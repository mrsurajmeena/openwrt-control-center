# OpenWrt Control Center

A modern dark dashboard for [OpenWrt](https://openwrt.org) that lives inside LuCI (**Status → Control Center**).
It shows router health, live internet speed, USB storage and — the main point — **accurate per-device data usage** (today, this month, lifetime) with friendly device names.

No Docker, no extra web server, no database. It uses what OpenWrt already has: LuCI, `nlbwmon`, `ubus`, `cron` and a few shell scripts.

<!-- Add a screenshot here: drag an image into this file while editing on GitHub -->

## Features

- Live CPU, RAM (`MemTotal − MemAvailable`, so cache is not counted as "used"), WAN download/upload with sparklines, load, uptime
- Per-device **daily**, **monthly** and **lifetime** download/upload, with IPv4 + IPv6 merged per device (grouped by MAC)
- Last-14-days usage chart
- USB/SD storage usage
- Clock in your router's timezone and optional weather tile ([Open-Meteo](https://open-meteo.com), no API key)
- A status pill that turns amber/red if the traffic sampler stalls or the drive is missing, so you know when numbers can't be trusted
- Lightweight: one 5-minute cron job; history is written to external storage, never the router's flash

## Requirements

- OpenWrt with the LuCI web interface (the JavaScript-based LuCI used by 21.02 and newer)
- `nlbwmon` (+ `luci-app-nlbwmon`) installed
- A mounted USB drive or SD card (any filesystem; used only for a small CSV history)

Developed and tested on a JioRouter AX6000 (MediaTek Filogic) running OpenWrt 25.12-SNAPSHOT. Other devices should work but are untested — please open an issue with your results.

## Install

1. Install the prerequisites if needed (LuCI → System → Software, or over SSH):
   - OpenWrt 25.12+: `apk update && apk add nlbwmon luci-app-nlbwmon`
   - older: `opkg update && opkg install nlbwmon luci-app-nlbwmon`
2. Plug in a USB drive and mount it (LuCI → System → Mount Points).
3. SSH into the router and run:

   ```sh
   wget -qO- https://raw.githubusercontent.com/mrsurajmeena/openwrt-control-center/main/install.sh | sh
   ```

   If your router can't download over HTTPS, download this repository as a ZIP on your computer, copy the folder to the router (`scp -O -r openwrt-control-center root@192.168.1.1:/tmp/`) and run `sh /tmp/openwrt-control-center/install.sh`.
4. Open LuCI → **Status → Control Center** and press Ctrl+F5 once.

Device totals start counting at install time. The first numbers appear after the second 5-minute sample.

## Configure

Edit `/etc/cc-dashboard.conf` (created by the installer, kept on upgrade):

| Setting | Meaning |
|---|---|
| `CC_TZ` / `CC_TZ_NAME` | timezone for day/month boundaries and the clock (auto-detected) |
| `CC_MNT` | mount point of the drive that stores history (auto-detected) |
| `CC_LAT`, `CC_LON`, `CC_PLACE` | enable the weather tile (empty = disabled) |
| `CC_SWAP` | set to `1` if download/upload look reversed |

Device names come from DHCP leases and static leases automatically, and are remembered after a device leaves. To override a name, add a line to `/etc/cc-names.conf`:

```
aa:bb:cc:dd:ee:ff Alice's phone
```

Only identified devices are listed; traffic from unidentified devices is still included in the "all devices" totals and summarised in the page footer.

## How the numbers are produced

Every 5 minutes `cc-sampler` reads nlbwmon's cumulative per-MAC counters (`nlbw -c json -g mac`), subtracts the previous reading and appends the difference to `<drive>/cc-data/usage-YYYY-MM.csv`. Daily, monthly and lifetime figures are sums of those increments. A counter that goes backwards (reboot or nlbwmon period rollover) is re-baselined rather than guessed. A lock file prevents overlapping runs, and nothing is written unless the drive is really mounted.

Known limitations:

- Up to ~5 minutes of one device's traffic can be missed around a reboot or month rollover.
- Devices using randomised ("private") Wi-Fi MAC addresses that rotate will appear as new devices. Use a fixed per-network MAC for devices on your home Wi-Fi.
- With **flow offloading** enabled, offloaded connections can bypass nlbwmon, so totals may read low (Network → Firewall → General Settings).

## Troubleshooting

- Run `/usr/bin/cc-api debug` — it lists the MACs nlbwmon counts next to your leases and neighbours.
- Run `/usr/bin/cc-sampler; cat <drive>/cc-data/status` — should print `ok`.
- Blank page: press Ctrl+F5; if still blank, `rm -rf /tmp/luci-*cache*; /etc/init.d/rpcd restart`.

## Privacy

Everything runs on your router. The only outside request is the optional weather tile, made by your browser to `api.open-meteo.com` with the coordinates you configure.

## Uninstall

```sh
sh uninstall.sh            # keeps history and settings
sh uninstall.sh --purge    # removes those too
```

## License

MIT — see [LICENSE](LICENSE).
