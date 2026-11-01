// For each English string seen on an Arabic page: is it in any en_GB.json, and does the matching ar.json have a real translation?
// usage: node check-strings.mjs <strings.json> <rootDir>...   (best-effort triage; exact key match, plus keys that START with the string)
import fs from 'node:fs';
import path from 'node:path';

const [stringsFile, ...roots] = process.argv.slice(2);
const groups = JSON.parse(fs.readFileSync(stringsFile, 'utf8'));

const entries = []; // {app, key, ar}
for (const root of roots) {
  for (const sub of ['core', 'apps', 'extra-apps']) {
    const base = path.join(root, sub);
    if (!fs.existsSync(base)) continue;
    const dirs = sub === 'core' ? [['core', base]] : fs.readdirSync(base).map((a) => [a, path.join(base, a)]);
    for (const [app, dir] of dirs) {
      const l10n = path.join(dir, 'l10n');
      if (!fs.existsSync(l10n)) continue;
      const read = (f) => { try { return JSON.parse(fs.readFileSync(path.join(l10n, f), 'utf8')).translations ?? {}; } catch { return null; } };
      const ref = fs.existsSync(path.join(l10n, 'en_GB.json')) ? read('en_GB.json') : null;
      const ar = fs.existsSync(path.join(l10n, 'ar.json')) ? read('ar.json') : null;
      if (!ref && !ar) continue;
      for (const key of new Set([...Object.keys(ref ?? {}), ...Object.keys(ar ?? {})])) {
        const v = ar ? ar[key] : undefined;
        entries.push({ app, key, ar: v === undefined ? null : (Array.isArray(v) ? v.join(' | ') : String(v)), hasArFile: !!ar });
      }
    }
  }
}

const out = [];
for (const [group, list] of Object.entries(groups)) {
  out.push(`## ${group}`);
  for (const s of list) {
    const hits = entries.filter((e) => e.key === s);
    if (hits.length === 0) {
      const near = entries.filter((e) => e.key.startsWith(s) || (s.length > 14 && e.key.includes(s))).slice(0, 2);
      out.push(`- ${JSON.stringify(s)}: NOT FOUND as a key${near.length ? ` (near: ${near.map((n) => `${n.app}: ${JSON.stringify(n.key.slice(0, 70))}`).join('; ')})` : ''}`);
      continue;
    }
    out.push(`- ${JSON.stringify(s)}: ` + hits.map((h) => `${h.app}: ${!h.hasArFile ? 'NO ar.json' : h.ar === null || h.ar.trim() === '' ? 'MISSING in ar' : h.ar === h.key ? 'ar equals English' : 'translated -> ' + h.ar.slice(0, 40)}`).join(' ; '));
  }
}
console.log(out.join('\n'));
