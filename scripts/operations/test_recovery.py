import copy,hashlib,importlib.util,json,pathlib,sys,tempfile,types,unittest
from unittest.mock import patch

class Recovery(unittest.TestCase):
 def setUp(self):
  self.temp=tempfile.TemporaryDirectory();self.root=pathlib.Path(self.temp.name);self.saved={}
  config=self.root/'.config/mosaic-pilot';config.mkdir(parents=True);(config/'maintenance.json').write_text(json.dumps({'url':'https://mosaic-lanternbound-rpg.rbuk2025.chatgpt.site'}))
  self.digest=lambda x:hashlib.sha256(json.dumps(x,sort_keys=True,separators=(',',':')).encode()).hexdigest()
  fake=types.SimpleNamespace(ROOT=self.root,write=lambda n,x:self.saved.update({n:copy.deepcopy(x)}),read=lambda n:{} if n=='ncb-backup.enc' else self.saved[n],digest=self.digest)
  spec=importlib.util.spec_from_file_location('recovery_under_test',pathlib.Path(__file__).with_name('site_recovery.py'));self.module=importlib.util.module_from_spec(spec)
  with patch.dict(sys.modules,{'ncb_recovery':fake}):spec.loader.exec_module(self.module)
  tables={n:[] for n in ['data_controls','data_leases','media_assets','workshop_resources']};tables['workshop_jobs']=[{'id':'kept'}]
  self.snapshot={'schemaVersion':1,'at':1,'tables':tables,'schema':[{'name':n,'type':'table','sql':'CREATE TABLE '+n+' (id TEXT PRIMARY KEY)'} for n in tables],'objects':[{'key':'narration/test.mp3','size':3,'etag':'abc'}]}
 def tearDown(self):self.temp.cleanup()
 def invoke(self,after=None,body=b'abc'):
  values=[json.dumps(self.snapshot).encode(),body,json.dumps(after or self.snapshot).encode()]
  with patch.object(self.module,'site_get',side_effect=values),patch.object(pathlib.Path,'home',return_value=self.root),patch('builtins.print'):
   self.module.run()
 def test_complete_restore_integrity(self):
  self.invoke();r=json.loads((self.root/'site-restore-report.json').read_text());self.assertEqual(r['databaseIntegrity'],'ok');self.assertEqual(r['tables']['workshop_jobs']['rows'],1)
 def test_mutation_during_export_is_rejected_before_backup(self):
  changed=copy.deepcopy(self.snapshot);changed['tables']['workshop_jobs'][0]['id']='changed'
  with self.assertRaisesRegex(AssertionError,'changed during export'):self.invoke(changed)
  self.assertFalse(self.saved)
 def test_missing_or_changed_file_rejected(self):
  with self.assertRaisesRegex(AssertionError,'Object changed'):self.invoke(body=b'bad length')
  self.assertFalse(self.saved)
 def test_active_deletion_blocks_snapshot(self):
  self.snapshot['tables']['data_controls']=[{'scope':'test','operation':'active'}]
  with self.assertRaisesRegex(AssertionError,'deletion is in flight'):self.invoke()
  self.assertFalse(self.saved)
if __name__=='__main__':unittest.main()
