<?php
// CLI-only watcher. Reuses SMTP configuration already on this 20i package.
// No credentials are copied into this script or into its state files.
declare(strict_types=1);
function mosaic_probe(string $host = '94.249.230.211', int $port = 22): bool {
    $s = @stream_socket_client('tcp://'.$host.':'.$port, $errno, $error, 5);
    if ($s === false) return false;
    stream_set_timeout($s, 5);
    $banner = fgets($s, 256);
    fclose($s);
    return is_string($banner) && str_starts_with($banner, 'SSH-2.0-');
}
function mosaic_transition(array &$state, bool $up, int $now): ?array {
    $state['count'] = isset($state['up']) && $state['up'] === $up ? ($state['count'] ?? 0) + 1 : 1;
    $state['up'] = $up; $state['checkedAt'] = $now;
    $state['history'] = array_slice(array_merge($state['history'] ?? [], [$up]), -5);
    $notified = $state['notifiedDown'] ?? false;
    $failures = count(array_filter($state['history'], fn($v) => !$v));
    if (!$up && !$notified && ($state['count'] >= 2 || $failures >= 3)) return ['kind'=>'incident','observedAt'=>$now];
    if ($up && $notified && $state['count'] >= 2) return ['kind'=>'recovered','observedAt'=>$now];
    return null;
}
function mosaic_save(string $path, array $state): void {
    $temp = $path.'.tmp';
    if (file_put_contents($temp, json_encode($state, JSON_THROW_ON_ERROR)) === false) throw new RuntimeException('state write');
    chmod($temp, 0600);
    if (!rename($temp, $path)) throw new RuntimeException('state replace');
}
function mosaic_check(string $path, bool $up, int $now, string $rehearsal, callable $deliver): array {
    $state = is_file($path) ? json_decode(file_get_contents($path), true, 64, JSON_THROW_ON_ERROR) : [];
    $candidate = mosaic_transition($state, $up, $now);
    $event = $state['pending']['event'] ?? $candidate;
    if ($event !== null) {
        $id = $state['pending']['id'] ?? substr(hash('sha256', $rehearsal.':'.$event['kind'].':'.$event['observedAt']), 0, 24);
        if (isset($state['pending']['attemptAt']) && $now - $state['pending']['attemptAt'] < 3600) {
            mosaic_save($path, $state); return $state;
        }
        $state['pending'] = ['id'=>$id,'event'=>$event,'attemptAt'=>$now];
        mosaic_save($path, $state); // Persist before SMTP, including ambiguous acknowledgement.
        if ($deliver($event, $id, $up, $rehearsal)) {
            $state['notifiedDown'] = $event['kind'] === 'incident';
            $state['lastReceipt'] = $id; $state['lastQueuedAt'] = $now;
            $state['delivery'] = 'smtp';
            unset($state['pending']);
        }
    }
    mosaic_save($path, $state);
    return $state;
}
function mosaic_config_literal(array $token): string|int {
    if ($token[0] === T_LNUMBER && ctype_digit($token[1])) return (int)$token[1];
    if ($token[0] !== T_CONSTANT_ENCAPSED_STRING) throw new RuntimeException('Unsupported SMTP configuration');
    $s = $token[1];
    if ($s[0] === "'") return strtr(substr($s, 1, -1), ["\\\\"=>"\\", "\\'"=>"'"]);
    // Only simple double-quoted literals are needed; never evaluate PHP code.
    if ($s[0] === '"' && !str_contains($s, '\\') && !str_contains($s, '$')) return substr($s, 1, -1);
    throw new RuntimeException('Unsupported SMTP configuration');
}
function mosaic_smtp_settings(string $path): array {
    $source = @file_get_contents($path);
    if ($source === false) throw new RuntimeException('SMTP configuration unavailable');
    $tokens = array_values(array_filter(token_get_all($source), fn($t)=>!is_array($t) || !in_array($t[0], [T_WHITESPACE,T_COMMENT,T_DOC_COMMENT], true)));
    $settings = []; $keys = ['GG_SMTP_HOST','GG_SMTP_PORT','GG_SMTP_USER','GG_SMTP_PASS'];
    for ($i = 0; $i + 5 < count($tokens); $i++) {
        if (!is_array($tokens[$i]) || $tokens[$i][0] !== T_STRING || strtolower($tokens[$i][1]) !== 'define' || $tokens[$i+1] !== '(') continue;
        if (!is_array($tokens[$i+2]) || $tokens[$i+2][0] !== T_CONSTANT_ENCAPSED_STRING) continue;
        $key = mosaic_config_literal($tokens[$i+2]);
        if (!in_array($key, $keys, true)) continue;
        if ($tokens[$i+3] !== ',' || !is_array($tokens[$i+4]) || $tokens[$i+5] !== ')' || array_key_exists($key, $settings)) throw new RuntimeException('Unsupported SMTP configuration');
        $settings[$key] = mosaic_config_literal($tokens[$i+4]);
    }
    if (count($settings) !== 4 || $settings['GG_SMTP_HOST'] !== 'smtp.stackmail.com' || !in_array($settings['GG_SMTP_PORT'], [465,587], true) || $settings['GG_SMTP_USER'] !== 'contact@graysongames.com' || !is_string($settings['GG_SMTP_PASS']) || $settings['GG_SMTP_PASS'] === '') throw new RuntimeException('Unexpected SMTP configuration');
    return $settings;
}
function mosaic_mail(array $event, string $id, bool $up, string $rehearsal): bool {
    $tag = $rehearsal !== '' ? ' REHEARSAL '.$rehearsal : '';
    $body = "Mosaic independent Baldur monitor: ".$event['kind']."\nObserved: ".gmdate('c', $event['observedAt']).
        "\nCurrent SSH service reachability from 20i: ".($up?'reachable':'unreachable').
        "\nThis can indicate a host, network, firewall or SSH-service outage; it does not diagnose the cause.".
        "\nThe check and this email run on 20i without Baldur or the Mac mini.".
        "\nNo learner information or credentials are included.\nReceipt: ".$id."\n".
        ($rehearsal !== '' ? "Labelled rehearsal: failed connection to a closed loopback port, followed by real Baldur reachability. No production service was stopped.\n" : '');
    try {
        $web = '/home/sites/11b/d/d7e70ebe4d/public_html';
        $settings = mosaic_smtp_settings($web.'/wp-config.php');
        // Use the maintained mailer already installed by WordPress, without
        // bootstrapping WordPress, executing wp-config, or reading its database.
        foreach (['Exception','PHPMailer','SMTP'] as $class) require_once $web.'/wp-includes/PHPMailer/'.$class.'.php';
        $mail = new \PHPMailer\PHPMailer\PHPMailer(true);
        $mail->isSMTP(); $mail->SMTPAuth = true; $mail->SMTPDebug = 0;
        $mail->Host = $settings['GG_SMTP_HOST']; $mail->Port = $settings['GG_SMTP_PORT'];
        $mail->Username = $settings['GG_SMTP_USER']; $mail->Password = $settings['GG_SMTP_PASS'];
        $mail->SMTPSecure = $mail->Port === 465 ? \PHPMailer\PHPMailer\PHPMailer::ENCRYPTION_SMTPS : \PHPMailer\PHPMailer\PHPMailer::ENCRYPTION_STARTTLS;
        $mail->SMTPOptions = ['ssl'=>['verify_peer'=>true,'verify_peer_name'=>true,'allow_self_signed'=>false]];
        $mail->Timeout = 10; $mail->getSMTPInstance()->Timelimit = 15;
        $mail->CharSet = 'UTF-8'; $mail->setFrom('contact@graysongames.com', 'Mosaic operations');
        $mail->addAddress('contact@graysongames.com');
        $mail->MessageID = '<mosaic-baldur-'.$id.'@graysongames.com>';
        $mail->Subject = '[Mosaic'.$tag.'] Baldur '.$event['kind']; $mail->Body = $body;
        return $mail->send();
    } catch (Throwable $error) {
        // Keep the event pending. Provider details and credentials never enter
        // cron output or state; failed submissions retry at most once an hour.
        return false;
    }
}
function mosaic_main(array $argv): void {
    if (PHP_SAPI !== 'cli') { http_response_code(404); return; }
    $rehearsal = $argv[1] ?? '';
    if ($rehearsal !== '' && !preg_match('/^rehearsal-[a-z0-9-]{1,40}$/D', $rehearsal)) throw new RuntimeException('invalid mode');
    $root = '/home/sites/11b/d/d7e70ebe4d/.mosaic-baldur-watch';
    if (!is_dir($root) && !mkdir($root, 0700, true)) throw new RuntimeException('state directory');
    chmod($root, 0700);
    $lock = fopen($root.'/watch.lock', 'c');
    if (!$lock || !flock($lock, LOCK_EX|LOCK_NB)) return;
    $path = $root.'/'.($rehearsal ?: 'production').'.json';
    if ($rehearsal !== '') {
        $state = is_file($path) ? json_decode(file_get_contents($path), true, 64, JSON_THROW_ON_ERROR) : [];
        if (!empty($state['completed'])) return;
        // Each cron invocation advances one persisted step. Never changes production state.
        $step = $state['step'] ?? 0;
        $up = $step < 2 ? mosaic_probe('127.0.0.1', 1) : mosaic_probe();
        $state = mosaic_check($path, $up, time(), $rehearsal, 'mosaic_mail');
        $state['step'] = $step + 1;
        if ($step >= 3 && $up && empty($state['pending']) && empty($state['notifiedDown'])) $state['completed'] = true;
        mosaic_save($path, $state);
    } else mosaic_check($path, mosaic_probe(), time(), '', 'mosaic_mail');
}
if (!defined('MOSAIC_WATCH_LIBRARY')) mosaic_main($argv);
