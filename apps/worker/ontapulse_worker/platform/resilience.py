"""Retry backoff and classification of recoverable infrastructure errors."""

from dataclasses import dataclass, field
from random import uniform

from pika.exceptions import (
    AMQPConnectionError,
    ChannelClosedByBroker,
    ConnectionClosedByBroker,
    ProbableAccessDeniedError,
    ProbableAuthenticationError,
    StreamLostError,
)
from sqlalchemy.exc import OperationalError

FATAL_CONNECTION_ERRORS = (
    ProbableAuthenticationError,
    ProbableAccessDeniedError,
    ChannelClosedByBroker,
)

RETRYABLE_CONNECTION_ERRORS = (
    OperationalError,
    AMQPConnectionError,
    StreamLostError,
    ConnectionClosedByBroker,
)


def is_retryable_connection_error(error: Exception) -> bool:
    if isinstance(error, FATAL_CONNECTION_ERRORS):
        return False

    if isinstance(error, ConnectionClosedByBroker):
        return error.reply_code not in {403, 406}

    return isinstance(error, RETRYABLE_CONNECTION_ERRORS)


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
