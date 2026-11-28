#!/bin/sh
set -eu

if [ "${RENEWED_LINEAGE:-}" = /etc/letsencrypt/live/warehouse.jahez.online ]; then
  nginx -t
  systemctl reload nginx
fi
