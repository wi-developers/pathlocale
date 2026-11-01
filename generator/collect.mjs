// raw/<app>.json ([[i, value], ...] from a translator) -> out/<app>.json keyed by the EXACT batch keys; reports index problems.
// usage: node collect.mjs <app>...
import fs from 'node:fs';
const W = 'C:/path-review/loc-work'; let bad = 0;
for (const app of process.argv.slice(2)) {
  let raw; try { raw = JSON.parse(fs.readFileSync(`${W}/raw/${app}.json`, 'utf8')); } catch (e) { console.log(`FAIL ${app}: raw missing/invalid (${String(e.message).slice(0, 60)})`); bad++; continue; }
  const B = JSON.parse(fs.readFileSync(`${W}/batches/${app}.json`, 'utf8')); const keys = Object.keys(B); const seen = new Map(); const out = {};
  if (!Array.isArray(raw)) { console.log(`FAIL ${app}: raw is not an array`); bad++; continue; }
  for (const row of raw) { if (!Array.isArray(row) || row.length !== 2 || !Number.isInteger(row[0])) { console.log(`FAIL ${app}: bad row ${JSON.stringify(row).slice(0, 60)}`); bad++; continue; } if (seen.has(row[0])) { console.log(`FAIL ${app}: duplicate index ${row[0]}`); bad++; } seen.set(row[0], row[1]); }
  keys.forEach((k, i) => { if (!seen.has(i)) { console.log(`FAIL ${app}: index ${i} missing (${JSON.stringify(k.slice(0, 50))})`); bad++; } else out[k] = seen.get(i); });
  for (const i of seen.keys()) if (i < 0 || i >= keys.length) { console.log(`FAIL ${app}: index ${i} out of range`); bad++; }
  fs.writeFileSync(`${W}/out/${app}.json`, JSON.stringify(out, null, 1)); console.log(`${app}: ${Object.keys(out).length}/${keys.length} mapped`);
}
process.exit(bad ? 1 : 0);
