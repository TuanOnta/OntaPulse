"""Classification of recoverable infrastructure errors."""

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
