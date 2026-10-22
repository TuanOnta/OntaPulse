"""dnspython implementation of the DnsResolver port.

The resolver never reads the operating system configuration (`configure=False`): the nameservers are
exactly the configured public addresses, so an internal resolver can never be used. dnspython
tries the
next nameserver on failure and retries over TCP when an answer is truncated. No DoH.
"""

import dns.exception
import dns.name
import dns.resolver
import dns.rrset

from ontapulse_worker.modules.dns_watch.domain.catalog import (
    DNS_QUERY_LIFETIME_SECONDS,
    DNS_SERVER_TIMEOUT_SECONDS,
)
from ontapulse_worker.modules.dns_watch.domain.models import AnswerStatus, DnsAnswer, RecordType


def _text(record_type: RecordType, rdata: object) -> str:
    """One record value as text. Only the fields of the asked type are read."""
    if record_type in (RecordType.A, RecordType.AAAA):
        return str(rdata.address)  # type: ignore[attr-defined]

    if record_type in (RecordType.CNAME, RecordType.NS):
        return rdata.target.to_text()  # type: ignore[attr-defined]

    if record_type is RecordType.MX:
        return f"{rdata.preference} {rdata.exchange.to_text()}"  # type: ignore[attr-defined]

    strings: tuple[bytes, ...] = rdata.strings  # type: ignore[attr-defined]

    return b"".join(strings).decode("utf-8", errors="replace")


class DnspythonResolver:
    def __init__(
        self,
        nameservers: tuple[str, ...],
        *,
        timeout: float = DNS_SERVER_TIMEOUT_SECONDS,
        lifetime: float = DNS_QUERY_LIFETIME_SECONDS,
        resolver: dns.resolver.Resolver | None = None,
    ) -> None:
        if resolver is None:
            resolver = dns.resolver.Resolver(configure=False)
            resolver.nameservers = list(nameservers)
            resolver.timeout = timeout
            resolver.lifetime = lifetime

        self._resolver = resolver

    def query(self, name: str, record_type: RecordType) -> DnsAnswer:
        try:
            answer = self._resolver.resolve(name, record_type.value, search=False)
        except dns.resolver.NXDOMAIN:
            return DnsAnswer(AnswerStatus.NXDOMAIN)
        except dns.resolver.NoAnswer:
            return DnsAnswer(AnswerStatus.NODATA)
        except (dns.name.NameTooLong, dns.name.LabelTooLong, dns.name.EmptyLabel):
            # A name that cannot exist in DNS has no records.
            return DnsAnswer(AnswerStatus.NODATA)
        except dns.exception.DNSException:
            # Timeout, SERVFAIL (NoNameservers), or any other failure: no statement can be made.
            return DnsAnswer(AnswerStatus.TRANSIENT)

        rrset = answer.rrset

        if rrset is None:
            return DnsAnswer(AnswerStatus.NODATA)

        return DnsAnswer(AnswerStatus.OK, tuple(_text(record_type, rdata) for rdata in rrset))
