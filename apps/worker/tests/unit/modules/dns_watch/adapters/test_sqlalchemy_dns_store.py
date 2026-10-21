from unittest.mock import MagicMock, Mock
from uuid import UUID

from ontapulse_worker.modules.dns_watch.adapters import sqlalchemy_dns_store
from ontapulse_worker.modules.dns_watch.adapters.sqlalchemy_dns_store import SqlAlchemyDnsWatchStore

MONITOR_ID = UUID("3edca2bb-c92c-4ac8-a5ed-75630416f604")


def store_with(result: Mock):
    session = MagicMock()
    session.execute.return_value = result
    sessions = MagicMock()
    sessions.return_value.__enter__.return_value = session

    return SqlAlchemyDnsWatchStore(sessions), session


def test_the_baseline_is_the_stored_snapshot_document() -> None:
    result = Mock()
    result.scalar_one_or_none.return_value = {"host": {"name": "www.example.com"}}
    store, session = store_with(result)

    assert store.load_baseline(MONITOR_ID) == {"host": {"name": "www.example.com"}}
    assert session.execute.call_args.args[1] == {"monitor_id": MONITOR_ID}
    assert '"DnsBaseline"' in str(session.execute.call_args.args[0])


def test_no_baseline_row_or_a_damaged_value_is_no_baseline() -> None:
    for value in (None, "text", ["list"], 5):
        result = Mock()
        result.scalar_one_or_none.return_value = value
        store, _ = store_with(result)

        assert store.load_baseline(MONITOR_ID) is None


def test_a_cdn_detection_is_read_from_the_edge_profile_layers() -> None:
    result = Mock()
    result.scalar_one.return_value = True
    store, session = store_with(result)

    assert store.has_cdn_detection(MONITOR_ID) is True
    statement = str(session.execute.call_args.args[0])
    assert '"MonitorEdgeProfile"' in statement
    assert "detection ->> 'layer' = 'CDN'" in statement


def test_no_cdn_detection_is_false() -> None:
    result = Mock()
    result.scalar_one.return_value = False
    store, _ = store_with(result)

    assert store.has_cdn_detection(MONITOR_ID) is False


def test_both_reads_are_plain_selects() -> None:
    for statement in (sqlalchemy_dns_store.LOAD_BASELINE, sqlalchemy_dns_store.HAS_CDN_DETECTION):
        assert str(statement).lstrip().upper().startswith("SELECT")
