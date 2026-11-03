"""Read-only NCB backup and isolated provider restore. Run only on Baldur.
All row data stays encrypted on disk; stdout contains counts/digests only.
"""
import hashlib,json,pathlib,sys,os,datetime
sys.path.insert(0,'/home/ubuntu/projects/capabilities/packages/nocodebackend-agent/tools')
from nocodebackend_cli import McpSseClient
from cryptography.fernet import Fernet
ROOT=pathlib.Path.home()/'.local/state/mosaic-recovery';ROOT.mkdir(parents=True,exist_ok=True);ROOT.chmod(0o700)
KEY=pathlib.Path.home()/'.config/mosaic-pilot/recovery.key'
if not KEY.exists():
 assert not list(ROOT.glob('*.enc')), 'Recovery key missing; refusing to replace the key for existing backups'
 with os.fdopen(os.open(KEY,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600),'wb') as f:f.write(Fernet.generate_key())
CIPHER=Fernet(KEY.read_bytes());SOURCE='34968_mosaic_learning'
def write(name,obj):
 p=ROOT/name;p.write_bytes(CIPHER.encrypt(json.dumps(obj,separators=(',',':')).encode()));p.chmod(0o600)
def read(name): return json.loads(CIPHER.decrypt((ROOT/name).read_bytes()))
def unpack(result):
 assert not result.get('isError'), 'NCB rejected operation'
 for c in result.get('content',[]):
  if c.get('type')=='text':
   try: return json.loads(c['text'])
   except ValueError: pass
 raise RuntimeError('NCB response was not JSON')
def call(c,name,args):
 raw=c.call_tool(name,args)
 if name=='create_database':write('creation-raw.enc',raw)
 try:x=unpack(raw)
 except RuntimeError:
  if name!='create_database':raise
  import re
  found=re.findall(r'[0-9]+_mosaic_recovery_20261103',json.dumps(raw));assert found, 'Creation receipt needs operator reconciliation'
  x={'instance':found[0]}
 assert x.get('ok') is not False and 'error' not in x,'NCB operation failed';return x
def rows(c,db,sql):
 x=call(c,'execute_sql',{'database':db,'sql':sql});return x['results'][0]['rows']
def digest(x):return hashlib.sha256(json.dumps(x,sort_keys=True,separators=(',',':')).encode()).hexdigest()
def backup(c):
 schema=call(c,'get_schema',{'database':SOURCE});tables={}
 for name,table in schema['tables'].items():
  assert name.replace('_','').isalnum();pk=table['primaryKey'];n=int(rows(c,SOURCE,f'SELECT COUNT(*) AS n FROM `{name}`')[0]['n']);assert n<=20000
  data=[]
  for start in range(0,n,200):data.extend(rows(c,SOURCE,f'SELECT * FROM `{name}` ORDER BY `{pk}` LIMIT 200 OFFSET {start}'))
  assert len(data)==n and n==int(rows(c,SOURCE,f'SELECT COUNT(*) AS n FROM `{name}`')[0]['n']),'Source changed during export'
  again=[]
  for start in range(0,n,200):again.extend(rows(c,SOURCE,f'SELECT * FROM `{name}` ORDER BY `{pk}` LIMIT 200 OFFSET {start}'))
  assert digest(data)==digest(again),'NoCodeBackend data changed during backup'
  tables[name]=data
 result={'source':SOURCE,'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'schema':schema,'tables':tables,'rls':call(c,'get_rls_policies',{'database':SOURCE})}
 write('ncb-backup.enc',result)
 report={'source':SOURCE,'at':result['at'],'tables':{k:{'rows':len(v),'sha256':digest(v)} for k,v in tables.items()},'encrypted':True,'file':'~/.local/state/mosaic-recovery/ncb-backup.enc'}
 (ROOT/'ncb-backup-report.json').write_text(json.dumps(report,indent=2));print(json.dumps(report))

def restore(c):
 source=read('ncb-backup.enc')
 creation=ROOT/'creation.enc'
 if not creation.exists():
  marker=ROOT/'creation-started.json'
  assert not marker.exists(), 'Creation result uncertain; inspect registry before retrying'
  marker.write_text(json.dumps({'name':'mosaic_recovery_20261103','status':'started'}));marker.chmod(0o600)
  columns=[{'name':'owner_key','type':'VARCHAR','length':64,'notNull':True},{'name':'slot_key','type':'VARCHAR','length':180,'notNull':True},{'name':'version','type':'INT','notNull':True},{'name':'payload','type':'TEXT','notNull':True},{'name':'updated_ms','type':'BIGINT','notNull':True}]
  result=call(c,'create_database',{'name':'mosaic_recovery_20261103','region':'eu','enableAuth':True,'tables':[{'name':t,'columns':columns} for t in ['learner_profiles','learner_saves']]})
  write('creation.enc',result)
 else: result=read('creation.enc')
 import re
 candidates=re.findall(r'[0-9]+_mosaic_recovery_20261103',json.dumps(result))
 assert candidates, 'No instance in creation receipt'
 target=candidates[0];assert target!=SOURCE and target.endswith('_mosaic_recovery_20261103')
 receipt={'source':SOURCE,'target':target,'tables':{},'identityPolicy':'Production sessions, password hashes, OAuth and mail configuration are NOT activated in the rehearsal database. Full source backup encrypted separately.'}
 (ROOT/'target.json').write_text(json.dumps({'instance':target}));(ROOT/'target.json').chmod(0o600)
 for table in ['learner_profiles','learner_saves']:
  call(c,'set_rls_policy',{'database':target,'table':table,'policy':'private'})
  n=int(rows(c,target,f'SELECT COUNT(*) AS n FROM `{table}`')[0]['n']);assert n<=20000
  current=[]
  for offset in range(0,n,200):current.extend(rows(c,target,f'SELECT * FROM `{table}` ORDER BY id LIMIT 200 OFFSET {offset}'))
  assert len(current)==n, 'Incomplete restored table read'
  originals={r['id']:r for r in source['tables'][table]}
  assert all(r['id'] in originals and digest(r)==digest(originals[r['id']]) for r in current), 'Target contains conflicting data; refusing to overwrite'
  existing={r['id'] for r in current}
  if not current:
   call(c,'execute_sql',{'database':target,'sql':f'ALTER TABLE `{table}` MODIFY payload MEDIUMTEXT NOT NULL'})
   mark=ROOT/(table+'-index')
   if not mark.exists():
    call(c,'execute_sql',{'database':target,'sql':f'CREATE UNIQUE INDEX recovery_slot_version ON `{table}` (owner_key,slot_key,version)'})
    mark.touch()
  for row in source['tables'][table]:
   if row['id'] in existing:continue
   assert row.get('user_id') is None, 'Linked auth identity needs explicit quarantine mapping'
   def value(v):
    if v is None:return 'NULL'
    if isinstance(v,(int,float)):return str(v)
    return 'CONVERT(0x'+str(v).encode().hex()+' USING utf8mb4)'
   cols=','.join('`'+k+'`' for k in row)
   call(c,'execute_sql',{'database':target,'sql':f'INSERT INTO `{table}` ({cols}) VALUES ('+','.join(value(v) for v in row.values())+')'})
  count=int(rows(c,target,f'SELECT COUNT(*) AS n FROM `{table}`')[0]['n']);assert count==len(originals)
  actual=[]
  for offset in range(0,count,200):actual.extend(rows(c,target,f'SELECT * FROM `{table}` ORDER BY id LIMIT 200 OFFSET {offset}'))
  assert digest(actual)==digest(source['tables'][table]), 'Restored rows differ'
  receipt['tables'][table]={'rows':len(actual),'sha256':digest(actual),'exactMatch':True}
 # Exercise full encrypted identity backup in an offline in-memory store. Never
 # activate production sessions/mail credentials in a second online auth service.
 import sqlite3
 db=sqlite3.connect(':memory:')
 for table,values in source['tables'].items():
  if not values:continue
  cols=list(values[0]);db.execute('CREATE TABLE "'+table+'" ('+','.join('"'+k+'"' for k in cols)+')')
  db.executemany('INSERT INTO "'+table+'" VALUES ('+','.join('?' for _ in cols)+')',[[v[k] for k in cols] for v in values])
  assert list(db.execute('SELECT * FROM "'+table+'"'))==[tuple(v[k] for k in cols) for v in values]
 receipt['offlineIdentityRestore']='all non-empty tables round-tripped in memory'
 receipt['at']=datetime.datetime.now(datetime.timezone.utc).isoformat()
 (ROOT/'restore-report.json').write_text(json.dumps(receipt,indent=2));print(json.dumps(receipt))
if __name__=='__main__':
 with McpSseClient(timeout_seconds=120) as c:
  if '--restore' in sys.argv:restore(c)
  else:backup(c)
