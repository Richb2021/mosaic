import {retiredHost} from "../../../../server/retired-host.js";
import {env} from 'cloudflare:workers';
import {authAPI} from '../../../../server/ncb-auth.js';
export const dynamic='force-dynamic';
export function GET(request:Request){return retiredHost(env) || authAPI(request,env)}
export function POST(request:Request){return retiredHost(env) || authAPI(request,env)}
