// Runs the BUILT runtime (js/pathlocale-l10n-<lang>.js) in a bare vm context with a stub of what Nextcloud provides.
// usage: node --test tests/js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const root = path.resolve(import.meta.dirname, '..', '..');
const load = (lang, setup = () => {}, documentStub) => {
	const ctx = { document: documentStub ?? { body: null, addEventListener() {} }, requestAnimationFrame() {}, MutationObserver: class { observe() {} } };
	ctx.globalThis = ctx;
	vm.createContext(ctx);
	setup(ctx);
	vm.runInContext(fs.readFileSync(path.join(root, 'js', `pathlocale-l10n-${lang}.js`), 'utf8'), ctx);
	return ctx;
};
const data = (lang) => JSON.parse(fs.readFileSync(path.join(root, 'data', `${lang}.json`), 'utf8'));
// a key that is certainly in our Arabic dictionary and one plural key
const arApps = data('ar').apps;
const pick = (app, pred) => { const k = Object.keys(arApps[app]).find(pred); return [k, arApps[app][k]]; };

test('our entry wins over the entry Nextcloud registered, and Nextcloud entries we do not have stay', () => {
	const [key, ours] = pick('core', (k) => !k.includes('_::_'));
	const ctx = load('ar', (c) => { c._oc_l10n_registry_translations = { core: { [key]: 'NEXTCLOUD VALUE', 'other key': 'other value' } }; c._oc_l10n_registry_plural_functions = {}; });
	const reg = ctx._oc_l10n_registry_translations;
	assert.equal(reg.core[key], ours);
	assert.equal(reg.core['other key'], 'other value');
});

test('an entry Nextcloud registers AFTER us does not displace ours (translations are fetched later per app)', () => {
	const [key, ours] = pick('core', (k) => !k.includes('_::_'));
	const ctx = load('ar');
	const reg = ctx._oc_l10n_registry_translations;
	reg.core = { ...(reg.core || {}), [key]: 'LATE NEXTCLOUD VALUE', late: 'late value' }; // what registerAppTranslations does
	assert.equal(reg.core[key], ours);
	assert.equal(reg.core.late, 'late value');
});

test('an app we have no dictionary for is passed through untouched', () => {
	const ctx = load('ar', (c) => { c._oc_l10n_registry_translations = { someapp: { a: 'b' } }; });
	assert.deepEqual({ ...ctx._oc_l10n_registry_translations.someapp }, { a: 'b' });
	assert.equal(ctx._oc_l10n_registry_translations.nope, undefined);
});

test('dangerous app names do not reach our dictionary', () => {
	const ctx = load('ar');
	const reg = ctx._oc_l10n_registry_translations;
	for (const name of ['__proto__', 'constructor', 'prototype', 'toString', 'hasOwnProperty']) {
		const v = reg[name];
		assert.ok(v === undefined || typeof v === 'function' || Object.keys(v).length === 0, `dictionary content reachable through ${name}`);
	}
	assert.equal(Object.keys(arApps).includes('__proto__'), false);
});

test('apps with a dictionary get a plural function when Nextcloud registered none, and keep theirs when it did', () => {
	const mine = () => 7;
	const ctx = load('ar', (c) => { c._oc_l10n_registry_translations = {}; c._oc_l10n_registry_plural_functions = { core: mine }; });
	const pf = ctx._oc_l10n_registry_plural_functions;
	assert.equal(pf.core, mine);
	const other = Object.keys(arApps).find((a) => a !== 'core');
	assert.equal(typeof pf[other], 'function');
	// Arabic: zero, one, two, few, many, other
	for (const [n, form] of [[0, 0], [1, 1], [2, 2], [3, 3], [10, 3], [11, 4], [99, 4], [100, 5], [102, 5], [111, 4], [103, 3]]) assert.equal(pf[other](n), form, `n=${n}`);
});

test('English: plural function is singular/plural', () => {
	const ctx = load('en');
	const app = Object.keys(data('en').apps)[0];
	const pf = ctx._oc_l10n_registry_plural_functions[app];
	assert.equal(pf(1), 0); assert.equal(pf(0), 1); assert.equal(pf(2), 1);
});

test('apps that ship no language file are marked as loaded so core does not fetch a missing file', () => {
	const ctx = load('ar');
	for (const app of data('ar').noFile) assert.ok(app in ctx._oc_l10n_registry_translations, app);
	assert.ok(data('ar').noFile.length > 0);
});

test('loading twice does not wrap twice', () => {
	const ctx = load('ar');
	const first = ctx._oc_l10n_registry_translations;
	vm.runInContext(fs.readFileSync(path.join(root, 'js', 'pathlocale-l10n-ar.js'), 'utf8'), ctx);
	assert.equal(ctx._oc_l10n_registry_translations, first);
});

test('navigation labels written by the server are translated, nothing else is touched', () => {
	const mk = (text) => ({ childNodes: [{ nodeType: 3, nodeValue: text }], get firstChild() { return this.childNodes[0]; }, matches: () => false, getAttribute: () => null });
	const nav = mk('\n Personal\n '); const user = mk('Personal'); const other = mk('Some user folder');
	const body = { id: 'body-user', querySelectorAll: (sel) => (sel.includes('app-navigation-entry__name') ? [nav, other] : []), matches: () => false };
	const ctx = load('ar', (c) => { c._oc_l10n_registry_translations = { core: { Personal: 'شخصي' } }; }, { body, addEventListener() {} });
	void ctx;
	assert.match(nav.firstChild.nodeValue, /شخصي/);
	assert.equal(nav.firstChild.nodeValue.startsWith('\n '), true, 'surrounding white space is kept');
	assert.equal(other.firstChild.nodeValue, 'Some user folder');
	assert.equal(user.firstChild.nodeValue, 'Personal', 'an element outside the navigation selector is not part of the query');
});

test('guest pages get one link to the other language; signed-in pages get none', () => {
	const made = [];
	const mkDoc = (id) => ({ title: '', createTreeWalker: () => ({ nextNode: () => null }), body: { id, querySelectorAll: () => [], matches: () => false, appendChild: (e) => made.push(e) }, createElement: () => ({}), addEventListener() {} });
	load('ar', (c) => { c.OC = { webroot: '' }; c.location = { pathname: '/login', search: '?a=1' }; }, mkDoc('body-login'));
	assert.equal(made.length, 1);
	assert.equal(made[0].lang, 'en');
	assert.equal(made[0].textContent, 'English');
	assert.equal(made[0].href, '/index.php/apps/pathlocale/lang/en?redirect=' + encodeURIComponent('/login?a=1'));
	made.length = 0;
	load('en', (c) => { c.OC = { webroot: '/nc' }; c.location = { pathname: '/s/x', search: '' }; }, mkDoc('body-public'));
	assert.equal(made[0].lang, 'ar'); assert.equal(made[0].href.startsWith('/nc/index.php/apps/pathlocale/lang/ar?'), true);
	made.length = 0;
	load('ar', (c) => { c.OC = { webroot: '' }; c.location = { pathname: '/', search: '' }; }, mkDoc('body-user'));
	assert.equal(made.length, 0);
});

test('English pages: the Arabic name and slogan are swapped in the title and on guest pages only', () => {
	const swaps = data('en').swaps;
	assert.ok(swaps.length >= 1 && swaps.every((p) => p.length === 2 && p[0] && p[1]));
	const [from, to] = swaps[0];
	const mkText = (v, inside) => ({ nodeValue: v, parentElement: { tagName: 'P', closest: (sel) => (inside && sel.includes('.files-list') ? {} : null) } });
	const run = (id, lang = 'en') => {
		const guestText = mkText('Log in to ' + from); const fileText = mkText('report ' + from + '.pdf', true); const script = mkText(from); script.parentElement.tagName = 'SCRIPT';
		const nodes = [guestText, fileText, script]; let i = 0;
		const doc = { title: 'Login - ' + from, createTreeWalker: () => ({ nextNode: () => nodes[i++] ?? null }), body: { id, querySelectorAll: () => [], matches: () => false, appendChild() {} }, createElement: () => ({}), addEventListener() {} };
		load(lang, (c) => { c.OC = { webroot: '' }; c.location = { pathname: '/', search: '' }; }, doc);
		return { doc, guestText, fileText, script };
	};
	const g = run('body-login');
	assert.equal(g.doc.title, 'Login - ' + to);
	assert.equal(g.guestText.nodeValue, 'Log in to ' + to);
	assert.equal(g.fileText.nodeValue, 'report ' + from + '.pdf', 'file lists are not touched');
	assert.equal(g.script.nodeValue, from, 'scripts are not touched');
	const s = run('body-user');
	assert.equal(s.doc.title, 'Login - ' + to, 'the title is swapped on every page');
	assert.equal(s.guestText.nodeValue, 'Log in to ' + from, 'signed-in page text is not touched');
	const a = run('body-login', 'ar');
	assert.equal(a.doc.title, 'Login - ' + from, 'Arabic pages keep the Arabic name');
});

test('personal settings footer: the reasons link is renamed, the "developed by" sentence becomes an attribution, only when the paragraph is the stock one', () => {
	const footerData = JSON.parse(fs.readFileSync(path.join(root, 'data', 'footer.json'), 'utf8'));
	const HREFS = ['https://nextcloud.com/contribute', 'https://github.com/nextcloud', 'https://www.gnu.org/licenses/agpl-3.0.html'];
	for (const lang of ['ar', 'en']) {
		const f = footerData[lang];
		const mkLinks = (hrefs) => hrefs.map((h, i) => ({ tagName: 'A', textContent: 'old' + i, getAttribute: () => h }));
		const mkP = (hrefs) => { const links = mkLinks(hrefs); const p = { tagName: 'P', dataset: {}, children: links, kids: null, replaceChildren(...k) { this.kids = k; } }; links.forEach((a) => { a.parentElement = p; }); return p; };
		const stock = mkP(HREFS); const div = mkP(HREFS); div.tagName = 'DIV'; const odd = mkP([HREFS[0], HREFS[1]]); const wrongLink = mkP([HREFS[0], 'https://example.org/x', HREFS[2]]);
		const reasonsText = { nodeType: 3, nodeValue: '\n\t\t\told reasons\t\t' };
		const reasons = { childNodes: [{ nodeType: 1 }, reasonsText] };
		const body = { id: 'body-user', matches: () => false, querySelectorAll: (sel) => {
			if (sel === '#open-reasons-use-nextcloud-pdf') return [reasons];
			if (sel === `a[href="${HREFS[0]}"]`) return [stock, div, odd, wrongLink].map((p) => p.children[0]);
			return [];
		} };
		const doc = { body, addEventListener() {}, createTextNode: (t) => ({ text: t }) };
		let observed = null;
		load(lang, (c) => { c.MutationObserver = class { constructor(cb) { observed = cb; } observe() {} }; c.requestAnimationFrame = (fn) => fn(); }, doc);
		assert.equal(reasonsText.nodeValue, '\n\t\t\t' + f.reasons + '\t\t', `${lang}: reasons text replaced, white space kept`);
		assert.deepEqual(stock.kids.filter((k) => k.text !== undefined).map((k) => k.text), [f.attribution[0], f.attribution[2], f.attribution[4], f.attribution[6]]);
		assert.deepEqual(stock.children.map((a) => a.textContent), [f.attribution[1], f.attribution[3], f.attribution[5]]);
		assert.equal(stock.kids.length, 7, 'text, link, text, link, text, link, text');
		assert.equal(stock.dataset.pathlocale, 'attribution');
		assert.equal(div.kids, null, 'only a paragraph is rebuilt');
		stock.kids = null; observed(); // the page changes (our own edit included): the same paragraph is not rebuilt again
		assert.equal(stock.kids, null, 'no rebuild loop');
		assert.equal(odd.kids, null, 'a paragraph with two links is left alone');
		assert.equal(wrongLink.kids, null, 'a paragraph whose links are not the stock ones is left alone');
		assert.ok(f.attribution[1] === 'Nextcloud' && f.attribution[5] === 'AGPL', 'the notice names the upstream software and the licence');
		assert.ok(!/Nextcloud/.test([f.reasons, ...f.attribution.filter((_, i) => i !== 1)].join(' ')), 'the name appears only as the attribution link');
	}
});

test('personal settings pages: the product name inside server text is renamed, in text nodes only and never in the attribution', () => {
	const mk = (v, tagName = 'P', marked = false) => ({ nodeValue: v, parentElement: { tagName, closest: (sel) => (marked && sel === '[data-pathlocale]' ? {} : null) } });
	const run = (lang, pathname, texts) => {
		let i = 0; const nodes = texts;
		const doc = { body: { id: 'body-user', querySelectorAll: () => [], matches: () => false }, addEventListener() {}, createTreeWalker: () => ({ nextNode: () => nodes[i++] ?? null }) };
		load(lang, (c) => { c.location = { pathname, search: '' }; }, doc);
	};
	const a = mk('connect to نكست كلاود و Nextcloud'); const style = mk('Nextcloud', 'STYLE'); const area = mk('Nextcloud', 'TEXTAREA'); const attr = mk('Nextcloud', 'A', true);
	run('ar', '/settings/user/security', [a, style, area, attr]);
	assert.equal(a.nodeValue, 'connect to منصة بث و منصة بث');
	assert.equal(style.nodeValue, 'Nextcloud'); assert.equal(area.nodeValue, 'Nextcloud'); assert.equal(attr.nodeValue, 'Nextcloud', 'the attribution keeps the upstream name');
	const e = mk('a Nextcloud server'); run('en', '/index.php/settings/user/sharing', [e]);
	assert.equal(e.nodeValue, 'a Path platform server');
	for (const other of ['/apps/files/', '/settings/admin/overview', '/settings/users', '/settings/userx', '/apps/files/settings/user']) {
		const n = mk('a Nextcloud server'); run('en', other, [n]);
		assert.equal(n.nodeValue, 'a Nextcloud server', `${other} is not a personal settings page`);
	}
});
