// pathlocale runtime: puts the app's own dictionary OVER whatever Nextcloud loads, whenever it loads it.
// the DATA placeholder below is replaced at build time by { lang, apps: { <appId>: { <key>: <string | string[]> } }, noFile: [<appId>...] }.
(() => {
	'use strict';
	const DATA = {"lang":"en","apps":{"core":{"Nextcloud Server":"Path platform server"}},"noFile":[]};
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
})();
