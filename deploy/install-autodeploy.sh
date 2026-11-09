#!/usr/bin/env bash
# ============================================================================
# Hospital HRM — bật tự deploy khi có commit mới trên nhánh main.
#
# Cài systemd timer hrm-deploy.timer: mỗi phút (đổi bằng --interval) chạy
# deploy/deploy.sh dưới tên user sở hữu thư mục dự án. Máy chủ tự hỏi GitHub
# (chỉ cần đi ra Internet) — không mở cổng vào, không cấp quyền gì cho GitHub.
#
#   sudo bash deploy/install-autodeploy.sh                  # cài / cập nhật
#   sudo bash deploy/install-autodeploy.sh --interval=5min
#   sudo bash deploy/install-autodeploy.sh --uninstall      # gỡ
#
# Trước khi cài: dự án đã chạy được bằng npm run setup:prod, và user đó có
# ~/.pgpass cho role hrm_owner (deploy cần để chạy migration) — xem README.
# ============================================================================
set -Eeuo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
UNIT=hrm-deploy
INTERVAL=1min
UNINSTALL=0

die() {
	printf '❌ %s\n' "$*" >&2
	exit 1
}
ok() { printf '  ✅ %s\n' "$*"; }
warn() { printf '  ⚠️  %s\n' "$*"; }

for arg in "$@"; do
	case "$arg" in
		--interval=*) INTERVAL="${arg#*=}" ;;
		--uninstall) UNINSTALL=1 ;;
		-h | --help)
			sed -n '3,15p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
			exit 0
			;;
		*) die "Tham số không hợp lệ: $arg (xem --help)" ;;
	esac
done

[[ $EUID -eq 0 ]] || die "Chạy bằng sudo: sudo bash deploy/install-autodeploy.sh"

if ((UNINSTALL)); then
	systemctl disable --now "$UNIT.timer" 2>/dev/null || true
	rm -f "/etc/systemd/system/$UNIT.service" "/etc/systemd/system/$UNIT.timer"
	systemctl daemon-reload
	ok "Đã gỡ tự deploy"
	exit 0
fi

[[ "$INTERVAL" =~ ^[0-9]+(s|sec|min|h)$ ]] || die "--interval phải có dạng 30s, 1min, 5min, 1h"
[[ -f "$REPO_DIR/docker-compose.prod.yml" && -f "$REPO_DIR/deploy/deploy.sh" ]] ||
	die "Không thấy mã nguồn dự án ở $REPO_DIR"
[[ "$REPO_DIR" != *[[:space:]]* ]] || die "Đường dẫn dự án không được có dấu cách: $REPO_DIR"

APP_USER="$(stat -c %U "$REPO_DIR")"
[[ "$APP_USER" != root ]] || die "Thư mục dự án thuộc root — clone bằng user thường (vd hungnk)"
APP_GROUP="$(id -gn "$APP_USER")"
APP_HOME="$(getent passwd "$APP_USER" | cut -d: -f6)"
as_user() { runuser -u "$APP_USER" -- env HOME="$APP_HOME" GIT_TERMINAL_PROMPT=0 "$@"; }
echo "Tự deploy cho $REPO_DIR (user $APP_USER, kiểm tra mỗi $INTERVAL)"

# ── Kiểm tra điều kiện ──
id -nG "$APP_USER" | tr ' ' '\n' | grep -qx docker ||
	die "User $APP_USER chưa thuộc nhóm docker: sudo usermod -aG docker $APP_USER"
for cmd in git docker psql pg_dump curl flock; do
	command -v "$cmd" >/dev/null || die "Thiếu lệnh $cmd"
done
[[ -f "$REPO_DIR/server/.env.production" ]] ||
	die "Chưa có server/.env.production — chạy npm run setup:prod trước"
branch="$(as_user git -C "$REPO_DIR" symbolic-ref --short -q HEAD || true)"
[[ "$branch" == main ]] || die "Thư mục dự án đang ở nhánh '$branch', cần ở main"
if as_user git -C "$REPO_DIR" fetch --quiet origin main; then
	ok "git fetch không cần nhập mật khẩu"
else
	die "User $APP_USER không git fetch được mà không nhập mật khẩu (repo private → dùng deploy key, xem README)"
fi
pgpass="$APP_HOME/.pgpass"
if [[ -f "$pgpass" ]] && grep -q ':hrm_owner:' "$pgpass"; then
	[[ "$(stat -c %a "$pgpass")" == 600 ]] || {
		chmod 600 "$pgpass"
		ok "Đã chmod 600 $pgpass"
	}
	ok "Có ~/.pgpass cho hrm_owner"
else
	warn "Chưa có $pgpass cho hrm_owner — commit có sửa server/db/postgres/ sẽ deploy lỗi (xem README)"
fi

# ── systemd ──
cat >"/etc/systemd/system/$UNIT.service" <<EOF
# Sinh bởi deploy/install-autodeploy.sh — sửa bằng cách chạy lại script đó
[Unit]
Description=Hospital HRM — deploy commit mới từ GitHub (nhánh main)
After=network-online.target docker.service postgresql.service
Wants=network-online.target

[Service]
Type=oneshot
User=$APP_USER
Group=$APP_GROUP
WorkingDirectory=$REPO_DIR
Environment=HOME=$APP_HOME
Environment=GIT_TERMINAL_PROMPT=0
ExecStart=/usr/bin/env bash $REPO_DIR/deploy/deploy.sh
TimeoutStartSec=30min
Nice=10
EOF

cat >"/etc/systemd/system/$UNIT.timer" <<EOF
# Sinh bởi deploy/install-autodeploy.sh — sửa bằng cách chạy lại script đó
[Unit]
Description=Hospital HRM — kiểm tra commit mới mỗi $INTERVAL

[Timer]
OnBootSec=2min
# Lần đầu ngay sau khi bật timer, sau đó cách nhau $INTERVAL tính từ lúc lần trước chạy xong
OnActiveSec=30s
OnUnitInactiveSec=$INTERVAL
AccuracySec=10s

[Install]
WantedBy=timers.target
EOF

systemctl daemon-reload
systemctl enable --now "$UNIT.timer" >/dev/null
systemctl restart "$UNIT.timer"
ok "Đã bật $UNIT.timer"

cat <<EOF

Xong. Từ giờ push lên main → trong khoảng $INTERVAL máy chủ tự build + chạy bản mới.
  Xem log deploy:     journalctl -u $UNIT -f
  Lần chạy tới:       systemctl list-timers $UNIT.timer
  Deploy ngay:        sudo systemctl start $UNIT
  Tạm dừng / bật lại: sudo systemctl stop $UNIT.timer  /  sudo systemctl start $UNIT.timer
  Gỡ:                 sudo bash deploy/install-autodeploy.sh --uninstall
EOF
