#!/bin/sh
# Removes OpenWrt Control Center.  Add --purge to also delete the stored history.
[ "$(id -u)" = 0 ] || { echo "run as root"; exit 1; }
[ -f /etc/cc-dashboard.conf ] && . /etc/cc-dashboard.conf
MNT="${CC_MNT:-/mnt/sda1}"
grep -v 'cc-sampler' /etc/crontabs/root > /tmp/cc-cron.new 2>/dev/null; cat /tmp/cc-cron.new > /etc/crontabs/root; rm -f /tmp/cc-cron.new
/etc/init.d/cron restart 2>/dev/null
rm -f /usr/bin/cc-sampler /usr/bin/cc-api \
      /usr/share/rpcd/acl.d/luci-app-control-center.json \
      /usr/share/luci/menu.d/luci-app-control-center.json
rm -rf /www/luci-static/resources/view/control-center
rm -rf /tmp/luci-indexcache* /tmp/luci-modulecache
/etc/init.d/rpcd restart
if [ "$1" = "--purge" ]; then
  rm -rf "$MNT/cc-data" /etc/cc-dashboard.conf /etc/cc-names.conf
  echo "Removed, including history and settings."
else
  echo "Removed. History kept in $MNT/cc-data and settings in /etc/cc-dashboard.conf (use --purge to delete)."
fi
