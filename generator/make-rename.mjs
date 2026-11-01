// Mechanical rename of the product name for the enabled apps + core.
//   en: every en_GB key containing the word "Nextcloud" -> same text with the English name (what English users see is the key itself)
//   ar: every existing Arabic value carrying the name (Latin or transliterated) -> same text with the Arabic name
// usage: node make-rename.mjs <outDir> <rootDir>...      Assurance: best-effort; skipped matches (URLs, e-mails, paths) are listed for hand check.
import fs from 'node:fs'; import path from 'node:path';
const EN = 'Path platform', AR = 'منصة بث';
const ENABLED = new Set(fs.readFileSync('C:/path-review/loc-tools/extract-missing.mjs', 'utf8').match(/const ENABLED = '([^']+)'/)[1].split(' '));
const [outDir, ...roots] = process.argv.slice(2); fs.mkdirSync(outDir, { recursive: true });
const rd = (f) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')).translations ?? null; } catch { return null; } };
const LAT = /(?<![\w@/:.-])Nextcloud(?![\w@/:-]|\.\w)/g;
// Arabic transliteration, optional attached prefix letter (ل ب و ف) and article: "لنكست كلاود" -> "لمنصة بث"; "النكست كلاود" -> "منصة بث"
const TR = /(?:(?<=^|[\s(«"'،:؛])ال|(?<=^|[\s(«"'،:؛])(?=[لبوفك]?ن))([لبوفك]?)ن[ايِى]?كست\s*(?:كلاود|كلود|كلاوود)/g;
const trSimple = /ن[ايِى]?كست\s*(?:كلاود|كلود|كلاوود)/g;
const skipped = [];
const arRename = (s, ctx) => {
  let out = s.replace(/(?<=^|[\s(«"'،:؛])ال(ن[ايِى]?كست\s*(?:كلاود|كلود|كلاوود))/g, '$1');      // drop the article: "النكست كلاود"
  out = out.replace(/(?<=^|[\s(«"'،:؛])([لبوفك]ـ?)(ن[ايِى]?كست\s*(?:كلاود|كلود|كلاوود))/g, (m, p) => p.replace('ـ', '') + AR); // prefix letter stays attached
  out = out.replace(trSimple, AR);
  out = out.replace(LAT, AR);
  const rest = out.match(/nextcloud/gi); if (rest) skipped.push(`${ctx}  ->  ${out.slice(0, 120)}`);
  return out;
};
const enRename = (s, ctx) => { const out = s.replace(LAT, EN); const rest = out.match(/nextcloud/gi); if (rest) skipped.push(`${ctx}  ->  ${out.slice(0, 120)}`); return out; };
const en = {}, ar = {}; let nEn = 0, nAr = 0;
for (const root of roots) for (const sub of ['core', 'lib', 'apps', 'extra-apps']) {
  const base = path.join(root, sub); if (!fs.existsSync(base)) continue;
  const dirs = (sub === 'core' || sub === 'lib') ? [[sub, base]] : fs.readdirSync(base).map((a) => [a, path.join(base, a)]);
  for (const [app, dir] of dirs) { if (!ENABLED.has(app)) continue;
    const ref = rd(path.join(dir, 'l10n', 'en_GB.json')) ?? {}; const t = rd(path.join(dir, 'l10n', 'ar.json')) ?? {};
    for (const k of Object.keys(ref)) { if (!/Nextcloud/.test(k)) continue; const pl = k.includes('_::_'); const forms = pl ? k.split('_::_') : [k];
      const out = forms.map((f) => enRename(f, `en ${app}: ${f.slice(0, 60)}`)); if (out.join('_::_') === k) continue; (en[app] ??= {})[k] = pl ? out : out[0]; nEn++; }
    for (const [k, v] of Object.entries(t)) { const forms = Array.isArray(v) ? v : [v]; if (!forms.some((f) => /nextcloud|ن[ايِى]?كست/i.test(f))) continue;
      const out = forms.map((f) => arRename(f, `ar ${app}: ${k.slice(0, 60)}`)); if (out.join('\u0000') === forms.join('\u0000')) continue; (ar[app] ??= {})[k] = Array.isArray(v) ? out : out[0]; nAr++; } } }
fs.writeFileSync(path.join(outDir, 'rename-en.json'), JSON.stringify(en, null, 1)); fs.writeFileSync(path.join(outDir, 'rename-ar.json'), JSON.stringify(ar, null, 1));
fs.writeFileSync(path.join(outDir, 'rename-skipped.txt'), skipped.join('\n') + '\n');
console.log(`en entries ${nEn} (${Object.keys(en).length} apps); ar entries ${nAr} (${Object.keys(ar).length} apps); lines still mentioning the name after rename: ${skipped.length}`);
