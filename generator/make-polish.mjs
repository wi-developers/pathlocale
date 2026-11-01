// latin-in-arabic.json -> batches/<app>~polish.json, src/<app>~polish.json (with the current Arabic), and a grouping for translators
import fs from 'node:fs';
const W = 'C:/path-review/loc-work'; const L = JSON.parse(fs.readFileSync(`${W}/mech/latin-in-arabic.json`, 'utf8')); const sizes = [];
for (const [app, m] of Object.entries(L)) {
  const keys = Object.keys(m); const B = {}; const src = [];
  keys.forEach((k, i) => { const pl = k.includes('_::_') || Array.isArray(m[k]); B[k] = pl ? ['', '', '', '', '', ''] : ''; src.push({ i, plural: pl, en: pl ? k.split('_::_') : k, current: m[k] }); });
  fs.writeFileSync(`${W}/batches/${app}~polish.json`, JSON.stringify(B, null, 1)); fs.writeFileSync(`${W}/src/${app}~polish.json`, JSON.stringify(src).replace(/\},\{/g, '},\n{')); sizes.push([`${app}~polish`, keys.length]);
}
sizes.sort((a, b) => b[1] - a[1]); const G = []; for (const [a, n] of sizes) { let g = G.find((g) => g.n + n <= 260); if (!g) { g = { n: 0, apps: [] }; G.push(g); } g.n += n; g.apps.push(a); }
G.forEach((g, i) => console.log(`P${i + 1} ${g.n} ${g.apps.join(' ')}`));
