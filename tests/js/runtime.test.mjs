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
	const mkDoc = (id) => ({ title: '', createTreeWalker: () => ({ nextNode: () => null }), querySelectorAll: () => [], body: { id, querySelectorAll: () => [], matches: () => false, appendChild: (e) => made.push(e) }, createElement: () => ({}), addEventListener() {} });
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

test('English pages: the Arabic name and slogan are swapped in the title; on the login page everywhere, on public pages only in header and footer, never in editable content', () => {
	const swaps = data('en').swaps;
	assert.ok(swaps.length >= 1 && swaps.every((p) => p.length === 2 && p[0] && p[1]));
	const [from, to] = swaps[0];
	// kind: 'editable' (inside a contenteditable, textarea or editor), 'content' (inside #content-vue); closest() answers for the selectors our skip list names
	const mkText = (v, kind) => ({ nodeValue: v, parentElement: { tagName: 'P', closest: (sel) => ((kind === 'editable' && sel.includes('[contenteditable]')) || (kind === 'content' && sel.includes('#content-vue')) ? {} : null) } });
	const run = (id, lang = 'en') => {
		const t = {
			login: mkText('Log in to ' + from), editable: mkText('my notes ' + from, 'editable'), content: mkText('chat ' + from, 'content'),
			script: mkText(from), headerText: mkText('Welcome ' + from), footerText: mkText(from + ' - slogan'), bodyOnly: mkText('document says ' + from),
		};
		t.script.parentElement.tagName = 'SCRIPT';
		const lists = { body: [t.login, t.editable, t.content, t.script, t.bodyOnly], header: [t.headerText], footer: [t.footerText, t.editable] };
		const asked = [];
		const doc = { title: 'Login - ' + from, createTreeWalker: (r) => { let i = 0; const l = lists[r.name]; asked.push(r.name); return { nextNode: () => l[i++] ?? null }; },
			querySelectorAll: (sel) => (sel === 'header, footer' ? [{ name: 'header' }, { name: 'footer' }] : []),
			body: { name: 'body', id, querySelectorAll: () => [], matches: () => false, appendChild() {} }, createElement: () => ({}), addEventListener() {} };
		load(lang, (c) => { c.OC = { webroot: '' }; c.location = { pathname: '/', search: '' }; }, doc);
		return { doc, asked, ...t };
	};
	const g = run('body-login');
	assert.equal(g.doc.title, 'Login - ' + to);
	assert.equal(g.login.nodeValue, 'Log in to ' + to);
	assert.equal(g.editable.nodeValue, 'my notes ' + from, 'editable content is not touched');
	assert.equal(g.content.nodeValue, 'chat ' + from, 'app content is not touched');
	assert.equal(g.script.nodeValue, from, 'scripts are not touched');
	const p = run('body-public');
	assert.deepEqual(p.asked, ['header', 'footer'], 'public pages: only header and footer are walked');
	assert.equal(p.headerText.nodeValue, 'Welcome ' + to);
	assert.equal(p.footerText.nodeValue, to + ' - slogan');
	assert.equal(p.bodyOnly.nodeValue, 'document says ' + from, 'public page body text (documents, chat) is not touched');
	assert.equal(p.editable.nodeValue, 'my notes ' + from, 'editable content in the footer is not touched either');
	const s = run('body-user');
	assert.equal(s.doc.title, 'Login - ' + to, 'the title is swapped on every page');
	assert.equal(s.login.nodeValue, 'Log in to ' + from, 'signed-in page text is not touched');
	assert.deepEqual(s.asked, []);
	const a = run('body-login', 'ar');
	assert.equal(a.doc.title, 'Login - ' + from, 'Arabic pages keep the Arabic name');
});

test('English pages: the Arabic slogan of Theming (tagline and WI line, any separator) becomes the English sentences of the brochure; Arabic pages keep it', () => {
	const SLOGAN_AR = ['منصة متكاملة للعمل والتواصل المؤسسي', 'إحدى منصات WI الرقمية'];
	const SLOGAN_EN = ['An Integrated Platform for Work and Digital Communication', 'A WI Digital Platform'];
	for (const sep of [' – ', ' - ', ' ']) {
		const mk = (v) => ({ nodeValue: v, parentElement: { tagName: 'P', closest: () => null } });
		const footer = mk('Path | بث – ' + SLOGAN_AR.join(sep));
		const doc = { title: 'Log in – ' + SLOGAN_AR[0], createTreeWalker: () => { let i = 0; const l = [footer]; return { nextNode: () => l[i++] ?? null }; },
			querySelectorAll: () => [], body: { id: 'body-login', querySelectorAll: () => [], matches: () => false, appendChild() {} }, createElement: () => ({}), addEventListener() {} };
		load('en', (c) => { c.OC = { webroot: '' }; c.location = { pathname: '/', search: '' }; }, doc);
		assert.equal(footer.nodeValue, 'Path | بث – ' + SLOGAN_EN.join(sep), `separator "${sep}"`);
		assert.equal(doc.title, 'Log in – ' + SLOGAN_EN[0]);
	}
	const arFooter = { nodeValue: SLOGAN_AR.join(' – '), parentElement: { tagName: 'P', closest: () => null } };
	const arDoc = { title: 'x', createTreeWalker: () => { let i = 0; const l = [arFooter]; return { nextNode: () => l[i++] ?? null }; },
		querySelectorAll: () => [], body: { id: 'body-login', querySelectorAll: () => [], matches: () => false, appendChild() {} }, createElement: () => ({}), addEventListener() {} };
	load('ar', (c) => { c.OC = { webroot: '' }; c.location = { pathname: '/', search: '' }; }, arDoc);
	assert.equal(arFooter.nodeValue, SLOGAN_AR.join(' – '));
});

test('personal settings footer: the reasons link is renamed and the "developed by" sentence becomes an attribution, only on the settings page, inside the notice area and for the stock paragraph', () => {
	const footerData = JSON.parse(fs.readFileSync(path.join(root, 'data', 'footer.json'), 'utf8'));
	const HREFS = ['https://nextcloud.com/contribute', 'https://github.com/nextcloud', 'https://www.gnu.org/licenses/agpl-3.0.html'];
	// where: which ancestors the element has; closest() answers for the selector text the runtime passes
	const closestFor = (where) => (sel) => ((where.notice && sel === '.development-notice') || (where.editable && sel.includes('[contenteditable]')) ? {} : null);
	const run = (lang, pathname, where = { notice: true }, tagName = 'P', hrefs = HREFS) => {
		const f = footerData[lang];
		const links = hrefs.map((h, i) => ({ tagName: 'A', textContent: 'old' + i, getAttribute: () => h }));
		const p = { tagName, dataset: {}, children: links, kids: null, replaceChildren(...k) { this.kids = k; }, closest: closestFor(where) };
		links.forEach((a) => { a.parentElement = p; });
		const reasonsText = { nodeType: 3, nodeValue: '\n\t\t\told reasons\t\t' };
		const reasons = { childNodes: [{ nodeType: 1 }, reasonsText], closest: closestFor(where) };
		const body = { id: 'body-user', matches: () => false, querySelectorAll: (sel) => {
			if (sel === '#open-reasons-use-nextcloud-pdf') return [reasons];
			if (sel === `a[href="${HREFS[0]}"]`) return [links[0]];
			return [];
		} };
		let observed = null;
		const doc = { body, addEventListener() {}, createTextNode: (t) => ({ text: t }), createTreeWalker: () => ({ nextNode: () => null }) };
		load(lang, (c) => { c.location = { pathname, search: '' }; c.MutationObserver = class { constructor(cb) { observed = cb; } observe() {} }; c.requestAnimationFrame = (fn) => fn(); }, doc);
		return { f, p, links, reasonsText, observed };
	};
	for (const lang of ['ar', 'en']) {
		const r = run(lang, '/settings/user');
		assert.equal(r.reasonsText.nodeValue, '\n\t\t\t' + r.f.reasons + '\t\t', lang + ': reasons text replaced, white space kept');
		assert.deepEqual(r.p.kids.filter((k) => k.text !== undefined).map((k) => k.text), [r.f.attribution[0], r.f.attribution[2], r.f.attribution[4], r.f.attribution[6]]);
		assert.deepEqual(r.links.map((a) => a.textContent), [r.f.attribution[1], r.f.attribution[3], r.f.attribution[5]]);
		assert.equal(r.p.kids.length, 7, 'text, link, text, link, text, link, text');
		assert.equal(r.p.dataset.pathlocale, 'attribution');
		r.p.kids = null; r.observed(); // the page changes (our own edit included): the same paragraph is not rebuilt again
		assert.equal(r.p.kids, null, 'no rebuild loop');
		assert.ok(r.f.attribution[1] === 'Nextcloud' && r.f.attribution[5] === 'AGPL', 'the notice names the upstream software and the licence');
		assert.ok(!/Nextcloud/.test([r.f.reasons, ...r.f.attribution.filter((_, i) => i !== 1)].join(' ')), 'the name appears only as the attribution link');
		assert.equal(run(lang, '/index.php/settings/user/security').p.kids !== null, true, lang + ': index.php form of the path');
		// the guards, each alone
		const off = run(lang, '/apps/files/'); assert.equal(off.p.kids, null, 'not a personal settings page'); assert.match(off.reasonsText.nodeValue, /old reasons/);
		const outside = run(lang, '/settings/user', { notice: false }); assert.equal(outside.p.kids, null, 'outside the notice area (a document, a note, a card)'); assert.match(outside.reasonsText.nodeValue, /old reasons/, 'the reasons link outside the notice area');
		const edit = run(lang, '/settings/user', { notice: true, editable: true }); assert.equal(edit.p.kids, null, 'editable content'); assert.match(edit.reasonsText.nodeValue, /old reasons/, 'an editable reasons link');
		assert.equal(run(lang, '/settings/user', { notice: true }, 'DIV').p.kids, null, 'only a paragraph is rebuilt');
		assert.equal(run(lang, '/settings/user', { notice: true }, 'P', [HREFS[0], HREFS[1]]).p.kids, null, 'two links');
		assert.equal(run(lang, '/settings/user', { notice: true }, 'P', [HREFS[0], 'https://example.org/x', HREFS[2]]).p.kids, null, 'not the stock links');
	}
});

test('personal settings pages: exact upstream sentences are replaced, nothing else, and not in editable content or the attribution', () => {
	const mk = (v, tagName = 'P', skip = null) => ({ nodeValue: v, parentElement: { tagName, closest: (sel) => (skip && sel.includes(skip) ? {} : null) } });
	const sentence = (lang) => { const d = data(lang).phpTexts; const k = Object.keys(d)[0]; return [k, d[k]]; };
	const run = (lang, pathname, texts) => {
		let i = 0;
		const doc = { body: { id: 'body-user', querySelectorAll: () => [], matches: () => false }, addEventListener() {}, createTreeWalker: () => ({ nextNode: () => texts[i++] ?? null }) };
		load(lang, (c) => { c.location = { pathname, search: '' }; }, doc);
	};
	for (const lang of ['ar', 'en']) {
		const [from, to] = sentence(lang);
		assert.ok(Object.keys(data(lang).phpTexts).length >= 10, lang + ': the sentence map has content');
		const hit = mk('\n\t' + from.replace(/ /g, '\n  ') + '\t'); const near = mk(from + ' and more'); const style = mk(from, 'STYLE');
		const attr = mk(from, 'A', '[data-pathlocale]'); const agpl = mk(from, 'P', 'a[href*=\"/licenses/agpl\"]'); const editable = mk(from, 'DIV', '[contenteditable]'); const option = mk(from, 'OPTION', 'option');
		run(lang, '/settings/user/security', [hit, near, style, attr, agpl, editable, option]);
		assert.equal(hit.nodeValue.trim(), to, lang + ': the sentence is replaced, white space around it kept');
		assert.equal(hit.nodeValue.startsWith('\n\t'), true);
		assert.equal(near.nodeValue, from + ' and more', 'a text that merely contains the sentence is not touched');
		for (const [name, n] of [['style', style], ['attribution', attr], ['agpl paragraph', agpl], ['editable', editable], ['option', option]]) assert.equal(n.nodeValue, from, name + ' is not touched');
		for (const other of ['/apps/files/', '/settings/admin/overview', '/settings/users', '/settings/userx', '/apps/files/settings/user']) {
			const n = mk(from); run(lang, other, [n]);
			assert.equal(n.nodeValue, from, other + ' is not a personal settings page');
		}
	}
	// the company, community and version texts keep the upstream name and are not in the map
	for (const lang of ['ar', 'en']) for (const [k, v] of Object.entries(data(lang).phpTexts)) assert.ok(!/GmbH|community (release|build)|Enterprise/.test(k + v), 'upstream-name sentence in the map: ' + k);
});

test('the constant product name of core is left alone (strings such as "a {productName} server" or "{productName} iOS app" talk about the upstream software)', () => {
	for (const lang of ['ar', 'en']) {
		const ctx = load(lang, (c) => { c.OC = { theme: { productName: 'Nextcloud', name: 'x' } }; });
		assert.equal(ctx.OC.theme.productName, 'Nextcloud');
		assert.equal(ctx.OC.theme.name, 'x');
		assert.doesNotThrow(() => load(lang, (c) => { c.OC = {}; }));
	}
});
