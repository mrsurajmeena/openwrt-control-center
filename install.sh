#!/bin/sh
# OpenWrt Control Center - installer
#
#   One-liner (on the router, as root):
#     wget -qO- https://raw.githubusercontent.com/mrsurajmeena/openwrt-control-center/main/install.sh | sh
#   or from a downloaded copy of this repository:
#     sh install.sh
#
# Optional environment variables:
#   CC_MNT=/mnt/xyz   mount point of the USB drive/SD card used to store history
#   CC_REPO=user/repo CC_BRANCH=main   where to download files from

REPO="${CC_REPO:-mrsurajmeena/openwrt-control-center}"
BRANCH="${CC_BRANCH:-main}"
BASE="https://raw.githubusercontent.com/$REPO/$BRANCH/files"
D="${DESTDIR:-}"          # only used for testing the installer off-router
FILES="usr/bin/cc-sampler usr/bin/cc-api www/luci-static/resources/view/control-center/main.js usr/share/rpcd/acl.d/luci-app-control-center.json usr/share/luci/menu.d/luci-app-control-center.json"

die() { echo "ERROR: $1" >&2; exit 1; }

echo "==> OpenWrt Control Center installer"

# ---- prerequisites -------------------------------------------------------
if [ -z "$D" ]; then
  [ "$(id -u)" = 0 ] || die "run as root"
  [ -d /www/luci-static ] || die "LuCI web interface not found"
  command -v jsonfilter >/dev/null || die "jsonfilter missing"
  if ! command -v nlbw >/dev/null; then
    echo "nlbwmon is required but not installed. Install it first, then re-run this installer:"
    echo "    OpenWrt 25.12 and newer :  apk update && apk add nlbwmon luci-app-nlbwmon"
    echo "    older releases          :  opkg update && opkg install nlbwmon luci-app-nlbwmon"
    exit 1
  fi
fi

# ---- storage -------------------------------------------------------------
MNT="${CC_MNT:-}"
if [ -z "$MNT" ]; then
  MNT=$(awk '$2 ~ /^\/mnt\// {print $2; exit}' /proc/mounts 2>/dev/null)
fi
if [ -z "$MNT" ]; then
  echo "No USB drive / SD card found under /mnt."
  echo "History is stored on external storage to protect the router's flash memory."
  echo "Plug in and mount a drive (LuCI > System > Mount Points), then re-run, or run:"
  echo "    CC_MNT=/path/to/mountpoint sh install.sh"
  [ -z "$D" ] && exit 1
  MNT=/mnt/sda1
fi
echo "    storage: $MNT"

# ---- fetch / copy files --------------------------------------------------
SRC=$(cd "$(dirname "$0")" 2>/dev/null && pwd)
if [ -f "$SRC/files/usr/bin/cc-api" ]; then
  MODE=local
else
  MODE=download
  if command -v uclient-fetch >/dev/null; then FETCH="uclient-fetch -q -O"
  elif command -v wget >/dev/null;        then FETCH="wget -q -O"
  else die "no uclient-fetch/wget available - download the repository and run install.sh from it"; fi
fi

echo "==> Installing files ($MODE)"
for f in $FILES; do
  mkdir -p "$D/$(dirname "/$f")"
  if [ "$MODE" = local ]; then
    cp "$SRC/files/$f" "$D/$f" || die "copy failed: $f"
  else
    $FETCH "$D/$f.tmp" "$BASE/$f" && [ -s "$D/$f.tmp" ] || { rm -f "$D/$f.tmp"; die "download failed: $BASE/$f (check CC_REPO / internet / CA certificates)"; }
    mv "$D/$f.tmp" "$D/$f"
  fi
  sed -i 's/\r$//' "$D/$f"
done
chmod 755 "$D/usr/bin/cc-sampler" "$D/usr/bin/cc-api"

# ---- config (never overwritten on upgrade) ------------------------------
mkdir -p "$D/etc"
if [ ! -f "$D/etc/cc-dashboard.conf" ]; then
  TZP=$(uci -q get system.@system[0].timezone 2>/dev/null); [ -n "$TZP" ] || TZP=UTC0
  TZN=$(uci -q get system.@system[0].zonename 2>/dev/null | tr ' ' '_'); [ -n "$TZN" ] || TZN=UTC
  cat > "$D/etc/cc-dashboard.conf" <<CONF
# OpenWrt Control Center settings (shell syntax). Edit, then reload the page.

# Time zone used for "today"/"this month" boundaries (POSIX string) and for the clock (IANA name)
CC_TZ="$TZP"
CC_TZ_NAME="$TZN"

# Where history is stored (must be a mounted USB drive / SD card)
CC_MNT="$MNT"

# Weather tile (free Open-Meteo API, called from your browser). Leave LAT/LON empty to disable.
# Find coordinates by right-clicking your location in Google Maps.
CC_PLACE=""
CC_LAT=""
CC_LON=""

# Set to 1 if Download and Upload look swapped compared with LuCI > Services > Network Bandwidth Monitor
CC_SWAP=0
CONF
  echo "    created /etc/cc-dashboard.conf (timezone $TZN)"
fi
[ -f "$D/etc/cc-names.conf" ] || cat > "$D/etc/cc-names.conf" <<'NAMES'
# Friendly names for devices, one per line:  MAC  Name
# Example:
# aa:bb:cc:dd:ee:ff Alice's phone
NAMES

# ---- system integration (skipped when testing with DESTDIR) -------------
if [ -z "$D" ]; then
  mkdir -p "$MNT/cc-data"
  /etc/init.d/nlbwmon enable 2>/dev/null; /etc/init.d/nlbwmon start 2>/dev/null

  echo "==> Scheduling sampler every 5 minutes"
  touch /etc/crontabs/root
  grep -v 'cc-sampler' /etc/crontabs/root > /tmp/cc-cron.new
  echo '*/5 * * * * /usr/bin/cc-sampler >/dev/null 2>&1' >> /tmp/cc-cron.new
  cat /tmp/cc-cron.new > /etc/crontabs/root; rm -f /tmp/cc-cron.new
  /etc/init.d/cron enable 2>/dev/null; /etc/init.d/cron restart 2>/dev/null

  echo "==> Taking first baseline sample"
  /usr/bin/cc-sampler || echo "WARNING: first sample failed: $(cat "$MNT/cc-data/status" 2>/dev/null)"

  echo "==> Refreshing LuCI"
  rm -rf /tmp/luci-indexcache* /tmp/luci-modulecache 2>/dev/null
  /etc/init.d/rpcd restart

  echo "==> Self-test"
  echo "    info : $(/usr/bin/cc-api info)"
  echo "    live : $(/usr/bin/cc-api live | cut -c1-120)..."

  if [ "$(uci -q get firewall.@defaults[0].flow_offloading_hw)" = 1 ] || [ "$(uci -q get firewall.@defaults[0].flow_offloading)" = 1 ]; then
    echo
    echo "NOTE: flow offloading is on. Offloaded connections can bypass per-device accounting,"
    echo "      so device totals may read low. LuCI > Network > Firewall > General Settings."
  fi
fi

echo
echo "DONE. Open LuCI > Status > Control Center (press Ctrl+F5 once)."
echo "Per-device totals start from now; the first numbers appear after the second 5-minute sample."
