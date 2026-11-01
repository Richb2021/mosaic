import { env } from 'cloudflare:workers';
import { operationsAPI } from '../../../server/launch-operations.js';
export async function GET(req:Request){return operationsAPI(req,env)}
export async function POST(req:Request){return operationsAPI(req,env)}
