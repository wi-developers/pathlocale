<?php

declare(strict_types=1);

use GuzzleHttp\Cookie\CookieJar;
use OCA\Pathlocale\Service\GuestLanguage;

class LanguageRouteTest extends PathlocaleTestCase {
	private const ROUTE = '/index.php/apps/pathlocale/lang/';

	private function setCookieHeader(\Psr\Http\Message\ResponseInterface $res): ?string {
		foreach ($res->getHeader('Set-Cookie') as $c) {
			if (str_starts_with($c, GuestLanguage::COOKIE . '=')) {
				return $c;
			}
		}
		return null;
	}

	public function testSetsTheCookieAndRedirectsBack(): void {
		foreach (['ar', 'en'] as $lang) {
			$res = $this->get(self::ROUTE . $lang . '?redirect=' . rawurlencode('/index.php/login?a=1'));
			$this->assertSame(303, $res->getStatusCode());
			$this->assertSame('/index.php/login?a=1', $res->getHeaderLine('Location'));
			$cookie = $this->setCookieHeader($res);
			$this->assertNotNull($cookie, 'no cookie for ' . $lang);
			$this->assertStringStartsWith(GuestLanguage::COOKIE . '=' . $lang . ';', $cookie);
			$this->assertStringContainsStringIgnoringCase('secure', $cookie);
			$this->assertStringContainsStringIgnoringCase('httponly', $cookie);
			$this->assertStringContainsStringIgnoringCase('samesite=lax', $cookie);
			$this->assertStringContainsString('Max-Age=' . GuestLanguage::MAX_AGE, $cookie);
			$this->assertStringContainsString('path=/', $cookie);
		}
	}

	public function testAnotherLanguageWritesNoCookie(): void {
		foreach (['fr', 'AR', 'ar_SA', 'zz', '%00', 'ar%3Bx'] as $lang) {
			$res = $this->get(self::ROUTE . $lang . '?redirect=/login');
			$this->assertNull($this->setCookieHeader($res), 'cookie written for ' . $lang);
		}
	}

	public function testRedirectToAnotherSiteIsRefused(): void {
		foreach (['//evil.example/x', 'https://evil.example', '/%5Cevil.example', '/a%0d%0aSet-Cookie:x=1', 'javascript:alert(1)', '/x%3Fu%3Dhttp://a'] as $target) {
			$res = $this->get(self::ROUTE . 'en?redirect=' . $target);
			$this->assertSame('/', $res->getHeaderLine('Location'), $target);
			$this->assertNull($res->getHeaderLine('X-Injected') ?: null);
			foreach ($res->getHeader('Set-Cookie') as $c) {
				$this->assertStringStartsNotWith('x=', $c, $target);
			}
		}
	}

	public function testNoRedirectGoesToTheRoot(): void {
		$res = $this->get(self::ROUTE . 'en');
		$this->assertSame('/', $res->getHeaderLine('Location'));
	}

	public function testRouteIsOpenToGuestsAndSignedInUsersAlike(): void {
		$uid = $this->makeUser('ar');
		$res = $this->getAs($uid, self::ROUTE . 'en');
		$this->assertSame(303, $res->getStatusCode());
	}
}
