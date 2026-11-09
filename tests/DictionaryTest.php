<?php

declare(strict_types=1);

use PHPUnit\Framework\TestCase;

/**
 * The data files and the built scripts: shape, placeholders, product name, and "the script was built from this data".
 */
class DictionaryTest extends TestCase {
	private const DIR = '/var/www/html/custom_apps/pathlocale';
	private const ATTRIBUTION_KEY = 'Developed by the {communityopen}Nextcloud community{linkclose}, the {githubopen}source code{linkclose} is licensed under the {licenseopen}AGPL{linkclose}.';
	/** Keys that name a company or the upstream community: the real name must stay (a false sponsor or author would be worse than the old name). */
	private const UPSTREAM_KEYS = '/Nextcloud (GmbH|community|Enterprise|portal|Appstore|App ?Store|All-in-One|Hub|[Dd]ocker|[Cc]lient|Server|Administration Manual|%d|%[0-9]\$s|[0-9]|<=)|Nextcloud subscription|community (release|build) of Nextcloud|We at Nextcloud|#Nextcloud|desktop client|(since|As of) Nextcloud|link to your Nextcloud|Add to your Nextcloud|remote Nextcloud|Nextcloud Mail [0-9]|Nextcloud instances|Struktur AG|Ethical AI Rating|Nextcloud Documentation|other Nextcloud users|Client Login Flow|^Nextcloud (URL|user)$|^Share with me via Nextcloud$/';
	private const NAME_BAD ='/nextcloud|ن[ايِى]?كست\s*كلا?و?د|ناكست/iu';
	/** English entries whose key does not name Nextcloud: each one stops an English page from printing the Arabic Theming name inside an English sentence (0.1.4). */
	private const ENGLISH_FIXES = [
		'Your {serverName} account',
		'You can share with anyone who uses a {productName} server or other Open Cloud Mesh (OCM) compatible servers and services! Just put their Federated Cloud ID in the share dialog. It looks like person@cloud.example.com',
	];
	/** Arabic sentences that leave out {productName} on purpose: with no Theming productName the server fills the token with "Nextcloud". */
	private const PRODUCT_TOKEN_DROPPED = [
		'You can share with anyone who uses a {productName} server or other Open Cloud Mesh (OCM) compatible servers and services! Just put their Federated Cloud ID in the share dialog. It looks like person@cloud.example.com',
	];
	/** Keep-list sentences that also name the product itself (0.1.7, owner decision D-NC-050): the product word is renamed, the upstream name stays where
	 * the sentence states a fact about upstream (D-NC-017). Key => the Arabic part that keeps the upstream name, word for word. */
	private const KEEP_AND_RENAME = [
		'You can install the Matterbridge to link Nextcloud Talk to some other services, visit their {linkstart1}GitHub page{linkend} for more details. Downloading and installing the app can take a while. In case it times out, please install it manually from the {linkstart2}Nextcloud App Store{linkend}.' => '{linkstart2}متجر تطبيقات Nextcloud{linkend}',
	];
	/** The texts of the Talk "new conversation" dialog that the server builds; the runtime swaps them from the spreed entries. */
	private const TALK_TYPE_TEXTS = [
		'Send messages, create threads, and start voice and video calls.',
		'Restricted conversation for internal presentations.',
		'Directly join the call, ideal for catch-ups or spontaneous meetings.',
		'Restricted conversation with lobby enabled, ideal for public webinars.',
		'Voice room',
	];

	private function data(string $lang): array {
		$d = json_decode((string)file_get_contents(self::DIR . "/data/$lang.json"), true, 512, JSON_THROW_ON_ERROR);
		$this->assertIsArray($d['apps']);
		return $d;
	}

	/** Tokens that must survive a translation byte for byte. */
	private function tokens(string $s): array {
		preg_match_all('/\{[^}]+\}|%\d+\$[sd]|%n|%[sd]/', $s, $m);
		$t = $m[0];
		sort($t);
		return array_values(array_unique($t));
	}

	public function testArabicShape(): void {
		$d = $this->data('ar');
		$this->assertGreaterThan(3000, array_sum(array_map('count', $d['apps'])));
		foreach ($d['apps'] as $app => $entries) {
			foreach ($entries as $key => $value) {
				$where = "$app: " . mb_substr((string)$key, 0, 60);
				$plural = str_contains((string)$key, '_::_');
				if ($plural) {
					$this->assertIsArray($value, $where);
					$this->assertCount(6, $value, "$where needs 6 plural forms");
				} else {
					$this->assertIsString($value, $where);
					$value = [$value];
				}
				foreach ($value as $i => $form) {
					$this->assertIsString($form, $where);
					$this->assertNotSame('', trim($form), "$where form $i is empty");
					$this->assertSame(0, preg_match('/[\x00-\x08\x0b\x0c\x0e-\x1f]/', $form), "$where control character");
				}
			}
		}
	}

	public function testArabicKeepsTheTokensOfTheSource(): void {
		foreach ($this->data('ar')['apps'] as $app => $entries) {
			foreach ($entries as $key => $value) {
				$sources = explode('_::_', (string)$key);
				$need = $this->tokens(implode(' ', $sources));
				if (in_array($key, self::PRODUCT_TOKEN_DROPPED, true)) {
					$this->assertStringNotContainsString('{productName}', (string)$value, 'the dropped token stays dropped');
					$need = array_values(array_diff($need, ['{productName}']));
				}
				foreach ((array)$value as $i => $form) {
					$have = $this->tokens($form);
					foreach (array_diff($have, $need) as $extra) {
						$this->fail("$app: " . mb_substr((string)$key, 0, 50) . " form $i has an extra token $extra");
					}
					if (is_array($value) && $i <= 2) {
						continue; // zero, one and two may use the word instead of the number
					}
					foreach (array_diff($need, $have) as $missing) {
						$this->fail("$app: " . mb_substr((string)$key, 0, 50) . " form $i misses $missing");
					}
				}
			}
		}
		$this->addToAssertionCount(1);
	}

	public function testNoOldProductNameInArabicOrEnglishValues(): void {
		foreach (['ar', 'en'] as $lang) {
			foreach ($this->data($lang)['apps'] as $app => $entries) {
				foreach ($entries as $key => $value) {
					if ($key === self::ATTRIBUTION_KEY || ($lang === 'ar' && preg_match(self::UPSTREAM_KEYS, (string)$key))) {
						continue; // the one place that must name the upstream software (testAttributionKeepsTheUpstreamNameAndLicence)
					}
					foreach ((array)$value as $form) {
						// a URL, an e-mail address, a path or the variable {nextcloud} may keep the lower-case name; so may the file name that the user-migration app really
						// creates (user.nextcloud_export, the user has to find it by that name) and the unchanged lower-case word in the notifications app description
						$text = preg_replace('#https?://\S+|[\w.+-]+@[\w.-]+\.\w+|"?[\w.…~-]*/[\w./…~-]+"?|\{nextcloud\}|user\.nextcloud_export|nextcloud itself#u', ' ', $form);
						$this->assertNotNull($text, "$lang $app: the pattern that removes URLs and paths must run (a NULL here would make the check test nothing)");
						$this->assertSame(0, preg_match(self::NAME_BAD, (string)$text), "$lang $app: " . mb_substr((string)$key, 0, 50));
					}
				}
			}
		}
	}

	/** The footer sentence is a legal notice (AGPL): it says what the platform is built on and links source and licence, in both languages. */
	public function testAttributionKeepsTheUpstreamNameAndLicence(): void {
		foreach (['ar', 'en'] as $lang) {
			$value = $this->data($lang)['apps']['settings'][self::ATTRIBUTION_KEY] ?? null;
			$this->assertIsString($value, "$lang: the attribution sentence is overridden");
			$this->assertStringContainsString('Nextcloud', $value);
			$this->assertStringContainsString('{licenseopen}AGPL{linkclose}', $value);
			$this->assertStringContainsString('{githubopen}', $value);
			$this->assertStringContainsString('{communityopen}Nextcloud{linkclose}', $value);
			$this->assertSame(1, substr_count($value, 'Nextcloud'), "$lang: the name appears once, as attribution");
			$this->assertStringNotContainsString('Nextcloud community', $value, "$lang: no claim that the community made Path platform");
		}
	}

	/** The English pages swap the Arabic Theming slogan (tagline and WI line, brief s.5) for the English sentences of the brochure. */
	public function testEnglishSloganSwaps(): void {
		$swaps = $this->data('en')['swaps'];
		$this->assertContains(['منصة متكاملة للعمل والتواصل المؤسسي', 'An Integrated Platform for Work and Digital Communication'], $swaps);
		$this->assertContains(['إحدى منصات WI الرقمية', 'A WI Digital Platform'], $swaps);
		$this->assertSame([], $this->data('ar')['swaps'] ?? [], 'Arabic pages swap nothing');
	}

	public function testEnglishIsOnlyTheRenamedSource(): void {
		$fixes = 0;
		foreach ($this->data('en')['apps'] as $app => $entries) {
			foreach ($entries as $key => $value) {
				if (in_array($key, self::ENGLISH_FIXES, true)) {
					$fixes++;
					$this->assertIsString($value, "$app: a fix is one sentence");
					continue; // not a rename: the key does not name the product (see ENGLISH_FIXES)
				}
				$this->assertStringContainsString('Nextcloud', (string)$key, "$app: an English entry exists only to rename the product");
				$this->assertStringContainsString('Path platform', implode(' ', (array)$value), "$app: " . mb_substr((string)$key, 0, 50));
				if (str_contains((string)$key, '_::_')) {
					$this->assertCount(2, $value);
				}
			}
		}
		$this->assertSame(count(self::ENGLISH_FIXES), $fixes, 'every listed fix is in the English data, once');
	}

	public function testBuiltScriptsMatchTheData(): void {
		foreach (['ar', 'en'] as $lang) {
			$js = (string)file_get_contents(self::DIR . "/js/pathlocale-l10n-$lang.js");
			$this->assertSame(1, preg_match('/const DATA = (\{.*\});\n/', $js, $m), "$lang: no DATA in the built script");
			$built = json_decode($m[1], true, 512, JSON_THROW_ON_ERROR);
			$src = $this->data($lang);
			$this->assertSame($lang, $built['lang']);
			$this->assertSame($src['noFile'] ?? [], $built['noFile']);
			$apps = $src['apps'];
			ksort($apps);
			foreach ($apps as &$entries) {
				ksort($entries);
			}
			unset($entries);
			$this->assertEquals($apps, $built['apps'], "$lang: built script is not made from data/$lang.json, run tools/build-js.mjs");
			$footer = json_decode((string)file_get_contents(self::DIR . '/data/footer.json'), true, 512, JSON_THROW_ON_ERROR)[$lang];
			$this->assertSame($footer, $built['footer'], "$lang: built script has another footer than data/footer.json");
			$this->assertEquals($src['swaps'] ?? [], $built['swaps'], "$lang: built script has other swaps than data/$lang.json");
			// the run-time map is phpTexts (sentences that name the product) plus phpFixes (other exact sentences)
			$this->assertEquals(array_merge($src['phpTexts'] ?? [], $src['phpFixes'] ?? []), $built['phpTexts'], "$lang: built script has another sentence map than data/$lang.json");
		}
	}

	/** Texts that name the company or the upstream community keep the real name in Arabic and are not renamed in English. */
	public function testCompanyAndCommunityNamesAreKept(): void {
		$found = 0;
		foreach ($this->data('ar')['apps'] as $app => $entries) {
			foreach ($entries as $key => $value) {
				if (!preg_match(self::UPSTREAM_KEYS, (string)$key) || $key === self::ATTRIBUTION_KEY) {
					continue;
				}
				$found++;
				if (isset(self::KEEP_AND_RENAME[$key])) {
					$this->assertStringContainsString(self::KEEP_AND_RENAME[$key], (string)$value, "$app: the upstream name stays where the sentence is about upstream");
					$this->assertSame(1, substr_count((string)$value, 'Nextcloud'), "$app: only that part keeps the upstream name");
					$this->assertSame(1, substr_count((string)$value, 'منصة بث'), "$app: the product word is renamed once");
					continue;
				}
				$this->assertSame(0, preg_match('/منصة بث|Path platform/u', implode(' ', (array)$value)), "$app: the platform name replaced a company or community");
			}
		}
		$this->assertGreaterThanOrEqual(4, $found);
		foreach ($this->data('en')['apps'] as $app => $entries) {
			foreach (array_keys($entries) as $key) {
				if ($key !== self::ATTRIBUTION_KEY) {
					$this->assertSame(0, preg_match(self::UPSTREAM_KEYS, (string)$key), "en $app: a company or community text must show upstream English");
				}
			}
		}
	}

	/** One list of "keep the upstream name" patterns for the build, the runtime data and this test. */
	public function testKeepPatternsAreTheOnesTheTestsUse(): void {
		$keep = json_decode((string)file_get_contents(self::DIR . '/data/footer.json'), true, 512, JSON_THROW_ON_ERROR)['en']['keep'];
		$this->assertSame(self::UPSTREAM_KEYS, '/' . implode('|', $keep) . '/');
		foreach ([
			'Nextcloud GmbH sponsors a free push notification gateway' => true,
			'install it manually from the Nextcloud App Store' => true,
			'Nextcloud portal' => true,
			'Nextcloud Enterprise' => true,
			'We at Nextcloud believe' => true,
			'As of Nextcloud 34 this app is bundled' => true,
			'This community release of Nextcloud is unsupported' => true,
			'Your Nextcloud setup is not capable' => false,
			'Nextcloud Talk' => false,
			'Add to your Nextcloud' => true,
			'Join conversations from remote Nextcloud servers' => true,
			'It requires Nextcloud Mail 4.1 and an email account' => true,
			'Our partner Struktur AG provides a service' => true,
			'Chat with other Nextcloud users on their servers' => true,
			'Nextcloud URL' => true,
			'Nextcloud user' => true,
			'Share with me via Nextcloud' => true,
			'Nextcloud URL used by Collabora:' => false,
			'Share with me via {productName}' => false,
			'Show a glimpse of your latest novel directly from your Nextcloud' => false,
		] as $key => $kept) {
			$this->assertSame($kept ? 1 : 0, preg_match(self::UPSTREAM_KEYS, $key), $key);
		}
	}

	/** The exact-sentence map for PHP-rendered pages: only sentences that really name the product, none that keep the upstream name. */
	public function testPhpTextsAreSafe(): void {
		foreach (['ar', 'en'] as $lang) {
			$map = $this->data($lang)['phpTexts'] ?? [];
			$this->assertGreaterThanOrEqual(10, count($map), $lang);
			foreach ($map as $from => $to) {
				$this->assertSame($from, trim((string)preg_replace('/\s+/u', ' ', $from)), "$lang: key is normalised");
				$this->assertNotSame($from, $to);
				$this->assertSame(0, preg_match(self::UPSTREAM_KEYS, $from . ' ' . $to), "$lang: a sentence that keeps the upstream name is in the map: " . mb_substr($from, 0, 50));
				$this->assertSame(0, preg_match(self::NAME_BAD, $to), "$lang: old name in the replacement: " . mb_substr($to, 0, 50));
				$this->assertSame(1, preg_match(self::NAME_BAD, $from), "$lang: the map is only for sentences that name the product: " . mb_substr($from, 0, 50));
			}
		}
	}

	/** Exact sentences of PHP-rendered pages that need a fix but do not name the product (0.1.4): same safety rules as phpTexts, without the product-name condition. */
	public function testPhpFixesAreSafe(): void {
		foreach (['ar', 'en'] as $lang) {
			$fixes = $this->data($lang)['phpFixes'] ?? null;
			$this->assertIsArray($fixes, "$lang: phpFixes exists");
			$texts = $this->data($lang)['phpTexts'] ?? [];
			foreach ($fixes as $from => $to) {
				$this->assertSame($from, trim((string)preg_replace('/\s+/u', ' ', $from)), "$lang: key is normalised");
				$this->assertIsString($to);
				$this->assertNotSame('', trim($to), "$lang: empty replacement for " . mb_substr($from, 0, 40));
				$this->assertNotSame($from, $to);
				$this->assertSame(0, preg_match(self::UPSTREAM_KEYS, $from . ' ' . $to), "$lang: a sentence that keeps the upstream name is in the fix map: " . mb_substr($from, 0, 50));
				$this->assertSame(0, preg_match(self::NAME_BAD, $from . ' ' . $to), "$lang: a sentence that names the product belongs in phpTexts: " . mb_substr($from, 0, 50));
				$this->assertArrayNotHasKey($from, $texts, "$lang: in both maps: " . mb_substr($from, 0, 50));
			}
		}
		$this->assertGreaterThanOrEqual(10, count($this->data('ar')['phpFixes']));
	}

	public function testStylesheetHidesTheMoreAppsEntryAndLoadsTheFont(): void {
		$css = str_replace("\r\n", "\n", (string)file_get_contents(self::DIR . '/css/pathlocale.css'));
		$this->assertStringContainsString("html:root .app-menu__grid a.app-item[href\$=\"/settings/apps\"] {\n\tdisplay: none !important;\n}", $css);
		$this->assertStringContainsString("html:root .app-menu__grid a.app-item[href=\"https://apps.nextcloud.com/\"] {
	display: none !important;
}", $css);
		$this->assertStringContainsString("html:root .development-notice p:has(> #open-reasons-use-nextcloud-pdf),\nhtml:root .development-notice #open-reasons-use-nextcloud-pdf {\n\tdisplay: none !important;\n}", $css);
		$this->assertStringNotContainsString('agpl', preg_replace('~/\*.*?\*/~s', '', $css), 'the stylesheet never hides the licence sentence');
		$this->assertStringContainsString("html:root .development-notice p.social-button {
	display: none !important;
}", $css);
		$this->assertStringContainsString("html:root #privacy-mission p {\n\tdisplay: none !important;\n}", $css);
		$this->assertStringContainsString("html:root #vue-personal-federated p.social-button {\n\tdisplay: none !important;\n}", $css);
		$this->assertSame(4, substr_count($css, '@font-face'));
		$this->assertStringContainsString("html:root body {\n\tfont-family: var(--font-face);", $css);
	}

	/** The sentences the runtime writes into PHP-rendered pages: shape, and the product name only as the attribution link. */
	public function testFooterData(): void {
		$footer = json_decode((string)file_get_contents(self::DIR . '/data/footer.json'), true, 512, JSON_THROW_ON_ERROR);
		foreach (['ar' => 'منصة بث', 'en' => 'Path platform'] as $lang => $name) {
			$f = $footer[$lang];
			$this->assertSame(7, count($f['attribution']), "$lang: text, link, text, link, text, link, text");
			$this->assertSame('Nextcloud', $f['attribution'][1]);
			$this->assertSame('AGPL', $f['attribution'][5]);
			$this->assertStringContainsString($name, $f['reasons']);
			$this->assertSame(0, preg_match(self::NAME_BAD, $f['reasons']));
			foreach ([0, 2, 3, 4, 6] as $i) {
				$this->assertSame(0, preg_match(self::NAME_BAD, $f['attribution'][$i]), "$lang: attribution part $i");
			}
		}
	}

	public function testRuntimeKeepsItsSafetyProperties(): void {
		$src = (string)file_get_contents(self::DIR . '/src/runtime.js');
		$this->assertStringNotContainsString('productName', $src); // core's constant product name is used by strings about other clients, servers and versions: left alone
		$this->assertStringNotContainsString('eval(', $src);
		$this->assertStringNotContainsString('innerHTML', $src);
		$this->assertStringNotContainsString('document.write', $src);
		$this->assertStringNotContainsString('fetch(', $src);
		$this->assertStringNotContainsString('XMLHttpRequest', $src);
	}

	/** The Talk home illustrations become icons only where the browser can draw them, only for the three known images, and without any request to another site. */
	public function testTalkIllustrationsBecomeIconsAndFailSafe(): void {
		$css = str_replace("\r\n", "\n", (string)file_get_contents(self::DIR . '/css/pathlocale.css'));
		$from = (int)strpos($css, 'reworked for Talk 25');
		$to = (int)strpos($css, 'owner request 2026-11-08 (D-NC-050');
		$this->assertTrue($from > 0 && $to > $from, 'the Talk block and the Teams block are both there');
		$talk = substr($css, $from, $to - $from);
		$guard = '@supports ((mask-image: none) or (-webkit-mask-image: none)) {';
		$this->assertSame(1, substr_count($talk, $guard), 'one feature check');
		$before = substr($talk, 0, (int)strpos($talk, $guard));
		$block = substr($talk, (int)strpos($talk, $guard));
		$this->assertSame(0, substr_count($before, '[style*='), 'no rule about the illustrations outside the feature check');
		foreach (['meetings', 'mentions', 'reminders'] as $img) {
			$this->assertSame(4, substr_count($block, '[style*="/dashboard/' . $img . '"]'), "$img: panel, icon box, faded icon box, icon");
		}
		$this->assertSame(1, substr_count($block, "\t\t--dashboard-section-image: none !important;\n"), 'the three pictures are switched off by one rule');
		$this->assertSame(1, substr_count($block, "{\n\t\tbackground: var(--color-primary-element-light);\n"), 'the panel colour comes from the theme');
		$this->assertSame(1, substr_count($block, "\t\tbackground-color: var(--color-primary-element-light-text);\n"), 'the icon colour comes from the theme');
		$this->assertSame(1, substr_count($block, "\t\topacity: 0.2;\n"), 'the icon is faded behind the text where the section is veiled');
		$this->assertSame(1, substr_count($block, "\t\tmask-position: var(--dashboard-section-image-position, right) center;\n"), 'the icon sits on the side Talk puts its picture (follows the text direction)');
		$this->assertSame(6, substr_count($block, 'url("data:image/svg+xml,'), 'three icons, each as mask-image and -webkit-mask-image');
		$this->assertSame(6, substr_count($block, 'url('), 'no other url');
		$this->assertStringNotContainsString('http', str_replace("xmlns='http://www.w3.org/2000/svg'", '', $block), 'no request to another site');
	}

	/** The Teams banner picture becomes an icon the same way: only where the browser can draw it, only for the one known image file, no request to another site. */
	public function testTeamsIllustrationBecomesIconAndFailsSafe(): void {
		$css = str_replace("\r\n", "\n", (string)file_get_contents(self::DIR . '/css/pathlocale.css'));
		$from = (int)strpos($css, 'owner request 2026-11-08 (D-NC-050');
		$this->assertTrue($from > 0, 'the Teams block is there');
		$teams = substr($css, $from);
		$guard = '@supports selector(:has(*)) and ((mask-image: none) or (-webkit-mask-image: none)) {';
		$this->assertSame(1, substr_count($teams, $guard), 'one feature check');
		$before = substr($teams, 0, (int)strpos($teams, $guard));
		$block = substr($teams, (int)strpos($teams, $guard));
		$this->assertSame(0, substr_count($before, 'teams-illustration.svg"]'), 'no rule about the picture outside the feature check');
		$this->assertSame(3, substr_count($block, ':has(> img[src*="/img/teams-illustration.svg"])'), 'positioned parent, hidden image, icon');
		$this->assertSame(1, substr_count($block, "{\n\t\tvisibility: hidden !important;\n"), 'the picture is hidden, not removed');
		$this->assertSame(1, substr_count($block, "\t\tbackground-color: var(--color-primary-element-light-text);\n"), 'the icon colour comes from the theme');
		$this->assertSame(2, substr_count($block, 'url("data:image/svg+xml,'), 'one icon, as mask and -webkit-mask');
		$this->assertSame(2, substr_count($block, 'url('), 'no other url');
		$this->assertStringNotContainsString('http', str_replace("xmlns='http://www.w3.org/2000/svg'", '', $block), 'no request to another site');
	}

	/** Admin Talk page (owner screenshot 195): the badge of the two beta headings gets its space back, with a logical margin, in those two sections only. */
	public function testTalkBetaBadgesGetTheirSpaceBack(): void {
		$css = str_replace("\r\n", "\n", (string)file_get_contents(self::DIR . '/css/pathlocale.css'));
		$this->assertSame(1, substr_count($css, "html:root #matterbridge_settings h2 small,\nhtml:root #federation_settings h2 small {\n\tmargin-inline-start: 6px;\n}\n"), 'one rule, both sections, logical margin');
		$this->assertSame(1, substr_count($css, '#matterbridge_settings'), 'nothing else names the first section');
		$this->assertSame(1, substr_count($css, '#federation_settings'), 'nothing else names the second section');
	}

	public function testIconLicenceShipsWithTheIcons(): void {
		$file = self::DIR . '/css/ICONS-LICENSE.txt';
		$this->assertFileExists($file);
		$text = (string)file_get_contents($file);
		$this->assertStringContainsString('Pictogrammers Free License', $text);
		$this->assertStringContainsString('Apache License', $text);
		$this->assertStringContainsString('Version 2.0, January 2004', $text);
		$this->assertStringContainsString('END OF TERMS AND CONDITIONS', $text);
	}

	/** Admin Talk page, Matterbridge section (owner screenshot 195, D-NC-050): "Nextcloud Talk" reads as Talk of the platform; the App Store link keeps its name. */
	public function testKeepAndRenameSentences(): void {
		$spreed = $this->data('ar')['apps']['spreed'];
		$this->assertCount(1, self::KEEP_AND_RENAME);
		foreach (self::KEEP_AND_RENAME as $key => $kept) {
			$this->assertSame(1, preg_match(self::UPSTREAM_KEYS, $key), 'still a keep-list key');
			$this->assertArrayHasKey($key, $spreed);
			$this->assertStringContainsString('لربط Talk في منصة بث', $spreed[$key]);
			$this->assertStringNotContainsString('Talk في Nextcloud', $spreed[$key]);
			$this->assertStringContainsString($kept, $spreed[$key]);
			$this->assertSame(['{linkend}', '{linkstart1}', '{linkstart2}'], $this->tokens($spreed[$key]), 'the link tokens of the source');
		}
	}

	/** The runtime swaps the type texts of the Talk dialog from these entries; without them it has nothing to swap. */
	public function testTalkConversationTypeTextsHaveArabic(): void {
		$spreed = $this->data('ar')['apps']['spreed'];
		foreach (self::TALK_TYPE_TEXTS as $key) {
			$this->assertArrayHasKey($key, $spreed);
			$this->assertIsString($spreed[$key]);
			$this->assertNotSame('', trim($spreed[$key]));
			$this->assertSame(0, preg_match('/[A-Za-z]{3,}/', $spreed[$key]), 'Arabic text: ' . $key);
		}
	}

	public function testFontLicenceShipsWithTheFont(): void {
		$this->assertFileExists(self::DIR . '/fonts/OFL-LICENSE.txt');
		$this->assertStringContainsString('SIL OPEN FONT LICENSE', strtoupper((string)file_get_contents(self::DIR . '/fonts/OFL-LICENSE.txt')));
	}
}
