import React from 'react';
import {allowanceSummary,ALLOWANCE_HREF} from './allowance-summary.js';
// Studio nav line: "About N AI creations left today · resets <time>".
export function AllowanceLine({budget}){
 const s=allowanceSummary(budget);if(!s)return null;
 return <a className={'nav-allowance'+(s.used?' is-used':'')} href={ALLOWANCE_HREF}><span>{s.main}{s.when&&<span className="nav-allowance-when"> · {s.when}</span>}</span>{s.used&&<b>Ask for more</b>}</a>;
}
// Shown next to a Create button that is disabled because the allowance is used up.
export function AllowanceUsed({budget}){
 if(!budget||budget.remaining>0)return null;
 return <p className="allowance-used" role="status">You’ve used today’s AI allowance, so this is paused. <a className="allowance-link" href={ALLOWANCE_HREF}>Need more? Ask for a higher allowance</a></p>;
}
