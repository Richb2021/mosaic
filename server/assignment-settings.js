import {need} from './data-control.js';
export function assignmentSettings(value={}){
 need(value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).every(k=>['instructions','dueAt'].includes(k)),'Unsupported assignment setting.');
 const instructions=value.instructions??'',dueAt=value.dueAt??null;
 need(typeof instructions==='string'&&instructions.length<=1200,'Keep assignment instructions under 1200 characters.');
 need(dueAt===null||Number.isSafeInteger(dueAt)&&dueAt>0&&dueAt<4102444800000,'Choose a valid due date.');
 return {instructions:instructions.trim(),dueAt};
}
