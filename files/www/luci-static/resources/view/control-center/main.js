'use strict';
'require view';
'require fs';
'require poll';

var API = '/usr/bin/cc-api';

var CSS = [
'.cc{--bg:#0f1626;--bg2:#141d33;--line:#222e4a;--tx:#e8edf7;--mut:#8fa0c0;--blue:#5b9dff;--green:#2ecc8f;--red:#ff6b6b;--amber:#f5b84b;max-width:1180px;margin:0 auto;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:var(--tx)}',
'.cc *{box-sizing:border-box}',
'.cc-hero{background:linear-gradient(120deg,#0b1f3a,#1b1f4a 70%);border-radius:18px;padding:22px 26px;display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap;margin-bottom:14px;border:1px solid var(--line)}',
'.cc-eyebrow{font-size:11px;letter-spacing:.14em;color:var(--blue);font-weight:700;text-transform:uppercase}',
'.cc-hero h1{margin:6px 0 4px;font-size:26px;color:#fff;font-weight:700}',
'.cc-sub{font-size:12px;color:var(--mut)}',
'.cc-pills{display:flex;gap:8px;flex-wrap:wrap}',
'.cc-pill{font-size:12px;font-weight:600;padding:7px 13px;border-radius:999px;border:1px solid;white-space:nowrap}',
'.cc-ok{color:var(--green);border-color:#1d7a58;background:#0a2a22}',
'.cc-warn{color:var(--amber);border-color:#8a6a22;background:#2b2210}',
'.cc-bad{color:var(--red);border-color:#8a3030;background:#2b1212}',
'.cc-grid{display:grid;gap:14px;margin-bottom:14px}',
'.cc-g4{grid-template-columns:repeat(auto-fit,minmax(230px,1fr))}.cc-g5{grid-template-columns:repeat(auto-fit,minmax(190px,1fr))}',
'.cc-g2{grid-template-columns:repeat(auto-fit,minmax(380px,1fr))}',
'.cc-g3{grid-template-columns:repeat(auto-fit,minmax(300px,1fr))}',
'.cc-card{background:var(--bg);border:1px solid var(--line);border-radius:16px;padding:16px 18px;min-width:0}',
'.cc-lbl{font-size:10.5px;letter-spacing:.12em;color:var(--mut);font-weight:700;text-transform:uppercase;margin-bottom:8px}',
'.cc-big{font-size:27px;font-weight:700;line-height:1.15;color:#fff}',
'.cc-small{font-size:12px;color:var(--mut);margin-top:5px}',
'.cc-spark{width:100%;height:38px;margin-top:8px;display:block}',
'.cc-bar{height:6px;border-radius:6px;background:var(--line);overflow:hidden;margin-top:10px}',
'.cc-bar>i{display:block;height:100%;background:var(--blue);border-radius:6px;transition:width .4s}',
'.cc-wx{background:linear-gradient(135deg,#0f1626,#17335c)}',
'.cc-card h3{margin:0 0 12px;font-size:15px;color:#fff;font-weight:700}',
'.cc-tw{overflow-x:auto}',
'.cc table{width:100%;border-collapse:collapse;font-size:12.5px}',
'.cc th{font-size:10.5px;letter-spacing:.08em;color:var(--mut);text-transform:uppercase;text-align:left;padding:7px 8px;border-bottom:1px solid var(--line);font-weight:600;white-space:nowrap}',
'.cc td{padding:9px 8px;border-bottom:1px solid #18223a;white-space:nowrap;color:#cfd8ea}',
'.cc td.n{font-weight:600;color:#fff;max-width:190px;overflow:hidden;text-overflow:ellipsis}',
'.cc td.t{font-weight:700;color:#fff}',
'.cc tr:last-child td{border-bottom:0}',
'.cc-dl{color:var(--blue)}.cc-ul{color:var(--green)}',
'.cc-rows{display:grid;grid-template-columns:1fr auto;gap:8px 12px;font-size:13px}',
'.cc-rows span:nth-child(odd){color:var(--mut)}.cc-rows span:nth-child(even){text-align:right;font-weight:600;color:#fff}',
'.cc-days{display:flex;align-items:flex-end;gap:6px;height:130px;margin-top:6px}',
'.cc-day{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;height:100%;min-width:0}',
'.cc-day .st{width:100%;display:flex;flex-direction:column;justify-content:flex-end;flex:1}',
'.cc-day .st b{display:block;width:100%;background:var(--blue);border-radius:3px 3px 0 0}',
'.cc-day .st u{display:block;width:100%;background:var(--green)}',
'.cc-day em{font-style:normal;font-size:9.5px;color:var(--mut);margin-top:4px}',
'.cc-note{font-size:11.5px;color:var(--mut);margin:2px 4px 18px}'
].join('');

function esc(s) {
	return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
		return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
	});
}

function fmtBytes(b) {
	b = Number(b) || 0;
	var u = ['B', 'KB', 'MB', 'GB', 'TB'], i = 0;
	while (b >= 1024 && i < u.length - 1) { b /= 1024; i++; }
	return (i === 0 ? b.toFixed(0) : b.toFixed(2)) + ' ' + u[i];
}

function fmtRate(bps) {
	bps = Number(bps) || 0;
	if (bps >= 1048576) return (bps / 1048576).toFixed(2) + ' MB/s';
	if (bps >= 1024) return (bps / 1024).toFixed(2) + ' KB/s';
	return bps.toFixed(0) + ' B/s';
}

function fmtUptime(s) {
	s = Math.floor(Number(s) || 0);
	var d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60);
	return (d ? d + 'd ' : '') + h + 'h ' + m + 'm';
}

function spark(arr, color) {
	if (arr.length < 2) return '';
	var max = Math.max.apply(null, arr) || 1, w = 200, h = 36, pts = [];
	for (var i = 0; i < arr.length; i++)
		pts.push((i * w / (arr.length - 1)).toFixed(1) + ',' + (h - 2 - (arr[i] / max) * (h - 6)).toFixed(1));
	return '<svg class="cc-spark" viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="none">' +
		'<polyline fill="none" stroke="' + color + '" stroke-width="2" stroke-linejoin="round" points="' + pts.join(' ') + '"/></svg>';
}

function wxLabel(c) {
	var m = { 0: 'Clear sky', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast', 45: 'Fog', 48: 'Rime fog',
		51: 'Light drizzle', 53: 'Drizzle', 55: 'Heavy drizzle', 61: 'Light rain', 63: 'Rain', 65: 'Heavy rain',
		80: 'Rain showers', 81: 'Rain showers', 82: 'Violent showers', 95: 'Thunderstorm', 96: 'Thunderstorm', 99: 'Thunderstorm' };
	return m[c] || 'Weather';
}

function exec(cmd) { return fs.exec_direct(API, [cmd], 'json'); }

return view.extend({
	hist: { cpu: [], rx: [], tx: [] },
	prev: null,
	info: {},
	usage: null,
	root: null,

	load: function () {
		return Promise.all([
			exec('live').catch(function () { return null; }),
			exec('usage').catch(function () { return null; }),
			exec('info').catch(function () { return {}; })
		]);
	},

	render: function (data) {
		var self = this;
		self.info = data[2] || {};
		self.usage = data[1];

		var root = E('div', { 'class': 'cc' });
		root.innerHTML =
			'<style>' + CSS + '</style>' +
			'<div class="cc-hero"><div>' +
				'<div class="cc-eyebrow">OpenWrt · Network Operations</div>' +
				'<h1>Control Center V3</h1>' +
				'<div class="cc-sub" id="cc-board"></div></div>' +
				'<div class="cc-pills"><span class="cc-pill cc-ok" id="cc-online">● Router online</span>' +
				'<span class="cc-pill cc-ok" id="cc-data">● Traffic data OK</span></div></div>' +

			'<div class="cc-grid cc-g5">' +
				'<div class="cc-card"><div class="cc-lbl">Today · all devices</div><div class="cc-big" id="cc-today"></div><div class="cc-small" id="cc-today2"></div></div>' +
				'<div class="cc-card"><div class="cc-lbl">This month · all devices</div><div class="cc-big" id="cc-month"></div><div class="cc-small" id="cc-month2"></div></div>' +
				'<div class="cc-card"><div class="cc-lbl">Lifetime · all devices</div><div class="cc-big" id="cc-life"></div><div class="cc-small" id="cc-life2"></div></div>' +
				'<div class="cc-card"><div class="cc-lbl" id="cc-tzlbl">Local time</div><div class="cc-big" id="cc-clock"></div><div class="cc-small" id="cc-date"></div></div>' +
				'<div class="cc-card cc-wx"><div class="cc-lbl" id="cc-place">Weather</div><div class="cc-big" id="cc-temp">--</div><div class="cc-small" id="cc-wx2">Loading weather…</div></div>' +
			'</div>' +

			'<div class="cc-grid cc-g4">' +
				'<div class="cc-card"><div class="cc-lbl">CPU usage</div><div class="cc-big" id="cc-cpu">--</div><div id="cc-cpu-s"></div><div class="cc-small" id="cc-load"></div></div>' +
				'<div class="cc-card"><div class="cc-lbl">RAM usage</div><div class="cc-big" id="cc-ram">--</div><div class="cc-small" id="cc-ram2"></div><div class="cc-bar"><i id="cc-ram-b" style="width:0"></i></div><div class="cc-small" id="cc-swap"></div></div>' +
				'<div class="cc-card"><div class="cc-lbl">WAN download</div><div class="cc-big cc-dl" id="cc-wd">--</div><div id="cc-wd-s"></div><div class="cc-small" id="cc-wd2"></div></div>' +
				'<div class="cc-card"><div class="cc-lbl">WAN upload</div><div class="cc-big cc-ul" id="cc-wu">--</div><div id="cc-wu-s"></div><div class="cc-small" id="cc-wu2"></div></div>' +
			'</div>' +

			'<div class="cc-grid cc-g2">' +
				'<div class="cc-card"><h3>Daily usage by device</h3><div class="cc-tw" id="cc-dt"></div></div>' +
				'<div class="cc-card"><h3>Monthly usage by device</h3><div class="cc-tw" id="cc-mt"></div></div>' +
			'</div>' +

			'<div class="cc-grid cc-g3">' +
				'<div class="cc-card"><h3>Last 14 days</h3><div class="cc-days" id="cc-days"></div><div class="cc-small"><span class="cc-dl">■</span> download &nbsp; <span class="cc-ul">■</span> upload</div></div>' +
				'<div class="cc-card"><h3>System health</h3><div class="cc-rows" id="cc-health"></div></div>' +
				'<div class="cc-card"><h3>USB NAS storage</h3><div class="cc-big" id="cc-usb">--</div><div class="cc-small" id="cc-usb2"></div><div class="cc-bar"><i id="cc-usb-b" style="width:0"></i></div></div>' +
			'</div>' +
			'<div class="cc-note" id="cc-foot"></div>';

		self.root = root;
		var q = function (id) { return root.querySelector('#' + id); };
		self.q = q;

		q('cc-board').textContent = (self.info.model || 'Router') + ' · ' + (self.info.release || '') + (self.info.kernel ? ' · kernel ' + self.info.kernel : '');

		if (data[0]) self.applyLive(data[0]);
		else self.setOnline(false);
		if (data[1]) self.applyUsage(data[1]);

		self.tz = self.info.tz || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
		q('cc-tzlbl').textContent = 'Local time · ' + self.tz;
		self.tickClock();
		self.loadWeather();
		var alive = function () { return document.body.contains(root); };
		var t1 = setInterval(function () { if (!alive()) { clearInterval(t1); return; } self.tickClock(); }, 1000);
		var t2 = setInterval(function () { if (!alive()) { clearInterval(t2); return; } self.loadWeather(); }, 15 * 60 * 1000);

		poll.add(function () {
			return exec('live').then(function (d) { self.applyLive(d); }).catch(function () { self.setOnline(false); });
		}, 2);
		poll.add(function () {
			return exec('usage').then(function (d) { self.applyUsage(d); }).catch(function () {});
		}, 30);

		return root;
	},

	setOnline: function (ok) {
		var el = this.q('cc-online');
		el.className = 'cc-pill ' + (ok ? 'cc-ok' : 'cc-bad');
		el.textContent = ok ? '● Router online' : '● Cannot reach backend';
	},

	tickClock: function () {
		var n = new Date();
		this.q('cc-clock').textContent = new Intl.DateTimeFormat(undefined, { timeZone: this.tz, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }).format(n);
		this.q('cc-date').textContent = new Intl.DateTimeFormat(undefined, { timeZone: this.tz, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(n);
	},

	loadWeather: function () {
		var self = this;
		var i = self.info || {};
		self.q('cc-place').textContent = i.place || 'Weather';
		if (!i.lat || !i.lon) { self.q('cc-wx2').textContent = 'Set CC_LAT and CC_LON in /etc/cc-dashboard.conf to enable weather'; return; }
		var url = 'https://api.open-meteo.com/v1/forecast?latitude=' + encodeURIComponent(i.lat) + '&longitude=' + encodeURIComponent(i.lon) + '&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code&timezone=auto';
		fetch(url).then(function (r) { return r.json(); }).then(function (j) {
			var c = j.current;
			self.q('cc-temp').textContent = Math.round(c.temperature_2m) + '°C';
			self.q('cc-wx2').textContent = wxLabel(c.weather_code) + ' · feels like ' + Math.round(c.apparent_temperature) + '° · humidity ' + c.relative_humidity_2m + '%';
		}).catch(function () {
			self.q('cc-wx2').textContent = 'Weather unavailable (needs internet on this device)';
		});
	},

	applyLive: function (d) {
		var self = this, q = this.q, H = this.hist;
		self.setOnline(true);

		// CPU: difference between two /proc/stat readings
		var c = d.cpu, total = 0, i;
		for (i = 0; i < c.length; i++) total += c[i];
		var idle = c[3] + c[4];
		var pct = null;
		if (self.prev) {
			var dt = total - self.prev.total, di = idle - self.prev.idle;
			if (dt > 0) pct = Math.max(0, Math.min(100, 100 * (1 - di / dt)));
		}
		if (pct !== null) {
			H.cpu.push(pct); if (H.cpu.length > 40) H.cpu.shift();
			q('cc-cpu').textContent = pct.toFixed(1) + '%';
			q('cc-cpu-s').innerHTML = spark(H.cpu, '#8b7bff');
		}
		q('cc-load').textContent = 'Load ' + d.load.join(' · ');

		// RAM = MemTotal - MemAvailable (page cache is reclaimable, so it is not "used")
		var used = d.mem_total - d.mem_avail, mp = d.mem_total ? 100 * used / d.mem_total : 0;
		q('cc-ram').textContent = fmtBytes(used * 1024) + ' / ' + fmtBytes(d.mem_total * 1024);
		q('cc-ram2').textContent = mp.toFixed(1) + '% used · ' + fmtBytes(d.mem_avail * 1024) + ' available · cache ' + fmtBytes(d.mem_cached * 1024);
		q('cc-ram-b').style.width = mp.toFixed(1) + '%';
		q('cc-swap').textContent = 'Swap ' + fmtBytes((d.swap_total - d.swap_free) * 1024) + ' / ' + fmtBytes(d.swap_total * 1024);

		// WAN speed from interface byte counters
		if (self.prev && d.up > self.prev.up) {
			var s = d.up - self.prev.up;
			var rd = (d.wan_rx - self.prev.rx) / s, ru = (d.wan_tx - self.prev.tx) / s;
			if (rd < 0) rd = 0;
			if (ru < 0) ru = 0;
			H.rx.push(rd); H.tx.push(ru);
			if (H.rx.length > 40) { H.rx.shift(); H.tx.shift(); }
			q('cc-wd').textContent = fmtRate(rd);
			q('cc-wu').textContent = fmtRate(ru);
			q('cc-wd-s').innerHTML = spark(H.rx, '#5b9dff');
			q('cc-wu-s').innerHTML = spark(H.tx, '#2ecc8f');
		}
		q('cc-wd2').textContent = d.wan_dev + ' · since boot ↓ ' + fmtBytes(d.wan_rx);
		q('cc-wu2').textContent = d.wan_dev + ' · since boot ↑ ' + fmtBytes(d.wan_tx);

		self.prev = { total: total, idle: idle, up: d.up, rx: d.wan_rx, tx: d.wan_tx };

		// USB
		var tot = d.usb[0] * 1024, usd = d.usb[1] * 1024, fre = d.usb[2] * 1024;
		if (d.usb_mounted && tot) {
			q('cc-usb').textContent = fmtBytes(usd) + ' / ' + fmtBytes(tot);
			q('cc-usb2').textContent = fmtBytes(fre) + ' free · ' + (100 * usd / tot).toFixed(0) + '% used';
			q('cc-usb-b').style.width = (100 * usd / tot).toFixed(1) + '%';
		} else {
			q('cc-usb').textContent = 'Not mounted';
			q('cc-usb2').textContent = 'USB drive not mounted';
			q('cc-usb-b').style.width = '0';
		}

		// Health
		q('cc-health').innerHTML =
			'<span>Uptime</span><span>' + fmtUptime(d.up) + '</span>' +
			'<span>Load (1/5/15 min)</span><span>' + esc(d.load.join(' / ')) + '</span>' +
			'<span>DHCP leases</span><span>' + d.leases + '</span>' +
			'<span>WAN interface</span><span>' + esc(d.wan_dev) + '</span>' +
			'<span>Last traffic sample</span><span>' + (d.sampler_last ? fmtUptime(d.now - d.sampler_last) + ' ago' : 'never') + '</span>';

		// Data-health pill: tells you honestly whether the per-device numbers are being collected
		var age = d.sampler_last ? d.now - d.sampler_last : Infinity, pill = q('cc-data');
		if (!d.usb_mounted) { pill.className = 'cc-pill cc-bad'; pill.textContent = '● USB not mounted – no history'; }
		else if (d.sampler_status !== 'ok') { pill.className = 'cc-pill cc-bad'; pill.textContent = '● Sampler: ' + d.sampler_status; }
		else if (age > 900) { pill.className = 'cc-pill cc-warn'; pill.textContent = '● Sampler stalled (' + Math.round(age / 60) + ' min)'; }
		else { pill.className = 'cc-pill cc-ok'; pill.textContent = '● Traffic data OK'; }
	},

	deviceTable: function (list, rk, tk) {
		var rows = list.slice().sort(function (a, b) { return (b[rk] + b[tk]) - (a[rk] + a[tk]); });
		var h = '<table><thead><tr><th>Device</th><th>IP</th><th>Download</th><th>Upload</th><th>Total</th></tr></thead><tbody>';
		if (!rows.length) h += '<tr><td colspan="5">No data yet – first figures appear after the second 5-minute sample.</td></tr>';
		rows.forEach(function (r) {
			h += '<tr><td class="n" title="' + esc(r.mac) + '">' + esc(r.name) + '</td><td>' + esc(r.ip || '—') + '</td>' +
				'<td class="cc-dl">' + fmtBytes(r[rk]) + '</td><td class="cc-ul">' + fmtBytes(r[tk]) + '</td>' +
				'<td class="t">' + fmtBytes(r[rk] + r[tk]) + '</td></tr>';
		});
		return h + '</tbody></table>';
	},

	applyUsage: function (u) {
		var q = this.q;
		q('cc-today').textContent = fmtBytes(u.today.rx + u.today.tx);
		q('cc-today2').innerHTML = '<span class="cc-dl">↓ ' + fmtBytes(u.today.rx) + '</span> &nbsp; <span class="cc-ul">↑ ' + fmtBytes(u.today.tx) + '</span>';
		q('cc-month').textContent = fmtBytes(u.month.rx + u.month.tx);
		if (u.life) {
			q('cc-life').textContent = fmtBytes(u.life.rx + u.life.tx);
			q('cc-life2').innerHTML = '<span class="cc-dl">↓ ' + fmtBytes(u.life.rx) + '</span> &nbsp; <span class="cc-ul">↑ ' + fmtBytes(u.life.tx) + '</span>' + (u.started ? ' · since ' + esc(u.started) : '');
		}
		q('cc-month2').innerHTML = '<span class="cc-dl">↓ ' + fmtBytes(u.month.rx) + '</span> &nbsp; <span class="cc-ul">↑ ' + fmtBytes(u.month.tx) + '</span>';

		var devs = u.devices.filter(function (x) { return x.known; });
		var other = { d: 0, m: 0 };
		u.devices.forEach(function (x) { if (!x.known) { other.d += x.drx + x.dtx; other.m += x.mrx + x.mtx; } });
		q('cc-dt').innerHTML = this.deviceTable(devs, 'drx', 'dtx');
		q('cc-mt').innerHTML = this.deviceTable(devs, 'mrx', 'mtx');

		var max = 1;
		u.days.forEach(function (x) { if (x.rx + x.tx > max) max = x.rx + x.tx; });
		var h = '';
		u.days.forEach(function (x) {
			var hr = 100 * x.rx / max, hu = 100 * x.tx / max;
			h += '<div class="cc-day" title="' + esc(x.d) + ': ↓ ' + fmtBytes(x.rx) + ' ↑ ' + fmtBytes(x.tx) + '"><div class="st">' +
				'<u style="height:' + hu.toFixed(1) + '%"></u><b style="height:' + hr.toFixed(1) + '%"></b></div><em>' + esc(x.d.slice(8)) + '</em></div>';
		});
		q('cc-days').innerHTML = h;
		q('cc-foot').textContent = 'Per-device figures come from nlbwmon, sampled every 5 minutes and stored on the USB drive' +
			(u.started ? ' · counting since ' + u.started : '') + ' · dates are in ' + this.tz + '.' +
			(other.m > 0 ? ' Traffic from unidentified devices (not listed above, but included in the totals): ' + fmtBytes(other.d) + ' today, ' + fmtBytes(other.m) + ' this month.' : '');
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
