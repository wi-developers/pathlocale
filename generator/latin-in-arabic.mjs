// Existing Arabic values (enabled apps + core) that still contain English words -> worklist for a polish pass.  Best-effort triage.
import fs from 'node:fs'; import path from 'node:path';
const src = fs.readFileSync('C:/path-review/loc-tools/validate.mjs', 'utf8');
const ALLOWED = new Set(eval('[' + src.match(/new Set\(\[([\s\S]*?)\]\);/)[1] + ']'));
const ENABLED = new Set(fs.readFileSync('C:/path-review/loc-tools/extract-missing.mjs', 'utf8').match(/const ENABLED = '([^']+)'/)[1].split(' '));
const strip = (s) => s.replace(/<[^>]+>/g, ' ').replace(/https?:\/\/\S+|[\w.+-]+@[\w.-]+\.\w+/g, ' ').replace(/\{[^}]+\}|%\d*\$?[sdn]|%[a-z]|:[a-z_]+:/gi, ' ').replace(/`[^`]*`/g, ' ');
const I = 'C:/path-review/loc-inv'; const out = {}; let n = 0;
for (const root of [`${I}/x-core`, `${I}/x-extra`]) for (const sub of ['core', 'lib', 'apps', 'extra-apps']) {
  const base = `${root}/${sub}`; if (!fs.existsSync(base)) continue;
  const dirs = (sub === 'core' || sub === 'lib') ? [[sub, base]] : fs.readdirSync(base).map((a) => [a, `${base}/${a}`]);
  for (const [app, dir] of dirs) { if (!ENABLED.has(app)) continue; let T; try { T = JSON.parse(fs.readFileSync(`${dir}/l10n/ar.json`, 'utf8')).translations; } catch { continue; }
    for (const [k, v] of Object.entries(T)) { const forms = Array.isArray(v) ? v : [v];
      const lat = forms.flatMap((f) => [...strip(f).matchAll(/[A-Za-z][A-Za-z0-9'’-]{2,}/g)].map((m) => m[0])).filter((w) => !ALLOWED.has(w));
      if (!lat.length) continue; if (forms.join('') === k) continue; (out[app] ??= {})[k] = v; n++; } } }
fs.writeFileSync('C:/path-review/loc-work/mech/latin-in-arabic.json', JSON.stringify(out, null, 1));
console.log('entries', n, Object.entries(out).map(([a, m]) => `${a}:${Object.keys(m).length}`).join(' '));
