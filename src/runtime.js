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
	// JS dictionary never sees them). Exact-text lookup, only inside these navigation elements (display only: a favourite folder or calendar named like a dictionary key is shown translated).
	const NAV_TEXT = '.app-navigation-entry__name, .app-navigation-caption__name';
	const NAV_TITLE = '.app-navigation-entry-link[title]';
	const ORDER = ['core', 'lib', 'settings', 'files'];
	// The personal and admin settings pages (/settings/user/..., /settings/admin/...): their left menu lists the sections of every app, and the
	// dictionary of an app that this page did not load (so it is not in the registry) would otherwise never be consulted (0.1.5). Only those two
	// (0.1.7): the accounts page (/settings/users) lists group names and the apps page lists app names in the same kind of menu entry.
	const SETTINGS_ANY = /^\/(index\.php\/)?settings\/(user|admin)(\/|$)/;
	const onAnySettings = () => SETTINGS_ANY.test(g.location?.pathname ?? '');
	const ours = (app, text) => (Object.prototype.hasOwnProperty.call(DATA.apps[app], text) ? DATA.apps[app][text] : undefined);
	const lookup = (text) => {
		const reg = g._oc_l10n_registry_translations;
		const apps = [...ORDER, ...Object.keys(reg).filter((a) => !ORDER.includes(a))];
		for (const app of apps) {
			const v = reg[app]?.[text];
			if (typeof v === 'string' && v !== '' && v !== text) return v;
		}
		if (onAnySettings()) {
			for (const app of Object.keys(DATA.apps)) {
				const v = ours(app, text);
				if (typeof v === 'string' && v !== '' && v !== text) return v;
			}
		}
		return null;
	};
	// Personal settings pages (/settings/user/...) print some sentences as finished PHP text with the product name inside. Everything
	// below runs on those pages only, inside the page's own notice area or by exact sentence, and never in editable content.
	const SETTINGS_PATH = /^\/(index\.php\/)?settings\/user(\/|$)/;
	const onSettings = () => SETTINGS_PATH.test(g.location?.pathname ?? '');
	const EDITABLE = '[contenteditable], textarea, input, .ProseMirror, .modal-container';
	// The reasons link gets its text replaced; the "developed by" sentence is a legal notice, so it is rebuilt as an attribution
	// ("built on Nextcloud, source code, AGPL") around the same three links, and only when the paragraph has exactly those three links.
	const ATTRIBUTION_LINKS = ['https://nextcloud.com/contribute', 'https://github.com/nextcloud', 'https://www.gnu.org/licenses/agpl-3.0.html'];
	const inNotice = (el) => !!el.closest('.development-notice') && !el.closest(EDITABLE);
	const footer = (root) => {
		const f = DATA.footer; if (!f || !onSettings()) return;
		for (const a of root.querySelectorAll('#open-reasons-use-nextcloud-pdf')) {
			if (!inNotice(a)) continue;
			const t = [...a.childNodes].find((n) => n.nodeType === 3 && n.nodeValue.trim());
			if (t && t.nodeValue.trim() !== f.reasons) t.nodeValue = t.nodeValue.replace(t.nodeValue.trim(), () => f.reasons);
		}
		for (const first of root.querySelectorAll(`a[href="${ATTRIBUTION_LINKS[0]}"]`)) {
			const p = first.parentElement; if (!p || p.tagName !== 'P' || p.dataset.pathlocale === 'attribution' || !inNotice(p)) continue;
			const links = [...p.children];
			if (links.length !== 3 || links.some((a, i) => a.tagName !== 'A' || a.getAttribute('href') !== ATTRIBUTION_LINKS[i])) continue;
			const parts = f.attribution; // text, link, text, link, text, link, text
			p.replaceChildren(document.createTextNode(parts[0]), links[0], document.createTextNode(parts[2]), links[1], document.createTextNode(parts[4]), links[2], document.createTextNode(parts[6]));
			links.forEach((a, i) => { a.textContent = parts[1 + 2 * i]; });
			p.dataset.pathlocale = 'attribution';
		}
	};
	// The other sentences: exact upstream sentence (white space collapsed) -> our sentence. A sentence that Nextcloud rewords is left
	// alone (upstream wording stays). Never the attribution paragraph, never editable content, form fields or options.
	const PHP_TEXTS = new Map(Object.entries(DATA.phpTexts ?? {}));
	const SETTINGS_SKIP = '[data-pathlocale], ' + EDITABLE + ', option, p:has(a[href*="/licenses/agpl"])';
	const settingsRename = () => {
		if (PHP_TEXTS.size === 0 || !onSettings()) return;
		const walker = document.createTreeWalker(document.body, 4);
		const todo = [];
		for (let n = walker.nextNode(); n; n = walker.nextNode()) {
			const el = n.parentElement;
			if (el && !['SCRIPT', 'STYLE'].includes(el.tagName) && !el.closest(SETTINGS_SKIP)) todo.push(n);
		}
		for (const n of todo) {
			const to = PHP_TEXTS.get(n.nodeValue.replace(/\s+/g, ' ').trim());
			if (to !== undefined) n.nodeValue = n.nodeValue.replace(n.nodeValue.trim(), () => to);
		}
	};
	// Talk (/apps/spreed, and the conversation URL /call/<token>, where the sidebar opens the same dialog): the "new conversation" dialog prints the conversation types (title and description) as finished text that the server builds
	// (OCS presets API, PHP t() in spreed), so the JS dictionary never sees them and Talk's own Arabic file lacks them. The two element kinds below
	// are swapped by exact text from our own spreed entries. They get their own list because the dialog is a .modal-container (skipped elsewhere).
	// Text that is already Arabic, or that Talk later renames, matches nothing and stays as it is.
	const TALK_PATH = /^\/(index\.php\/)?(apps\/spreed|call)(\/|$)/;
	const TALK_TEXT = '.conversation-type-selector__label, .conversation-type-selector__description';
	const talkTexts = (root) => {
		const dict = DATA.apps.spreed;
		if (!dict || !TALK_PATH.test(g.location?.pathname ?? '')) return;
		for (const el of root.querySelectorAll(TALK_TEXT)) {
			for (const n of el.childNodes) {
				if (n.nodeType !== 3) continue;
				const text = n.nodeValue.trim();
				const key = text.replace(/\s+/g, ' ');
				const to = Object.prototype.hasOwnProperty.call(dict, key) ? dict[key] : undefined;
				if (typeof to === 'string' && to !== '' && to !== text) n.nodeValue = n.nodeValue.replace(text, () => to);
			}
		}
	};
	// Admin Overview (/settings/admin/...): the setup checks print their name and description as finished text that the server builds
	// (PHP t() in the settings app; the page puts the description in as finished markup), so the JS dictionary never sees them. The two element kinds are
	// swapped by exact text from our own settings entries, text nodes at any depth, never anything else. There is no language check: on Arabic pages this
	// fills in sentences the settings app's own Arabic file lacks; on English pages our English entries only rename the product in a sentence they hold word for word.
	const ADMIN_PATH = /^\/(index\.php\/)?settings\/admin(\/|$)/;
	const ADMIN_TEXT = '.settings-setup-checks-item__name, .settings-setup-checks-item__description';
	const textNodesOf = (el, out = []) => {
		for (const n of el.childNodes ?? []) {
			if (n.nodeType === 3) out.push(n);
			else if (n.nodeType === 1 && n.tagName !== 'SCRIPT' && n.tagName !== 'STYLE') textNodesOf(n, out);
		}
		return out;
	};
	const adminTexts = (root) => {
		const dict = DATA.apps.settings;
		if (!dict || !ADMIN_PATH.test(g.location?.pathname ?? '')) return;
		for (const el of root.querySelectorAll(ADMIN_TEXT)) {
			for (const n of textNodesOf(el)) {
				const text = n.nodeValue.trim();
				const key = text.replace(/\s+/g, ' ');
				const to = ours('settings', key);
				if (typeof to === 'string' && to !== '' && to !== text) n.nodeValue = n.nodeValue.replace(text, () => to);
			}
		}
	};
	// 0.1.6: texts that the server (PHP t()) or an app prints as finished English on a few named pages, where the app's own Arabic file has no entry
	// (admin pages of quick presets, groupware, delegation, AI, Diagramming and Office) or where the text is read once while the page loads, before this script
	// has installed its dictionary (the dialog of the Files settings). Same exact-sentence map as the personal settings pages (PHP_TEXTS): only text nodes that
	// equal a key after white space is collapsed, only inside the content area of those pages, never in form fields, editable content, code or options.
	// 0.1.7: the Office start page (/apps/office) names the kinds of file that other apps register on the server (Text, draw.io) with their finished English
	// names when those apps have no Arabic for them: swapped in its menu, its list heading and its empty-list text only, never in file or template names.
	// The settings dialog of Calendar (/apps/calendar) shows the heading "Keyboard shortcuts" of the shared component library, whose Arabic list lacks it.
	const PAGE_RULES = [
		{ path: /^\/(index\.php\/)?settings\/admin\/(presets|groupware|admindelegation|ai|drawio|richdocuments)(\/|$)/, scope: 'div#content.app-settings' },
		{ path: /^\/(index\.php\/)?apps\/files(\/|$)/, scope: '.modal-mask.app-settings' },
		{ path: /^\/(index\.php\/)?apps\/office(\/|$)/, scope: '#app-navigation-vue, #files-section-heading, .office-overview__files > .empty-content' },
		{ path: /^\/(index\.php\/)?apps\/calendar(\/|$)/, scope: '.modal-mask.app-settings' },
	];
	const PAGE_SKIP = '[data-pathlocale], [contenteditable], textarea, input, select, option, code, pre, tt, script, style';
	const pageTexts = (root) => {
		if (PHP_TEXTS.size === 0) return;
		const rule = PAGE_RULES.find((r) => r.path.test(g.location?.pathname ?? ''));
		if (!rule) return;
		for (const scope of root.querySelectorAll(rule.scope)) {
			const walker = document.createTreeWalker(scope, 4);
			const todo = [];
			for (let n = walker.nextNode(); n; n = walker.nextNode()) {
				if (n.parentElement && !n.parentElement.closest(PAGE_SKIP)) todo.push(n);
			}
			for (const n of todo) {
				const text = n.nodeValue.trim();
				const to = PHP_TEXTS.get(text.replace(/\s+/g, ' '));
				if (typeof to === 'string' && to !== '' && to !== text) n.nodeValue = n.nodeValue.replace(text, () => to);
			}
		}
	};
	const navTexts = (root) => {
		const nodes = root.matches?.(NAV_TEXT) ? [root, ...root.querySelectorAll(NAV_TEXT)] : root.querySelectorAll(NAV_TEXT);
		for (const el of nodes) {
			if (el.childNodes.length !== 1 || el.firstChild.nodeType !== 3) continue;
			const raw = el.firstChild.nodeValue; const text = raw.trim(); if (!text) continue;
			const tr = lookup(text) ?? (onAnySettings() ? PHP_TEXTS.get(text.replace(/\s+/g, ' ')) : null); if (tr) el.firstChild.nodeValue = raw.replace(text, () => tr);
		}
		const links = root.matches?.(NAV_TITLE) ? [root, ...root.querySelectorAll(NAV_TITLE)] : root.querySelectorAll(NAV_TITLE);
		for (const el of links) { const tr = lookup(el.getAttribute('title').trim()); if (tr) el.setAttribute('title', tr); }
	};
	// Each part runs on its own (0.1.7, C4 of D-NC-035): a part that throws leaves its texts as they are, and the parts after it, and the next
	// change of the page, still run. No part is known to throw; this only keeps one surprise from stopping all the others.
	const each = (parts, root) => {
		for (const part of parts) {
			try { part(root); } catch (e) { /* fail safe: the texts of this part stay as the page printed them; the reason goes to the console at debug level */ if (typeof console !== 'undefined' && console.debug) console.debug('pathlocale: a part failed', e); }
		}
	};
	const fix = (root) => {
		if (!root.querySelectorAll) return;
		each([navTexts, footer, settingsRename, talkTexts, adminTexts, pageTexts], root);
	};
	// English pages: Theming holds a single name and slogan (Arabic), so the server prints them in Arabic. Swap them for the
	// English wording in the page title; on the login page everywhere (no user content there); on public pages (shares, Talk guests: user documents,
	// chat messages and editors live there) only in the header and the footer, where Theming prints them, and never in editable content.
	const swapText = (text) => DATA.swaps.reduce((acc, [from, to]) => acc.split(from).join(to), text);
	const GUEST_SKIP = 'textarea, input, [contenteditable], .ProseMirror, #content-vue, .modal-container';
	const swapGuest = () => {
		if (DATA.swaps.length === 0) return;
		if (document.title) document.title = swapText(document.title);
		const id = document.body?.id; if (id !== 'body-login' && id !== 'body-public') return;
		const todo = [];
		for (const r of id === 'body-login' ? [document.body] : document.querySelectorAll('header, footer')) {
			const walker = document.createTreeWalker(r, 4);
			for (let n = walker.nextNode(); n; n = walker.nextNode()) { if (n.parentElement && !n.parentElement.closest(GUEST_SKIP) && !['SCRIPT', 'STYLE'].includes(n.parentElement.tagName)) todo.push(n); }
		}
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
	// Guest-layout pages (the login page, the password page of a protected share) link the fixed manifest file of Nextcloud's core ("name":
	// "Nextcloud", Nextcloud icons), which the browser shows in its "Install app" prompt; an open public share page already links Theming's manifest.
	// Signed-in pages link Theming's manifest too (platform name, Theming icon), which also answers guests, so the core link is pointed there. Only
	// that exact core file is replaced; a link that is anything else is left alone.
	const CORE_MANIFEST = /\/core\/img\/manifest\.json(\?.*)?$/;
	const manifest = () => {
		const id = document.body?.id; if (id !== 'body-login' && id !== 'body-public') return;
		for (const l of document.querySelectorAll('link[rel="manifest"]')) {
			if (CORE_MANIFEST.test(l.getAttribute('href') ?? '')) l.setAttribute('href', (g.OC?.webroot ?? '') + '/index.php/apps/theming/manifest');
		}
	};
	const start = () => {
		each([fix, swapGuest, guestSwitch, manifest], document.body);
		let queued = false;
		new MutationObserver(() => { if (queued) return; queued = true; requestAnimationFrame(() => { queued = false; each([fix, swapGuest], document.body); }); })
			.observe(document.body, { childList: true, subtree: true });
	};
	if (document.body) start(); else document.addEventListener('DOMContentLoaded', start, { once: true });
})();
