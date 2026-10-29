<?php

declare(strict_types=1);

use OCA\Pathlocale\Service\GuestLanguage;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

class GuestLanguageTest extends TestCase {
	public static function cookies(): array {
		return [
			'ar' => ['ar', 'ar'], 'en' => ['en', 'en'],
			'upper case' => ['AR', null], 'other language' => ['fr', null], 'with region' => ['ar_SA', null], 'empty' => ['', null],
			'null' => [null, null], 'array' => [['ar'], null], 'int' => [1, null], 'padded' => [' ar', null], 'trailing newline' => ["en\n", null],
			'injection' => ['ar; admin=1', null], 'long' => [str_repeat('a', 5000), null],
		];
	}

	#[DataProvider('cookies')]
	public function testOnlyTheTwoCodesAreAccepted(mixed $value, ?string $expected): void {
		$this->assertSame($expected, GuestLanguage::fromCookie($value));
	}

	public static function redirects(): array {
		return [
			'root' => ['/', '/'], 'path' => ['/index.php/login', '/index.php/login'], 'query kept' => ['/s/abc?x=1&y=2', '/s/abc?x=1&y=2'],
			'empty' => ['', '/'], 'relative' => ['login', '/'], 'dot dot' => ['../x', '/'],
			'protocol relative' => ['//evil.example/x', '/'], 'absolute' => ['https://evil.example', '/'], 'backslash' => ['/\\evil.example', '/'],
			'backslash later' => ['/a\\b', '/'], 'crlf' => ["/a\r\nSet-Cookie: x=1", '/'], 'newline' => ["/a\nb", '/'], 'tab' => ["/a\tb", '/'], 'nul' => ["/a\0b", '/'],
			'del' => ["/a\x7fb", '/'], 'scheme in query' => ['/x?u=http://a', '/'], 'javascript' => ['javascript:alert(1)', '/'], 'data' => ['data:text/html,x', '/'],
		];
	}

	#[DataProvider('redirects')]
	public function testRedirectStaysOnThisSite(string $target, string $expected): void {
		$this->assertSame($expected, GuestLanguage::safeRedirect($target));
	}
}
