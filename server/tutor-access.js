export function creativePermissions(env,access={}){
 const canAuthor=env.PILOT_ENABLED!=='true'||access.canAuthor===true&&access.ageBand==='18plus';
 return {canAuthor,canTutor:canAuthor||access.tutorAllowed===true};
}
