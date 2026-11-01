import {env} from 'cloudflare:workers';
import {pilotAPI} from '../../../server/pilot-access.js';
export const dynamic='force-dynamic';
export function GET(request:Request){return pilotAPI(request,env)}
export function POST(request:Request){return pilotAPI(request,env)}
