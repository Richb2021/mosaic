import unittest
from monitor import transition,probe
class Alerts(unittest.TestCase):
 def test_invalid_configuration_is_an_incident(self):
  self.assertEqual(probe({}),['endpoint']);self.assertEqual(probe({'url':'https://wrong.example'}),['endpoint'])
 def test_incident_dedupe_recovery(self):
  s={};self.assertIsNone(transition(s,[],1));self.assertIsNone(transition(s,['files'],2));e=transition(s,['files'],3);self.assertEqual(e['kind'],'incident');s['notified']=e['signature'];self.assertIsNone(transition(s,['files'],4));self.assertIsNone(transition(s,[],5));self.assertEqual(transition(s,[],6)['kind'],'recovered')
 def test_transient_and_changed_incident(self):
  s={};self.assertIsNone(transition(s,['endpoint'],1));self.assertIsNone(transition(s,[],2));self.assertIsNone(transition(s,['files'],3));self.assertEqual(transition(s,['files'],4)['kind'],'incident');s['notified']='files';self.assertEqual(transition(s,['retention'],5)['previous'],'files')
 def test_flapping_is_not_silenced(self):
  s={}
  for at,issues in enumerate([['files'],[],['database'],[]]):self.assertIsNone(transition(s,issues,at))
  self.assertEqual(transition(s,['files'],5)['kind'],'incident')
 def test_already_reported_flapping_does_not_spam(self):
  s={'notified':'database,files','history':[True,True,True]}
  self.assertIsNone(transition(s,['files'],1));self.assertIsNone(transition(s,['database'],2))
 def test_failed_delivery_survives_recovery(self):
  import tempfile,pathlib,json,types
  from unittest.mock import patch
  from monitor import run
  with tempfile.TemporaryDirectory() as d,patch('pathlib.Path.home',return_value=pathlib.Path(d)),patch('builtins.print'):
   args=types.SimpleNamespace(rehearsal='test',inject='failure')
   with patch('monitor.send',side_effect=RuntimeError('SMTP unavailable')):
    run(args);run(args)
   path=pathlib.Path(d)/'.local/state/mosaic-alerts/rehearsal-test.json';state=json.loads(path.read_text());self.assertEqual(state['pending']['event']['kind'],'incident')
   args.inject='healthy';run(args)
   state=json.loads(path.read_text());self.assertEqual(state['pending']['event']['kind'],'incident');state['pending']['attemptAt']=0;path.write_text(json.dumps(state))
   with patch('monitor.send') as delivery:run(args);self.assertEqual(delivery.call_args[0][0]['kind'],'incident');self.assertEqual(delivery.call_args[0][0]['current'],'')
if __name__=='__main__': unittest.main()
