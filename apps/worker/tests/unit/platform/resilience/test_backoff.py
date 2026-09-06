from ontapulse_worker.platform.resilience.backoff import ExponentialBackoff


def test_backoff_increases_until_maximum() -> None:
    backoff = ExponentialBackoff(jitter=0)

    assert [backoff.next_delay() for _ in range(7)] == [1, 2, 5, 10, 30, 30, 30]


def test_backoff_resets() -> None:
    backoff = ExponentialBackoff(jitter=0)

    backoff.next_delay()
    backoff.next_delay()
    backoff.reset()

    assert backoff.next_delay() == 1
