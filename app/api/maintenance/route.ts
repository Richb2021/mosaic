import {env} from 'cloudflare:workers';
import {maintenanceAPI} from '../../../server/background-retention.js';
export const dynamic='force-dynamic';
export function GET(request:Request){return maintenanceAPI(request,env)}
export function POST(request:Request){return maintenanceAPI(request,env)}
