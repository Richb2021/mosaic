"""Authenticated complete bounded D1/R2 export and isolated restore verification.
Must run on Baldur. No mutation of a live Site is implemented by this script.
"""
import base64,datetime,hashlib,json,pathlib,sqlite3,urllib.parse,urllib.request
from monitor import ORIGIN,NoRedirect
from ncb_recovery import ROOT,write,read,digest

def site_get(config,query=''):
 req=urllib.request.Request(ORIGIN+'/api/operations'+query,headers={'Authorization':'Bearer '+config['maintenanceSecret'],'X-Mosaic-Maintenance':'recovery-v1'})
 with urllib.request.build_opener(NoRedirect()).open(req,timeout=90) as r:
  b=r.read(64*1024*1024+1);assert len(b)<=64*1024*1024,'Object exceeds backup bound';return b

def stable(snapshot):
 tables=json.loads(json.dumps(snapshot['tables']))
 # The idle worker heartbeat is deliberately outside the content consistency check.
 tables['data_controls']=[r for r in tables['data_controls'] if r['scope']!='maintenance:media']
 return digest({'tables':tables,'objects':snapshot['objects']})

def run():
 config=json.loads((pathlib.Path.home()/'.config/mosaic-pilot/maintenance.json').read_text());assert config['url']==ORIGIN
 started=datetime.datetime.now(datetime.timezone.utc)
 snapshot=json.loads(site_get(config));assert snapshot['schemaVersion']==1
 assert not any(r['operation'] for r in snapshot['tables']['data_controls']),'A deletion is in flight; retry after completion'
 assert not any(r['expires']>snapshot['at'] for r in snapshot['tables']['data_leases']),'A data mutation is in flight; retry after completion'
 assert sum(o['size'] for o in snapshot['objects'])<=256*1024*1024,'Backup byte bound exceeded'
 objects={};checks=[]
 for obj in snapshot['objects']:
  data=site_get(config,'?'+urllib.parse.urlencode({'object':obj['key']}));assert len(data)==obj['size'],'Object changed during backup'
  objects[obj['key']]=base64.b64encode(data).decode();checks.append({'keyHash':hashlib.sha256(obj['key'].encode()).hexdigest(),'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()})
 for asset in snapshot['tables']['media_assets']:
  if asset['status']=='ready':assert asset['object_key'] in objects,'Ready media missing from file storage'
 for resource in snapshot['tables']['workshop_resources']:
  if json.loads(resource['payload']).get('original'):
   key='sources/'+hashlib.sha256(resource['owner'].encode()).hexdigest()+'/'+resource['id']+'/original';assert key in objects,'Retained original missing'
 after=json.loads(site_get(config));assert stable(snapshot)==stable(after),'Content changed during export; snapshot not accepted'
 bundle={'snapshot':snapshot,'objects':objects,'ncb':read('ncb-backup.enc'),'at':started.isoformat()};name='site-'+started.strftime('%Y%m%dT%H%M%SZ')+'.enc';write(name,bundle)
 recovered=read(name);db=sqlite3.connect(':memory:');db.row_factory=sqlite3.Row
 for schema in sorted(recovered['snapshot']['schema'],key=lambda x:x['type']!='table'):db.execute(schema['sql'])
 for table,rows in recovered['snapshot']['tables'].items():
  for row in rows:
   cols=list(row);db.execute('INSERT INTO "'+table+'" ('+','.join('"'+c+'"' for c in cols)+') VALUES ('+','.join('?' for _ in cols)+')',[row[c] for c in cols])
  restored=[dict(x) for x in db.execute('SELECT * FROM "'+table+'" ORDER BY 1')];assert digest(restored)==digest(rows),'Database restore mismatch'
 assert db.execute('PRAGMA integrity_check').fetchone()[0]=='ok'
 for obj,check in zip(snapshot['objects'],checks):assert hashlib.sha256(base64.b64decode(recovered['objects'][obj['key']])).hexdigest()==check['sha256']
 elapsed=(datetime.datetime.now(datetime.timezone.utc)-started).total_seconds()
 report={'status':'verified','at':started.isoformat(),'archive':name,'tables':{k:{'rows':len(v),'sha256':digest(v)} for k,v in snapshot['tables'].items()},'objects':checks,'elapsedSeconds':elapsed,'databaseIntegrity':'ok','sourceUnchanged':True,'restoreTarget':'isolated in-memory SQLite and decoded file bytes; no live restore','limits':'256MB files, 64MB each, 10000 rows/table; fails closed on truncation or concurrent content changes'}
 (ROOT/'site-restore-report.json').write_text(json.dumps(report,indent=2));print(json.dumps(report))
 # Fixed seven-day encrypted backup retention. Only this script's completed files.
 for old in ROOT.glob('site-*.enc'):
  if old.name!=name and old.stat().st_mtime < started.timestamp()-7*86400:old.unlink()
if __name__=='__main__':run()
