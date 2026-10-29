<?php

declare(strict_types=1);

namespace OCA\Pathlocale\AppInfo;

use OCA\Pathlocale\Listener\AssetsListener;
use OCA\Pathlocale\Service\GuestLanguage;
use OCP\AppFramework\App;
use OCP\AppFramework\Bootstrap\IBootContext;
use OCP\AppFramework\Bootstrap\IBootstrap;
use OCP\AppFramework\Bootstrap\IRegistrationContext;
use OCP\AppFramework\Http\Events\BeforeLoginTemplateRenderedEvent;
use OCP\AppFramework\Http\Events\BeforeTemplateRenderedEvent;
use OCP\IRequest;
use OCP\IUserSession;

class Application extends App implements IBootstrap {
	public const APP_ID = 'pathlocale';

	public function __construct() {
		parent::__construct(self::APP_ID);
	}

	public function register(IRegistrationContext $context): void {
		// login and guest pages fire the Login event, every other page fires the plain one
		$context->registerEventListener(BeforeLoginTemplateRenderedEvent::class, AssetsListener::class);
		$context->registerEventListener(BeforeTemplateRenderedEvent::class, AssetsListener::class);
	}

	public function boot(IBootContext $context): void {
		// A guest's language choice (cookie, two accepted values) goes in through core's own `forceLanguage` request
		// parameter. Never in register(): the session is not known there. Never for a signed-in user: their saved
		// language wins. setUrlParameters() is not part of IRequest, so a core change turns this into "no switcher".
		$server = $context->getServerContainer();
		$request = $server->get(IRequest::class);
		$lang = GuestLanguage::fromCookie($request->getCookie(GuestLanguage::COOKIE));
		if ($lang === null || $server->get(IUserSession::class)->isLoggedIn() || !method_exists($request, 'setUrlParameters')) {
			return;
		}
		$request->setUrlParameters(['forceLanguage' => $lang]);
	}
}
