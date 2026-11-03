import {retiredHost} from "../../../server/retired-host.js";
import {env} from 'cloudflare:workers';
import {pilotAPI} from '../../../server/pilot-access.js';
export const dynamic='force-dynamic';
export function GET(request:Request){return retiredHost(env) || pilotAPI(request,env)}
export function POST(request:Request){return retiredHost(env) || pilotAPI(request,env)}
