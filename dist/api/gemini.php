<?php
/**
 * Sketch — Gemini AI Proxy
 * Receives the full Gemini request payload from the frontend,
 * attaches the API key server-side, forwards to Google, and
 * returns the response.  The API key never touches the browser.
 */

require_once __DIR__ . '/config.php';

// CORS headers for local dev (Vite on :5173 → PHP on different port/origin)
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Handle preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

// Read the request body — the frontend sends the full Gemini payload
$input = json_decode(file_get_contents('php://input'), true);
if (!$input) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid JSON body']);
    exit;
}

$apiKey = get_env_var('GEMINI_API_KEY');
if (!$apiKey) {
    http_response_code(500);
    echo json_encode(['error' => 'Gemini API key not configured on server']);
    exit;
}

// The frontend sends { model, payload } where payload is the Gemini request body
$model = $input['model'] ?? 'gemini-2.5-flash';
$payload = $input['payload'] ?? null;

if (!$payload) {
    http_response_code(400);
    echo json_encode(['error' => 'Missing payload']);
    exit;
}

$url = "https://generativelanguage.googleapis.com/v1beta/models/{$model}:generateContent?key=" . urlencode($apiKey);

$ch = curl_init($url);
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_POSTFIELDS => json_encode($payload),
    CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT => 60,
    CURLOPT_SSL_VERIFYPEER => true,
    CURLOPT_SSL_VERIFYHOST => 2,
]);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlError = curl_error($ch);
curl_close($ch);

if ($curlError) {
    http_response_code(502);
    echo json_encode(['error' => 'Upstream connection failed: ' . $curlError]);
    exit;
}

// Forward the upstream status code and body as-is
http_response_code($httpCode);
echo $response;
?>