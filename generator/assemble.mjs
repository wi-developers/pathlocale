// Merge validated translations + mechanical renames + hand fixes into pathlocale/data/{ar,en}.json
// ar: rename-ar (existing Arabic with the name replaced) < out/<app> (new translations) < fixes-ar (hand fixes)
// en: rename-en (English text with the English name)     < fixes-en
import fs from 'node:fs';
const W = 'C:/path-review/loc-work', P = 'C:/path-review/pathlocale';
const rd = (f, d = {}) => fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : d;
const ar = {}, en = {}; const stats = {};
for (const [app, m] of Object.entries(rd(`${W}/mech/rename-ar.json`))) { ar[app] = { ...m }; stats[app] = { rename: Object.keys(m).length, translated: 0, fixed: 0 }; }
const only = process.argv.slice(2);
for (const f of fs.readdirSync(`${W}/out`).filter((x) => x.endsWith('.json') && !x.startsWith('_')).sort((a, b) => Number(a.includes('~')) - Number(b.includes('~')) || a.localeCompare(b))) {
  const name = f.slice(0, -5); const app = name.replace('~polish', ''); if (only.length && !only.includes(name)) continue;
  const o = rd(`${W}/out/${f}`); ar[app] = { ...(ar[app] ?? {}), ...o }; (stats[app] ??= { rename: 0, translated: 0, fixed: 0 }).translated += Object.keys(o).length;
}
for (const [app, m] of Object.entries(rd(`${W}/mech/fixes-ar.json`))) { ar[app] = { ...(ar[app] ?? {}), ...m }; (stats[app] ??= { rename: 0, translated: 0, fixed: 0 }).fixed = Object.keys(m).length; }
for (const [app, m] of Object.entries(rd(`${W}/mech/rename-en.json`))) en[app] = { ...m };
for (const [app, m] of Object.entries(rd(`${W}/mech/fixes-en.json`))) en[app] = { ...(en[app] ?? {}), ...m };
// --- upstream names that must stay (data/footer.json "keep"), and the exact-sentence map for PHP-rendered pages (phpTexts)
const FOOT = rd(P + '/data/footer.json');
const KEEP = FOOT.en.keep.map((p) => new RegExp(p));
const ATTR = 'Developed by the {communityopen}Nextcloud community{linkclose}, the {githubopen}source code{linkclose} is licensed under the {licenseopen}AGPL{linkclose}.';
const keepKey = (k) => k !== ATTR && KEEP.some((r) => r.test(k));
const TRN = /(?:ال)?([لبوفك]?)ن[ايِى]?كست\s*(?:كلاود|كلود|كلاوود)/g;
const toLatin = (v) => v.replace(TRN, (m, p) => (p ? p + 'ـ' : '') + 'Nextcloud');
const orig = {}; // upstream Arabic values, by app, for every key that carries the name
for (const root of ['C:/path-review/loc-inv/x-core', 'C:/path-review/loc-inv/x-extra']) for (const sub of ['core', 'lib', 'apps', 'extra-apps']) {
  const base = root + '/' + sub; if (!fs.existsSync(base)) continue;
  const dirs = (sub === 'core' || sub === 'lib') ? [[sub, base]] : fs.readdirSync(base).map((a) => [a, base + '/' + a]);
  for (const [app, dir] of dirs) { const t = rd(dir + '/l10n/ar.json')?.translations; if (t) orig[app] = { ...(orig[app] ?? {}), ...t }; }
}
let keptAr = 0, keptEn = 0;
for (const [app, m] of Object.entries(en)) for (const k of Object.keys(m)) if (keepKey(k)) { delete m[k]; keptEn++; }
for (const [app, m] of Object.entries(ar)) for (const [k, v] of Object.entries(m)) {
  if (!keepKey(k) || (rd(W + '/mech/fixes-ar.json')[app] ?? {})[k] !== undefined) continue;
  const base = v; const forms = Array.isArray(base) ? base : [base];
  const out = forms.map((x) => toLatin(x).replace(/(?<=^|[\s(«"'،:؛])([لبوفك])منصة بث/g, '$1ـNextcloud').replace(/منصة بث/g, 'Nextcloud'));
  m[k] = Array.isArray(base) ? out : out[0]; keptAr++;
}
const norm = (x) => x.replace(/\s+/g, ' ').trim();
const phpAr = {}, phpEn = {};
for (const [k, v] of Object.entries(en.settings ?? {})) if (typeof v === 'string' && !k.includes('_::_') && k !== ATTR) phpEn[norm(k)] = v;
for (const [k, v] of Object.entries(ar.settings ?? {})) { const o = orig.settings?.[k]; if (typeof o === 'string' && typeof v === 'string' && /ن[ايِى]?كست|Nextcloud/.test(o) && !keepKey(k) && k !== ATTR) phpAr[norm(o)] = v; }
console.log('kept upstream name: ar', keptAr, 'en', keptEn, '; phpTexts ar', Object.keys(phpAr).length, 'en', Object.keys(phpEn).length);
const noFile = ['weather_status', 'webhook_listeners'];
fs.writeFileSync(`${P}/data/ar.json`, JSON.stringify({ apps: ar, noFile, phpTexts: phpAr })); fs.writeFileSync(`${P}/data/en.json`, JSON.stringify({ apps: en, noFile: [], phpTexts: phpEn, swaps: rd(`${W}/mech/swaps-en.json`, []) }));
const cnt = (o) => Object.values(o).reduce((a, m) => a + Object.keys(m).length, 0);
console.log(`ar: ${Object.keys(ar).length} apps, ${cnt(ar)} entries; en: ${Object.keys(en).length} apps, ${cnt(en)} entries`);
console.log(Object.entries(stats).map(([a, s]) => `${a}:${s.rename}r+${s.translated}t+${s.fixed}f`).join(' '));
