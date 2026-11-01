// Validate translated batches against the extracted batches (best-effort triage; hard FAILs block, WARNs go to the hand-check list).
// usage: node validate.mjs <batchesDir> <outDir> [app...]
import fs from 'node:fs'; import path from 'node:path';
const [batchDir, outDir, ...only] = process.argv.slice(2);
const apps = only.length ? only : fs.readdirSync(outDir).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5));
const ALLOWED_LATIN = new Set(['WebDAV', 'CalDAV', 'CardDAV', 'DAV', 'OCS', 'OCC', 'occ', 'URL', 'URLs', 'API', 'PDF', 'JSON', 'SMTP', 'IMAP', 'POP3', 'LDAP', 'SAML', 'OIDC', 'TOTP', 'HTML', 'CSS', 'CSV', 'ICS', 'vCard', 'iCal', 'iCalendar', 'HTTP', 'HTTPS', 'SSL', 'TLS', 'SSH', 'DNS', 'IP', 'PHP', 'SQL', 'ID', 'UID', 'RFC', 'UTC', 'GMT', 'AM', 'PM', 'MB', 'GB', 'KB', 'TB', 'GPS', 'QR', 'SIP', 'NAT', 'TURN', 'STUN', 'HPB', 'MP3', 'MP4', 'WebRTC', 'Markdown', 'Docker', 'GitHub', 'Google', 'Microsoft', 'Outlook', 'Gmail', 'iOS', 'Android', 'Windows', 'macOS', 'Linux', 'Apple', 'Matterbridge', 'Collabora', 'Talk', 'Office', 'Zoom', 'Skype', 'Jitsi', 'Bluesky', 'Mastodon', 'Twitter', 'X', 'LinkedIn', 'Facebook', 'Instagram', 'WhatsApp', 'Telegram', 'Signal', 'Matrix', 'IRC', 'XMPP', 'Wi', 'wi', 'OpenStreetMap', 'Nominatim', 'GIF', 'PNG', 'JPEG', 'SVG', 'ODF', 'DOCX', 'XLSX', 'PPTX', 'ODT', 'ODS', 'ODP', 'Enter', 'Shift', 'Ctrl', 'Alt', 'Esc', 'Tab', 'Delete', 'Backspace', 'CalDAV', 'WebCal', 'webcal', 'S/MIME', 'PGP', 'GPG', 'DKIM', 'SPF', 'DMARC', 'OAuth', 'OAuth2', 'JWT', 'CLI', 'LAN', 'VPN', 'PIN', 'OTP', 'SMS', 'RSS', 'ZIP', 'TAR']);
const NAME_BAD = /nextcloud|ن[ايِى]?كست\s*كلا?و?د|ناكست/i;
const stripNonText = (s) => s.replace(/"?[\w.…~-]*\/[\w./…~-]+"?/g, ' ').replace(/<[^>]+>/g, ' ').replace(/https?:\/\/\S+|[\w.+-]+@[\w.-]+\.\w+/g, ' ').replace(/\{[^}]+\}|%\d*\$?[sdn]|%[a-z]|:[a-z_]+:/gi, ' ').replace(/`[^`]*`/g, ' ');
const tokens = (s) => [...s.matchAll(/\{[^}]+\}|%\d+\$[sd]|%n|%[sd]/g)].map((m) => m[0]);
const tags = (s) => [...s.matchAll(/<\/?([a-zA-Z][a-zA-Z0-9]*)/g)].map((m) => m[0].toLowerCase());
const hrefs = (s) => [...s.matchAll(/href="([^"]*)"/g)].map((m) => m[1]);
let fails = 0, warns = 0; const report = [];
for (const app of apps) {
  const bf = path.join(batchDir, `${app}.json`), of = path.join(outDir, `${app}.json`);
  let B, O; try { B = JSON.parse(fs.readFileSync(bf, 'utf8')); } catch (e) { report.push(`FAIL ${app}: batch unreadable`); fails++; continue; }
  try { O = JSON.parse(fs.readFileSync(of, 'utf8')); } catch (e) { report.push(`FAIL ${app}: output missing or invalid JSON (${String(e.message).slice(0, 60)})`); fails++; continue; }
  const bk = Object.keys(B), ok = Object.keys(O);
  for (const k of bk) if (!(k in O)) { report.push(`FAIL ${app}: missing key ${JSON.stringify(k.slice(0, 70))}`); fails++; }
  for (const k of ok) if (!(k in B)) { report.push(`FAIL ${app}: unknown key ${JSON.stringify(k.slice(0, 70))}`); fails++; }
  for (const k of bk) { if (!(k in O)) continue; const v = O[k], pl = Array.isArray(B[k]); const src = pl ? k.split('_::_') : [k];
    if (pl && !(Array.isArray(v) && v.length === 6)) { report.push(`FAIL ${app}: plural key needs 6 forms: ${JSON.stringify(k.slice(0, 60))}`); fails++; continue; }
    if (!pl && typeof v !== 'string') { report.push(`FAIL ${app}: value must be a string: ${JSON.stringify(k.slice(0, 60))}`); fails++; continue; }
    const forms = pl ? v : [v];
    forms.forEach((f, i) => { const at = `${app}: ${JSON.stringify(k.slice(0, 50))}${pl ? ` [form ${i}]` : ''}`;
      if (typeof f !== 'string' || f.trim() === '') { report.push(`FAIL ${at}: empty`); fails++; return; }
      if (f.trim() === k.trim() && /[A-Za-z]{3,}/.test(stripNonText(k))) { report.push(`WARN ${at}: same as English`); warns++; }
      const need = new Set(src.flatMap(tokens)); const have = new Set(tokens(f));
      for (const t of need) { if (have.has(t)) continue; if (pl && (t === "%n" || /^{(i|n|[a-zA-Z]*(count|Count)|number|num)}$/.test(t)) && i <= 2) continue; report.push(`FAIL ${at}: missing ${t}`); fails++; }
      for (const t of have) if (!need.has(t)) { report.push(`FAIL ${at}: extra ${t}`); fails++; }
      const st = src.flatMap(tags).sort().join(), ft = tags(f).sort().join(); if (st !== ft) { report.push(`FAIL ${at}: HTML tags differ (${st} vs ${ft})`); fails++; }
      if (src.flatMap(hrefs).sort().join() !== hrefs(f).sort().join()) { report.push(`FAIL ${at}: href differs`); fails++; }
      if (NAME_BAD.test(stripNonText(f).replace(/\{nextcloud\}/g, '')) ) { report.push(`FAIL ${at}: product name not replaced`); fails++; }
      if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(f)) { report.push(`FAIL ${at}: control character`); fails++; }
      if ((src[0].match(/\n/g) || []).length !== (f.match(/\n/g) || []).length && !pl) { report.push(`WARN ${at}: line breaks differ`); warns++; }
      if (src[0].includes(' ') && !f.includes(' ') && src[0].length < 60) { report.push(`WARN ${at}: no-break space of the source not kept`); warns++; }
      const lat = [...stripNonText(f).matchAll(/[A-Za-z][A-Za-z0-9'’-]{2,}/g)].map((m) => m[0]).filter((w) => !ALLOWED_LATIN.has(w));
      if (lat.length && !(pl && i > 0)) { report.push(`WARN ${at}: Latin words left: ${[...new Set(lat)].slice(0, 6).join(', ')}`); warns++; }
      if (!/[؀-ۿ]/.test(f) && /[A-Za-z]{3,}/.test(stripNonText(src[0]))) { report.push(`WARN ${at}: no Arabic letters`); warns++; } });
  }
}
fs.writeFileSync(path.join(outDir, '_validation.txt'), report.join('\n') + '\n');
console.log(`apps ${apps.length}  FAIL ${fails}  WARN ${warns}`); console.log(report.filter((l) => l.startsWith('FAIL')).slice(0, 25).join('\n'));
process.exit(fails ? 1 : 0);
