import {env} from 'cloudflare:workers';
import {authAPI} from '../../../server/ncb-auth.js';
export const dynamic='force-dynamic';
export function GET(request:Request){return authAPI(request,env)}
