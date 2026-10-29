<?php

declare(strict_types=1);

namespace OCA\Pathlocale\Controller;

use OCA\Pathlocale\AppInfo\Application;
use OCP\AppFramework\Controller;
use OCP\AppFramework\Http\Attribute\NoCSRFRequired;
use OCP\AppFramework\Http\Attribute\PublicPage;
use OCP\AppFramework\Http\RedirectResponse;
use OCP\IRequest;

/**
 * Remembers a guest's language choice in a cookie. The cookie only has an effect on requests without a signed-in user
 * (see Application::boot), and only the two values below are ever stored or read.
 */
class LanguageController extends Controller {
	public const COOKIE = 'pathlocale_lang';
	public const LANGUAGES = ['ar', 'en'];
	private const MAX_AGE = 31536000;

	public function __construct(IRequest $request) {
		parent::__construct(Application::APP_ID, $request);
	}

	#[PublicPage]
	#[NoCSRFRequired]
	public function set(string $lang, string $redirect = '/'): RedirectResponse {
		$response = new RedirectResponse(self::safeRedirect($redirect));
		if (in_array($lang, self::LANGUAGES, true)) {
			$response->addCookie(self::COOKIE, $lang, new \DateTime('@' . (time() + self::MAX_AGE)), 'Lax');
		}
		return $response;
	}

	/**
	 * Only a path on this site: starts with exactly one slash, no backslash, no control characters, no scheme.
	 */
	public static function safeRedirect(string $target): string {
		if ($target === '' || $target[0] !== '/' || str_starts_with($target, '//') || str_contains($target, '\\')
			|| preg_match('/[\x00-\x1f\x7f]/', $target) === 1 || str_contains($target, '://')) {
			return '/';
		}
		return $target;
	}
}
