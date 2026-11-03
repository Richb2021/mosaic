import {retiredHost} from "../../../../server/retired-host.js";
import {env} from 'cloudflare:workers';
import {learningAPI} from '../../../../server/learning-api.js';
export const dynamic='force-dynamic';
export function GET(request:Request){return retiredHost(env) || learningAPI(request,env)}
export function POST(request:Request){return retiredHost(env) || learningAPI(request,env)}
