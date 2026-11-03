"""Run on Baldur after the old host is frozen. Private plaintext is temporary.

Uses the installed legacy site's recovery transport until cutover. It refuses
active mutations and checks that a second snapshot has the same content.
"""
import base64, hashlib, json, pathlib, sys, urllib.parse
from site_recovery import site_get, stable

destination = pathlib.Path(sys.argv[1])
assert not destination.exists(), 'Choose a fresh private export path'
config = json.loads((pathlib.Path.home()/'.config/mosaic-pilot/maintenance.json').read_text())
snapshot = json.loads(site_get(config))
assert snapshot['schemaVersion'] == 1
assert not any(r['operation'] for r in snapshot['tables']['data_controls']), 'Deletion in flight'
assert not any(r['expires'] > snapshot['at'] for r in snapshot['tables']['data_leases']), 'Mutation in flight'
assert sum(o['size'] for o in snapshot['objects']) <= 256*1024*1024
objects = {}
for obj in snapshot['objects']:
    data = site_get(config, '?' + urllib.parse.urlencode({'object': obj['key']}))
    assert len(data) == obj['size'], 'Byte count changed'
    objects[obj['key']] = base64.b64encode(data).decode()
after = json.loads(site_get(config))
assert stable(snapshot) == stable(after), 'Content changed during export'
for row in snapshot['tables']['media_assets']:
    if row['status'] == 'ready': assert row['object_key'] in objects
destination.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
with destination.open('x') as f:
    destination.chmod(0o600)
    json.dump({'snapshot': snapshot, 'objects': objects}, f)
print(json.dumps({'tables': {k: len(v) for k,v in snapshot['tables'].items()}, 'objects': len(objects), 'sourceUnchanged': True}))
