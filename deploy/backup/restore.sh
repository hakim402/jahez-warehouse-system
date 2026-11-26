#!/usr/bin/env bash
# Restore an encrypted backup produced by backup.sh into an existing target database and storage dir.
# The target database must already exist (create it first); this overwrites its contents.
#
# Required environment:
#   RESTORE_DB_DUMP       path to the *.dump.enc archive
#   RESTORE_PG_URL        target database connection (contents will be replaced)
#   RESTORE_PASSPHRASE    OpenSSL passphrase  (or set RESTORE_KEY_FILE to a key file path)
# Optional:
#   RESTORE_FILES_ARCHIVE path to the *.tar.enc archive
#   RESTORE_STORAGE_DIR   target directory to extract files into
set -euo pipefail

: "${RESTORE_DB_DUMP:?RESTORE_DB_DUMP is required}"
: "${RESTORE_PG_URL:?RESTORE_PG_URL is required}"
if [ -z "${RESTORE_PASSPHRASE:-}" ] && [ -z "${RESTORE_KEY_FILE:-}" ]; then
  echo "RESTORE_PASSPHRASE or RESTORE_KEY_FILE is required" >&2
  exit 1
fi

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

decrypt() {
  local in="$1" out="$2"
  if [ -n "${RESTORE_KEY_FILE:-}" ]; then
    openssl enc -d -aes-256-cbc -pbkdf2 -pass "file:$RESTORE_KEY_FILE" -in "$in" -out "$out"
  else
    openssl enc -d -aes-256-cbc -pbkdf2 -pass "pass:$RESTORE_PASSPHRASE" -in "$in" -out "$out"
  fi
}

# A wrong passphrase must fail loudly, not restore garbage.
decrypt "$RESTORE_DB_DUMP" "$WORK/db.dump"

# --clean --if-exists makes the restore re-runnable; --no-owner avoids owner-role mismatch.
if [ -n "${RESTORE_FILES_ARCHIVE:-}" ]; then
  : "${RESTORE_STORAGE_DIR:?RESTORE_STORAGE_DIR is required with a files archive}"
  decrypt "$RESTORE_FILES_ARCHIVE" "$WORK/files.tar"
  tar -tf "$WORK/files.tar" >/dev/null
fi
pg_restore --dbname="$RESTORE_PG_URL" --clean --if-exists --no-owner --exit-on-error --single-transaction "$WORK/db.dump" 2>"$WORK/restore.log" || {
  echo "Database restore failed" >&2
  cat "$WORK/restore.log" >&2
  exit 1
}

if [ -n "${RESTORE_FILES_ARCHIVE:-}" ] && [ -n "${RESTORE_STORAGE_DIR:-}" ]; then
  mkdir -p "$RESTORE_STORAGE_DIR"
  tar -C "$RESTORE_STORAGE_DIR" -xf "$WORK/files.tar"
fi

echo "restore complete"
