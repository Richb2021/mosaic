export const questionIdentity=prompt=>'question:'+String(prompt).normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,'');
// Transparent study heuristics, never grades or estimates of ability/mastery.
export const SUPPORT_CHOICES=['suggested','more','less'];
export function adaptiveLearning({activities,profile,signals=[],choice='suggested'}){
 if(!SUPPORT_CHOICES.includes(choice))throw Error('Choose an available support preference.');
 const focus=activities.map(activity=>{
  const seen=new Set(),rows=signals.filter(s=>s.key===activity.key&&s.eligible!==false).sort((a,b)=>a.at-b.at).filter(s=>{if(seen.has(s.id))return false;seen.add(s.id);return true}).slice(-12);
  const last=rows.at(-1),after=rows.slice(rows.findLastIndex(s=>s.correct!==true||s.assisted||s.confidence!=='confident')+1);
  const independent=after.filter(s=>s.correct===true&&!s.assisted&&s.confidence==='confident'&&s.fresh).length;
  const needsReview=last?.humanReview===true;
  let support=independent>=3&&after.some(s=>s.transfer)?'stretch':independent>=2?'independent':last&&(last.correct!==true||last.assisted||last.confidence!=='confident')?'guided':['Starting out','Building confidence','Not sure yet'].includes(profile.level)?'guided':'practice';
  let reason=independent>=2?`${independent} different recent questions were answered correctly and confidently without recorded help. Try with fewer prompts; support remains available.`:last?.correct===false?'A recent answer differed from the reviewed answer. Compare the specific point below, then try a fresh example.':last?.assisted?'Help was used on the recent question. Try a new example before reducing support.':last?'A little more practice can help check this idea. Confidence and completion alone do not show understanding.':'There is not enough answer evidence yet. Start from your chosen level and adjust the support if needed.';
  if(needsReview){support='review';reason='The latest written reasoning needs human review. It has not been treated as an incorrect answer or a score.';}
  if(choice==='more'){support='guided';reason='You asked for more support. Your original responses stay unchanged.';}
  if(choice==='less'){support='independent';reason='You chose to try with fewer prompts. This is your preference, not an assessment of understanding.';}
  const instruction={guided:'Explain one source-supported step, ask for a prediction, and offer a partial worked example before a fresh question.',practice:'Give one small cue, then ask the learner to complete the next step in a fresh example.',independent:'Ask for an independent explanation or a new application first. Offer hints only if requested.',stretch:'Ask the learner to compare two applications and explain where their interest-based analogy stops working. Keep within reviewed evidence.',review:'Invite the learner to compare their reasoning with the reviewed criteria and request human feedback.'}[support];
  const priority=support==='guided'?0:support==='review'?1:!rows.length?2:support==='practice'?3:4;
  return {key:activity.key,label:activity.label||activity.objective||activity.key,support,reason,instruction,priority,independentQuestions:independent,observations:rows.length,humanReview:needsReview,pointToRevisit:last?.correct===false&&!needsReview?last.feedback||null:null,sourceRefs:activity.sourceRefs||[],nextQuestion: support==='stretch'?'Explain a different application':support==='independent'?'Try a fresh question without a cue':'Compare an example, then try a fresh question'};
 }).sort((a,b)=>a.priority-b.priority);
 return {ruleVersion:1,choice,focus,nextFocus:focus[0]?.key||null,scope:'Study suggestions from recorded responses. Repeated questions, game wins and self-reports do not establish mastery. Questions you reviewed yourself are practice, not an unseen assessment.'};
}

export function loopSignals(bank,state,keys,hash){
 return state.answers.flatMap(a=>{const q=bank.questions.find(q=>q.stage===a.stage);return keys.map(key=>({id:questionIdentity(q.prompt),key,at:a.at,correct:a.answer===null?null:a.answer===q.answer,confidence:a.confidence,assisted:a.assisted,fresh:true,transfer:['transfer','revisit'].includes(a.stage),feedback:a.answer===null?q.hint:q.feedback[a.answer]}))});
}
