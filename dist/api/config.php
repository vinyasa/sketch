<?php
/**
 * Sketch — Environment Configuration
 * Loads .env-sketch file and provides get_env_var() helper.
 * On Namecheap, the .env-sketch file lives one level above public_html.
 */

$envPaths = [
    __DIR__ . '/.env-sketch',          // same dir (local dev)
    __DIR__ . '/../.env-sketch',       // one level up from api/
    __DIR__ . '/../../.env-sketch',    // two levels up (sketch/public → sketch)
    $_SERVER['DOCUMENT_ROOT'] . '/../.env-sketch',  // one level above public_html (Namecheap)
];

$envPath = '';
foreach ($envPaths as $path) {
    if (file_exists($path)) {
        $envPath = $path;
        break;
    }
}

if ($envPath) {
    $lines = file($envPath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        $trimmed = trim($line);
        if (str_starts_with($trimmed, '#') || str_starts_with($trimmed, '//'))
            continue;
        if (strpos($line, '=') === false)
            continue;
        [$key, $value] = explode('=', $line, 2);
        $key = trim($key);
        $value = trim($value);
        $value = trim($value, '"\'');
        $_ENV[$key] = $value;
        putenv("$key=$value");
    }
}

/**
 * Get an environment variable with fallback.
 */
function get_env_var(string $key, string $default = ''): string
{
    return $_ENV[$key] ?? getenv($key) ?: $default;
}
?>
