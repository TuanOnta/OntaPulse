from uuid import UUID

import pytest

from ontapulse_worker.modules.dns_watch.application.dns_watch_scan import (
    DnsWatchExecutor,
    extract_host,
)
from ontapulse_worker.modules.dns_watch.domain.catalog import MAX_DNS_QUERIES_PER_SCAN
from ontapulse_worker.modules.dns_watch.domain.models import AnswerStatus, DnsAnswer, RecordType
from ontapulse_worker.modules.scans.domain.errors import ScanExecutionError
from ontapulse_worker.modules.scans.domain.models import ScanOptions

MONITOR_ID = UUID("3edca2bb-c92c-4ac8-a5ed-75630416f604")
OPTIONS = ScanOptions(monitor_id=MONITOR_ID)
NODATA = DnsAnswer(AnswerStatus.NODATA)
NXDOMAIN = DnsAnswer(AnswerStatus.NXDOMAIN)
TRANSIENT = DnsAnswer(AnswerStatus.TRANSIENT)


def ok(*values: str) -> DnsAnswer:
    return DnsAnswer(AnswerStatus.OK, tuple(values))


class FakeResolver:
    """Answers from a table; anything not listed is NODATA. `default` overrides that."""

    def __init__(self, answers=None, default: DnsAnswer = NODATA) -> None:
        self.answers = dict(answers or {})
        self.default = default
        self.calls: list[tuple[str, str]] = []

    def query(self, name: str, record_type: RecordType) -> DnsAnswer:
        self.calls.append((name, record_type.value))

        return self.answers.get((name, record_type.value), self.default)


class FakeStore:
    def __init__(self, baseline=None, cdn: bool = False) -> None:
        self.baseline = baseline
        self.cdn = cdn
        self.loaded: list[UUID] = []
        self.cdn_asked = 0

    def load_baseline(self, monitor_id):
        self.loaded.append(monitor_id)
        return self.baseline

    def has_cdn_detection(self, monitor_id) -> bool:
        self.cdn_asked += 1
        return self.cdn


def world(extra=None):
    """A healthy www.example.com with mail, SPF, and a DMARC record on the organizational domain."""
    answers = {
        ("www.example.com", "A"): ok("93.184.216.34"),
        ("www.example.com", "AAAA"): ok("2606:2800:220:1::1"),
        ("example.com", "NS"): ok("a.iana-servers.net.", "b.iana-servers.net."),
        ("example.com", "MX"): ok("10 mail.example.com."),
        ("example.com", "TXT"): ok("v=spf1 -all", "google-site-verification=abc"),
        ("_dmarc.example.com", "TXT"): ok("v=DMARC1; p=reject; rua=mailto:d@example.com"),
    }
    answers.update(extra or {})

    return answers


def run(answers, store=None, *, options=OPTIONS, url="https://www.example.com/path", limit=None):
    resolver = FakeResolver(answers)
    kwargs = {} if limit is None else {"query_limit": limit}
    executor = DnsWatchExecutor(resolver, store or FakeStore(), **kwargs)

    return executor.execute(url, options=options), resolver


def finding_ids(result) -> list[str]:
    return [finding.check_id for finding in result.findings]


def states(result) -> dict[str, tuple[str, str | None]]:
    return {item.name: (item.state.value, item.reason) for item in result.sub_checks}


class TestHost:
    @pytest.mark.parametrize(
        ("url", "host"),
        [
            ("https://www.example.com/path?x=1", "www.example.com"),
            ("http://WWW.Example.COM:8080", "www.example.com"),
            ("https://www.example.com./", "www.example.com"),
            ("https://bücher.example/", "xn--bcher-kva.example"),
        ],
    )
    def test_the_host_is_lowercased_and_idna_encoded(self, url: str, host: str) -> None:
        assert extract_host(url) == host

    @pytest.mark.parametrize(
        "url",
        ["not a url", "https:///path", "https://[::1]/", "https://93.184.216.34/", "https://a..b/"],
    )
    def test_an_address_or_an_invalid_target_is_rejected(self, url: str) -> None:
        with pytest.raises(ScanExecutionError):
            extract_host(url)


class TestFirstScan:
    def test_the_first_scan_stores_a_baseline_and_makes_no_change_finding(self) -> None:
        result, _ = run(world())

        assert [f for f in finding_ids(result) if f.startswith("DNS_")] == []
        assert result.status_code is None
        assert result.dns_outcome is not None
        assert result.dns_outcome.changes == ()
        assert result.dns_outcome.host == "www.example.com"
        assert result.dns_outcome.organization_domain == "example.com"

    def test_the_snapshot_is_normalized_and_has_the_documented_shape(self) -> None:
        result, _ = run(world())

        assert result.dns_outcome.snapshot == {
            "host": {
                "name": "www.example.com",
                "A": ["93.184.216.34"],
                "AAAA": ["2606:2800:220:1::1"],
                "CNAME": [],
                "NS": [],
                "MX": [],
                "TXT": [],
            },
            "organization": {
                "name": "example.com",
                "NS": ["a.iana-servers.net", "b.iana-servers.net"],
                "MX": ["10 mail.example.com"],
            },
        }

    def test_all_three_sub_checks_ran_or_say_why_not(self) -> None:
        result, _ = run(world())

        assert states(result) == {
            "dns_records": ("ran", None),
            "dangling_cname": ("skipped", "not_applicable"),
            "email_auth": ("ran", None),
        }

    def test_a_healthy_domain_has_no_finding_at_all(self) -> None:
        result, _ = run(world())

        assert result.findings == ()

    def test_no_baseline_is_read_without_a_monitor_id(self) -> None:
        store = FakeStore(baseline={"host": {}})

        result, _ = run(world(), store, options=ScanOptions())

        assert store.loaded == []
        assert result.dns_outcome.changes == ()

    def test_the_baseline_is_read_for_the_monitor(self) -> None:
        store = FakeStore()

        run(world(), store)

        assert store.loaded == [MONITOR_ID]


BASELINE = {
    "host": {
        "name": "www.example.com",
        "A": ["93.184.216.34"],
        "AAAA": ["2606:2800:220:1::1"],
        "CNAME": [],
        "NS": [],
        "MX": [],
        "TXT": [],
    },
    "organization": {
        "name": "example.com",
        "NS": ["a.iana-servers.net", "b.iana-servers.net"],
        "MX": ["10 mail.example.com"],
    },
}


class TestChanges:
    def test_an_unchanged_second_scan_has_no_change_and_no_finding(self) -> None:
        result, _ = run(world(), FakeStore(BASELINE))

        assert result.dns_outcome.changes == ()
        assert [f for f in finding_ids(result) if f.startswith("DNS_")] == []

    def test_a_changed_address_gives_one_finding_and_one_recorded_change(self) -> None:
        store = FakeStore(BASELINE)

        result, _ = run(world({("www.example.com", "A"): ok("93.184.216.99")}), store)

        assert finding_ids(result) == ["DNS_ADDRESS_CHANGED"]
        assert [
            (c.scope, c.record_type, c.added, c.removed) for c in result.dns_outcome.changes
        ] == [("host", "A", ("93.184.216.99",), ("93.184.216.34",))]
        # The new snapshot becomes the baseline.
        assert result.dns_outcome.snapshot["host"]["A"] == ["93.184.216.99"]
        assert store.cdn_asked == 1

    def test_behind_a_cdn_the_same_change_is_the_low_edge_finding(self) -> None:
        result, _ = run(
            world({("www.example.com", "A"): ok("93.184.216.99")}), FakeStore(BASELINE, cdn=True)
        )

        assert finding_ids(result) == ["DNS_ADDRESS_CHANGED_EDGE"]

    def test_the_cdn_is_only_asked_when_an_address_changed(self) -> None:
        store = FakeStore(BASELINE)

        run(world({("example.com", "NS"): ok("c.example.net.")}), store)

        assert store.cdn_asked == 0

    def test_a_changed_ns_set_is_a_high_finding_from_the_organizational_domain(self) -> None:
        result, _ = run(world({("example.com", "NS"): ok("c.example.net.")}), FakeStore(BASELINE))

        assert finding_ids(result) == ["DNS_NS_CHANGED"]
        assert result.findings[0].severity.value == "HIGH"

    def test_a_changed_txt_record_is_reported_as_txt(self) -> None:
        result, _ = run(world({("www.example.com", "TXT"): ok("token=1")}), FakeStore(BASELINE))

        assert finding_ids(result) == ["DNS_TXT_CHANGED"]

    def test_a_failed_query_makes_no_finding_and_keeps_the_baseline_value(self) -> None:
        result, _ = run(
            world({("www.example.com", "A"): TRANSIENT, ("example.com", "NS"): TRANSIENT}),
            FakeStore(BASELINE),
        )

        assert result.dns_outcome.changes == ()
        assert result.dns_outcome.snapshot["host"]["A"] == ["93.184.216.34"]
        assert result.dns_outcome.snapshot["organization"]["NS"] == [
            "a.iana-servers.net",
            "b.iana-servers.net",
        ]
        assert states(result)["dns_records"] == ("ran", None)

    def test_a_removed_record_is_a_change(self) -> None:
        result, _ = run(world({("www.example.com", "AAAA"): NODATA}), FakeStore(BASELINE))

        assert finding_ids(result) == ["DNS_ADDRESS_CHANGED"]
        change = result.dns_outcome.changes[0]
        assert (change.record_type, change.added, change.removed) == (
            "AAAA",
            (),
            ("2606:2800:220:1::1",),
        )


class TestUnresolvableHost:
    def test_a_host_that_does_not_exist_fails_the_scan_with_a_generic_message(self) -> None:
        answers = {("www.example.com", "CNAME"): NXDOMAIN}

        with pytest.raises(ScanExecutionError) as error:
            run(answers)

        assert error.value.safe_message == "The host name could not be resolved"

    def test_nxdomain_on_another_type_also_means_a_missing_host(self) -> None:
        with pytest.raises(ScanExecutionError):
            run({("www.example.com", "A"): NXDOMAIN})

    def test_every_resolver_being_unreachable_fails_the_scan(self) -> None:
        resolver = FakeResolver(default=TRANSIENT)

        with pytest.raises(ScanExecutionError):
            DnsWatchExecutor(resolver, FakeStore()).execute(
                "https://www.example.com", options=OPTIONS
            )

    def test_one_failing_type_does_not_fail_the_scan(self) -> None:
        result, _ = run(world({("www.example.com", "MX"): TRANSIENT}))

        assert result.dns_outcome.snapshot["host"]["MX"] == []
        assert states(result)["dns_records"] == ("ran", None)


class TestDanglingCname:
    def chain(self, *, target_cname=NODATA, a=NODATA, aaaa=NODATA):
        return world(
            {
                ("www.example.com", "CNAME"): ok("shop.example.net."),
                ("www.example.com", "A"): NXDOMAIN,
                ("www.example.com", "AAAA"): NXDOMAIN,
                ("shop.example.net", "CNAME"): target_cname,
                ("shop.example.net", "A"): a,
                ("shop.example.net", "AAAA"): aaaa,
            }
        )

    def test_a_dangling_target_does_not_make_the_host_look_missing(self) -> None:
        result, _ = run(self.chain(target_cname=NXDOMAIN))

        assert "DNS_DANGLING_CNAME" in finding_ids(result)
        assert states(result)["dns_records"] == ("ran", None)

    def test_a_target_that_does_not_exist_is_a_high_finding_with_the_chain(self) -> None:
        result, _ = run(self.chain(target_cname=NXDOMAIN))

        finding = next(f for f in result.findings if f.check_id == "DNS_DANGLING_CNAME")
        assert finding.severity.value == "HIGH"
        assert finding.confidence.value == "MEDIUM"
        assert finding.evidence == {
            "chain": ["www.example.com", "shop.example.net"],
            "name": "shop.example.net",
            "reason": "nxdomain",
        }
        assert states(result)["dangling_cname"] == ("ran", None)

    def test_a_final_name_without_any_address_is_dangling(self) -> None:
        result, _ = run(self.chain())

        finding = next(f for f in result.findings if f.check_id == "DNS_DANGLING_CNAME")
        assert finding.evidence["reason"] == "no_address"

    def test_a_final_name_with_an_address_is_not_dangling(self) -> None:
        result, _ = run(self.chain(a=ok("203.0.113.5")))

        assert "DNS_DANGLING_CNAME" not in finding_ids(result)
        assert states(result)["dangling_cname"] == ("ran", None)

    def test_an_ipv6_only_target_is_not_dangling(self) -> None:
        result, _ = run(self.chain(aaaa=ok("2001:db8::5")))

        assert "DNS_DANGLING_CNAME" not in finding_ids(result)

    def test_the_chain_is_followed_through_several_hops(self) -> None:
        answers = world(
            {
                ("www.example.com", "CNAME"): ok("a.example.net."),
                ("www.example.com", "A"): NXDOMAIN,
                ("www.example.com", "AAAA"): NXDOMAIN,
                ("a.example.net", "CNAME"): ok("b.example.net."),
                ("b.example.net", "CNAME"): ok("c.example.net."),
                ("c.example.net", "CNAME"): NXDOMAIN,
            }
        )

        result, _ = run(answers)

        finding = next(f for f in result.findings if f.check_id == "DNS_DANGLING_CNAME")
        assert finding.evidence["chain"] == [
            "www.example.com",
            "a.example.net",
            "b.example.net",
            "c.example.net",
        ]
        assert finding.evidence["name"] == "c.example.net"

    def test_a_transient_error_in_the_chain_is_skipped_not_a_finding(self) -> None:
        result, _ = run(self.chain(target_cname=TRANSIENT))

        assert "DNS_DANGLING_CNAME" not in finding_ids(result)
        assert states(result)["dangling_cname"] == ("skipped", "connection_failed")

    def test_a_transient_error_on_the_final_addresses_is_skipped(self) -> None:
        result, _ = run(self.chain(a=TRANSIENT))

        assert states(result)["dangling_cname"] == ("skipped", "connection_failed")

    def test_an_unknown_cname_answer_for_the_host_is_skipped(self) -> None:
        result, _ = run(world({("www.example.com", "CNAME"): TRANSIENT}))

        assert states(result)["dangling_cname"] == ("skipped", "connection_failed")

    def test_an_endless_chain_stops_after_eight_hops_without_a_finding(self) -> None:
        answers = world(
            {
                ("www.example.com", "CNAME"): ok("h0.example.net."),
                ("www.example.com", "A"): NXDOMAIN,
                ("www.example.com", "AAAA"): NXDOMAIN,
            }
        )
        answers.update(
            {(f"h{i}.example.net", "CNAME"): ok(f"h{i + 1}.example.net.") for i in range(30)}
        )

        result, resolver = run(answers)

        hops = [call for call in resolver.calls if call[1] == "CNAME" and call[0].startswith("h")]
        assert len(hops) == 8
        assert "DNS_DANGLING_CNAME" not in finding_ids(result)


class TestOrganizationalDomain:
    def test_the_dmarc_record_found_by_the_tree_walk_fixes_the_organizational_domain(self) -> None:
        result, resolver = run(world())

        assert result.dns_outcome.organization_domain == "example.com"
        walked = [name for name, kind in resolver.calls if name.startswith("_dmarc.")]
        assert walked == ["_dmarc.www.example.com", "_dmarc.example.com"]

    def test_without_a_dmarc_record_the_last_two_labels_are_used(self) -> None:
        answers = world()
        del answers[("_dmarc.example.com", "TXT")]

        result, _ = run(answers)

        assert result.dns_outcome.organization_domain == "example.com"

    def test_a_multi_label_suffix_yields_the_suffix_and_stays_silent_without_mx(self) -> None:
        answers = {
            ("shop.example.co.uk", "A"): ok("93.184.216.34"),
        }

        result, resolver = run(answers, url="https://shop.example.co.uk")

        assert result.dns_outcome.organization_domain == "co.uk"
        assert [f for f in finding_ids(result) if f.startswith("EMAIL_")] == []
        # The walk never queries a top-level label on its own.
        assert not any(name == "_dmarc.uk" for name, _ in resolver.calls)

    def test_a_host_that_is_the_organizational_domain_reuses_its_records(self) -> None:
        answers = {
            ("example.com", "A"): ok("93.184.216.34"),
            ("example.com", "MX"): ok("10 mail.example.com."),
            ("example.com", "NS"): ok("a.iana-servers.net."),
            ("example.com", "TXT"): ok("v=spf1 -all"),
            ("_dmarc.example.com", "TXT"): ok("v=DMARC1; p=reject; rua=mailto:a@b.c"),
        }

        result, resolver = run(answers, url="https://example.com")

        assert result.dns_outcome.snapshot["organization"]["MX"] == ["10 mail.example.com"]
        assert resolver.calls.count(("example.com", "MX")) == 1
        assert resolver.calls.count(("example.com", "TXT")) == 1


class TestDmarc:
    def test_a_missing_record_is_reported_when_the_domain_accepts_mail(self) -> None:
        answers = world()
        del answers[("_dmarc.example.com", "TXT")]

        result, _ = run(answers)

        assert finding_ids(result) == ["EMAIL_DMARC_MISSING"]

    def test_a_missing_record_is_silent_without_mx_or_with_a_null_mx(self) -> None:
        for mx in (NODATA, ok("0 .")):
            answers = world({("example.com", "MX"): mx})
            del answers[("_dmarc.example.com", "TXT")]

            result, _ = run(answers)

            assert [f for f in finding_ids(result) if f.startswith("EMAIL_DMARC")] == []

    def test_policy_none_without_reporting_gives_two_low_findings(self) -> None:
        result, _ = run(world({("_dmarc.example.com", "TXT"): ok("v=DMARC1; p=none")}))

        assert finding_ids(result) == ["EMAIL_DMARC_POLICY_NONE", "EMAIL_DMARC_NO_REPORTING"]

    def test_several_records_are_reported(self) -> None:
        result, _ = run(
            world({("_dmarc.example.com", "TXT"): ok("v=DMARC1; p=none", "v=DMARC1; p=reject")})
        )

        assert finding_ids(result) == ["EMAIL_DMARC_MULTIPLE"]

    def test_an_incomplete_walk_makes_no_dmarc_finding(self) -> None:
        answers = world({("_dmarc.example.com", "TXT"): TRANSIENT})

        result, _ = run(answers)

        assert [f for f in finding_ids(result) if f.startswith("EMAIL_DMARC")] == []

    def test_a_txt_record_that_is_not_dmarc_is_ignored(self) -> None:
        answers = world({("_dmarc.example.com", "TXT"): ok("some token", "v=spf1 -all")})

        result, _ = run(answers)

        assert finding_ids(result) == ["EMAIL_DMARC_MISSING"]


class TestSpf:
    def test_missing_with_mail_is_reported(self) -> None:
        result, _ = run(world({("example.com", "TXT"): ok("google-site-verification=abc")}))

        assert finding_ids(result) == ["EMAIL_SPF_MISSING"]

    def test_missing_without_mail_is_silent(self) -> None:
        answers = world({("example.com", "MX"): NODATA, ("example.com", "TXT"): NODATA})

        result, _ = run(answers)

        assert [f for f in finding_ids(result) if f.startswith("EMAIL_SPF")] == []

    @pytest.mark.parametrize(
        ("record", "expected"),
        [
            ("v=spf1 +all", ["EMAIL_SPF_PERMISSIVE"]),
            ("v=spf1 all", ["EMAIL_SPF_PERMISSIVE"]),
            ("v=spf1 mx ~all", ["EMAIL_SPF_SOFTFAIL"]),
            ("v=spf1 ptr -all", ["EMAIL_SPF_PTR"]),
            ("v=spf1 mx -all", []),
        ],
    )
    def test_the_own_record_gives_the_all_and_ptr_findings(self, record, expected) -> None:
        result, _ = run(world({("example.com", "TXT"): ok(record)}))

        assert [f for f in finding_ids(result) if f.startswith("EMAIL_SPF")] == expected

    def test_two_spf_records_are_one_permanent_error(self) -> None:
        result, _ = run(world({("example.com", "TXT"): ok("v=spf1 -all", "v=spf1 +all")}))

        assert finding_ids(result) == ["EMAIL_SPF_MULTIPLE"]

    def test_includes_are_followed_and_counted(self) -> None:
        answers = world(
            {
                ("example.com", "TXT"): ok(
                    "v=spf1 include:a.example.net include:b.example.net -all"
                ),
                ("a.example.net", "TXT"): ok("v=spf1 a mx include:c.example.net -all"),
                ("b.example.net", "TXT"): ok("v=spf1 a a a a a a a -all"),
                ("c.example.net", "TXT"): ok("v=spf1 ip4:1.2.3.4 -all"),
            }
        )

        result, _ = run(answers)

        finding = next(f for f in result.findings if f.check_id == "EMAIL_SPF_TOO_MANY_LOOKUPS")
        # 2 includes + (a, mx, include) + 7 a terms + 0 = 12
        assert finding.evidence["lookups"] == 12

    def test_ten_lookups_are_still_fine(self) -> None:
        answers = world(
            {
                ("example.com", "TXT"): ok("v=spf1 include:a.example.net -all"),
                ("a.example.net", "TXT"): ok("v=spf1 a a a a a a a a a -all"),
            }
        )

        result, _ = run(answers)

        assert "EMAIL_SPF_TOO_MANY_LOOKUPS" not in finding_ids(result)

    def test_a_redirect_supplies_the_final_all_qualifier(self) -> None:
        answers = world(
            {
                ("example.com", "TXT"): ok("v=spf1 redirect=_spf.example.net"),
                ("_spf.example.net", "TXT"): ok("v=spf1 mx +all"),
            }
        )

        result, _ = run(answers)

        assert finding_ids(result) == ["EMAIL_SPF_PERMISSIVE"]

    def test_a_circular_include_does_not_loop(self) -> None:
        answers = world(
            {
                ("example.com", "TXT"): ok("v=spf1 include:a.example.net -all"),
                ("a.example.net", "TXT"): ok(
                    "v=spf1 include:a.example.net include:example.com -all"
                ),
            }
        )

        _, resolver = run(answers)

        assert resolver.calls.count(("a.example.net", "TXT")) == 1

    def test_an_unresolvable_include_does_not_fail_the_scan(self) -> None:
        answers = world(
            {
                ("example.com", "TXT"): ok("v=spf1 include:gone.example.net -all"),
                ("gone.example.net", "TXT"): NXDOMAIN,
            }
        )

        result, _ = run(answers)

        assert states(result)["email_auth"] == ("ran", None)
        assert [f for f in finding_ids(result) if f.startswith("EMAIL_SPF")] == []

    def test_an_unknown_txt_answer_makes_no_spf_finding(self) -> None:
        result, _ = run(world({("example.com", "TXT"): TRANSIENT}))

        assert [f for f in finding_ids(result) if f.startswith("EMAIL_SPF")] == []


class TestDkim:
    def test_a_selector_in_testing_mode_is_a_low_confidence_finding(self) -> None:
        result, _ = run(
            world({("google._domainkey.example.com", "TXT"): ok("v=DKIM1; k=rsa; t=y; p=MIIB")})
        )

        assert finding_ids(result) == ["EMAIL_DKIM_TESTING"]
        assert result.findings[0].evidence == {"selector": "google"}
        assert result.findings[0].confidence.value == "LOW"

    def test_a_revoked_selector_is_reported(self) -> None:
        result, _ = run(world({("selector1._domainkey.example.com", "TXT"): ok("v=DKIM1; p=")}))

        assert finding_ids(result) == ["EMAIL_DKIM_REVOKED"]

    def test_a_cname_published_key_is_found_because_the_resolver_follows_it(self) -> None:
        result, _ = run(world({("s1._domainkey.example.com", "TXT"): ok("v=DKIM1; t=y; p=abc")}))

        assert finding_ids(result) == ["EMAIL_DKIM_TESTING"]

    def test_a_wildcard_revoked_key_on_a_domain_without_mail_is_not_a_finding(self) -> None:
        answers = {
            ("www.example.com", "A"): ok("93.184.216.34"),
            ("example.com", "MX"): ok("0 ."),
        }
        answers.update(
            {
                (f"{selector}._domainkey.example.com", "TXT"): ok("v=DKIM1; p=")
                for selector in ("google", "selector1", "selector2", "s1", "s2")
            }
        )

        result, _ = run(answers)

        assert result.findings == ()

    def test_missing_selectors_are_never_a_finding(self) -> None:
        result, resolver = run(world())

        assert result.findings == ()
        selectors = [name for name, kind in resolver.calls if "_domainkey" in name]
        assert selectors == [
            "google._domainkey.example.com",
            "selector1._domainkey.example.com",
            "selector2._domainkey.example.com",
            "s1._domainkey.example.com",
            "s2._domainkey.example.com",
        ]

    def test_a_record_that_is_not_a_key_is_ignored(self) -> None:
        result, _ = run(world({("google._domainkey.example.com", "TXT"): ok("hello world")}))

        assert result.findings == ()


class TestBudget:
    def test_a_normal_scan_uses_a_small_part_of_the_budget(self) -> None:
        _, resolver = run(world())

        assert len(resolver.calls) <= 20

    def test_the_hard_limit_is_forty(self) -> None:
        assert MAX_DNS_QUERIES_PER_SCAN == 40

    def test_the_worst_case_never_exceeds_the_budget(self) -> None:
        # A deep host, a CNAME chain that never ends, and an SPF record with endless includes.
        deep = ".".join(f"l{i}" for i in range(12)) + ".example.com"
        answers = {
            (deep, "CNAME"): ok("h0.example.net."),
            (deep, "A"): NXDOMAIN,
            (deep, "AAAA"): NXDOMAIN,
            ("example.com", "MX"): ok("10 mail.example.com."),
            ("example.com", "TXT"): ok("v=spf1 include:i0.example.net -all"),
        }
        answers.update(
            {(f"h{i}.example.net", "CNAME"): ok(f"h{i + 1}.example.net.") for i in range(40)}
        )
        answers.update(
            {
                (f"i{i}.example.net", "TXT"): ok(f"v=spf1 include:i{i + 1}.example.net -all")
                for i in range(40)
            }
        )

        result, resolver = run(answers, url=f"https://{deep}")

        assert len(resolver.calls) <= MAX_DNS_QUERIES_PER_SCAN
        assert result.dns_outcome is not None

    def test_running_out_of_budget_skips_the_email_check_with_a_reason(self) -> None:
        result, resolver = run(world(), limit=10)

        assert len(resolver.calls) == 10
        assert states(result)["email_auth"] == ("skipped", "budget_exhausted")
        assert result.findings == ()

    def test_running_out_of_budget_in_the_chain_skips_the_dangling_check(self) -> None:
        answers = world(
            {
                ("www.example.com", "CNAME"): ok("a.example.net."),
                ("www.example.com", "A"): NXDOMAIN,
                ("a.example.net", "CNAME"): ok("b.example.net."),
            }
        )

        result, _ = run(answers, limit=12)

        assert states(result)["dangling_cname"] == ("skipped", "budget_exhausted")

    def test_the_host_records_come_first(self) -> None:
        _, resolver = run(world())

        assert resolver.calls[0] == ("www.example.com", "CNAME")
        assert {kind for name, kind in resolver.calls[:6] if name == "www.example.com"} == {
            "A",
            "AAAA",
            "CNAME",
            "NS",
            "MX",
            "TXT",
        }


def test_no_record_value_is_logged(caplog: pytest.LogCaptureFixture) -> None:
    secret = "verification-token-SECRET-123"
    caplog.set_level("INFO")

    run(world({("www.example.com", "TXT"): ok(f"token={secret}")}))

    assert secret not in caplog.text
    assert all(secret not in repr(vars(record)) for record in caplog.records)
