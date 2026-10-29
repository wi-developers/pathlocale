// pathlocale runtime: puts the app's own dictionary OVER whatever Nextcloud loads, whenever it loads it.
// the DATA placeholder below is replaced at build time by { lang, apps: { <appId>: { <key>: <string | string[]> } }, noFile: [<appId>...] }.
(() => {
	'use strict';
	const DATA = __PATHLOCALE_DATA__;
	const g = globalThis;
	g._oc_l10n_registry_translations ??= {};
	g._oc_l10n_registry_plural_functions ??= {};
	if (g._oc_l10n_registry_translations.__pathlocale) return;

	const plural = DATA.lang === 'ar'
		? (n) => (n === 0 ? 0 : n === 1 ? 1 : n === 2 ? 2 : (n % 100 >= 3 && n % 100 <= 10) ? 3 : (n % 100 >= 11 && n % 100 <= 99) ? 4 : 5)
		: (n) => (n === 1 ? 0 : 1);
	const own = (app) => typeof app === 'string' && Object.prototype.hasOwnProperty.call(DATA.apps, app);
	const empty = {};
	const cache = new WeakMap();
	const emptyMerged = {};

	const real = g._oc_l10n_registry_translations;
	const proxy = new Proxy(real, {
		get(target, app, receiver) {
			if (app === '__pathlocale') return true;
			const base = Reflect.get(target, app, receiver);
			if (!own(app)) return base;
			const key = base ?? empty;
			let byApp = cache.get(key);
			if (!byApp) { byApp = {}; cache.set(key, byApp); }
			return byApp[app] ??= { ...(base ?? {}), ...DATA.apps[app] };
		},
	});
	g._oc_l10n_registry_translations = proxy;

	// apps with a dictionary of ours need a plural function even when Nextcloud registered none
	for (const app of Object.keys(DATA.apps)) {
		if (typeof g._oc_l10n_registry_plural_functions[app] !== 'function') g._oc_l10n_registry_plural_functions[app] = plural;
	}
	// apps that ship no <lang>.json: mark them as loaded so core does not fetch a file that does not exist
	for (const app of DATA.noFile) {
		if (!Object.prototype.hasOwnProperty.call(real, app)) real[app] = {};
	}
	// Labels the server renders itself (app navigation entries and section captions arrive as finished text, so the
	// JS dictionary never sees them). Exact-text lookup, only inside these navigation elements: never user data.
	const NAV_TEXT = '.app-navigation-entry__name, .app-navigation-caption__name';
	const NAV_TITLE = '.app-navigation-entry-link[title]';
	const ORDER = ['core', 'lib', 'settings', 'files'];
	const lookup = (text) => {
		const reg = g._oc_l10n_registry_translations;
		const apps = [...ORDER, ...Object.keys(reg).filter((a) => !ORDER.includes(a))];
		for (const app of apps) {
			const v = reg[app]?.[text];
			if (typeof v === 'string' && v !== '' && v !== text) return v;
		}
		return null;
	};
	const fix = (root) => {
		if (!root.querySelectorAll) return;
		const nodes = root.matches?.(NAV_TEXT) ? [root, ...root.querySelectorAll(NAV_TEXT)] : root.querySelectorAll(NAV_TEXT);
		for (const el of nodes) {
			if (el.childNodes.length !== 1 || el.firstChild.nodeType !== 3) continue;
			const raw = el.firstChild.nodeValue; const text = raw.trim(); if (!text) continue;
			const tr = lookup(text); if (tr) el.firstChild.nodeValue = raw.replace(text, () => tr);
		}
		const links = root.matches?.(NAV_TITLE) ? [root, ...root.querySelectorAll(NAV_TITLE)] : root.querySelectorAll(NAV_TITLE);
		for (const el of links) { const tr = lookup(el.getAttribute('title').trim()); if (tr) el.setAttribute('title', tr); }
	};
	// English pages: Theming holds a single name and slogan (Arabic), so the server prints them in Arabic. Swap them for the
	// English wording in the page title and on guest pages (login, public pages: no user files shown there).
	const swapText = (text) => DATA.swaps.reduce((acc, [from, to]) => acc.split(from).join(to), text);
	const swapGuest = () => {
		if (DATA.swaps.length === 0) return;
		if (document.title) document.title = swapText(document.title);
		const id = document.body?.id; if (id !== 'body-login' && id !== 'body-public') return;
		const skip = '.files-list, #app-content-vue, .app-files';
		const walker = document.createTreeWalker(document.body, 4);
		const todo = [];
		for (let n = walker.nextNode(); n; n = walker.nextNode()) { if (n.parentElement && !n.parentElement.closest(skip) && !['SCRIPT', 'STYLE'].includes(n.parentElement.tagName)) todo.push(n); }
		for (const n of todo) { const t = swapText(n.nodeValue); if (t !== n.nodeValue) n.nodeValue = t; }
	};
	// Guest pages (login, public shares): a link to the other language. Signed-in users change language in their settings.
	const guestSwitch = () => {
		const id = document.body?.id; if (id !== 'body-login' && id !== 'body-public') return;
		const other = DATA.lang === 'ar' ? 'en' : 'ar';
		const a = document.createElement('a');
		a.className = 'pathlocale-switch'; a.lang = other; a.textContent = other === 'ar' ? 'العربية' : 'English';
		a.href = (g.OC?.webroot ?? '') + '/index.php/apps/pathlocale/lang/' + other + '?redirect=' + encodeURIComponent(location.pathname + location.search);
		document.body.appendChild(a);
	};
	const start = () => {
		fix(document.body);
		swapGuest();
		guestSwitch();
		let queued = false;
		new MutationObserver(() => { if (queued) return; queued = true; requestAnimationFrame(() => { queued = false; fix(document.body); swapGuest(); }); })
			.observe(document.body, { childList: true, subtree: true });
	};
	if (document.body) start(); else document.addEventListener('DOMContentLoaded', start, { once: true });
})();
