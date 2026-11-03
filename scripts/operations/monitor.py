"""Content-free operational alerts; run from the authorised operations host."""
import argparse, datetime, email.message, fcntl, hashlib, json, os, pathlib, shlex, smtplib, ssl, urllib.request

RECIPIENT = 'contact@graysongames.com'
ORIGIN = 'https://mosaic-lanternbound-rpg.rbuk2025.chatgpt.site'
KNOWN = {'database', 'mediaWorker', 'mediaQueue', 'mediaFailures', 'retention', 'learnerStorage', 'files', 'endpoint', 'backup'}
class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs): return None

def save(path, value):
    tmp = path.with_suffix('.tmp'); tmp.write_text(json.dumps(value, indent=2)); tmp.chmod(0o600); tmp.replace(path)

def probe(config):
    try:
        assert config['url'] == ORIGIN
        request = urllib.request.Request(ORIGIN + '/api/operations', headers={
            'OAI-Sites-Authorization':'Bearer ' + config['token'],
            'Authorization':'Bearer ' + config['maintenanceSecret'], 'X-Mosaic-Maintenance':'health-v1'})
        with urllib.request.build_opener(NoRedirect()).open(request, timeout=45) as r: result=json.load(r)
        assert result['schemaVersion'] == 1 and isinstance(result['issues'], list)
        assert all(x in KNOWN for x in result['issues'])
        assert isinstance(result['ok'], bool) and result['ok'] == (not result['issues'])
        issues=list(result['issues'])
        try:
            backup=json.loads((pathlib.Path.home()/'.local/state/mosaic-recovery/backup-last.json').read_text())
            age=(datetime.datetime.now(datetime.timezone.utc)-datetime.datetime.fromisoformat(backup['at'])).total_seconds()
            healthy=backup['status']=='verified' and age<=26*3600 or backup['status']=='running' and age<=25*60
            if not healthy:issues.append('backup')
        except Exception:issues.append('backup')
        return sorted(issues)
    except Exception: return ['endpoint']

def transition(state, issues, now):
    signature=','.join(sorted(issues)); previous=state.get('candidate','')
    count=state.get('count',0)+1 if signature==previous else 1
    state.update(candidate=signature,count=count,checkedAt=now,issues=issues)
    notified=state.get('notified','')
    history=(state.get('history',[])+[bool(issues)])[-5:];state['history']=history
    # Catch oscillating degradation as well as repeated failures, and require
    # two healthy probes before declaring recovery.
    sustained=count>=2 or sum(history)>=3
    new_issues=set(issues)-set(notified.split(','))
    if (signature and sustained and (not notified or new_issues)) or (not signature and notified and count>=2):
        affected=','.join(sorted((set(issues)|set(notified.split(',')))-{''})) if signature else ''
        return {'kind':'incident' if signature else 'recovered','signature':affected,'previous':notified,'observedAt':now}
    return None

def password():
    for line in (pathlib.Path.home()/'.config/agent-control/secrets.env').read_text().splitlines():
        if line.startswith('export '): line=line[7:]
        if line.startswith('GRAYSONGAMES_MAIL_PASSWORD='):
            return shlex.split(line.split('=',1)[1])[0]
    raise RuntimeError('Mail credential unavailable')

def send(event, ident, rehearsal=''):
    msg=email.message.EmailMessage();msg['From']=RECIPIENT;msg['To']=RECIPIENT
    tag=' REHEARSAL '+rehearsal if rehearsal else ''
    msg['Subject']='[Mosaic'+tag+'] '+event['kind']+': '+(event['signature'] or event['previous'])
    msg['Message-ID']='<mosaic-'+ident+'@graysongames.com>'
    msg.set_content('Mosaic operational '+event['kind']+' observed at '+event.get('observedAt','an earlier check')+'.\nAffected checks: '+(event['signature'] or 'All checks recovered')+'\nCurrent checks: '+(event.get('current') or 'All checks healthy')+'\nSite: '+ORIGIN+'\nReceipt: '+ident+'\nNo learner information is included.\nRunbook: rpg-demo/docs/LAUNCH-OPERATIONS.md\n'+('This is an explicitly injected delivery rehearsal.\n' if rehearsal else ''))
    with smtplib.SMTP('smtp.stackmail.com',587,timeout=30) as smtp:
        smtp.ehlo();smtp.starttls(context=ssl.create_default_context());smtp.ehlo();smtp.login(RECIPIENT,password());smtp.send_message(msg)

def run(args):
    root=pathlib.Path.home()/'.local/state/mosaic-alerts';root.mkdir(parents=True,exist_ok=True);root.chmod(0o700)
    assert not args.rehearsal or all(c.isalnum() or c=='-' for c in args.rehearsal)
    assert not args.inject or args.rehearsal, 'Injection requires a separate rehearsal state'
    path=root/(('rehearsal-'+args.rehearsal if args.rehearsal else 'production')+'.json')
    with open(root/'monitor.lock','w') as lock:
        fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
        state=json.loads(path.read_text()) if path.exists() else {}
        try:config=json.loads((pathlib.Path.home()/'.config/mosaic-pilot/maintenance.json').read_text())
        except Exception:config={}
        issues=[] if args.inject=='healthy' else ['endpoint'] if args.inject=='failure' else probe(config)
        now=datetime.datetime.now(datetime.timezone.utc).isoformat();candidate=transition(state,issues,now)
        event=state.get('pending',{}).get('event') or candidate
        if event:
            # Stable receipt for ambiguous SMTP acknowledgement. Leave pending on
            # failure and retry at most once per hour, using the same Message-ID.
            event['current']=','.join(issues)
            identity=state.get('pending',{}).get('id') or hashlib.sha256((args.rehearsal+event['kind']+event['signature']+state.get('lastSentAt','initial')).encode()).hexdigest()[:24]
            pending=state.get('pending',{})
            if pending.get('id')==identity and datetime.datetime.now(datetime.timezone.utc).timestamp()-pending.get('attemptAt',0)<3600:
                save(path,state);print(json.dumps({'status':'delivery-pending','issues':issues}));return 1
            state['pending']={'id':identity,'event':event,'attemptAt':datetime.datetime.now(datetime.timezone.utc).timestamp()};save(path,state)
            try: send(event,identity,args.rehearsal)
            except Exception:
                save(path,state);print(json.dumps({'status':'delivery-pending','receipt':identity,'issues':issues}));return 1
            state.update(notified=event['signature'],lastSentAt=now,lastReceipt=identity);state.pop('pending',None)
        save(path,state);print(json.dumps({'status':'healthy' if not issues else 'attention','issues':issues,'sent':bool(event),'receipt':state.get('lastReceipt')}));return 0
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--rehearsal',default='');p.add_argument('--inject',choices=['failure','healthy']);raise SystemExit(run(p.parse_args()))
