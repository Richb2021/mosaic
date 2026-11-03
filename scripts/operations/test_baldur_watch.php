<?php
declare(strict_types=1);
define('MOSAIC_WATCH_LIBRARY', true);
require __DIR__.'/baldur_watch.php';
function check(bool $ok): void { if (!$ok) throw new RuntimeException('Assertion failed'); }
$s=[]; check(mosaic_transition($s, true, 1)===null); check(mosaic_transition($s,false,2)===null);
check(mosaic_transition($s,false,3)['kind']==='incident'); $s['notifiedDown']=true;
check(mosaic_transition($s,false,4)===null); check(mosaic_transition($s,true,5)===null); check(mosaic_transition($s,true,6)['kind']==='recovered');
$s=[]; foreach ([false,true,false,true] as $i=>$up) check(mosaic_transition($s,$up,$i)===null);
check(mosaic_transition($s,false,5)['kind']==='incident');
$path=tempnam(sys_get_temp_dir(),'mosaic-watch-'); unlink($path); $sent=[];
$config=$path.'.php'; $marker=$path.'.executed';
$fail=fn(...$args)=>false;
$ok=function($event,$id,$up,$r)use(&$sent){$sent[]=[$event,$id,$up,$r];return true;};
try {
    $password="quote'back\\slash";
    $source="<?php file_put_contents(".var_export($marker,true).",'must not execute');\n";
    foreach (['GG_SMTP_HOST'=>'smtp.stackmail.com','GG_SMTP_PORT'=>587,'GG_SMTP_USER'=>'contact@graysongames.com','GG_SMTP_PASS'=>$password] as $key=>$value) $source.='define('.var_export($key,true).','.var_export($value,true).");\n";
    file_put_contents($config,$source);
    check(mosaic_smtp_settings($config)['GG_SMTP_PASS']===$password && !is_file($marker));
    foreach ([str_replace("'smtp.stackmail.com'","'unexpected.example'",$source),$source."define('GG_SMTP_PORT',465);",str_replace(var_export($password,true),"getenv('PASSWORD')",$source)] as $invalid) {
        file_put_contents($config,$invalid); $rejected=false;
        try { mosaic_smtp_settings($config); } catch (RuntimeException $e) { $rejected=true; }
        check($rejected);
    }
    mosaic_check($path,false,100,'test',$fail);$s=mosaic_check($path,false,101,'test',$fail);
    check(isset($s['pending'])); $id=$s['pending']['id'];
    $s=mosaic_check($path,true,102,'test',$ok);check(count($sent)===0 && $s['pending']['id']===$id);
    $s=mosaic_check($path,true,3702,'test',$ok);check(count($sent)===1 && $sent[0][0]['kind']==='incident' && $sent[0][2]===true);
    $s=mosaic_check($path,true,3703,'test',$ok);check(count($sent)===2 && $sent[1][0]['kind']==='recovered');
    mosaic_check($path,true,3704,'test',$ok);check(count($sent)===2);
    check((fileperms($path)&0777)===0600);
    // A listening service that is not SSH is not healthy.
    $server=stream_socket_server('tcp://127.0.0.1:0',$n,$e);check($server!==false);
    $address=stream_socket_get_name($server,false);$port=(int)substr(strrchr($address,':'),1);
    $pid=pcntl_fork();check($pid>=0);
    if($pid===0){$c=stream_socket_accept($server,10);fwrite($c,"HTTP/1.1 200 OK\r\n");fclose($c);exit(0);}
    check(!mosaic_probe('127.0.0.1',$port));pcntl_waitpid($pid,$status);fclose($server);
    check(!mosaic_probe('127.0.0.1',1));
} finally { @unlink($path); @unlink($path.'.tmp'); @unlink($config); @unlink($marker); }
echo "Baldur watcher: state, retry, permissions, non-executing SMTP configuration and transport checks passed.\n";
