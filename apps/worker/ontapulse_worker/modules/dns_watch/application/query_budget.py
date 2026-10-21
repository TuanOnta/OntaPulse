"""One query budget shared by every sub-check of a scan (docs/security-checks.md section 4)."""

from ontapulse_worker.modules.dns_watch.application.ports import DnsResolver
from ontapulse_worker.modules.dns_watch.domain.catalog import MAX_DNS_QUERIES_PER_SCAN
from ontapulse_worker.modules.dns_watch.domain.models import DnsAnswer, RecordType


class BudgetExhaustedError(Exception):
    """The scan used its whole DNS query budget. The remaining sub-check is skipped."""


class QueryBudget:
    def __init__(self, limit: int = MAX_DNS_QUERIES_PER_SCAN) -> None:
        self._limit = limit
        self.used = 0
        # True once a query was refused: what depended on it is incomplete.
        self.exhausted = False

    def consume(self) -> None:
        if self.used >= self._limit:
            self.exhausted = True
            raise BudgetExhaustedError("DNS query budget exhausted")

        self.used += 1


class BudgetedResolver:
    """Counts every query before it is sent, so no scan can exceed the budget."""

    def __init__(self, resolver: DnsResolver, budget: QueryBudget) -> None:
        self._resolver = resolver
        self._budget = budget

    @property
    def exhausted(self) -> bool:
        return self._budget.exhausted

    def query(self, name: str, record_type: RecordType) -> DnsAnswer:
        self._budget.consume()

        return self._resolver.query(name, record_type)
