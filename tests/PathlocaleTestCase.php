<?php

declare(strict_types=1);

use GuzzleHttp\Client;
use GuzzleHttp\Cookie\CookieJar;
use OCP\IConfig;
use OCP\IUserManager;
use OCP\Server;
use PHPUnit\Framework\TestCase;
use Psr\Http\Message\ResponseInterface;

abstract class PathlocaleTestCase extends TestCase {
	protected const BASE = 'https://localhost:8443';
	protected const APP_DIR = '/var/www/html/custom_apps/pathlocale';

	protected IUserManager $um;
	protected IConfig $config;
	/** @var array<string, string> uid => password of accounts made by a test */
	protected array $made = [];

	protected function setUp(): void {
		$this->um = Server::get(IUserManager::class);
		$this->config = Server::get(IConfig::class);
	}

	protected function tearDown(): void {
		foreach (array_keys($this->made) as $uid) {
			$this->um->get($uid)?->delete();
		}
		$this->made = [];
	}

	protected function client(?CookieJar $jar = null): Client {
		return new Client(['base_uri' => self::BASE, 'verify' => false, 'http_errors' => false, 'allow_redirects' => false,
			'cookies' => $jar ?? new CookieJar(), 'timeout' => 30]);
	}

	/** @param array<string, string> $headers */
	protected function get(string $path, array $headers = [], ?CookieJar $jar = null): ResponseInterface {
		return $this->client($jar)->get($path, ['headers' => $headers]);
	}

	/** The `lang` attribute of the <html> element of a page body. */
	protected function htmlLang(string $body): string {
		$this->assertSame(1, preg_match('/<html[^>]*\slang="([^"]*)"/', $body, $m), 'no lang attribute in page');
		return $m[1];
	}

	protected function makeUser(string $lang): string {
		$uid = 'plt_' . bin2hex(random_bytes(4));
		$password = bin2hex(random_bytes(12)) . 'Aa1!';
		$this->um->createUser($uid, $password);
		$this->config->setUserValue($uid, 'core', 'lang', $lang);
		$this->made[$uid] = $password;
		return $uid;
	}

	/** A page request made as this account (Basic auth reaches the same session code as the login form). */
	protected function getAs(string $uid, string $path, array $headers = []): ResponseInterface {
		return $this->client()->get($path, ['headers' => $headers, 'auth' => [$uid, $this->made[$uid]]]);
	}
}
