import {env} from 'cloudflare:workers';
import {workshopGateway} from '../../../../server/workshop-gateway.js';
import {deferWorkshopWork} from '../../../../server/execution-context';
export const dynamic='force-dynamic';
function handle(request:Request){return workshopGateway(request,env,{defer:deferWorkshopWork})}
export const GET=handle;
export const POST=handle;
