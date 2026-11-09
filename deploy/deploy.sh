#!/usr/bin/env bash
# ============================================================================
# Hospital HRM — cập nhật production từ GitHub (nhánh main).
#
# Chạy tự động mỗi phút bởi systemd timer hrm-deploy.timer (cài bằng
# deploy/install-autodeploy.sh), hoặc chạy tay bằng user sở hữu thư mục dự án:
#   bash deploy/deploy.sh           # chỉ làm khi origin/main có commit mới
#   bash deploy/deploy.sh --force   # làm lại dù không có gì mới (kể cả commit từng lỗi)
#
# Khi có commit mới:
#   1. git merge --ff-only origin/main. Máy chủ không được sửa file đã commit
#      (file env, backup... đã nằm trong .gitignore nên không sao).
#   2. Có thay đổi trong server/db/postgres/ → pg_dump backup vào backup/ rồi
#      chạy lại các file migration bằng role hrm_owner (mật khẩu đọc từ
#      ~/.pgpass). Bỏ qua 000 (role/DB), 001 (tạo bảng), 010 (danh mục cài mới),
#      900 (sequence) — các file còn lại PHẢI idempotent (chạy lại không sao).
#   3. Giữ image đang chạy thành tag :previous → build + thay container, chờ
#      healthcheck, thử gọi trang web.
#   4. Lỗi → quay về image :previous + code cũ, ghi nhớ commit lỗi để không
#      build lại mỗi phút (push commit sửa lỗi, hoặc chạy --force).
#
# Log: journalctl -u hrm-deploy -f
# ============================================================================
set -Eeuo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCRIPT="$REPO_DIR/deploy/deploy.sh"
BRANCH="${DEPLOY_BRANCH:-main}"
COMPOSE=(docker compose -f docker-compose.prod.yml)
BACKUP_DIR="$REPO_DIR/backup"
KEEP_BACKUPS=10
FAILED_MARK="$REPO_DIR/.git/hrm-deploy-failed"
LOCK_FILE="$REPO_DIR/.git/hrm-deploy.lock"
# Không chạy lại khi deploy: tạo role/DB, tạo bảng, danh mục cài mới, đặt lại sequence
SKIP_SQL=(000_roles_database.sql 001_init.sql 010_seed_data.sql 900_reset_sequences.sql)

cd "$REPO_DIR"

log() { printf '%s %s\n' "$(date '+%F %T')" "$*"; }
die() {
	log "❌ $*" >&2
	exit 1
}
short() { git rev-parse --short "$1" 2>/dev/null || printf '%.7s' "$1"; }

# Đọc KEY=value trong file env (bỏ comment cuối dòng, dấu nháy bao ngoài).
env_get() {
	local file=$1 key=$2 v=""
	if [[ -f $file ]]; then
		v="$(sed -n "s/^[[:space:]]*${key}[[:space:]]*=[[:space:]]*//p" "$file" | tail -n 1 |
			sed -E "s/[[:space:]]+#.*$//; s/^(['\"])(.*)\\1$/\\2/; s/\\r$//" || true)"
	fi
	printf '%s' "$v"
}

# Cấu hình server giống docker-compose.prod.yml: .env.production ghi đè .env
cfg() {
	local v
	v="$(env_get "$REPO_DIR/server/.env.production" "$1")"
	[[ -n $v ]] || v="$(env_get "$REPO_DIR/server/.env" "$1")"
	printf '%s' "${v:-$2}"
}

# ── Pha 1: kiểm tra GitHub, kéo code mới ────────────────────────────────────
if [[ "${1:-}" != --after-pull ]]; then
	FORCE=0
	case "${1:-}" in
		--force) FORCE=1 ;;
		"") ;;
		*) die "Tham số không hợp lệ: $1 (chỉ có --force)" ;;
	esac

	# Mỗi lúc chỉ 1 lần deploy (timer + chạy tay cùng lúc)
	exec 9>"$LOCK_FILE"
	flock -n 9 || {
		log "Đang có lần deploy khác chạy — bỏ qua"
		exit 0
	}

	[[ "$(git symbolic-ref --short -q HEAD || true)" == "$BRANCH" ]] ||
		die "Thư mục dự án không ở nhánh $BRANCH (git checkout $BRANCH)"
	git fetch --quiet origin "$BRANCH" || die "git fetch lỗi — kiểm tra mạng / quyền truy cập repo"
	OLD="$(git rev-parse HEAD)"
	NEW="$(git rev-parse "origin/$BRANCH")"

	if ((!FORCE)); then
		[[ "$OLD" != "$NEW" ]] || exit 0
		# Commit này từng deploy lỗi → chờ commit mới, không build lại mỗi phút
		if [[ -f $FAILED_MARK && "$(cat "$FAILED_MARK")" == "$NEW" ]]; then exit 0; fi
	fi

	if ! git diff --quiet || ! git diff --cached --quiet; then
		git status --short >&2
		die "Có file đã commit bị sửa trực tiếp trên máy chủ (ở trên) — hoàn tác bằng 'git checkout -- <file>' rồi sửa qua GitHub"
	fi
	git merge --ff-only --quiet "origin/$BRANCH" ||
		die "Không fast-forward được lên origin/$BRANCH (lịch sử main bị viết lại?) — xử lý tay"

	# Chạy bản deploy.sh vừa kéo về (commit mới có thể đã sửa chính file này).
	# fd 9 được giữ qua exec → vẫn giữ khoá.
	exec bash "$SCRIPT" --after-pull "$OLD" "$NEW" "$FORCE"
fi

# ── Pha 2: migrate + build + thay container ─────────────────────────────────
OLD=$2
NEW=$3
FORCE=${4:-0}
MIGRATED=0
LAST_DUMP=""

# Lỗi trước khi đụng tới container → chỉ cần trả code về bản đang chạy (nếu
# không, lần kiểm tra sau thấy HEAD == origin/main và bỏ qua, code mới không
# bao giờ được deploy).
early_fail() {
	trap - ERR
	git reset --hard -q "$OLD" || true
	log "❌ $* — đã trả code về $(short "$OLD"), container không đổi" >&2
	exit 1
}
die() { early_fail "$*"; }
trap 'early_fail "Lỗi ở dòng $LINENO"' ERR

# Image đang chạy → tag :previous để quay về nhanh, không phải build lại bản cũ
mapfile -t IMAGES < <("${COMPOSE[@]}" config --images 2>/dev/null | sort -u)
((${#IMAGES[@]})) || die "Không đọc được danh sách image từ docker-compose.prod.yml"
for img in "${IMAGES[@]}"; do
	if docker image inspect "$img" >/dev/null 2>&1; then
		docker tag "$img" "${img%:*}:previous"
	else
		docker image rm "${img%:*}:previous" >/dev/null 2>&1 || true
	fi
done

rollback() {
	trap - ERR
	local img restored=1
	log "❌ Deploy $(short "$NEW") lỗi — quay về $(short "$OLD")"
	echo "$NEW" >"$FAILED_MARK"
	git reset --hard -q "$OLD" || true
	for img in "${IMAGES[@]}"; do
		if docker image inspect "${img%:*}:previous" >/dev/null 2>&1; then
			docker tag "${img%:*}:previous" "$img" || restored=0
		else
			restored=0
		fi
	done
	if ((restored)); then
		"${COMPOSE[@]}" up -d --wait --wait-timeout 180 ||
			log "⚠ Chạy lại bản cũ cũng lỗi — kiểm tra: docker compose -f docker-compose.prod.yml ps / logs backend"
	else
		log "Không có image cũ để quay về → build lại bản $(short "$OLD")"
		"${COMPOSE[@]}" up -d --build --wait --wait-timeout 300 ||
			log "⚠ Build lại bản cũ cũng lỗi — kiểm tra: docker compose -f docker-compose.prod.yml ps / logs backend"
	fi
	if ((MIGRATED)); then
		log "Lưu ý: migration DB đã chạy, không tự hoàn tác. Backup trước khi migrate: ${LAST_DUMP#"$REPO_DIR"/}"
	fi
	log "Bỏ qua commit $(short "$NEW") cho tới khi có commit mới (hoặc: bash deploy/deploy.sh --force)"
	exit 1
}
# Từ đây mọi lỗi (kể cả die) đều quay về bản cũ
die() {
	log "❌ $*" >&2
	rollback
}
trap rollback ERR

run_migrations() {
	local db port app host f name
	db="$(cfg DB_NAME hrm_hospital)"
	port="$(cfg DB_PORT 5432)"
	app="$(cfg DB_USER hrm_app)"
	host="$(cfg DB_HOST localhost)"
	# host.docker.internal là địa chỉ nhìn từ container; từ máy chủ là localhost
	if [[ ${host,,} == host.docker.internal ]]; then host=localhost; fi
	local psql_args=(-X -q -w -h "$host" -p "$port" -U hrm_owner -d "$db" -v ON_ERROR_STOP=1)

	if ! psql "${psql_args[@]}" -c 'SELECT 1' >/dev/null 2>&1; then
		die "hrm_owner không đăng nhập được PostgreSQL ($host:$port/$db) — kiểm tra ~/.pgpass (README, mục Tự động deploy)"
	fi

	mkdir -p "$BACKUP_DIR"
	LAST_DUMP="$BACKUP_DIR/predeploy_$(date +%Y%m%d_%H%M%S)_$(short "$OLD").dump"
	pg_dump -w -h "$host" -p "$port" -U hrm_owner -d "$db" -Fc -f "$LAST_DUMP"
	chmod 600 "$LAST_DUMP"
	log "Đã backup DB: ${LAST_DUMP#"$REPO_DIR"/}"
	# Giữ $KEEP_BACKUPS bản mới nhất
	ls -1t "$BACKUP_DIR"/predeploy_*.dump | tail -n +$((KEEP_BACKUPS + 1)) | xargs -r rm -f --

	MIGRATED=1
	for f in server/db/postgres/[0-9][0-9][0-9]_*.sql; do
		name="$(basename "$f")"
		if [[ " ${SKIP_SQL[*]} " == *" $name "* ]]; then continue; fi
		log "  psql -f $name"
		psql "${psql_args[@]}" -f "$f"
	done
	# Bảng/hàm mới do hrm_owner tạo đã có quyền nhờ ALTER DEFAULT PRIVILEGES — cấp lại cho chắc
	psql "${psql_args[@]}" <<SQL
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO "$app";
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO "$app";
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO "$app";
SQL
	log "✅ Migration xong"
}

if [[ "$OLD" == "$NEW" ]]; then
	log "Deploy lại $(short "$NEW") (--force)"
else
	log "Deploy $(short "$OLD") → $(short "$NEW")"
	git log --oneline --no-decorate "$OLD..$NEW" | sed 's/^/    /' || true
fi

if ((FORCE)) || ! git diff --quiet "$OLD" "$NEW" -- server/db/postgres; then
	run_migrations
fi

log "Build image + thay container (chờ healthcheck)..."
"${COMPOSE[@]}" up -d --build --remove-orphans --wait --wait-timeout 300

bind="$(env_get "$REPO_DIR/.env" WEB_BIND)"
if [[ -z $bind || $bind == 0.0.0.0 ]]; then bind=127.0.0.1; fi
port="$(env_get "$REPO_DIR/.env" WEB_PORT)"
port="${port:-8081}"
curl -fsS --max-time 15 -o /dev/null "http://$bind:$port/" ||
	die "Container đã chạy nhưng http://$bind:$port/ không trả lời"

trap - ERR
rm -f "$FAILED_MARK"
# Xoá image cũ không còn tag (image :previous vẫn giữ để lần sau quay về)
docker image prune -f >/dev/null 2>&1 || true
log "✅ Đã deploy $(short "$NEW")"
