"""Read side of the DNS watch (SQLAlchemy). The baseline is written by the scan repository."""

from collections.abc import Mapping
from typing import Any
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.orm import Session, sessionmaker

LOAD_BASELINE = text('SELECT snapshot FROM "DnsBaseline" WHERE "monitorId" = :monitor_id')
HAS_CDN_DETECTION = text(
    """
    SELECT EXISTS (
        SELECT 1
        FROM "MonitorEdgeProfile" AS profile,
             jsonb_array_elements(profile.detections) AS detection
        WHERE profile."monitorId" = :monitor_id AND detection ->> 'layer' = 'CDN'
    )
    """
)


class SqlAlchemyDnsWatchStore:
    def __init__(self, sessions: sessionmaker[Session]) -> None:
        self._sessions = sessions

    def load_baseline(self, monitor_id: UUID) -> Mapping[str, Any] | None:
        with self._sessions() as session:
            snapshot = session.execute(
                LOAD_BASELINE, {"monitor_id": monitor_id}
            ).scalar_one_or_none()

        return snapshot if isinstance(snapshot, dict) else None

    def has_cdn_detection(self, monitor_id: UUID) -> bool:
        with self._sessions() as session:
            return bool(session.execute(HAS_CDN_DETECTION, {"monitor_id": monitor_id}).scalar_one())
