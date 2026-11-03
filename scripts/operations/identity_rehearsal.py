"""Synthetic identity restore in the isolated NCB rehearsal database only."""
import secrets,json,urllib.request,urllib.error,http.cookiejar,datetime
from ncb_recovery import ROOT,read,write,McpSseClient,rows,call
TARGET='34968_mosaic_recovery_20261103'
assert TARGET!='34968_mosaic_learning'
def sqlvalue(v):
 if v is None:return 'NULL'
 if isinstance(v,(int,float)):return str(v)
 return 'CONVERT(0x'+str(v).encode().hex()+' USING utf8mb4)'
def run():
 if (ROOT/'identity-fixture.enc').exists():fixture=read('identity-fixture.enc')
 else:
  fixture={'email':'recovery-'+secrets.token_hex(5)+'@example.invalid','password':secrets.token_urlsafe(32),'status':'new'};write('identity-fixture.enc',fixture)
 with McpSseClient(timeout_seconds=120) as c:
  if fixture['status']=='new':
   fixture['status']='creation-started';write('identity-fixture.enc',fixture)
   result=c.call_tool('create_test_user',{'database':TARGET,'email':fixture['email'],'password':fixture['password'],'name':'Synthetic recovery test'});write('identity-create.enc',result)
   fixture['status']='created';write('identity-fixture.enc',fixture)
  user=rows(c,TARGET,'SELECT * FROM ncba_user WHERE email='+sqlvalue(fixture['email']));assert len(user)==1
  uid=user[0]['id'];account=rows(c,TARGET,'SELECT * FROM ncba_account WHERE user_id='+sqlvalue(uid));assert account
  jar=http.cookiejar.CookieJar();opener=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))
  base='https://app.nocodebackend.com/api/user-auth/'
  def request(path,body=None):
   req=urllib.request.Request(base+path+'?instance='+TARGET,headers={'Content-Type':'application/json','X-Database-Instance':TARGET,'Origin':'https://app.nocodebackend.com'},data=json.dumps(body).encode() if body is not None else None)
   try:
    with opener.open(req,timeout=30) as r:return r.status,json.load(r)
   except urllib.error.HTTPError as e:return e.code,{}
  status,data=request('sign-in/email',{'email':fixture['email'],'password':fixture['password']});assert status==200, 'Synthetic sign-in failed: '+str(status)
  status,data=request('get-session');assert status==200 and data.get('user',{}).get('id')==uid
  write('identity-snapshot.enc',{'user':user,'account':account})
  # Delete only this fixture, restoring its identity/account but never its session.
  call(c,'execute_sql',{'database':TARGET,'sql':'DELETE FROM ncba_user WHERE id='+sqlvalue(uid)})
  status,data=request('get-session');assert not data.get('user'), 'Deleted identity still has a session'
  for table,values in [('ncba_user',user),('ncba_account',account)]:
   for row in values:
    cols=','.join('`'+k+'`' for k in row);call(c,'execute_sql',{'database':TARGET,'sql':'INSERT INTO '+table+' ('+cols+') VALUES ('+','.join(sqlvalue(v) for v in row.values())+')'})
  status,data=request('get-session');assert not data.get('user'), 'Historical session was revived'
  jar.clear();status,data=request('sign-in/email',{'email':fixture['email'],'password':fixture['password']});assert status==200
  status,data=request('get-session');assert data.get('user',{}).get('id')==uid
  call(c,'execute_sql',{'database':TARGET,'sql':'DELETE FROM ncba_user WHERE id='+sqlvalue(uid)})
  assert not rows(c,TARGET,'SELECT id FROM ncba_user WHERE id='+sqlvalue(uid))
  fixture['status']='verified-and-deleted';write('identity-fixture.enc',fixture)
  report={'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'target':TARGET,'syntheticIdentityRestored':True,'historicalSessionRejected':True,'freshSignInVerified':True,'fixtureDeleted':True,'productionIdentitiesTouched':False};(ROOT/'identity-report.json').write_text(json.dumps(report,indent=2));print(json.dumps(report))
if __name__=='__main__':run()
