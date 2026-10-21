import json

import pytest

from ontapulse_worker.modules.dns_watch.domain.models import RecordType, Snapshot
from ontapulse_worker.modules.dns_watch.domain.normalize import (
    normalize_name,
    normalize_value,
    normalize_values,
)
from ontapulse_worker.modules.dns_watch.domain.snapshot import (
    MAX_SNAPSHOT_BYTES,
    MAX_VALUE_CHARS,
    MAX_VALUES_PER_TYPE,
    bound_document,
    diff_snapshot,
    to_document,
)
from ontapulse_worker.modules.scans.domain.models import RecordChange


def snapshot(
    *,
    host=None,
    organization=None,
    host_name="www.example.com",
    organization_name="example.com",
) -> Snapshot:
    base_host = {t: () for t in ("A", "AAAA", "CNAME", "NS", "MX", "TXT")}
    base_org = {"NS": (), "MX": ()}

    return Snapshot(
        host_name,
        {**base_host, **(host or {})},
        organization_name,
        {**base_org, **(organization or {})},
    )


PREVIOUS = {
    "host": {
        "name": "www.example.com",
        "A": ["93.184.216.34"],
        "AAAA": [],
        "CNAME": [],
        "NS": [],
        "MX": [],
        "TXT": ["v=spf1 -all"],
    },
    "organization": {"name": "example.com", "NS": ["a.iana-servers.net"], "MX": ["0 ."]},
}


@pytest.mark.parametrize(
    ("name", "expected"),
    [
        ("WWW.Example.COM.", "www.example.com"),
        ("  example.com  ", "example.com"),
        ("example.com", "example.com"),
        (".", ""),
    ],
)
def test_names_are_lowercased_and_lose_the_trailing_dot(name: str, expected: str) -> None:
    assert normalize_name(name) == expected


@pytest.mark.parametrize(
    ("record_type", "values", "expected"),
    [
        (RecordType.A, ("93.184.216.34", "1.1.1.1", "93.184.216.34"), ("1.1.1.1", "93.184.216.34")),
        (RecordType.AAAA, ("2606:2800:0220:0001::0001",), ("2606:2800:220:1::1",)),
        (
            RecordType.NS,
            ("B.IANA-SERVERS.NET.", "a.iana-servers.net"),
            ("a.iana-servers.net", "b.iana-servers.net"),
        ),
        (RecordType.CNAME, ("Target.Example.NET.",), ("target.example.net",)),
        (
            RecordType.MX,
            ("10 MAIL.Example.com.", "5 mx2.example.com."),
            ("10 mail.example.com", "5 mx2.example.com"),
        ),
        (RecordType.MX, ("0 .",), ("0 .",)),
        (RecordType.TXT, ("v=spf1 -all", "Keep-CASE", "v=spf1 -all"), ("Keep-CASE", "v=spf1 -all")),
    ],
)
def test_values_are_normalized_sorted_and_deduplicated(record_type, values, expected) -> None:
    assert normalize_values(record_type, values) == expected


def test_an_unparsable_address_or_mx_is_kept_lowercase_instead_of_failing() -> None:
    assert normalize_value(RecordType.A, "NOT-AN-IP") == "not-an-ip"
    assert normalize_value(RecordType.MX, "garbage") == "garbage"
    assert normalize_value(RecordType.MX, "x mail.example.com.") == "x mail.example.com"


def test_the_document_has_the_documented_shape() -> None:
    document = to_document(
        snapshot(
            host={"A": ("93.184.216.34",), "TXT": ("v=spf1 -all",)},
            organization={"NS": ("a.iana-servers.net",), "MX": ("0 .",)},
        ),
        None,
    )

    assert document == {
        "host": {
            "name": "www.example.com",
            "A": ["93.184.216.34"],
            "AAAA": [],
            "CNAME": [],
            "NS": [],
            "MX": [],
            "TXT": ["v=spf1 -all"],
        },
        "organization": {"name": "example.com", "NS": ["a.iana-servers.net"], "MX": ["0 ."]},
    }


class TestDiff:
    def test_there_is_nothing_to_diff_before_the_first_baseline(self) -> None:
        assert diff_snapshot(None, snapshot(host={"A": ("1.1.1.1",)})) == []
        assert diff_snapshot({}, snapshot(host={"A": ("1.1.1.1",)})) == []

    def test_an_identical_snapshot_has_no_changes(self) -> None:
        current = snapshot(
            host={"A": ("93.184.216.34",), "TXT": ("v=spf1 -all",)},
            organization={"NS": ("a.iana-servers.net",), "MX": ("0 .",)},
        )

        assert diff_snapshot(PREVIOUS, current) == []

    def test_added_and_removed_values_are_reported_per_type_and_scope(self) -> None:
        current = snapshot(
            host={"A": ("93.184.216.35", "93.184.216.34"), "TXT": ("v=spf1 ~all",)},
            organization={"NS": ("b.iana-servers.net",), "MX": ("0 .",)},
        )

        changes = diff_snapshot(PREVIOUS, current)

        assert changes == [
            RecordChange("host", "A", ("93.184.216.35",), ()),
            RecordChange("host", "TXT", ("v=spf1 ~all",), ("v=spf1 -all",)),
            RecordChange("organization", "NS", ("b.iana-servers.net",), ("a.iana-servers.net",)),
        ]

    def test_an_unknown_type_is_never_diffed(self) -> None:
        current = snapshot(
            host={"A": None, "TXT": ("v=spf1 -all",)}, organization={"NS": None, "MX": None}
        )

        assert diff_snapshot(PREVIOUS, current) == []

    def test_a_type_that_became_empty_is_a_removal(self) -> None:
        current = snapshot(
            host={"A": ()}, organization={"NS": ("a.iana-servers.net",), "MX": ("0 .",)}
        )

        changes = diff_snapshot(PREVIOUS, current)

        assert RecordChange("host", "A", (), ("93.184.216.34",)) in changes

    def test_a_new_organizational_domain_is_a_new_frame_not_a_change(self) -> None:
        current = snapshot(
            host={"A": ("93.184.216.34",), "TXT": ("v=spf1 -all",)},
            organization={"NS": ("other.example.net",), "MX": ("10 mail.parent.com",)},
            organization_name="parent.com",
        )

        assert diff_snapshot(PREVIOUS, current) == []

    def test_a_baseline_without_a_type_counts_as_empty(self) -> None:
        previous = {"host": {"name": "www.example.com"}, "organization": {"name": "example.com"}}

        changes = diff_snapshot(previous, snapshot(host={"A": ("1.1.1.1",)}))

        assert changes == [RecordChange("host", "A", ("1.1.1.1",), ())]

    def test_a_damaged_baseline_does_not_raise(self) -> None:
        previous = {"host": "text", "organization": {"name": "example.com", "NS": "x"}}

        assert diff_snapshot(previous, snapshot(host={"A": ("1.1.1.1",)})) == [
            RecordChange("host", "A", ("1.1.1.1",), ())
        ]


class TestUnknownTypesKeepTheirBaselineValue:
    def test_the_previous_value_is_kept_for_a_failed_query(self) -> None:
        document = to_document(
            snapshot(host={"A": None, "TXT": ()}, organization={"NS": None, "MX": None}), PREVIOUS
        )

        assert document["host"]["A"] == ["93.184.216.34"]
        assert document["host"]["TXT"] == []
        assert document["organization"]["NS"] == ["a.iana-servers.net"]
        assert document["organization"]["MX"] == ["0 ."]

    def test_an_unknown_type_without_a_baseline_is_stored_empty(self) -> None:
        document = to_document(snapshot(host={"A": None}), None)

        assert document["host"]["A"] == []

    def test_organization_values_are_not_carried_over_to_another_organization(self) -> None:
        document = to_document(
            snapshot(organization={"NS": None, "MX": None}, organization_name="parent.com"),
            PREVIOUS,
        )

        assert document["organization"] == {"name": "parent.com", "NS": [], "MX": []}


class TestBounds:
    def test_values_are_capped_in_number_and_length(self) -> None:
        many = tuple(
            f"10.0.{index // 250}.{index % 250}" for index in range(MAX_VALUES_PER_TYPE + 10)
        )
        document = to_document(snapshot(host={"A": many, "TXT": ("t" * 2000,)}), None)

        assert len(document["host"]["A"]) == MAX_VALUES_PER_TYPE
        assert len(document["host"]["TXT"][0]) == MAX_VALUE_CHARS

    def test_an_oversized_document_shrinks_until_it_fits(self) -> None:
        big = tuple("v" * MAX_VALUE_CHARS + str(index) for index in range(MAX_VALUES_PER_TYPE))
        document = bound_document(
            {
                "host": {
                    "name": "h",
                    "A": list(big),
                    "TXT": list(big),
                    "NS": list(big),
                    "MX": list(big),
                },
                "organization": {"name": "o", "NS": list(big), "MX": list(big)},
            }
        )

        assert len(json.dumps(document).encode()) <= MAX_SNAPSHOT_BYTES
        assert document["host"]["name"] == "h"
        assert document["organization"]["name"] == "o"
