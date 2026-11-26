#!/usr/bin/env bash
# Encrypted, region-local, off-server backup of PostgreSQL + private file storage.
# Nothing leaves the machine: archives are written to BACKUP_DIR, which the operator points at an
# off-server mount (separate volume, remote share, or object bucket mounted read-write).
#
# Required environment:
#   BACKUP_PG_URL        connection string of the database to back up
#   BACKUP_STORAGE_DIR   directory of private file storage to archive
#   BACKUP_DIR           off-server target directory for encrypted archives
#   BACKUP_REGION        label: international | cn-mainland | local
#   BACKUP_PASSPHRASE    OpenSSL passphrase  (or set BACKUP_KEY_FILE to a key file path)
set -euo pipefail

: "${BACKUP_PG_URL:?BACKUP_PG_URL is required}"
: "${BACKUP_STORAGE_DIR:?BACKUP_STORAGE_DIR is required}"
: "${BACKUP_DIR:?BACKUP_DIR is required}"
: "${BACKUP_REGION:=local}"
if [ -z "${BACKUP_PASSPHRASE:-}" ] && [ -z "${BACKUP_KEY_FILE:-}" ]; then
  echo "BACKUP_PASSPHRASE or BACKUP_KEY_FILE is required" >&2
  exit 1
fi

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
mkdir -p "$BACKUP_DIR"

# 1. PostgreSQL custom-format dump (restorable with pg_restore, schema + data + privileges).
pg_dump --dbname="$BACKUP_PG_URL" --format=custom --file="$WORK/db.dump"

# 2. Archive the private file storage, preserving relative object keys.
if [ -d "$BACKUP_STORAGE_DIR" ]; then
  tar -C "$BACKUP_STORAGE_DIR" -cf "$WORK/files.tar" .
else
  echo "warning: BACKUP_STORAGE_DIR missing; archiving an empty file set" >&2
  tar -C "$WORK" -cf "$WORK/files.tar" -T /dev/null
fi

# 3. Encrypt with AES-256-CBC + PBKDF2 (salted).
encrypt() {
  local in="$1" out="$2"
  if [ -n "${BACKUP_KEY_FILE:-}" ]; then
    openssl enc -aes-256-cbc -pbkdf2 -salt -pass "file:$BACKUP_KEY_FILE" -in "$in" -out "$out"
  else
    openssl enc -aes-256-cbc -pbkdf2 -salt -pass "pass:$BACKUP_PASSPHRASE" -in "$in" -out "$out"
  fi
}
DB_OUT="$BACKUP_DIR/jahez-${BACKUP_REGION}-db-${STAMP}.dump.enc"
FILES_OUT="$BACKUP_DIR/jahez-${BACKUP_REGION}-files-${STAMP}.tar.enc"
encrypt "$WORK/db.dump" "$DB_OUT"
encrypt "$WORK/files.tar" "$FILES_OUT"

# 4. Integrity manifest so a restore can detect corruption or tampering.
openssl dgst -sha256 "$DB_OUT" "$FILES_OUT" > "$BACKUP_DIR/jahez-${BACKUP_REGION}-${STAMP}.sha256"

echo "backup complete:"
echo "  $DB_OUT"
echo "  $FILES_OUT"
echo "  $BACKUP_DIR/jahez-${BACKUP_REGION}-${STAMP}.sha256"
