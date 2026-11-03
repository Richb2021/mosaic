import unittest
from monitor import transition,probe
class Alerts(unittest.TestCase):
 def test_invalid_configuration_is_an_incident(self):
  self.assertEqual(probe({}),['endpoint']);self.assertEqual(probe({'url':'https://wrong.example'}),['endpoint'])
 def test_incident_dedupe_recovery(self):
  s={};self.assertIsNone(transition(s,[],1));self.assertIsNone(transition(s,['files'],2));e=transition(s,['files'],3);self.assertEqual(e['kind'],'incident');s['notified']=e['signature'];self.assertIsNone(transition(s,['files'],4));self.assertEqual(transition(s,[],5)['kind'],'recovered')
 def test_transient_and_changed_incident(self):
  s={};self.assertIsNone(transition(s,['endpoint'],1));self.assertIsNone(transition(s,[],2));self.assertIsNone(transition(s,['files'],3));self.assertEqual(transition(s,['files'],4)['kind'],'incident');s['notified']='files';self.assertIsNone(transition(s,['retention'],5));self.assertEqual(transition(s,['retention'],6)['previous'],'files')
if __name__=='__main__': unittest.main()
