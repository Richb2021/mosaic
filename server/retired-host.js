// The former host stays private and may serve archived assets, but cannot
// mutate shared NCB learner records or diverge from the migrated SQL store.
export function retiredHost(env) {
  if(!env.MOSAIC_MIGRATED_ORIGIN)return null;
  return Response.json({error:'Mosaic has moved to https://mosaic.richardbatt.com. Open that address to continue learning.',movedTo:'https://mosaic.richardbatt.com'}, {status:410,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
}
