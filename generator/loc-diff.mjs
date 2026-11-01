// Arabic translation gap report for Nextcloud core and apps (read-only on its inputs).
// usage: node loc-diff.mjs <outDir> <rootDir>[:<label>] ...   (each rootDir holds core/l10n, apps/*/l10n or extra-apps/*/l10n)
// Assurance: best-effort triage. en_GB.json is only a proxy for "all strings of an app" (it may be incomplete);
// anything that does not parse is listed, not skipped silently.
import fs from 'node:fs';
import path from 'node:path';

const [outDir, ...roots] = process.argv.slice(2);
if (!outDir || roots.length === 0) { console.error('usage: node loc-diff.mjs <outDir> <rootDir>...'); process.exit(2); }
fs.mkdirSync(outDir, { recursive: true });

const readJson = (f) => {
  try { return { ok: true, data: JSON.parse(fs.readFileSync(f, 'utf8')) }; }
  catch (e) { return { ok: false, err: String(e.message).slice(0, 120) }; }
};
const asText = (v) => Array.isArray(v) ? v.join(' | ') : String(v ?? '');
const NC = /nextcloud/i;

const rows = [];
const problems = [];
const ncLines = [];

function collect(rootDir) {
  const found = []; // {name, l10nDir}
  const core = path.join(rootDir, 'core', 'l10n');
  if (fs.existsSync(core)) found.push({ name: 'core', dir: core });
  for (const sub of ['apps', 'extra-apps']) {
    const base = path.join(rootDir, sub);
    if (!fs.existsSync(base)) continue;
    for (const app of fs.readdirSync(base).sort()) {
      const dir = path.join(base, app, 'l10n');
      if (fs.existsSync(dir)) found.push({ name: app, dir, where: sub });
    }
  }
  return found;
}

for (const root of roots) {
  for (const { name, dir, where } of collect(root)) {
    const ar = path.join(dir, 'ar.json');
    const ref = path.join(dir, 'en_GB.json');
    const row = { app: name, where: where ?? 'core', ar: fs.existsSync(ar), ref: fs.existsSync(ref),
      refKeys: 0, arKeys: 0, missing: 0, sameAsKey: 0, emptyAr: 0, ncInAr: 0, ncInKeys: 0 };
    let arT = {}, refT = {};
    if (row.ar) {
      const r = readJson(ar);
      if (r.ok) arT = r.data.translations ?? {}; else problems.push(`${name}: ar.json unreadable: ${r.err}`);
    }
    if (row.ref) {
      const r = readJson(ref);
      if (r.ok) refT = r.data.translations ?? {}; else problems.push(`${name}: en_GB.json unreadable: ${r.err}`);
    }
    row.arKeys = Object.keys(arT).length;
    row.refKeys = Object.keys(refT).length;
    const universe = row.ref ? Object.keys(refT) : Object.keys(arT);
    const missing = [];
    for (const k of universe) {
      const v = asText(arT[k]);
      if (!(k in arT) || v.trim() === '') { missing.push(k); continue; }
      if (v === k) row.sameAsKey++;
    }
    row.missing = missing.length;
    for (const [k, v] of Object.entries(arT)) {
      if (NC.test(k)) row.ncInKeys++;
      if (NC.test(asText(v))) { row.ncInAr++; ncLines.push(`[${name}] ${k}  =>  ${asText(v)}`); }
    }
    if (missing.length) fs.writeFileSync(path.join(outDir, `missing-${name}.txt`), missing.join('\n') + '\n');
    rows.push(row);
  }
}

rows.sort((a, b) => b.missing - a.missing);
const head = ['app', 'where', 'ar.json', 'en_GB', 'ref_keys', 'ar_keys', 'missing_in_ar', 'ar_same_as_source', 'Nextcloud_in_ar', 'Nextcloud_in_source_keys'];
const lines = [head.join('\t')];
for (const r of rows) lines.push([r.app, r.where, r.ar ? 'yes' : 'NO', r.ref ? 'yes' : 'no', r.refKeys, r.arKeys, r.missing, r.sameAsKey, r.ncInAr, r.ncInKeys].join('\t'));
const total = rows.reduce((a, r) => ({ missing: a.missing + r.missing, nc: a.nc + r.ncInAr, ncKeys: a.ncKeys + r.ncInKeys, ref: a.ref + r.refKeys }), { missing: 0, nc: 0, ncKeys: 0, ref: 0 });
lines.push(`TOTAL\t\t\t\t${total.ref}\t\t${total.missing}\t\t${total.nc}\t${total.ncKeys}`);
fs.writeFileSync(path.join(outDir, 'summary.tsv'), lines.join('\n') + '\n');
fs.writeFileSync(path.join(outDir, 'nextcloud-in-arabic.txt'), ncLines.join('\n') + '\n');
fs.writeFileSync(path.join(outDir, 'problems.txt'), problems.join('\n') + (problems.length ? '\n' : ''));
console.log(lines.join('\n'));
console.log(`\napps/core with l10n: ${rows.length}; without ar.json: ${rows.filter((r) => !r.ar).map((r) => r.app).join(', ') || 'none'}`);
console.log(`problems: ${problems.length}`);
