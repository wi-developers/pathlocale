<?php

declare(strict_types=1);

namespace OCA\Pathlocale\AppInfo;

use OCA\Pathlocale\Listener\AssetsListener;
use OCP\AppFramework\App;
use OCP\AppFramework\Bootstrap\IBootContext;
use OCP\AppFramework\Bootstrap\IBootstrap;
use OCP\AppFramework\Bootstrap\IRegistrationContext;
use OCP\AppFramework\Http\Events\BeforeLoginTemplateRenderedEvent;
use OCP\AppFramework\Http\Events\BeforeTemplateRenderedEvent;
use OCP\IRequest;
use OCP\IUserSession;
use OCP\Server;

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
		// SPIKE: guest language from a whitelisted cookie, through core's own forceLanguage request parameter
		$c = $_COOKIE['pathlocale_lang'] ?? '';
		if ($c === 'ar' || $c === 'en') {
			$req = Server::get(IRequest::class);
			$us = Server::get(IUserSession::class);
			if (!$us->isLoggedIn() && method_exists($req, 'setUrlParameters')) {
				$req->setUrlParameters(['forceLanguage' => $c]);
			}
		}
	}
}
