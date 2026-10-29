<?php

declare(strict_types=1);

namespace OCA\Pathlocale\Controller;

use OCA\Pathlocale\AppInfo\Application;
use OCA\Pathlocale\Service\GuestLanguage;
use OCP\AppFramework\Controller;
use OCP\AppFramework\Http\Attribute\NoCSRFRequired;
use OCP\AppFramework\Http\Attribute\PublicPage;
use OCP\AppFramework\Http\RedirectResponse;
use OCP\IRequest;

/**
 * Remembers a guest's language choice in a cookie. The cookie only has an effect on requests without a signed-in user
 * (see Application::boot), and only the two values of GuestLanguage::LANGUAGES are ever stored or read.
 */
class LanguageController extends Controller {
	public function __construct(IRequest $request) {
		parent::__construct(Application::APP_ID, $request);
	}

	#[PublicPage]
	#[NoCSRFRequired]
	public function set(string $lang, string $redirect = '/'): RedirectResponse {
		$response = new RedirectResponse(GuestLanguage::safeRedirect($redirect));
		if (GuestLanguage::fromCookie($lang) !== null) {
			$response->addCookie(GuestLanguage::COOKIE, $lang, new \DateTime('@' . (time() + GuestLanguage::MAX_AGE)), 'Lax');
		}
		return $response;
	}
}
