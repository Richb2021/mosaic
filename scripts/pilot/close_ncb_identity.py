"""Baldur only. Input is the server-authorised closure queue item, not an arbitrary email.
Run through the local operator wrapper after the learner requests closure and all
learning-data cleanup completes. Idempotent: verifies the exact identity is absent.
"""
import sys,pathlib,json,re,hashlib
sys.path.insert(0,str(pathlib.Path.home()/'projects/capabilities/packages/nocodebackend-agent/tools'))
import nocodebackend_cli as ncb
item=json.load(sys.stdin);uid=item['userId']
assert item['status']=='provider-pending' and re.fullmatch(r'[A-Za-z0-9_-]{1,100}',uid)
assert hashlib.sha256(('mosaic-learner:'+uid).encode()).hexdigest()==item['accountReference']
def payload(result):
 for c in result.get('content',[]):
  if c.get('type')=='text':
   try:
    d=json.loads(c['text'])
    if 'ok' in d:return d
   except ValueError:pass
 raise RuntimeError('Provider did not return a verified result')
with ncb.McpSseClient() as client:
 result=payload(client.call_tool('execute_sql',{'database':'34968_mosaic_learning','sql':"DELETE FROM ncba_user WHERE id='"+uid+"'"}))
 assert result.get('ok'), 'NoCodeBackend deletion failed'
 result=payload(client.call_tool('execute_sql',{'database':'34968_mosaic_learning','sql':"SELECT COUNT(*) AS remaining FROM ncba_user WHERE id='"+uid+"'"}))
 assert result.get('ok') and result['results'][0]['rows'][0]['remaining']==0
 print(json.dumps({'providerDeleted':True,'accountReference':item['accountReference']}))
