<?php

declare(strict_types=1);

namespace OCA\Pathlocale\Service;

/**
 * The only two languages a guest can pick, and the only values the cookie may carry.
 */
final class GuestLanguage {
	public const COOKIE = 'pathlocale_lang';
	public const LANGUAGES = ['ar', 'en'];
	/** one year, in seconds */
	public const MAX_AGE = 31536000;

	/**
	 * The language a cookie value stands for, or null when it is anything but one of the two accepted codes.
	 */
	public static function fromCookie(mixed $value): ?string {
		return is_string($value) && in_array($value, self::LANGUAGES, true) ? $value : null;
	}

	/**
	 * Only a path on this site: starts with exactly one slash, has no backslash, control character or scheme.
	 */
	public static function safeRedirect(string $target): string {
		if ($target === '' || $target[0] !== '/' || str_starts_with($target, '//') || str_contains($target, '\\')
			|| preg_match('/[\x00-\x1f\x7f]/', $target) === 1 || str_contains($target, '://')) {
			return '/';
		}
		return $target;
	}
}
