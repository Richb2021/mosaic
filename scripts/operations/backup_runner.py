"""Daily encrypted backup; keeps a content-free success/failure receipt."""
import datetime,json,pathlib,subprocess,sys
from monitor import save
root=pathlib.Path.home()/'.local/state/mosaic-recovery';root.mkdir(parents=True,exist_ok=True);root.chmod(0o700)
report={'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'status':'running'};save(root/'backup-last.json',report)
try:
 for name in ['ncb_recovery.py','site_recovery.py']:
  r=subprocess.run([sys.executable,str(pathlib.Path(__file__).with_name(name))],capture_output=True,timeout=720)
  if r.returncode:raise RuntimeError(name+' failed; prior backups preserved')
 report['status']='verified'
except Exception:
 report['status']='failed'
finally:
 # Expiry is independent of provider availability or a successful new backup.
 for old in list(root.glob('site-*.enc'))+[root/'ncb-backup.enc']:
  if old.exists() and old.stat().st_mtime<datetime.datetime.now().timestamp()-7*86400:old.unlink()
 save(root/'backup-last.json',report)
print(json.dumps(report));sys.exit(0 if report['status']=='verified' else 1)
