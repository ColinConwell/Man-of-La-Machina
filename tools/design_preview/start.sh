#!/bin/sh
set -eu
: "${PREVIEW_PASSWORD_HASH:?A password hash is required for the private design preview}"
exec caddy run --config /etc/caddy/Caddyfile --adapter caddyfile
