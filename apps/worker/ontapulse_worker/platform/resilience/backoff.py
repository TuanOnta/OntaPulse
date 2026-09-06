"""Exponential backoff policy."""

from dataclasses import dataclass, field
from random import uniform


@dataclass
class ExponentialBackoff:
    delays: tuple[float, ...] = (1, 2, 5, 10, 30)
    jitter: float = 0.2
    _index: int = field(default=0, init=False)

    def next_delay(self) -> float:
        delay = self.delays[min(self._index, len(self.delays) - 1)]
        self._index += 1
        return uniform(delay * (1 - self.jitter), delay * (1 + self.jitter))

    def reset(self) -> None:
        self._index = 0
