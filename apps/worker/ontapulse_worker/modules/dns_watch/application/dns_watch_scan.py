"""Orchestration of one DNS_WATCH scan (ScanExecutor port implementation).

Order: host records, the DMARC tree walk (it also fixes the organizational domain), the CNAME chain,
SPF, then DKIM. Every query goes through one shared budget. Conditions caused by the target are
findings, never scan failures; the scan fails only when the monitor host cannot be resolved at all.
"""

import ipaddress
import logging
from urllib.parse import urlsplit
from uuid import UUID

from ontapulse_worker.modules.dns_watch.application.ports import DnsResolver, DnsWatchStore
from ontapulse_worker.modules.dns_watch.application.query_budget import (
    BudgetedResolver,
    BudgetExhaustedError,
    QueryBudget,
)
from ontapulse_worker.modules.dns_watch.domain.catalog import (
    MAX_CNAME_HOPS,
    MAX_DNS_QUERIES_PER_SCAN,
    REASON_BUDGET_EXHAUSTED,
    REASON_CONNECTION_FAILED,
    REASON_NOT_APPLICABLE,
    SUB_CHECK_DANGLING_CNAME,
    SUB_CHECK_DNS_RECORDS,
    SUB_CHECK_EMAIL_AUTH,
)
from ontapulse_worker.modules.dns_watch.domain.dkim import DKIM_SELECTORS, DkimKey, parse_dkim
from ontapulse_worker.modules.dns_watch.domain.dmarc import (
    DmarcRecord,
    DmarcSelection,
    parse_dmarc,
    select_dmarc,
    tree_walk_names,
)
from ontapulse_worker.modules.dns_watch.domain.findings import (
    SpfSummary,
    accepts_mail,
    change_findings,
    dangling_finding,
    dkim_findings,
    dmarc_findings,
    spf_findings,
)
from ontapulse_worker.modules.dns_watch.domain.models import (
    HOST_RECORD_TYPES,
    ORGANIZATION_RECORD_TYPES,
    AnswerStatus,
    DnsAnswer,
    RecordType,
    Snapshot,
)
from ontapulse_worker.modules.dns_watch.domain.normalize import normalize_name, normalize_values
from ontapulse_worker.modules.dns_watch.domain.snapshot import diff_snapshot, to_document
from ontapulse_worker.modules.dns_watch.domain.spf import (
    MAX_SPF_LOOKUPS,
    SpfRecord,
    is_spf_record,
    parse_spf,
)
from ontapulse_worker.modules.scans.domain.errors import ScanExecutionError
from ontapulse_worker.modules.scans.domain.models import (
    DnsOutcome,
    RecordChange,
    ScanFinding,
    ScanOptions,
    ScanResult,
    SubCheckResult,
    SubCheckState,
)

logger = logging.getLogger(__name__)

UNRESOLVABLE_MESSAGE = "The host name could not be resolved"
# One query per name that SPF has to follow; the RFC 7208 limit on counted lookups is the same
# number.
MAX_SPF_QUERIES = MAX_SPF_LOOKUPS

Records = dict[str, tuple[str, ...] | None]


def extract_host(target_url: str) -> str:
    """The monitor host as an ASCII (IDNA) name. A scan of an IP address has no DNS records to
    watch."""
    try:
        hostname = urlsplit(target_url).hostname
    except ValueError as error:
        raise ScanExecutionError("Scan target URL is invalid") from error

    if not hostname:
        raise ScanExecutionError("Scan target URL is invalid")

    try:
        ipaddress.ip_address(hostname)
    except ValueError:
        pass
    else:
        raise ScanExecutionError("DNS watch needs a host name, not an IP address")

    try:
        return hostname.rstrip(".").encode("idna").decode("ascii").lower()
    except UnicodeError as error:
        raise ScanExecutionError("Scan target URL is invalid") from error


def _skipped(name: str, reason: str) -> SubCheckResult:
    return SubCheckResult(name, SubCheckState.SKIPPED, reason)


def _known(answer: DnsAnswer, record_type: RecordType) -> tuple[str, ...] | None:
    """Normalized values, an empty tuple for "no such record", None when the query failed."""
    if answer.status is AnswerStatus.OK:
        return normalize_values(record_type, answer.values)

    if answer.status is AnswerStatus.TRANSIENT:
        return None

    return ()


class DnsWatchExecutor:
    def __init__(
        self,
        resolver: DnsResolver,
        store: DnsWatchStore,
        *,
        query_limit: int = MAX_DNS_QUERIES_PER_SCAN,
    ) -> None:
        self._resolver = resolver
        self._store = store
        self._query_limit = query_limit

    def execute(self, target_url: str, *, options: ScanOptions | None = None) -> ScanResult:
        host = extract_host(target_url)
        budget = QueryBudget(self._query_limit)
        dns = BudgetedResolver(self._resolver, budget)
        monitor_id = options.monitor_id if options else None

        host_records = self._host_records(dns, host)
        selection, walk_complete = self._dmarc_walk(dns, host)
        organization = selection.organization_domain
        organization_records = self._organization_records(dns, host, organization, host_records)

        findings: list[ScanFinding] = []
        sub_checks: list[SubCheckResult] = [
            SubCheckResult(SUB_CHECK_DNS_RECORDS, SubCheckState.RAN)
        ]

        findings.extend(self._dangling_check(dns, host, host_records, sub_checks))
        findings.extend(
            self._email_checks(
                dns, organization, selection, walk_complete, organization_records, sub_checks
            )
        )

        snapshot = Snapshot(host, host_records, organization, organization_records)
        previous = self._store.load_baseline(monitor_id) if monitor_id else None
        changes = diff_snapshot(previous, snapshot)

        if changes:
            findings.extend(change_findings(changes, self._cdn_fronted(monitor_id, changes)))

        logger.info(
            "dns.scan",
            extra={
                "queries": budget.used,
                "sub_checks": {item.name: item.state.value for item in sub_checks},
                "finding_count": len(findings),
                "baseline_existed": previous is not None,
                "change_count": len(changes),
            },
        )

        return ScanResult(
            status_code=None,
            response_time_ms=None,
            findings=tuple(findings),
            sub_checks=tuple(sub_checks),
            dns_outcome=DnsOutcome(
                host=host,
                organization_domain=organization,
                snapshot=to_document(snapshot, previous),
                changes=tuple(changes),
            ),
        )

    # -- records ---------------------------------------------------------------------------------

    def _host_records(self, dns: BudgetedResolver, host: str) -> Records:
        """The six record types of the host. The scan fails only if the host itself is
        unresolvable."""
        # CNAME first: a host with a CNAME exists even when the target does not (a dangling
        # CNAME makes
        # the address queries answer NXDOMAIN), so that case must not look like a missing host.
        cname = dns.query(host, RecordType.CNAME)

        if cname.status is AnswerStatus.NXDOMAIN:
            raise ScanExecutionError(UNRESOLVABLE_MESSAGE)

        has_cname = cname.status is AnswerStatus.OK
        records: Records = {RecordType.CNAME.value: _known(cname, RecordType.CNAME)}
        statuses = [cname.status]

        for record_type in HOST_RECORD_TYPES:
            if record_type is RecordType.CNAME:
                continue

            answer = dns.query(host, record_type)
            statuses.append(answer.status)

            if answer.status is AnswerStatus.NXDOMAIN and not has_cname:
                raise ScanExecutionError(UNRESOLVABLE_MESSAGE)

            records[record_type.value] = _known(answer, record_type)

        if all(status is AnswerStatus.TRANSIENT for status in statuses):
            raise ScanExecutionError(UNRESOLVABLE_MESSAGE)

        return records

    def _dmarc_walk(self, dns: BudgetedResolver, host: str) -> tuple[DmarcSelection, bool]:
        """Query `_dmarc.<name>` up the tree. Returns the selection and whether the walk was
        complete."""
        found: list[tuple[str, list[DmarcRecord]]] = []
        complete = True

        for name in tree_walk_names(host):
            try:
                answer = dns.query(f"_dmarc.{name}", RecordType.TXT)
            except BudgetExhaustedError:
                complete = False
                break

            if answer.status is AnswerStatus.TRANSIENT:
                complete = False
                continue

            records = [parse_dmarc(value) for value in answer.values]
            valid = [record for record in records if record is not None]

            if valid:
                found.append((name, valid))

        return select_dmarc(host, found), complete

    def _organization_records(
        self,
        dns: BudgetedResolver,
        host: str,
        organization: str,
        host_records: Records,
    ) -> Records:
        records: Records = {}

        for record_type in (*ORGANIZATION_RECORD_TYPES, RecordType.TXT):
            if organization == host:
                records[record_type.value] = host_records.get(record_type.value)
                continue

            try:
                records[record_type.value] = _known(
                    dns.query(organization, record_type), record_type
                )
            except BudgetExhaustedError:
                records[record_type.value] = None

        return records

    # -- dangling CNAME ----------------------------------------------------------------------------

    def _dangling_check(
        self,
        dns: BudgetedResolver,
        host: str,
        host_records: Records,
        sub_checks: list[SubCheckResult],
    ) -> list[ScanFinding]:
        cnames = host_records.get(RecordType.CNAME.value)

        if cnames is None:
            sub_checks.append(_skipped(SUB_CHECK_DANGLING_CNAME, REASON_CONNECTION_FAILED))
            return []

        if not cnames:
            sub_checks.append(_skipped(SUB_CHECK_DANGLING_CNAME, REASON_NOT_APPLICABLE))
            return []

        try:
            finding, complete = self._follow_chain(dns, host, cnames[0])
        except BudgetExhaustedError:
            sub_checks.append(_skipped(SUB_CHECK_DANGLING_CNAME, REASON_BUDGET_EXHAUSTED))
            return []

        if not complete:
            sub_checks.append(_skipped(SUB_CHECK_DANGLING_CNAME, REASON_CONNECTION_FAILED))
            return []

        sub_checks.append(SubCheckResult(SUB_CHECK_DANGLING_CNAME, SubCheckState.RAN))

        return [finding] if finding else []

    def _follow_chain(
        self, dns: BudgetedResolver, host: str, first_target: str
    ) -> tuple[ScanFinding | None, bool]:
        """Follow the chain by DNS answers only. Returns (finding or None, whether it was
        conclusive)."""
        chain = [host, first_target]
        current = first_target

        for _ in range(MAX_CNAME_HOPS):
            answer = dns.query(current, RecordType.CNAME)

            if answer.status is AnswerStatus.TRANSIENT:
                return None, False

            if answer.status is AnswerStatus.NXDOMAIN:
                return dangling_finding(chain, current, "nxdomain"), True

            if answer.status is AnswerStatus.OK and answer.values:
                current = normalize_name(answer.values[0])
                chain.append(current)
                continue

            return self._check_final_name(dns, chain, current)

        # Longer chains are not followed further; nothing was observed to be broken.
        return None, True

    def _check_final_name(
        self, dns: BudgetedResolver, chain: list[str], name: str
    ) -> tuple[ScanFinding | None, bool]:
        ipv4 = dns.query(name, RecordType.A)
        ipv6 = dns.query(name, RecordType.AAAA)
        answers = (ipv4, ipv6)

        if any(answer.status is AnswerStatus.TRANSIENT for answer in answers):
            return None, False

        if any(answer.status is AnswerStatus.NXDOMAIN for answer in answers):
            return dangling_finding(chain, name, "nxdomain"), True

        if all(answer.status is AnswerStatus.NODATA or not answer.values for answer in answers):
            return dangling_finding(chain, name, "no_address"), True

        return None, True

    # -- email authentication -------------------------------------------------------------------

    def _email_checks(
        self,
        dns: BudgetedResolver,
        organization: str,
        selection: DmarcSelection,
        walk_complete: bool,
        organization_records: Records,
        sub_checks: list[SubCheckResult],
    ) -> list[ScanFinding]:
        # Records the budget could not fetch would make every finding below a guess.
        if dns.exhausted:
            sub_checks.append(_skipped(SUB_CHECK_EMAIL_AUTH, REASON_BUDGET_EXHAUSTED))
            return []

        mx = organization_records.get(RecordType.MX.value)
        mail = accepts_mail(mx)
        findings: list[ScanFinding] = []

        try:
            # An incomplete walk could hide the real policy record, so no DMARC finding is made
            # from it.
            if walk_complete:
                findings.extend(dmarc_findings(selection, mail))

            txt = organization_records.get(RecordType.TXT.value)

            if txt is not None:
                summary = self._spf_summary(dns, txt)
                findings.extend(spf_findings(organization, summary, mail))
        except BudgetExhaustedError:
            sub_checks.append(_skipped(SUB_CHECK_EMAIL_AUTH, REASON_BUDGET_EXHAUSTED))
            return []

        findings.extend(dkim_findings(self._dkim_keys(dns, organization), mail))
        sub_checks.append(SubCheckResult(SUB_CHECK_EMAIL_AUTH, SubCheckState.RAN))

        return findings

    def _spf_summary(self, dns: BudgetedResolver, txt_values: tuple[str, ...]) -> SpfSummary:
        records = [value for value in txt_values if is_spf_record(value)]

        if len(records) != 1:
            return SpfSummary(len(records), None, False, 0)

        top = parse_spf(records[0])
        lookups = top.lookup_terms
        effective_all = top.all_qualifier
        pending = [*top.includes]
        redirect = top.redirect
        queries = 0
        seen: set[str] = set()

        # Include and redirect targets are followed only to count the lookups and find the final
        # `all`.
        while (pending or redirect) and lookups <= MAX_SPF_LOOKUPS and queries < MAX_SPF_QUERIES:
            from_redirect = not pending
            name = redirect if from_redirect else pending.pop(0)

            if from_redirect:
                redirect = None

            if not name or name in seen:
                continue

            seen.add(name)
            queries += 1
            nested = self._spf_record_at(dns, name)

            if nested is None:
                continue

            lookups += nested.lookup_terms
            pending.extend(nested.includes)

            if from_redirect:
                effective_all = nested.all_qualifier
                redirect = nested.redirect

        return SpfSummary(1, effective_all, top.has_ptr, lookups)

    @staticmethod
    def _spf_record_at(dns: BudgetedResolver, name: str) -> SpfRecord | None:
        answer = dns.query(name, RecordType.TXT)

        if answer.status is not AnswerStatus.OK:
            return None

        records = [value for value in answer.values if is_spf_record(value)]

        return parse_spf(records[0]) if len(records) == 1 else None

    @staticmethod
    def _dkim_keys(dns: BudgetedResolver, organization: str) -> list[tuple[str, DkimKey]]:
        """Best effort: a missing selector, or running out of budget, is never a finding."""
        keys: list[tuple[str, DkimKey]] = []

        for selector in DKIM_SELECTORS:
            try:
                answer = dns.query(f"{selector}._domainkey.{organization}", RecordType.TXT)
            except BudgetExhaustedError:
                break

            if answer.status is not AnswerStatus.OK:
                continue

            for value in answer.values:
                key = parse_dkim(value)

                if key is not None:
                    keys.append((selector, key))
                    break

        return keys

    # -- helpers --------------------------------------------------------------------------------

    def _cdn_fronted(self, monitor_id: UUID | None, changes: list[RecordChange]) -> bool:
        """Only asked when an address changed: behind a CDN that churn is normal."""
        touches_address = any(
            change.scope == "host" and change.record_type in ("A", "AAAA") for change in changes
        )

        return (
            monitor_id is not None and touches_address and self._store.has_cdn_detection(monitor_id)
        )
