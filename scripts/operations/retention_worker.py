"""Deterministic daily retention runner. Credentials stay on the operations host."""
import pathlib,json,urllib.request,urllib.error,hashlib,datetime,sys
home=pathlib.Path.home();directory=home/'.local/state/mosaic-pilot';directory.mkdir(parents=True,exist_ok=True);directory.chmod(0o700)
config=json.loads((home/'.config/mosaic-pilot/maintenance.json').read_text());origin='https://mosaic-lanternbound-rpg.rbuk2025.chatgpt.site';assert config['url']==origin
headers={'OAI-Sites-Authorization':'Bearer '+config['token'],'Authorization':'Bearer '+config['maintenanceSecret'],'X-Mosaic-Maintenance':'retention-v1'}
class NoRedirect(urllib.request.HTTPRedirectHandler):
 def redirect_request(self,*args,**kwargs):return None
client=urllib.request.build_opener(NoRedirect())
def request(method,path,purpose='retention-v1'):
 req=urllib.request.Request(origin+path,data=b'' if method=='POST' else None,headers={**headers,'X-Mosaic-Maintenance':purpose},method=method)
 try:
  with client.open(req,timeout=55) as r:return json.load(r)
 except urllib.error.HTTPError as error:raise RuntimeError('Maintenance HTTP '+str(error.code)) from None
result={'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'status':'failed','runs':[]}
try:
 current=request('GET','/api/maintenance');assert current['enabled']
 for i in range(20):
  batch=request('POST','/api/maintenance');result['runs'].append(batch)
  if not batch['more']:break
 assert not batch['more'],'Sweep batch bound reached'
 saved=request('GET','/api/maintenance');assert saved['lastRun']['runId']==batch['runId'],'Saved run did not match'
 queue=request('GET','/api/operations','closure-v1');pending=sum(x['status']!='complete' for x in queue['closures'])
 result.update(status='attention' if pending or any(x['status']!='complete' for x in result['runs']) else 'complete',pendingClosures=pending,lastRunAt=saved['lastRun']['at'],verified=True)
except Exception as e:
 # Never include request objects, headers, body content or raw provider responses.
 result['error']=str(e) if isinstance(e,(AssertionError,RuntimeError)) else type(e).__name__
path=directory/'retention-last.json';temporary=directory/'retention-last.tmp';temporary.write_text(json.dumps(result,indent=2));temporary.chmod(0o600);temporary.replace(path)
print(json.dumps(result));sys.exit(0 if result['status']=='complete' else 1)
