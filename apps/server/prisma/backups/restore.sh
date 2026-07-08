#!/usr/bin/env bash
# issue-board SQLite 데이터 스냅샷 복원기.
# 사용법: bash restore.sh [스냅샷.sql]
#   인자 없으면 이 폴더에서 가장 최신 snapshot-*.sql 을 사용.
#
# 동작: apps/server/prisma/issue-board.db 를 스냅샷으로 교체한다.
#   - 기존 db 가 있으면 issue-board.db.bak 으로 백업 후 덮어씀.
#   - 덤프에 스키마 + 데이터 + _prisma_migrations 가 모두 들어 있어,
#     복원 후 prisma migrate 를 따로 돌릴 필요가 없다. (prisma generate 만 하면 됨)
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PRISMA_DIR="$(dirname "$HERE")"
DB="$PRISMA_DIR/issue-board.db"

SNAP="${1:-}"
if [[ -z "$SNAP" ]]; then
  SNAP="$(ls -t "$HERE"/snapshot-*.sql 2>/dev/null | head -1 || true)"
fi
if [[ -z "$SNAP" || ! -f "$SNAP" ]]; then
  echo "복원할 스냅샷 .sql 을 찾지 못했습니다. 경로를 인자로 넘겨주세요." >&2
  exit 1
fi

if [[ -f "$DB" ]]; then
  cp "$DB" "$DB.bak"
  echo "기존 DB 백업 → $DB.bak"
  rm -f "$DB"
fi

sqlite3 "$DB" < "$SNAP"
echo "복원 완료: $SNAP → $DB"
echo "테이블 행 수:"
for t in Project Plan PlanVersion Issue Domain Wireframe; do
  printf "  %-14s %s\n" "$t" "$(sqlite3 "$DB" "SELECT COUNT(*) FROM \"$t\";")"
done
echo "다음: (apps/server 에서) npx prisma generate && pnpm dev"
