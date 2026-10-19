# TLS test fixtures

Test-only certificates and keys for `tests/unit/modules/security_posture/adapters/tls`. The tests start a
loopback TLS server with them; nothing here protects any real system, and the scanner can never reach a
loopback address.

| File                     | What it is                                                           |
| ------------------------ | -------------------------------------------------------------------- |
| `ca.pem`                 | Throw-away test CA certificate (its key is not stored)               |
| `valid.*`                | `example.test`, signed by the CA, valid 2020 to 2120                 |
| `wrong-host.*`           | `other.test`, signed by the CA                                       |
| `expired.*`              | `example.test`, signed by the CA, valid 2019 to 2020                 |
| `not-yet-valid.*`        | `example.test`, signed by the CA, valid from 2100                    |
| `self-signed.*`          | `example.test`, self-signed (not signed by the CA)                   |

`generate.sh` recreates all of them with the `openssl` CLI. The `valid` certificates expire in 2120; the tests do
not depend on the current date for them.
