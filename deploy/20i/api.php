<?php
// Only the same-origin API is relayed. Static game assets are served by 20i.
declare(strict_types=1);
ini_set('display_errors', '0');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
$configPath = dirname(__DIR__, 2) . '/.mosaic/gateway.json';
function failRequest(int $status, string $message): never {
    http_response_code($status);
    header('Content-Type: application/json');
    echo json_encode(['error' => $message]);
    exit;
}
$config = json_decode((string)@file_get_contents($configPath), true);
if (!is_array($config) || !isset($config['upstream'], $config['key']) || strlen($config['key']) < 32) failRequest(503, 'Mosaic is being prepared. Please try again shortly.');
if (($config['enabled'] ?? false) !== true) failRequest(503, 'Mosaic is being prepared. Please try again shortly.');
if ($config['upstream'] !== 'https://mosaic-api.24hourcoder.com') failRequest(503, 'Mosaic connection needs attention.');
$method = $_SERVER['REQUEST_METHOD'] ?? '';
if (!in_array($method, ['GET', 'POST'], true)) failRequest(405, 'Method not allowed.');
$uri = $_SERVER['REQUEST_URI'] ?? '';
$path = parse_url($uri, PHP_URL_PATH);
if (!is_string($path) || !preg_match('#^/api/[A-Za-z0-9._~%/-]+$#D', $path) || str_contains($uri, "\r") || str_contains($uri, "\n")) failRequest(404, 'Not found.');
if ((int)($_SERVER['CONTENT_LENGTH'] ?? 0) > 16777216) failRequest(413, 'This request is too large.');
$body = file_get_contents('php://input', false, null, 0, 16777217);
if ($body === false || strlen($body) > 16777216) failRequest(413, 'This request is too large.');
$forward = ['X-Mosaic-Gateway: ' . $config['key']];
$allowed = ['content-type', 'origin', 'cookie', 'authorization', 'x-mosaic-learner', 'x-mosaic-data-epoch', 'x-mosaic-maintenance', 'x-lanternbound-workshop'];
foreach (getallheaders() as $name => $value) {
    if (in_array(strtolower($name), $allowed, true) && !str_contains($value, "\r") && !str_contains($value, "\n")) $forward[] = $name . ': ' . $value;
}
// Buffer a bounded response in a private temporary stream. Do not send a 2xx
// status or partial saved recording if the upstream connection is interrupted.
$stream = fopen('php://temp/maxmemory:2097152', 'w+b');
if ($stream === false) failRequest(503, 'Mosaic is temporarily unavailable.');
$status = 502;
$responseHeaders = [];
$size = 0;
$curl = curl_init($config['upstream'] . $uri);
curl_setopt_array($curl, [
    CURLOPT_CUSTOMREQUEST => $method,
    CURLOPT_HTTPHEADER => $forward,
    CURLOPT_USERAGENT => 'MosaicGateway/1.0 (+https://mosaic.richardbatt.com)',
    CURLOPT_FOLLOWLOCATION => false,
    CURLOPT_CONNECTTIMEOUT => 10,
    CURLOPT_TIMEOUT => 90,
    CURLOPT_SSL_VERIFYPEER => true,
    CURLOPT_SSL_VERIFYHOST => 2,
    CURLOPT_HEADERFUNCTION => static function ($curl, string $line) use (&$status, &$responseHeaders): int {
        if (preg_match('#^HTTP/\\S+ ([1-5][0-9]{2})#', $line, $match)) {
            $status = (int)$match[1];
            $responseHeaders = [];
        } elseif (str_contains($line, ':')) {
            [$name, $value] = explode(':', $line, 2);
            $key = strtolower(trim($name));
            if (in_array($key, ['content-type','cache-control','content-disposition','content-length','content-security-policy','x-frame-options','retry-after','set-cookie','x-mosaic-data-epoch','x-mosaic-data-reset','x-mosaic-data-reset-kind','x-mosaic-audio','x-mosaic-media-id'], true)) $responseHeaders[] = [$key, trim($value)];
        }
        return strlen($line);
    },
    CURLOPT_WRITEFUNCTION => static function ($curl, string $bytes) use ($stream, &$size): int {
        $size += strlen($bytes);
        if ($size > 67108864) return 0;
        return fwrite($stream, $bytes);
    },
]);
if ($method === 'POST') curl_setopt($curl, CURLOPT_POSTFIELDS, $body);
$started = microtime(true);
$ok = curl_exec($curl);
$upstreamMs = (microtime(true) - $started) * 1000;
curl_close($curl);
if ($ok === false || $status < 200 || $status >= 300 && $status < 400) {
    fclose($stream);
    failRequest(503, 'Mosaic is temporarily unavailable. Your device save is safe; retry to check whether the cloud save completed.');
}
foreach ($responseHeaders as [$key, $value]) {
    if ($key === 'content-length' && (int)$value !== $size) {
        fclose($stream);
        failRequest(503, 'The transfer was interrupted. Please try again.');
    }
}
http_response_code($status);
foreach ($responseHeaders as [$key, $value]) {
    if ($key !== 'content-length') header($key . ': ' . $value, $key !== 'set-cookie');
}
header('Content-Length: ' . $size);
// Duration only: no identity, upstream address or credentials are exposed.
header('Server-Timing: upstream;dur=' . number_format($upstreamMs, 1, '.', ''));
rewind($stream);
fpassthru($stream);
fclose($stream);
