<?php

declare(strict_types=1);

namespace OCA\Pathlocale\Listener;

use OCP\AppFramework\Http\Events\BeforeLoginTemplateRenderedEvent;
use OCP\AppFramework\Http\Events\BeforeTemplateRenderedEvent;
use OCP\EventDispatcher\Event;
use OCP\EventDispatcher\IEventListener;
use OCP\IConfig;
use OCP\L10N\IFactory;
use OCP\Util;

/**
 * @template-implements IEventListener<Event>
 */
class AssetsListener implements IEventListener {
	/** languages this app has a dictionary for; any other language gets the font only */
	private const LANGUAGES = ['ar', 'en'];

	public function __construct(private IFactory $l10nFactory) {
	}

	public function handle(Event $event): void {
		if (!($event instanceof BeforeTemplateRenderedEvent) && !($event instanceof BeforeLoginTemplateRenderedEvent)) {
			return;
		}
		Util::addStyle('pathlocale', 'pathlocale');
		$lang = $this->l10nFactory->findLanguage();
		if (in_array($lang, self::LANGUAGES, true)) {
			// the file name contains "l10n" so that core does not look for a pathlocale translation file of its own
			Util::addInitScript('pathlocale', 'pathlocale-l10n-' . $lang);
		}
	}
}
