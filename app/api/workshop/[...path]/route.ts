import {env} from 'cloudflare:workers';
import {workshopAPI} from '../../../../server/workshop-api.js';
import {deferWorkshopWork} from '../../../../server/execution-context';
export const dynamic='force-dynamic';
export function GET(request:Request){return workshopAPI(request,env)}
export function POST(request:Request){return workshopAPI(request,env,{defer:deferWorkshopWork})}
