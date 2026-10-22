import dns.exception
import dns.name
import dns.rdata
import dns.rdataclass
import dns.rdatatype
import dns.resolver
import pytest

from ontapulse_worker.modules.dns_watch.adapters.dnspython_resolver import DnspythonResolver
from ontapulse_worker.modules.dns_watch.domain.models import AnswerStatus, RecordType


def rdata(record_type: str, text: str):
    return dns.rdata.from_text(dns.rdataclass.IN, dns.rdatatype.from_text(record_type), text)


class FakeAnswer:
    def __init__(self, records) -> None:
        self.rrset = records


class FakeDnspython:
    """Stands in for dns.resolver.Resolver: answers or raises, and remembers the calls."""

    def __init__(self, outcome) -> None:
        self.outcome = outcome
        self.calls: list[tuple[str, str, bool]] = []

    def resolve(self, name: str, record_type: str, *, search: bool = True):
        self.calls.append((name, record_type, search))

        if isinstance(self.outcome, BaseException):
            raise self.outcome

        return self.outcome


def query(outcome, record_type: RecordType = RecordType.A, name: str = "example.com"):
    fake = FakeDnspython(outcome)
    answer = DnspythonResolver((), resolver=fake).query(name, record_type)

    return answer, fake


class TestAnswers:
    def test_a_and_aaaa_values_are_the_addresses(self) -> None:
        a, _ = query(FakeAnswer([rdata("A", "93.184.216.34")]), RecordType.A)
        aaaa, _ = query(FakeAnswer([rdata("AAAA", "2606:2800:220:1::1")]), RecordType.AAAA)

        assert (a.status, a.values) == (AnswerStatus.OK, ("93.184.216.34",))
        assert aaaa.values == ("2606:2800:220:1::1",)

    def test_cname_and_ns_values_are_the_target_names(self) -> None:
        cname, _ = query(FakeAnswer([rdata("CNAME", "target.example.net.")]), RecordType.CNAME)
        ns, _ = query(
            FakeAnswer([rdata("NS", "a.iana-servers.net."), rdata("NS", "b.iana-servers.net.")]),
            RecordType.NS,
        )

        assert cname.values == ("target.example.net.",)
        assert ns.values == ("a.iana-servers.net.", "b.iana-servers.net.")

    def test_an_mx_value_is_the_preference_and_the_exchange(self) -> None:
        answer, _ = query(
            FakeAnswer([rdata("MX", "10 mail.example.com."), rdata("MX", "0 .")]), RecordType.MX
        )

        assert answer.values == ("10 mail.example.com.", "0 .")

    def test_a_txt_value_joins_its_strings_without_a_separator(self) -> None:
        answer, _ = query(
            FakeAnswer([rdata("TXT", '"v=spf1 " "include:x.example -all"')]), RecordType.TXT
        )

        assert answer.values == ("v=spf1 include:x.example -all",)

    def test_a_txt_value_with_invalid_utf8_is_decoded_with_replacement(self) -> None:
        answer, _ = query(FakeAnswer([rdata("TXT", '"caf\\233"')]), RecordType.TXT)

        assert answer.values == ("caf�",)

    def test_the_query_never_uses_a_search_list(self) -> None:
        _, fake = query(FakeAnswer([rdata("A", "1.2.3.4")]), name="www.example.com")

        assert fake.calls == [("www.example.com", "A", False)]


class TestConditions:
    def test_nxdomain_is_an_answer(self) -> None:
        answer, _ = query(dns.resolver.NXDOMAIN())

        assert answer.status is AnswerStatus.NXDOMAIN

    def test_an_existing_name_without_the_record_is_nodata(self) -> None:
        answer, _ = query(dns.resolver.NoAnswer())

        assert answer.status is AnswerStatus.NODATA

    def test_an_empty_rrset_is_nodata(self) -> None:
        answer, _ = query(FakeAnswer(None))

        assert answer.status is AnswerStatus.NODATA

    @pytest.mark.parametrize(
        "error",
        [dns.name.NameTooLong(), dns.name.LabelTooLong(), dns.name.EmptyLabel()],
    )
    def test_a_name_that_cannot_exist_has_no_records(self, error) -> None:
        answer, _ = query(error)

        assert answer.status is AnswerStatus.NODATA

    @pytest.mark.parametrize(
        "error",
        [
            dns.resolver.NoNameservers(),
            dns.resolver.LifetimeTimeout(),
            dns.exception.Timeout(),
            dns.exception.DNSException("boom"),
        ],
    )
    def test_timeouts_and_server_failures_are_transient(self, error) -> None:
        answer, _ = query(error)

        assert answer.status is AnswerStatus.TRANSIENT
        assert answer.values == ()

    def test_an_error_that_is_not_a_dns_error_is_not_swallowed(self) -> None:
        with pytest.raises(RuntimeError):
            query(RuntimeError("bug"))


class TestConfiguration:
    def test_only_the_configured_nameservers_are_used_never_the_system_ones(self) -> None:
        resolver = DnspythonResolver(("1.1.1.1", "9.9.9.9"))

        inner = resolver._resolver
        assert inner.nameservers == ["1.1.1.1", "9.9.9.9"]

    def test_the_timeouts_are_two_seconds_per_server_and_five_per_query(self) -> None:
        inner = DnspythonResolver(("1.1.1.1",))._resolver

        assert inner.timeout == 2.0
        assert inner.lifetime == 5.0

    def test_timeouts_can_be_overridden(self) -> None:
        inner = DnspythonResolver(("1.1.1.1",), timeout=1.0, lifetime=3.0)._resolver

        assert (inner.timeout, inner.lifetime) == (1.0, 3.0)
