import {retiredHost} from "../../../server/retired-host.js";
import {env} from 'cloudflare:workers';
import {mediaWorkerAPI} from '../../../server/media-jobs.js';
export async function POST(req:Request){return retiredHost(env) || mediaWorkerAPI(req,env)}
