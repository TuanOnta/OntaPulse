import json

import pytest

from ontapulse_worker.modules.dns_watch.domain.catalog import (
    CATALOG,
    MAX_EVIDENCE_BYTES,
    MAX_EVIDENCE_VALUE_CHARS,
    MAX_EVIDENCE_VALUES,
)
from ontapulse_worker.modules.dns_watch.domain.dkim import DkimKey
from ontapulse_worker.modules.dns_watch.domain.dmarc import DmarcSelection, parse_dmarc
from ontapulse_worker.modules.dns_watch.domain.findings import (
    SpfSummary,
    accepts_mail,
    change_findings,
    dangling_finding,
    dkim_findings,
    dmarc_findings,
    spf_findings,
)
from ontapulse_worker.modules.scans.domain.models import (
    FindingCategory,
    FindingConfidence,
    FindingSeverity,
    RecordChange,
)


def ids(findings) -> list[str]:
    return [finding.check_id for finding in findings]


def selection(policy_text: str | None, *, multiple=(), name="example.com") -> DmarcSelection:
    record = parse_dmarc(policy_text) if policy_text else None

    return DmarcSelection(
        organization_domain="example.com",
        policy_name=name if record else None,
        policy=record,
        multiple_names=tuple(multiple),
    )


def test_the_catalog_matches_the_documented_ids_severities_and_categories() -> None:
    expected = {
        "DNS_NS_CHANGED": ("DNS", "HIGH"),
        "DNS_CNAME_CHANGED": ("DNS", "MEDIUM"),
        "DNS_MX_CHANGED": ("DNS", "MEDIUM"),
        "DNS_TXT_CHANGED": ("DNS", "LOW"),
        "DNS_ADDRESS_CHANGED": ("DNS", "MEDIUM"),
        "DNS_ADDRESS_CHANGED_EDGE": ("DNS", "LOW"),
        "DNS_DANGLING_CNAME": ("DNS", "HIGH"),
        "EMAIL_SPF_MISSING": ("EMAIL_AUTH", "MEDIUM"),
        "EMAIL_SPF_MULTIPLE": ("EMAIL_AUTH", "HIGH"),
        "EMAIL_SPF_PERMISSIVE": ("EMAIL_AUTH", "HIGH"),
        "EMAIL_SPF_SOFTFAIL": ("EMAIL_AUTH", "LOW"),
        "EMAIL_SPF_TOO_MANY_LOOKUPS": ("EMAIL_AUTH", "MEDIUM"),
        "EMAIL_SPF_PTR": ("EMAIL_AUTH", "LOW"),
        "EMAIL_DMARC_MISSING": ("EMAIL_AUTH", "MEDIUM"),
        "EMAIL_DMARC_POLICY_NONE": ("EMAIL_AUTH", "LOW"),
        "EMAIL_DMARC_NO_REPORTING": ("EMAIL_AUTH", "LOW"),
        "EMAIL_DMARC_MULTIPLE": ("EMAIL_AUTH", "MEDIUM"),
        "EMAIL_DKIM_TESTING": ("EMAIL_AUTH", "LOW"),
        "EMAIL_DKIM_REVOKED": ("EMAIL_AUTH", "LOW"),
    }

    assert {k: (v.category.value, v.severity.value) for k, v in CATALOG.items()} == expected
    assert FindingCategory.DNS.value == "DNS"


class TestChangeFindings:
    def test_each_record_type_maps_to_its_check_id(self) -> None:
        changes = [
            RecordChange("host", "NS", ("n2",), ()),
            RecordChange("host", "CNAME", ("t",), ()),
            RecordChange("host", "MX", ("10 m",), ()),
            RecordChange("host", "TXT", ("x",), ()),
            RecordChange("host", "A", ("1.1.1.1",), ()),
        ]

        assert ids(change_findings(changes, cdn_fronted=False)) == [
            "DNS_NS_CHANGED",
            "DNS_CNAME_CHANGED",
            "DNS_MX_CHANGED",
            "DNS_TXT_CHANGED",
            "DNS_ADDRESS_CHANGED",
        ]

    def test_organization_ns_and_mx_changes_use_the_same_ids_in_one_finding(self) -> None:
        changes = [
            RecordChange("host", "NS", ("n2",), ()),
            RecordChange("organization", "NS", ("o2",), ()),
            RecordChange("organization", "MX", ("10 m",), ()),
        ]

        findings = change_findings(changes, cdn_fronted=False)

        assert ids(findings) == ["DNS_NS_CHANGED", "DNS_MX_CHANGED"]
        ns_scopes = [item["scope"] for item in findings[0].evidence["changes"]]
        assert ns_scopes == ["host", "organization"]

    def test_a_and_aaaa_changes_are_one_address_finding(self) -> None:
        changes = [
            RecordChange("host", "A", ("1.1.1.1",), ()),
            RecordChange("host", "AAAA", ("2001:db8::1",), ()),
        ]

        findings = change_findings(changes, cdn_fronted=False)

        assert ids(findings) == ["DNS_ADDRESS_CHANGED"]
        assert findings[0].confidence is FindingConfidence.MEDIUM
        assert findings[0].severity is FindingSeverity.MEDIUM
        assert len(findings[0].evidence["changes"]) == 2

    def test_behind_a_cdn_address_churn_is_low_and_informational(self) -> None:
        findings = change_findings([RecordChange("host", "A", ("1.1.1.1",), ())], cdn_fronted=True)

        assert ids(findings) == ["DNS_ADDRESS_CHANGED_EDGE"]
        assert findings[0].severity is FindingSeverity.LOW
        assert findings[0].confidence is FindingConfidence.LOW

    def test_a_cdn_does_not_soften_other_changes(self) -> None:
        findings = change_findings(
            [RecordChange("host", "NS", ("n",), ()), RecordChange("host", "A", ("1.1.1.1",), ())],
            cdn_fronted=True,
        )

        assert ids(findings) == ["DNS_NS_CHANGED", "DNS_ADDRESS_CHANGED_EDGE"]

    def test_organization_types_without_a_check_id_are_ignored(self) -> None:
        assert change_findings([RecordChange("organization", "A", ("1.1.1.1",), ())], False) == []

    def test_evidence_holds_the_type_and_the_added_and_removed_values_only(self) -> None:
        findings = change_findings(
            [RecordChange("host", "TXT", ("new",), ("old",))], cdn_fronted=False
        )

        assert findings[0].evidence == {
            "changes": [{"scope": "host", "type": "TXT", "added": ["new"], "removed": ["old"]}]
        }

    def test_evidence_values_are_capped_in_number_and_length(self) -> None:
        many = tuple(f"v{index:02d}" for index in range(40))
        long = ("x" * 1000,)

        evidence = change_findings([RecordChange("host", "TXT", many, long)], cdn_fronted=False)[
            0
        ].evidence

        item = evidence["changes"][0]
        assert len(item["added"]) == MAX_EVIDENCE_VALUES
        assert len(item["removed"][0]) == MAX_EVIDENCE_VALUE_CHARS

    def test_one_large_change_is_trimmed_to_fit_and_never_dropped(self) -> None:
        many = tuple(f"v{index}-" + "x" * 400 for index in range(40))

        evidence = change_findings([RecordChange("host", "TXT", many, many)], cdn_fronted=False)[
            0
        ].evidence

        assert len(evidence["changes"]) == 1
        assert 1 <= len(evidence["changes"][0]["added"]) <= MAX_EVIDENCE_VALUES
        assert len(json.dumps(evidence).encode()) <= MAX_EVIDENCE_BYTES

    def test_many_large_changes_stay_within_the_total_size(self) -> None:
        many = tuple(f"v{index}-" + "x" * 400 for index in range(40))
        changes = [RecordChange("host", "TXT", many, many)] * 12

        evidence = change_findings(changes, cdn_fronted=False)[0].evidence

        assert evidence["changes"]
        assert len(json.dumps(evidence).encode()) <= MAX_EVIDENCE_BYTES


def test_a_dangling_finding_carries_the_chain_the_name_and_the_reason() -> None:
    finding = dangling_finding(
        ["www.example.com", "gone.example.net"], "gone.example.net", "nxdomain"
    )

    assert finding.check_id == "DNS_DANGLING_CNAME"
    assert finding.severity is FindingSeverity.HIGH
    assert finding.confidence is FindingConfidence.MEDIUM
    assert finding.evidence == {
        "chain": ["www.example.com", "gone.example.net"],
        "name": "gone.example.net",
        "reason": "nxdomain",
    }


@pytest.mark.parametrize(
    ("mx", "expected"),
    [
        (("10 mail.example.com",), True),
        (("0 .", "10 mail.example.com"), True),
        (("0 .",), False),
        ((), False),
        (None, False),
    ],
)
def test_a_domain_accepts_mail_unless_it_has_no_mx_or_only_the_null_mx(mx, expected) -> None:
    assert accepts_mail(mx) is expected


class TestSpfFindings:
    def test_missing_is_reported_only_when_the_domain_accepts_mail(self) -> None:
        none = SpfSummary(0, None, False, 0)

        assert ids(spf_findings("example.com", none, mail=True)) == ["EMAIL_SPF_MISSING"]
        assert spf_findings("example.com", none, mail=False) == []

    def test_several_records_are_one_permanent_error_and_nothing_else(self) -> None:
        assert ids(spf_findings("example.com", SpfSummary(2, "+", True, 20), mail=True)) == [
            "EMAIL_SPF_MULTIPLE"
        ]

    @pytest.mark.parametrize(
        ("summary", "expected"),
        [
            (SpfSummary(1, "-", False, 3), []),
            (SpfSummary(1, "?", False, 3), []),
            (SpfSummary(1, None, False, 3), []),
            (SpfSummary(1, "+", False, 3), ["EMAIL_SPF_PERMISSIVE"]),
            (SpfSummary(1, "~", False, 3), ["EMAIL_SPF_SOFTFAIL"]),
            (SpfSummary(1, "-", True, 3), ["EMAIL_SPF_PTR"]),
            (SpfSummary(1, "-", False, 10), []),
            (SpfSummary(1, "-", False, 11), ["EMAIL_SPF_TOO_MANY_LOOKUPS"]),
            (
                SpfSummary(1, "+", True, 12),
                ["EMAIL_SPF_PERMISSIVE", "EMAIL_SPF_PTR", "EMAIL_SPF_TOO_MANY_LOOKUPS"],
            ),
        ],
    )
    def test_findings_follow_the_all_qualifier_ptr_and_the_lookup_count(
        self, summary, expected
    ) -> None:
        assert ids(spf_findings("example.com", summary, mail=True)) == expected

    def test_softfail_is_low_confidence_and_too_many_lookups_is_medium(self) -> None:
        soft = spf_findings("example.com", SpfSummary(1, "~", False, 1), mail=True)[0]
        many = spf_findings("example.com", SpfSummary(1, "-", False, 12), mail=True)[0]

        assert soft.confidence is FindingConfidence.LOW
        assert many.confidence is FindingConfidence.MEDIUM
        assert many.evidence == {"domain": "example.com", "lookups": 12, "limit": 10}


class TestDmarcFindings:
    def test_missing_is_reported_only_when_the_domain_accepts_mail(self) -> None:
        assert ids(dmarc_findings(selection(None), mail=True)) == ["EMAIL_DMARC_MISSING"]
        assert dmarc_findings(selection(None), mail=False) == []

    def test_a_none_policy_without_reporting_gives_both_findings(self) -> None:
        findings = dmarc_findings(selection("v=DMARC1; p=none"), mail=True)

        assert ids(findings) == ["EMAIL_DMARC_POLICY_NONE", "EMAIL_DMARC_NO_REPORTING"]
        assert findings[0].evidence == {"domain": "example.com", "policy": "none"}

    def test_a_missing_p_is_treated_as_none(self) -> None:
        assert ids(dmarc_findings(selection("v=DMARC1; rua=mailto:a@b.c"), mail=True)) == [
            "EMAIL_DMARC_POLICY_NONE"
        ]

    def test_an_enforcing_policy_with_reporting_is_clean(self) -> None:
        assert dmarc_findings(selection("v=DMARC1; p=reject; rua=mailto:a@b.c"), mail=True) == []
        assert (
            dmarc_findings(selection("v=DMARC1; p=quarantine; rua=mailto:a@b.c"), mail=True) == []
        )

    def test_several_records_are_reported_and_do_not_also_count_as_missing(self) -> None:
        findings = dmarc_findings(selection(None, multiple=("example.com",)), mail=True)

        assert ids(findings) == ["EMAIL_DMARC_MULTIPLE"]
        assert findings[0].evidence == {"names": ["example.com"]}

    def test_a_usable_record_elsewhere_still_reports_the_multiple_names(self) -> None:
        findings = dmarc_findings(
            selection("v=DMARC1; p=reject; rua=mailto:a@b.c", multiple=("www.example.com",)),
            mail=True,
        )

        assert ids(findings) == ["EMAIL_DMARC_MULTIPLE"]


def test_dkim_testing_and_revoked_keys_are_low_confidence_findings() -> None:
    findings = dkim_findings(
        [
            ("google", DkimKey(testing=True, revoked=False)),
            ("s1", DkimKey(testing=False, revoked=True)),
            ("s2", DkimKey(testing=False, revoked=False)),
        ],
        mail=True,
    )

    assert ids(findings) == ["EMAIL_DKIM_TESTING", "EMAIL_DKIM_REVOKED"]
    assert [item.evidence for item in findings] == [{"selector": "google"}, {"selector": "s1"}]
    assert all(item.confidence is FindingConfidence.LOW for item in findings)


def test_no_discovered_selector_is_never_a_finding() -> None:
    assert dkim_findings([], mail=True) == []


def test_a_revoked_key_is_silent_for_a_domain_that_sends_no_mail() -> None:
    keys = [("google", DkimKey(False, True)), ("s1", DkimKey(True, True))]

    findings = dkim_findings(keys, mail=False)

    # A wildcard revoked key is the usual way to say "no mail"; testing mode is still reported.
    assert ids(findings) == ["EMAIL_DKIM_TESTING"]
