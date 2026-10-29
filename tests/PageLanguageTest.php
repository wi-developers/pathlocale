<?php

declare(strict_types=1);

use OCA\Pathlocale\Service\GuestLanguage;

class PageLanguageTest extends PathlocaleTestCase {
	private function guest(string $accept, ?string $cookie): string {
		$headers = ['Accept-Language' => $accept];
		if ($cookie !== null) {
			$headers['Cookie'] = GuestLanguage::COOKIE . '=' . $cookie;
		}
		return (string)$this->get('/login', $headers)->getBody();
	}

	public function testGuestWithoutCookieFollowsTheBrowser(): void {
		$this->assertSame('ar', $this->htmlLang($this->guest('ar', null)));
		$this->assertSame('en', $this->htmlLang($this->guest('en', null)));
	}

	public function testGuestCookieBeatsTheBrowser(): void {
		$this->assertSame('en', $this->htmlLang($this->guest('ar', 'en')));
		$this->assertSame('ar', $this->htmlLang($this->guest('en', 'ar')));
	}

	public function testUnacceptedCookieValuesAreIgnored(): void {
		foreach (['fr', 'AR', 'ar_SA', 'ar%3Bx', '', 'xx'] as $cookie) {
			$this->assertSame('ar', $this->htmlLang($this->guest('ar', $cookie)), 'cookie ' . $cookie);
			$this->assertSame('en', $this->htmlLang($this->guest('en', $cookie)), 'cookie ' . $cookie);
		}
	}

	public function testSignedInUserKeepsTheirOwnLanguage(): void {
		foreach (['ar', 'en'] as $own) {
			$other = $own === 'ar' ? 'en' : 'ar';
			$uid = $this->makeUser($own);
			$res = $this->getAs($uid, '/index.php/settings/user', ['Cookie' => GuestLanguage::COOKIE . '=' . $other, 'Accept-Language' => $other]);
			$this->assertSame(200, $res->getStatusCode());
			$this->assertSame($own, $this->htmlLang((string)$res->getBody()), 'signed-in user with language ' . $own);
		}
	}

	public function testGuestPagesCarryTheSwitchAssets(): void {
		$page = $this->guest('ar', null);
		$this->assertStringContainsString('/custom_apps/pathlocale/css/pathlocale.css', $page);
		$this->assertStringContainsString('/custom_apps/pathlocale/js/pathlocale-l10n-ar.js', $page);
		$this->assertStringNotContainsString('pathlocale-l10n-en.js', $page);
		$this->assertStringContainsString('/custom_apps/pathlocale/js/pathlocale-l10n-en.js', $this->guest('en', null));
	}

	public function testSignedInPagesGetTheirLanguageDictionary(): void {
		$uid = $this->makeUser('ar');
		$page = (string)$this->getAs($uid, '/index.php/settings/user')->getBody();
		$this->assertStringContainsString('/custom_apps/pathlocale/js/pathlocale-l10n-ar.js', $page);
		$this->assertStringContainsString('/custom_apps/pathlocale/css/pathlocale.css', $page);
	}

	public function testAnotherLanguageGetsTheFontButNoDictionary(): void {
		$uid = $this->makeUser('de');
		$page = (string)$this->getAs($uid, '/index.php/settings/user')->getBody();
		$this->assertStringContainsString('/custom_apps/pathlocale/css/pathlocale.css', $page);
		$this->assertStringNotContainsString('pathlocale-l10n-', $page);
	}

	public function testAssetsAreServed(): void {
		foreach (['css/pathlocale.css', 'js/pathlocale-l10n-ar.js', 'js/pathlocale-l10n-en.js', 'fonts/IBMPlexSansArabic-Regular.woff2', 'fonts/IBMPlexSansArabic-Bold.woff2'] as $f) {
			$res = $this->get('/custom_apps/pathlocale/' . $f);
			$this->assertSame(200, $res->getStatusCode(), $f);
			$this->assertGreaterThan(1000, (int)$res->getBody()->getSize(), $f);
		}
	}
}
