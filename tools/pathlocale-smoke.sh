#!/bin/sh
# pathlocale-smoke.sh: does the pathlocale app still answer after a snap refresh or any change?
# Needs no account and changes nothing (the only cookie it asks for is thrown away). Run it after EVERY Nextcloud snap refresh
# (daily window 04:00-05:00 UTC) and after installing or upgrading the app.
#
#   sh pathlocale-smoke.sh                       # checks https://path.wi.sa
#   sh pathlocale-smoke.sh https://host [-k]     # another base URL; -k accepts a self-signed certificate (local rig)
#
# Exit 0 = all checks passed, 1 = a check failed (read the line that says FAIL), 2 = could not run.
# What each check proves:
#   1. the login page follows the browser language (ar and en) and carries the app's stylesheet and dictionary script.
#   2. the language cookie beats the browser, and a cookie value that is not exactly ar or en is ignored.
#   3. the language route answers 303, sets the cookie for ar and en only, and sends a hostile redirect target to "/".
#   4. the four files a page needs (stylesheet, both dictionaries, the Regular font) answer HTTP 200.
# It cannot prove that a SIGNED-IN user keeps their own language: look at one account in a private window
# (a user whose saved language is Arabic must stay Arabic even after choosing English on the login page).
# Nextcloud caches its route table for a few seconds, so right after an enable or disable wait about 10 s before judging a result.
set -u
BASE="${1:-https://path.wi.sa}"
CURL_OPTS=""
[ "${2:-}" = "-k" ] && CURL_OPTS="-k"
BASE="${BASE%/}"
command -v curl >/dev/null 2>&1 || { echo "curl is not installed"; exit 2; }
fail=0

lang_of() { # accept-language, cookie value or "-"
	if [ "$2" = "-" ]; then
		curl -sS $CURL_OPTS -m 20 -H "Accept-Language: $1" "$BASE/login" 2>&1
	else
		curl -sS $CURL_OPTS -m 20 -H "Accept-Language: $1" -H "Cookie: pathlocale_lang=$2" "$BASE/login" 2>&1
	fi
}
html_lang() { printf %s "$1" | tr '\n' ' ' | sed -n 's/.*<html[^>]*[[:space:]]lang="\([^"]*\)".*/\1/p' | head -n 1; }
check() { # name, expected, actual
	if [ "$2" = "$3" ]; then echo "PASS  $1"; else echo "FAIL  $1 (expected '$2', got '$3')"; fail=1; fi
}

page="$(lang_of ar -)" || { echo "could not reach $BASE"; exit 2; }
check "login page follows a browser asking for Arabic" ar "$(html_lang "$page")"
# where the app's files are served from differs between installs (custom_apps on the rig, extra-apps on the snap): read it from the page
assets="$(printf %s "$page" | tr '\n' ' ' | sed -n 's#.*href="\([^"?]*/pathlocale\)/css/pathlocale\.css.*#\1#p' | head -n 1)"
if [ -n "$assets" ]; then echo "PASS  login page carries the stylesheet ($assets)"; else echo "FAIL  login page has no pathlocale stylesheet"; fail=1; assets="/apps/pathlocale"; fi
case "$page" in *"pathlocale/js/pathlocale-l10n-ar.js"*) echo "PASS  login page carries the Arabic dictionary" ;; *) echo "FAIL  login page has no Arabic dictionary script"; fail=1 ;; esac
check "login page follows a browser asking for English" en "$(html_lang "$(lang_of en -)")"
check "cookie en beats a browser asking for Arabic" en "$(html_lang "$(lang_of ar en)")"
check "cookie ar beats a browser asking for English" ar "$(html_lang "$(lang_of en ar)")"
check "cookie fr is ignored (Arabic browser)" ar "$(html_lang "$(lang_of ar fr)")"
check "cookie AR is ignored (English browser)" en "$(html_lang "$(lang_of en AR)")"

route="$BASE/index.php/apps/pathlocale/lang"
hdr="$(curl -sS $CURL_OPTS -m 20 -D - -o /dev/null "$route/en?redirect=//evil.example/x" 2>&1 | tr -d '\r')"
check "route answers 303" "303" "$(printf %s "$hdr" | sed -n '1s/^HTTP[^ ]* \([0-9]*\).*/\1/p')"
check "hostile redirect goes to the root" "/" "$(printf %s "$hdr" | sed -n 's/^[Ll]ocation: //p' | head -n 1)"
case "$hdr" in *"pathlocale_lang=en;"*) echo "PASS  route sets the cookie for en" ;; *) echo "FAIL  route did not set the cookie for en"; fail=1 ;; esac
hdr="$(curl -sS $CURL_OPTS -m 20 -D - -o /dev/null "$route/fr?redirect=/login" 2>&1 | tr -d '\r')"
case "$hdr" in *"pathlocale_lang="*) echo "FAIL  route set a cookie for fr"; fail=1 ;; *) echo "PASS  route sets no cookie for another language" ;; esac
check "good redirect is kept" "/login" "$(printf %s "$hdr" | sed -n 's/^[Ll]ocation: //p' | head -n 1)"

for f in css/pathlocale.css js/pathlocale-l10n-ar.js js/pathlocale-l10n-en.js fonts/IBMPlexSansArabic-Regular.woff2; do
	code="$(curl -sS $CURL_OPTS -m 30 -o /dev/null -w '%{http_code}' "$BASE$assets/$f" 2>&1)"
	check "file $f is served" 200 "$code"
done

if [ "$fail" = 0 ]; then echo "SMOKE: PASS"; exit 0; fi
echo "SMOKE: FAIL"
exit 1
