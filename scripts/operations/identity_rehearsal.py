"""Synthetic NCB identity recovery only. Operator API key arrives on stdin."""
import secrets,json,urllib.request,urllib.error,http.cookiejar,datetime,sys,re
from ncb_recovery import ROOT,read,write,McpSseClient,rows,call
from monitor import NoRedirect
TARGET='34968_mosaic_recovery_20261103'
assert TARGET!='34968_mosaic_learning'
def sqlvalue(v,column=''):
 if isinstance(v,str) and column.lower() in {'createdat','updatedat','expiresat','accesstokenexpiresat','refreshtokenexpiresat'}:
  v=datetime.datetime.fromisoformat(v.replace('Z','+00:00')).astimezone(datetime.timezone.utc).strftime('%Y-%m-%d %H:%M:%S.%f')
 if v is None:return 'NULL'
 if isinstance(v,(int,float)):return str(v)
 return 'CONVERT(0x'+str(v).encode().hex()+' USING utf8mb4)'
def identity(v):
 assert re.fullmatch(r'[A-Za-z0-9_-]+',v)
 return "'"+v+"'"
def run(key):
 assert len(key)>10,'Supply the authorised NCB key on stdin'
 if (ROOT/'identity-fixture.enc').exists():fixture=read('identity-fixture.enc')
 else:
  fixture={'email':'recovery-'+secrets.token_hex(5)+'@example.com','password':secrets.token_urlsafe(32),'status':'new'};write('identity-fixture.enc',fixture)
 if fixture.get('status')=='verified-and-deleted':
  print((ROOT/'identity-report.json').read_text());return
 jar=http.cookiejar.CookieJar();opener=urllib.request.build_opener(NoRedirect(),urllib.request.HTTPCookieProcessor(jar))
 def request(path,body=None):
  url='https://app.nocodebackend.com/api/user-auth/'+path+'?instance='+TARGET+('&disableCookieCache=true' if path=='get-session' else '')
  req=urllib.request.Request(url,headers={'Content-Type':'application/json','X-Database-Instance':TARGET,'Authorization':'Bearer '+key,'Origin':'https://app.nocodebackend.com'},data=json.dumps(body).encode() if body is not None else None)
  try:
   with opener.open(req,timeout=30) as r:return r.status,json.load(r)
  except urllib.error.HTTPError as e:return e.code,{}
 with McpSseClient(timeout_seconds=120) as c:
  def restore_identity(saved):
   for table,label in [('ncba_user','user'),('ncba_account','account')]:
    existing=rows(c,TARGET,'SELECT * FROM '+table)
    assert all(r['id'] in {v['id'] for v in saved[label]} for r in existing),'Unexpected identity during restore'
    for row in saved[label]:
     if any(r['id']==row['id'] for r in existing):continue
     cols=','.join('`'+k+'`' for k in row);call(c,'execute_sql',{'database':TARGET,'sql':'INSERT INTO '+table+' ('+cols+') VALUES ('+','.join(sqlvalue(v,k) for k,v in row.items())+')'})
  if (ROOT/'identity-snapshot.enc').exists():restore_identity(read('identity-snapshot.enc'))
  allusers=rows(c,TARGET,'SELECT * FROM ncba_user');assert not any(u['email']!=fixture['email'] for u in allusers),'Unexpected identity in isolated target'
  if not allusers:
   fixture['status']='signup-started';write('identity-fixture.enc',fixture)
   status,data=request('sign-up/email',{'email':fixture['email'],'password':fixture['password'],'name':'Synthetic recovery test'});assert status==200,'Synthetic signup failed: '+str(status)
  user=rows(c,TARGET,'SELECT * FROM ncba_user');assert len(user)==1 and user[0]['email']==fixture['email']
  uid=user[0]['id'];account=rows(c,TARGET,'SELECT * FROM ncba_account');assert account and all(x['user_id']==uid for x in account)
  status,data=request('sign-in/email',{'email':fixture['email'],'password':fixture['password']});assert status==200,'Synthetic sign-in failed: '+str(status)
  status,data=request('get-session');assert status==200 and data.get('user',{}).get('id')==uid
  write('identity-snapshot.enc',{'user':user,'account':account})
  call(c,'execute_sql',{'database':TARGET,'sql':'DELETE FROM ncba_user WHERE id='+identity(uid)})
  status,data=request('get-session');assert not (data or {}).get('user'),'Deleted identity still has a session'
  restore_identity({'user':user,'account':account})
  status,data=request('get-session');assert not (data or {}).get('user'),'Historical session was revived'
  jar.clear();status,data=request('sign-in/email',{'email':fixture['email'],'password':fixture['password']});assert status==200
  status,data=request('get-session');assert data.get('user',{}).get('id')==uid
  call(c,'execute_sql',{'database':TARGET,'sql':'DELETE FROM ncba_user WHERE id='+identity(uid)})
  assert not rows(c,TARGET,'SELECT id FROM ncba_user')
  fixture['status']='verified-and-deleted';fixture.pop('password',None);write('identity-fixture.enc',fixture)
  report={'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'target':TARGET,'syntheticIdentityRestored':True,'historicalSessionRejected':True,'freshSignInVerified':True,'fixtureDeleted':True,'productionIdentitiesTouched':False};(ROOT/'identity-report.json').write_text(json.dumps(report,indent=2));print(json.dumps(report))
if __name__=='__main__':run(sys.stdin.read().strip())
