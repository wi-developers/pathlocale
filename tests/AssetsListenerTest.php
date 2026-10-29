<?php

declare(strict_types=1);

use OCA\Pathlocale\Listener\AssetsListener;
use OCP\AppFramework\Http\Events\BeforeLoginTemplateRenderedEvent;
use OCP\AppFramework\Http\Events\BeforeTemplateRenderedEvent;
use OCP\AppFramework\Http\TemplateResponse;
use OCP\EventDispatcher\Event;
use OCP\L10N\IFactory;
use OCP\Util;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

/**
 * The listener decides which files a page gets. Core drops a script whose file does not exist, so the guard on the
 * language is only visible on the list of scripts, not in the page: that is what these tests read.
 */
class AssetsListenerTest extends TestCase {
	/** Util keeps the scripts of a request in static properties; every test starts from an empty list. */
	protected function setUp(): void {
		foreach (['scriptsInit' => [], 'scripts' => []] as $prop => $empty) {
			(new ReflectionProperty(Util::class, $prop))->setValue(null, $empty);
		}
	}

	private function run_(string $lang, Event $event): void {
		$factory = $this->createStub(IFactory::class);
		$factory->method('findLanguage')->willReturn($lang);
		(new AssetsListener($factory))->handle($event);
	}

	private function ours(): array {
		return array_values(array_filter(Util::getScripts(), static fn (string $s): bool => str_contains($s, 'pathlocale-l10n-')));
	}

	public static function languages(): array {
		return ['ar' => ['ar', true], 'en' => ['en', true], 'de' => ['de', false], 'fr' => ['fr', false], 'empty' => ['', false],
			'region' => ['ar_SA', false], 'upper' => ['AR', false], 'traversal' => ['../ar', false]];
	}

	#[DataProvider('languages')]
	public function testDictionaryOnlyForTheTwoLanguages(string $lang, bool $expected): void {
		$before = count($this->ours());
		$this->run_($lang, new BeforeTemplateRenderedEvent(true, new TemplateResponse('core', 'x')));
		$added = array_slice($this->ours(), $before);
		if ($expected) {
			$this->assertSame(['pathlocale/js/pathlocale-l10n-' . $lang], $added);
		} else {
			$this->assertSame([], $added);
		}
	}

	public function testLoginPagesGetTheSameAssets(): void {
		$before = count($this->ours());
		$this->run_('ar', new BeforeLoginTemplateRenderedEvent(new TemplateResponse('core', 'x')));
		$this->assertSame(['pathlocale/js/pathlocale-l10n-ar'], array_slice($this->ours(), $before));
	}

	public function testOtherEventsAreIgnored(): void {
		$before = count($this->ours());
		$this->run_('ar', new Event());
		$this->assertSame([], array_slice($this->ours(), $before));
	}
}
