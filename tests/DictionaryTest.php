<?php

declare(strict_types=1);

use PHPUnit\Framework\TestCase;

/**
 * The data files and the built scripts: shape, placeholders, product name, and "the script was built from this data".
 */
class DictionaryTest extends TestCase {
	private const DIR = '/var/www/html/custom_apps/pathlocale';
	private const ATTRIBUTION_KEY = 'Developed by the {communityopen}Nextcloud community{linkclose}, the {githubopen}source code{linkclose} is licensed under the {licenseopen}AGPL{linkclose}.';
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
					if ($key === self::ATTRIBUTION_KEY) {
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
			$this->assertNotEmpty($f['renames']);
			foreach ($f['renames'] as $pair) {
				$this->assertCount(2, $pair);
				$this->assertSame($name, $pair[1]);
				$this->assertSame(1, preg_match(self::NAME_BAD, $pair[0]), "$lang: a rename source is an old spelling");
			}
		}
	}

	public function testRuntimeKeepsItsSafetyProperties(): void {
		$src = (string)file_get_contents(self::DIR . '/src/runtime.js');
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
