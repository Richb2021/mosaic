import {readFile,writeFile} from 'node:fs/promises';
import {importRecovery} from '../server/node/import.mjs';
const [bundle,target,migrations,report]=process.argv.slice(2);
if(!bundle||!target||!migrations||!report)throw Error('Usage: import-portable.mjs PRIVATE_BUNDLE NEW_DATA_DIRECTORY MIGRATIONS REPORT');
const result=await importRecovery(JSON.parse(await readFile(bundle,'utf8')),{target,migrations});
await writeFile(report,JSON.stringify(result,null,2)+'\n',{mode:0o600});
console.log('Imported and verified '+Object.keys(result.tables).length+' tables and '+result.objects.length+' objects.');
