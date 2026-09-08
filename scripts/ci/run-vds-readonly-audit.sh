#!/usr/bin/env bash
set -Eeuo pipefail

: "${SOURCE_DATABASE_URL:?SOURCE_DATABASE_URL is required}"
: "${SSH_HOST:?SSH_HOST is required}"
: "${SSH_USER:?SSH_USER is required}"

OUTPUT_DIR="${OUTPUT_DIR:-rehearsal-output}"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/rehearsal_audit_key}"
SSH_OPTS=(-i "$SSH_KEY" -o StrictHostKeyChecking=yes -o ServerAliveInterval=20 -o ServerAliveCountMax=30 -o TCPKeepAlive=yes -o ConnectTimeout=20)
REMOTE="${SSH_USER}@${SSH_HOST}"

mkdir -p "$OUTPUT_DIR/vds-private"
chmod 700 "$OUTPUT_DIR/vds-private"

source_fingerprint=$(printf '%s' "$SOURCE_DATABASE_URL" | sha256sum | awk '{print $1}')
vds_fingerprint=$(ssh "${SSH_OPTS[@]}" "$REMOTE" "bash -s" <<'REMOTE_SCRIPT'
set -Eeuo pipefail
env_file=/var/www/sherkozu/current/.env
[ -r "$env_file" ] || { echo "VDS .env is not readable" >&2; exit 1; }
database_url=$(sed -n 's/^DATABASE_URL=//p' "$env_file" | head -n 1)
[ -n "$database_url" ] || { echo "DATABASE_URL is absent in VDS .env" >&2; exit 1; }
printf '%s' "$database_url" | sha256sum | awk '{print $1}'
REMOTE_SCRIPT
)

ssh "${SSH_OPTS[@]}" "$REMOTE" "bash -s" > "$OUTPUT_DIR/vds-private/authorized-key-fingerprints.tsv" <<'REMOTE_SCRIPT'
set -Eeuo pipefail
printf 'owner\tpath\tfingerprint\ttype\tcomment\n'
for key_file in /root/.ssh/authorized_keys /home/*/.ssh/authorized_keys; do
  [ -r "$key_file" ] || continue
  owner=$(stat -c '%U' "$key_file")
  while IFS= read -r line; do
    case "$line" in
      ssh-*|ecdsa-*|sk-*) ;;
      *) continue ;;
    esac
    fingerprint=$(printf '%s\n' "$line" | ssh-keygen -lf - -E sha256 2>/dev/null | awk '{print $2}')
    key_type=$(printf '%s\n' "$line" | awk '{print $1}')
    comment=$(printf '%s\n' "$line" | cut -d' ' -f3-)
    printf '%s\t%s\t%s\t%s\t%s\n' "$owner" "$key_file" "$fingerprint" "$key_type" "$comment"
  done < "$key_file"
done
REMOTE_SCRIPT

ssh "${SSH_OPTS[@]}" "$REMOTE" "bash -s" > "$OUTPUT_DIR/vds-private/backup-status.txt" <<'REMOTE_SCRIPT'
set -Eeuo pipefail
echo '=== backup paths ==='
for path in /var/backups /var/www/sherkozu/backups /var/www/sherkozu/shared/backups; do
  if [ -e "$path" ]; then
    printf '%s\tbytes=%s\tmodified=%s\n' "$path" "$(du -sb "$path" 2>/dev/null | awk '{print $1}')" "$(stat -c '%y' "$path")"
  else
    printf '%s\tabsent\n' "$path"
  fi
done
echo '=== backup-related timers ==='
systemctl list-timers --all --no-pager 2>/dev/null | grep -Ei 'backup|snapshot|dump|mysql|maria' || true
echo '=== root cron backup commands ==='
crontab -l 2>/dev/null | grep -Ei 'backup|snapshot|dump|mysqldump|mariadb' || true
REMOTE_SCRIPT

read -r upload_files upload_bytes upload_latest < <(
  ssh "${SSH_OPTS[@]}" "$REMOTE" "bash -s" <<'REMOTE_SCRIPT'
set -Eeuo pipefail
upload_dir=/var/www/sherkozu/uploads
[ -d "$upload_dir" ] || { echo '0 0 none'; exit 0; }
files=$(find "$upload_dir" -type f -print | wc -l | tr -d ' ')
bytes=$(du -sb "$upload_dir" | awk '{print $1}')
latest=$(find "$upload_dir" -type f -printf '%TY-%Tm-%TdT%TH:%TM:%TSZ\n' 2>/dev/null | sort | tail -n 1)
printf '%s %s %s\n' "$files" "$bytes" "${latest:-none}"
REMOTE_SCRIPT
)

ssh "${SSH_OPTS[@]}" "$REMOTE" "tar -C /var/www/sherkozu -czf - uploads" > "$OUTPUT_DIR/vds-uploads.tar.gz"
archive_sha=$(sha256sum "$OUTPUT_DIR/vds-uploads.tar.gz" | awk '{print $1}')
key_count=$(awk 'NR > 1 { n++ } END { print n+0 }' "$OUTPUT_DIR/vds-private/authorized-key-fingerprints.tsv")

SOURCE_FP="$source_fingerprint" VDS_FP="$vds_fingerprint" UPLOAD_FILES="$upload_files" \
UPLOAD_BYTES="$upload_bytes" UPLOAD_LATEST="$upload_latest" ARCHIVE_SHA="$archive_sha" KEY_COUNT="$key_count" \
node --input-type=module <<'NODE' > "$OUTPUT_DIR/vds-audit-summary.json"
const summary = {
  createdAt: new Date().toISOString(),
  githubDatabaseSecretSha256: process.env.SOURCE_FP,
  vdsDatabaseUrlSha256: process.env.VDS_FP,
  databaseUrlFingerprintMatches: process.env.SOURCE_FP === process.env.VDS_FP,
  authorizedKeyCount: Number(process.env.KEY_COUNT),
  uploads: {
    fileCount: Number(process.env.UPLOAD_FILES),
    bytes: Number(process.env.UPLOAD_BYTES),
    latestModifiedUtc: process.env.UPLOAD_LATEST,
    tarGzSha256BeforeEncryption: process.env.ARCHIVE_SHA,
  },
  productionMutations: 0,
};
console.log(JSON.stringify(summary, null, 2));
NODE

printf 'VDS read-only audit complete: database fingerprint match=%s, uploads=%s files, authorized keys=%s\n' \
  "$([ "$source_fingerprint" = "$vds_fingerprint" ] && echo yes || echo no)" "$upload_files" "$key_count"
