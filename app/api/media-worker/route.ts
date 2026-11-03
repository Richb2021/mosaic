import {env} from 'cloudflare:workers';
import {mediaWorkerAPI} from '../../../server/media-jobs.js';
export async function POST(req:Request){return mediaWorkerAPI(req,env)}
