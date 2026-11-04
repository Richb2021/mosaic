<?php
// Meta Model API relay. Meta refuses requests from the API server's Netherlands
// address, so the server sends its Meta calls here, on the UK web host, and this
// forwards them unchanged. Only the Mosaic server can use it (shared secret), only
// for the Responses, Models and image generation endpoints, and nothing is stored or logged.
declare(strict_types=1);
ini_set('display_errors', '0');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
header('X-Robots-Tag: noindex');
function relayFail(int $status, string $message): never {
    http_response_code($status);
    header('Content-Type: application/json');
    echo json_encode(['error' => ['code' => 'relay_error', 'message' => $message]]);
    exit;
}
$config = json_decode((string)@file_get_contents(dirname(__DIR__, 2) . '/.mosaic/meta-relay.json'), true);
if (!is_array($config) || !is_string($config['secret'] ?? null) || strlen($config['secret']) < 32 || ($config['enabled'] ?? false) !== true) relayFail(503, 'Relay is not configured.');
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') relayFail(405, 'Method not allowed.');
if (!hash_equals($config['secret'], (string)($_SERVER['HTTP_X_MOSAIC_RELAY'] ?? ''))) relayFail(403, 'Forbidden.');
$raw = file_get_contents('php://input', false, null, 0, 4194305);
if (!is_string($raw) || strlen($raw) > 4194304) relayFail(413, 'Request too large.');
$req = json_decode($raw, true);
if (!is_array($req)) relayFail(400, 'Bad request.');
$method = $req['method'] ?? '';
$path = $req['path'] ?? '';
$auth = $req['authorization'] ?? '';
$body = $req['body'] ?? null;
if (!in_array($method, ['GET', 'POST', 'DELETE'], true)) relayFail(400, 'Method not allowed.');
if (!is_string($path) || !preg_match('#^/v1/(responses(/resp_[A-Za-z0-9:_-]{1,195})?|models(/[a-z0-9.-]{1,80})?|images/generations)$#D', $path)) relayFail(400, 'Path not allowed.');
if ($method === 'POST' && !in_array($path, ['/v1/responses', '/v1/images/generations'], true)) relayFail(400, 'Path not allowed.');
if ($path === '/v1/images/generations' && $method !== 'POST') relayFail(400, 'Path not allowed.');
// Images take longer than text and come back as base64 (a few MB at most).
$image = $path === '/v1/images/generations';
if ($image) @set_time_limit(110);
if (!is_string($auth) || !preg_match('#^Bearer [A-Za-z0-9_-]{20,200}$#D', $auth)) relayFail(400, 'Bad credential.');
if ($method === 'POST' && !is_string($body)) relayFail(400, 'A request body is required.');
$ch = curl_init('https://api.meta.ai' . $path);
curl_setopt_array($ch, [
    CURLOPT_CUSTOMREQUEST => $method,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_FOLLOWLOCATION => false,
    CURLOPT_PROTOCOLS => CURLPROTO_HTTPS,
    CURLOPT_CONNECTTIMEOUT => 8,
    CURLOPT_TIMEOUT => $image ? 95 : 18,
    CURLOPT_HTTPHEADER => array_merge(['Authorization: ' . $auth, 'Accept: application/json'], $method === 'POST' ? ['Content-Type: application/json'] : []),
]);
if ($method === 'POST') curl_setopt($ch, CURLOPT_POSTFIELDS, $body);
$out = curl_exec($ch);
if (is_string($out) && strlen($out) > 16777216) relayFail(502, 'Meta returned too much data.');
if ($out === false) relayFail(502, 'Meta could not be reached from the relay.');
$status = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
$type = (string)(curl_getinfo($ch, CURLINFO_CONTENT_TYPE) ?: 'application/json');
http_response_code($status ?: 502);
header('Content-Type: ' . (preg_match('#^[a-z]+/[a-z0-9.+-]+(; ?charset=[A-Za-z0-9-]+)?$#i', $type) ? $type : 'application/json'));
echo $out;
