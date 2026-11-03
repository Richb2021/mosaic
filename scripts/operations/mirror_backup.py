"""Off-host encrypted backup mirror on the approved Mac mini; no API keys."""
import datetime,hashlib,json,os,pathlib,subprocess,re
home=pathlib.Path.home();dest=home/'.local/share/mosaic-recovery';config=home/'.config/mosaic-recovery'
for p in [dest,config]:p.mkdir(parents=True,exist_ok=True);p.chmod(0o700)
report={'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'status':'failed'}
try:
 key=subprocess.run(['/usr/bin/ssh','-o','BatchMode=yes','-o','ConnectTimeout=10','baldur','cat ~/.config/mosaic-pilot/recovery.key'],check=True,capture_output=True,timeout=30).stdout
 assert len(key.strip())==44
 path=config/'recovery.key'
 if path.exists():assert path.read_bytes()==key,'Recovery key changed; preserve previous key and reconcile manually'
 else:
  with os.fdopen(os.open(path,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600),'wb') as f:f.write(key)
 subprocess.run(['/usr/bin/rsync','-a','--include=site-*.enc','--include=site-restore-report.json','--exclude=*','baldur:.local/state/mosaic-recovery/',str(dest)+'/'],check=True,capture_output=True,timeout=600)
 manifest=json.loads((dest/'site-restore-report.json').read_text());assert re.fullmatch(r'site-[0-9]{8}T[0-9]{6}Z[.]enc',manifest['archive']);archive=dest/manifest['archive'];assert archive.exists()
 # Compare cipher hashes across hosts; no plaintext leaves the protected backup.
 remote=subprocess.run(['/usr/bin/ssh','baldur','sha256sum ~/.local/state/mosaic-recovery/'+archive.name],check=True,capture_output=True,timeout=30).stdout.decode().split()[0]
 assert hashlib.sha256(archive.read_bytes()).hexdigest()==remote
 report.update(status='verified',archive=archive.name,sha256=remote,bytes=archive.stat().st_size)
except Exception as e:report['error']=type(e).__name__
finally:
 for p in dest.glob('site-*.enc'):
  if p.stat().st_mtime<datetime.datetime.now().timestamp()-7*86400:p.unlink()
tmp=dest/'mirror-last.tmp';tmp.write_text(json.dumps(report,indent=2));tmp.chmod(0o600);tmp.replace(dest/'mirror-last.json')
print(json.dumps(report));raise SystemExit(0 if report['status']=='verified' else 1)
