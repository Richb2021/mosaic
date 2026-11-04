// One guided retry for weak stories, shared by game and cartoon/podcast jobs.
// The first draft is never lost: it is kept in the job record and wins unless the revision scores higher.
import {needsStoryRetry,storyQualityLine} from '../src/story-quality.js';

export const RETRY_COST_SUFFIX=':story-retry';
// What the job record and review screen keep: the score and reasons, not the whole plan.
export function storyCheckSummary(check,extra={}){
 if(!check)return null;
 const {fixes=[],arc=null,...rest}=check;
 const summary={...rest,fixes:fixes.map(f=>({criterion:f.criterion,label:f.label,why:f.why})),dramaticQuestion:arc?.dramaticQuestion||null,...extra};
 return {...summary,line:storyQualityLine(summary)};
}
// Retry only once, only when the story clearly fails to pull forward, and never when switched off.
// It needs the response's own story plan (games: storyArc; cartoons and podcasts: story.dramaticQuestion),
// which the current schemas require, so the fix list can point at what the model meant to do.
export function shouldRetryStory(env,payload,check){return env?.STORY_RETRY!=='off'&&!payload?.storyRetry&&!!check?.arc&&needsStoryRetry(check)}
export function retryState(payload,check,content){
 return {state:'running',score:check.score,fixes:check.fixes.slice(0,5),fallback:{content,storyCheck:storyCheckSummary(check)}};
}
// The revision as a job: same request, plus the first draft and the exact fixes.
export function retryJob(payload,retry){return {...payload,storyRetry:{previous:retry.fallback.content,score:retry.score,fixes:retry.fixes}}}
// After the revision settles (or fails), keep the better draft and say what happened.
export function chooseAfterRetry(retry,content,check){
 const before=retry.score;
 if(!content)return {content:retry.fallback.content,storyCheck:{...retry.fallback.storyCheck,retry:`One revision was requested but did not complete, so this is the first draft (${before}/16). Check the notes below before approving.`}};
 if(check.score<before)return {content:retry.fallback.content,storyCheck:{...retry.fallback.storyCheck,retry:`One revision scored ${check.score}/16, lower than the first draft, so the first draft (${before}/16) is kept.`}};
 return {content,storyCheck:storyCheckSummary(check,{retry:`Revised once to fix the story: ${before}/16 → ${check.score}/16.`})};
}
