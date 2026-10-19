#!/usr/bin/env bash
# Regenerates the TEST-ONLY TLS fixtures used by the posture TLS tests.
# The keys here protect nothing: they are throw-away and only ever used against a loopback server
# started inside the tests. The CA key lives in a temporary directory and is deleted afterwards.
set -euo pipefail
cd "$(dirname "$0")"
export MSYS_NO_PATHCONV=1
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
# Native Windows OpenSSL needs mixed-style paths; elsewhere `cygpath` does not exist.
wp="$work"; command -v cygpath >/dev/null 2>&1 && wp="$(cygpath -m "$work")"

# An explicit config keeps a machine-wide OPENSSL_CONF from interfering.
cat > "$work/ca.cnf" <<CNF
[req]
distinguished_name = dn
[dn]
[ca]
default_ca = test_ca
[test_ca]
dir = $wp
database = $wp/index.txt
new_certs_dir = $wp
serial = $wp/serial
default_md = sha256
policy = policy_any
unique_subject = no
copy_extensions = copy
[policy_any]
commonName = supplied
CNF
export OPENSSL_CONF="$wp/ca.cnf"
: > "$work/index.txt"; echo 01 > "$work/serial"

openssl req -x509 -newkey rsa:2048 -nodes -keyout "$wp/ca.key" -out ca.pem -days 36500 \
  -subj "/O=OntaPulse Test CA/CN=OntaPulse Test CA" \
  -addext "basicConstraints=critical,CA:TRUE" -addext "keyUsage=critical,keyCertSign,cRLSign"

issue() { # name common-name start-date end-date
  openssl req -newkey rsa:2048 -nodes -keyout "$1.key" -out "$wp/$1.csr" -subj "/CN=$2" \
    -addext "subjectAltName=DNS:$2"
  openssl ca -batch -config "$wp/ca.cnf" -cert ca.pem -keyfile "$wp/ca.key" \
    -in "$wp/$1.csr" -out "$1.pem" -startdate "$3" -enddate "$4" -notext
}

issue valid example.test 20200101000000Z 21200101000000Z
issue wrong-host other.test 20200101000000Z 21200101000000Z
issue expired example.test 20190101000000Z 20200101000000Z
issue not-yet-valid example.test 21000101000000Z 21200101000000Z

openssl req -x509 -newkey rsa:2048 -nodes -keyout self-signed.key -out self-signed.pem -days 36500 \
  -subj "/CN=example.test" -addext "subjectAltName=DNS:example.test"
