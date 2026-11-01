import {env} from 'cloudflare:workers';
import {learningAPI} from '../../../../server/learning-api.js';
export const dynamic='force-dynamic';
export function GET(request:Request){return learningAPI(request,env)}
export function POST(request:Request){return learningAPI(request,env)}
