// Which Arabic values (enabled apps + core) carry the product name, and in which spellings?  usage: node rename-scan.mjs <rootDir>...
import fs from 'node:fs'; import path from 'node:path';
const ENABLED = new Set(fs.readFileSync('C:/path-review/loc-tools/extract-missing.mjs', 'utf8').match(/const ENABLED = '([^']+)'/)[1].split(' '));
const roots = process.argv.slice(2); const forms = {}; let entries = 0; const perApp = {};
const NAME = /[\u0600-\u06FF]*\s?(?:ن[ايِى]?كست|ناكست)\s?(?:كلاود|كلود|كلاوود)|next\s?cloud/gi;
for (const root of roots) for (const sub of ['core', 'apps', 'extra-apps']) {
  const base = path.join(root, sub); if (!fs.existsSync(base)) continue;
  const dirs = sub === 'core' ? [['core', base]] : fs.readdirSync(base).map((a) => [a, path.join(base, a)]);
  for (const [app, dir] of dirs) { if (!ENABLED.has(app)) continue;
    let t; try { t = JSON.parse(fs.readFileSync(path.join(dir, 'l10n', 'ar.json'), 'utf8')).translations; } catch { continue; }
    for (const [k, v] of Object.entries(t)) { const s = Array.isArray(v) ? v.join(' | ') : String(v); const m = s.match(NAME); if (!m) continue; entries++; perApp[app] = (perApp[app] || 0) + 1; for (const x of m) forms[x.trim()] = (forms[x.trim()] || 0) + 1; } } }
console.log('entries', entries, JSON.stringify(perApp)); console.log(Object.entries(forms).sort((a, b) => b[1] - a[1]).map(([k, v]) => v + '\t' + k).join('\n'));
