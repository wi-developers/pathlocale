<?php

declare(strict_types=1);

// Runs inside the rig container, as the web server user, against the real instance. HTTP checks go over HTTPS to the
// Apache of the rig; Nextcloud services from the CLI are used only to prepare accounts and to read state back.
define('OC_CONSOLE', 1);
require_once '/var/www/html/lib/base.php';
\OC_App::loadApp('pathlocale');

require_once __DIR__ . '/PathlocaleTestCase.php';
