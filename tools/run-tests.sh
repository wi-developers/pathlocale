#!/bin/sh
# Copies the app into the rig container, runs the suite there as the web server user; output goes to a file, only the tail is shown.
# usage: tools/run-tests.sh [phpunit args...]   (output file: $OUT, default /tmp/pathlocale-phpunit.txt inside the container)
set -u
OUT="${OUT:-/tmp/pathlocale-phpunit.txt}"
HERE="$(cd "$(dirname "$0")/.." && (pwd -W 2>/dev/null || pwd))"
export MSYS_NO_PATHCONV=1
docker cp "$HERE/." wisso-rig-app-1:/var/www/html/custom_apps/pathlocale/ || exit 2
docker exec wisso-rig-app-1 chown -R www-data:www-data /var/www/html/custom_apps/pathlocale
docker exec wisso-rig-app-1 apache2ctl graceful > /dev/null 2>&1
docker exec -u www-data wisso-rig-app-1 bash -c 'out=$0; cd /var/www/html/custom_apps/pathlocale && phpunit -c phpunit.xml "$@" > "$out" 2>&1; echo exit=$?' "$OUT" "$@"
docker exec wisso-rig-app-1 tail -n 25 "$OUT"
