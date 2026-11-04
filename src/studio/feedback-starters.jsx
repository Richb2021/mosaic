import React from 'react';
import './feedback.css';

// Rubric starters: sentence openers a teacher can drop into feedback, then edit.
// They describe the reasoning, never a mark, and nothing is sent until the teacher sends it.
export const STARTERS=[
 {id:'clear',label:'Clear explanation',strength:'You explained this clearly, one step at a time.',next:'Try explaining it to someone new in two sentences.'},
 {id:'evidence',label:'Uses evidence',strength:'You backed up your answer with evidence from the source.',next:'Point to the exact line in the source that supports your answer.'},
 {id:'working',label:'Shows working',strength:'Your working shows how you got there.',next:'Write down each step so I can follow your thinking.'},
 {id:'vocabulary',label:'Key words',strength:'You used the key words accurately.',next:'Add one key word from the lesson and say what it means.'},
 {id:'connect',label:'Makes links',strength:'You linked this to something you learned before.',next:'Explain how this connects to the last thing we studied.'},
];
export const addStarter=(current,line)=>{const t=String(current||'').trim();return t?(t.endsWith(line)?t:t+' '+line):line};

export function FeedbackStarters({onStrength,onNext,disabled}){
 const row=(label,field,add)=><div className="fb-row" role="group" aria-label={'Add to '+label.toLowerCase()}><span>{label}</span>{STARTERS.map(s=><button type="button" key={s.id} disabled={disabled} title={s[field]} onClick={()=>add(s[field])}>{s.label}</button>)}</div>;
 return <details className="fb-starters">
  <summary>Feedback starters</summary>
  <p>Each one adds a sentence you can then make your own. They describe the reasoning, not a mark.</p>
  {row('What worked','strength',onStrength)}{row('Next step','next',onNext)}
 </details>;
}
