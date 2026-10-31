import {AsyncLocalStorage} from 'node:async_hooks';
const context=new AsyncLocalStorage<ExecutionContext>();
export const runWithWorkshopExecution=<T>(ctx:ExecutionContext,fn:()=>T)=>context.run(ctx,fn);
export const deferWorkshopWork=(work:Promise<unknown>)=>context.getStore()?.waitUntil(work);
