import pytest

from ontapulse_worker.modules.dns_watch.domain.dkim import DKIM_SELECTORS, parse_dkim
from ontapulse_worker.modules.dns_watch.domain.dmarc import (
    MAX_TREE_WALK_QUERIES,
    DmarcRecord,
    fallback_organization_domain,
    parse_dmarc,
    select_dmarc,
    tree_walk_names,
)
from ontapulse_worker.modules.dns_watch.domain.spf import (
    MAX_SPF_LOOKUPS,
    is_spf_record,
    parse_spf,
)


class TestSpf:
    @pytest.mark.parametrize(
        ("text", "expected"),
        [
            ("v=spf1 -all", True),
            ("v=spf1", True),
            ("V=SPF1 include:x.example -all", True),
            ("  v=spf1 mx -all", True),
            ("v=spf10 -all", False),
            ("v=spf2.0/pra -all", False),
            ("spf1 -all", False),
            ("google-site-verification=abc", False),
            ("", False),
        ],
    )
    def test_the_version_section_is_exactly_v_spf1(self, text: str, expected: bool) -> None:
        assert is_spf_record(text) is expected

    @pytest.mark.parametrize(
        ("text", "qualifier"),
        [
            ("v=spf1 -all", "-"),
            ("v=spf1 ~all", "~"),
            ("v=spf1 +all", "+"),
            ("v=spf1 ?all", "?"),
            ("v=spf1 all", "+"),
            ("v=spf1 mx", None),
            ("v=spf1 ALL", "+"),
        ],
    )
    def test_the_all_qualifier_defaults_to_plus(self, text: str, qualifier) -> None:
        assert parse_spf(text).all_qualifier == qualifier

    def test_lookup_terms_are_include_a_mx_ptr_exists_and_redirect(self) -> None:
        record = parse_spf(
            "v=spf1 a mx:mail.example.com ptr exists:%{i}.example.org "
            "include:_spf.x.com ip4:1.2.3.4 -all"
        )

        assert record.lookup_terms == 5
        assert record.includes == ("_spf.x.com",)
        assert record.has_ptr is True

    def test_ip_mechanisms_and_modifiers_other_than_redirect_cost_nothing(self) -> None:
        record = parse_spf("v=spf1 ip4:1.2.3.4 ip6:::1 exp=explain.example.com -all")

        assert record.lookup_terms == 0
        assert record.redirect is None
        assert record.has_ptr is False

    def test_a_redirect_modifier_costs_a_lookup_unless_an_all_is_present(self) -> None:
        followed = parse_spf("v=spf1 redirect=_spf.example.net")
        ignored = parse_spf("v=spf1 redirect=_spf.example.net -all")

        assert followed.redirect == "_spf.example.net"
        assert followed.lookup_terms == 1
        assert ignored.redirect is None
        assert ignored.lookup_terms == 0

    def test_an_all_anywhere_ignores_the_redirect_regardless_of_order(self) -> None:
        record = parse_spf("v=spf1 -all redirect=_spf.example.net")

        assert record.redirect is None
        assert record.all_qualifier == "-"

    def test_names_are_lowercased_and_lose_the_trailing_dot(self) -> None:
        record = parse_spf("v=spf1 include:_SPF.Example.COM. redirect=Other.Example.")

        assert record.includes == ("_spf.example.com",)
        assert record.redirect == "other.example"

    def test_the_limit_is_ten(self) -> None:
        assert MAX_SPF_LOOKUPS == 10


class TestDmarcParse:
    def test_a_full_record_is_parsed(self) -> None:
        record = parse_dmarc("v=DMARC1; p=reject; rua=mailto:d@example.com; psd=n")

        assert record == DmarcRecord(
            tags={"v": "DMARC1", "p": "reject", "rua": "mailto:d@example.com", "psd": "n"},
            policy="reject",
            has_reporting=True,
            psd="n",
        )

    @pytest.mark.parametrize(
        "text",
        [
            "p=none; v=DMARC1",
            "v=dmarc1; p=none",
            "v=DMARC2; p=none",
            "v = DMARC1; p=none",
            "",
            "v=spf1 -all",
            "some verification token",
        ],
    )
    def test_the_first_tag_must_be_exactly_v_dmarc1(self, text: str) -> None:
        if text == "v = DMARC1; p=none":
            # Whitespace around the name and value is allowed by the tag-list syntax.
            assert parse_dmarc(text) is not None
        else:
            assert parse_dmarc(text) is None

    @pytest.mark.parametrize(
        "text", ["v=DMARC1", "v=DMARC1; p=bogus", "v=DMARC1; rua=mailto:x@y.z"]
    )
    def test_a_missing_or_unusable_policy_is_none(self, text: str) -> None:
        assert parse_dmarc(text).policy == "none"

    def test_reporting_needs_a_non_empty_rua(self) -> None:
        assert parse_dmarc("v=DMARC1; p=none; rua=").has_reporting is False
        assert parse_dmarc("v=DMARC1; p=none").has_reporting is False
        assert parse_dmarc("v=DMARC1; p=none; rua=mailto:a@b.c").has_reporting is True

    def test_a_repeated_tag_keeps_its_first_value(self) -> None:
        assert parse_dmarc("v=DMARC1; p=reject; p=none").policy == "reject"

    def test_policy_is_case_insensitive(self) -> None:
        assert parse_dmarc("v=DMARC1; p=REJECT").policy == "reject"


class TestTreeWalk:
    @pytest.mark.parametrize(
        ("host", "expected"),
        [
            ("example.com", ["example.com"]),
            ("www.example.com", ["www.example.com", "example.com"]),
            ("a.b.example.com", ["a.b.example.com", "b.example.com", "example.com"]),
            ("WWW.Example.COM.", ["www.example.com", "example.com"]),
            ("localhost", ["localhost"]),
        ],
    )
    def test_names_run_from_the_host_up_and_never_reach_a_top_level_label(
        self, host, expected
    ) -> None:
        assert tree_walk_names(host) == expected

    def test_a_host_with_eight_or_more_labels_is_cut_from_the_left_until_seven_remain(self) -> None:
        host = "a.b.c.d.e.f.g.h.example.com"

        names = tree_walk_names(host)

        # The author domain itself, then the walk over the last seven labels: at most eight queries.
        assert names[0] == host
        assert names[1] == "d.e.f.g.h.example.com"
        assert names[-1] == "example.com"
        assert len(names) == 7

    def test_seven_labels_are_walked_as_they_are_and_eight_are_cut(self) -> None:
        seven = "b.c.d.e.f.example.com"
        eight = "a." + seven

        assert tree_walk_names(seven) == [
            seven,
            "c.d.e.f.example.com",
            "d.e.f.example.com",
            "e.f.example.com",
            "f.example.com",
            "example.com",
        ]
        cut = tree_walk_names(eight)
        assert cut[0] == eight
        assert cut[1] == seven
        assert len(cut) == 7

    def test_never_more_than_eight_queries(self) -> None:
        host = ".".join(f"l{index}" for index in range(20)) + ".example.com"

        assert len(tree_walk_names(host)) <= MAX_TREE_WALK_QUERIES

    @pytest.mark.parametrize(
        ("host", "expected"),
        [
            ("www.example.com", "example.com"),
            ("example.com", "example.com"),
            ("shop.example.co.uk", "co.uk"),
            ("a.b.c.d", "c.d"),
            ("localhost", "localhost"),
        ],
    )
    def test_the_fallback_is_the_last_two_labels(self, host: str, expected: str) -> None:
        assert fallback_organization_domain(host) == expected


def record(text: str) -> DmarcRecord:
    parsed = parse_dmarc(text)
    assert parsed is not None
    return parsed


class TestSelection:
    def test_the_policy_comes_from_the_organizational_domain_when_the_host_has_none(self) -> None:
        selection = select_dmarc(
            "www.example.com", [("example.com", [record("v=DMARC1; p=reject; rua=mailto:a@b.c")])]
        )

        assert selection.organization_domain == "example.com"
        assert selection.policy_name == "example.com"
        assert selection.policy.policy == "reject"
        assert selection.multiple_names == ()

    def test_a_record_at_the_author_domain_wins_for_the_policy_but_not_for_the_organization(
        self,
    ) -> None:
        selection = select_dmarc(
            "www.example.com",
            [
                ("www.example.com", [record("v=DMARC1; p=quarantine")]),
                ("example.com", [record("v=DMARC1; p=reject")]),
            ],
        )

        assert selection.organization_domain == "example.com"
        assert selection.policy_name == "www.example.com"
        assert selection.policy.policy == "quarantine"

    def test_the_organizational_domain_is_the_name_with_the_fewest_labels(self) -> None:
        selection = select_dmarc(
            "a.b.example.com",
            [
                ("a.b.example.com", [record("v=DMARC1; p=none")]),
                ("example.com", [record("v=DMARC1; p=reject")]),
            ],
        )

        assert selection.organization_domain == "example.com"

    def test_a_psd_n_record_is_the_organizational_domain_even_with_more_labels(self) -> None:
        selection = select_dmarc(
            "www.shop.example.com",
            [
                ("shop.example.com", [record("v=DMARC1; p=none; psd=n")]),
                ("example.com", [record("v=DMARC1; p=reject")]),
            ],
        )

        assert selection.organization_domain == "shop.example.com"

    def test_a_psd_y_record_is_a_public_suffix_not_an_organization(self) -> None:
        selection = select_dmarc(
            "www.example.co.uk",
            [
                ("example.co.uk", [record("v=DMARC1; p=none")]),
                ("co.uk", [record("v=DMARC1; p=reject; psd=y")]),
            ],
        )

        assert selection.organization_domain == "example.co.uk"

    def test_several_records_at_one_name_are_all_discarded(self) -> None:
        selection = select_dmarc(
            "www.example.com",
            [
                (
                    "example.com",
                    [record("v=DMARC1; p=none"), record("v=DMARC1; p=reject")],
                )
            ],
        )

        assert selection.policy is None
        assert selection.multiple_names == ("example.com",)
        assert selection.organization_domain == "example.com"  # fallback

    def test_no_record_falls_back_to_the_last_two_labels(self) -> None:
        selection = select_dmarc("shop.example.co.uk", [])

        assert selection.organization_domain == "co.uk"
        assert selection.policy is None
        assert selection.policy_name is None


class TestDkim:
    def test_the_selector_list_is_the_verified_one(self) -> None:
        assert DKIM_SELECTORS == ("google", "selector1", "selector2", "s1", "s2")

    @pytest.mark.parametrize(
        ("text", "testing", "revoked"),
        [
            ("v=DKIM1; k=rsa; p=MIIBIjAN", False, False),
            ("v=DKIM1; k=rsa; t=y; p=MIIBIjAN", True, False),
            ("v=DKIM1; t=s:y; p=abc", True, False),
            ("v=DKIM1; t=s; p=abc", False, False),
            ("v=DKIM1; p=", False, True),
            ("k=rsa; p=abc", False, False),
            ("p=abc", False, False),
            ("v=DKIM1; k=rsa; t=Y; p=", True, True),
        ],
    )
    def test_a_key_record_is_testing_or_revoked_per_its_tags(self, text, testing, revoked) -> None:
        key = parse_dkim(text)

        assert key is not None
        assert (key.testing, key.revoked) == (testing, revoked)

    @pytest.mark.parametrize(
        "text",
        [
            "v=DKIM2; p=abc",
            "k=rsa; v=DKIM1; p=abc",
            "v=DKIM1; k=rsa",
            "not a key record",
            "",
            "v=spf1 -all",
        ],
    )
    def test_a_record_that_is_not_a_valid_key_is_ignored(self, text: str) -> None:
        assert parse_dkim(text) is None
