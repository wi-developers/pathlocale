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
						// a URL, an e-mail address, a path or the variable {nextcloud} may keep the lower-case name
						$text = preg_replace('~https?://\S+|[\w.+-]+@[\w.-]+\.\w+|"?[\w.…~-]*/[\w./…~-]+"?|\{nextcloud\}~u', ' ', $form);
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

	public function testEnglishIsOnlyTheRenamedSource(): void {
		foreach ($this->data('en')['apps'] as $app => $entries) {
			foreach ($entries as $key => $value) {
				$this->assertStringContainsString('Nextcloud', (string)$key, "$app: an English entry exists only to rename the product");
				$this->assertStringContainsString('Path platform', implode(' ', (array)$value), "$app: " . mb_substr((string)$key, 0, 50));
				if (str_contains((string)$key, '_::_')) {
					$this->assertCount(2, $value);
				}
			}
		}
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

	public function testFontLicenceShipsWithTheFont(): void {
		$this->assertFileExists(self::DIR . '/fonts/OFL-LICENSE.txt');
		$this->assertStringContainsString('SIL OPEN FONT LICENSE', strtoupper((string)file_get_contents(self::DIR . '/fonts/OFL-LICENSE.txt')));
	}
}
