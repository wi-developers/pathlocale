// Combine src/runtime.js with data/<lang>.json into js/pathlocale-l10n-<lang>.js  (deterministic: no dates, sorted keys)
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '..');
const runtime = fs.readFileSync(path.join(root, 'src/runtime.js'), 'utf8');
for (const lang of ['ar', 'en']) {
	const f = path.join(root, 'data', `${lang}.json`);
	if (!fs.existsSync(f)) continue;
	const d = JSON.parse(fs.readFileSync(f, 'utf8'));
	const sortObj = (o) => Object.fromEntries(Object.keys(o).sort().map((k) => [k, o[k]]));
	const apps = Object.fromEntries(Object.keys(d.apps).sort().map((a) => [a, sortObj(d.apps[a])]));
	const footer = JSON.parse(fs.readFileSync(path.join(root, 'data', 'footer.json'), 'utf8'))[lang];
	// phpTexts (sentences that name the product) and phpFixes (other exact sentences, 0.1.4) are one map at run time; the tests keep them apart
	const data = JSON.stringify({ lang, swaps: d.swaps ?? [], footer, phpTexts: { ...(d.phpTexts ?? {}), ...(d.phpFixes ?? {}) }, apps, noFile: [...(d.noFile ?? [])].sort() });
	if (!runtime.includes('const DATA = __PATHLOCALE_DATA__;')) throw new Error('runtime placeholder missing');
	fs.writeFileSync(path.join(root, 'js', `pathlocale-l10n-${lang}.js`), runtime.replace('const DATA = __PATHLOCALE_DATA__;', () => 'const DATA = ' + data + ';'));
	console.log(lang, Object.keys(apps).length, 'apps', data.length, 'bytes of data');
}
