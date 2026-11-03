import test from 'node:test';
import assert from 'node:assert/strict';
import {modalAccess,focusToken,restoreFocus} from '../src/game-modes/accessibility.js';

function fixture() {
 const doc={activeElement:null};
 function node(name,props={}) {return {name,tagName:'DIV',inert:false,children:[],dataset:{},id:'',textContent:name,tabIndex:0,ownerDocument:doc,
  hasAttribute(){return false},getAttribute(){return null},getClientRects(){return [{}]},closest(){return null},
  focus(){doc.activeElement=this},...props};}
 const body=node('body'),root=node('root'),background=node('game'),savebar=node('savebar'),existing=node('already inert',{inert:true}),dialog=node('dialog');
 function append(parent,...children){parent.children.push(...children);for(const child of children)child.parentElement=parent;}
 append(body,savebar,root,existing);append(root,background,dialog);doc.body=body;
 const close=node('Close'),link=node('Support',{tagName:'A'}),summary=node('Source',{tagName:'SUMMARY'}),disabled=node('Disabled',{disabled:true}),hidden=node('Hidden',{getClientRects:()=>[]}),heading=node('Title',{tabIndex:-1});
 const controls=[close,link,summary,disabled,hidden,heading];dialog.querySelectorAll=()=>controls;
 root.querySelectorAll=()=>controls;root.contains=el=>controls.includes(el);return {doc,root,dialog,savebar,background,existing,close,link,summary,heading,node,controls};
}
test('modal isolates both game and outer save controls, then restores pre-existing inert state',()=>{
 const f=fixture(),access=modalAccess(f.root);access.sync(f.dialog);
 assert.equal(f.background.inert,true);assert.equal(f.savebar.inert,true);assert.equal(f.dialog.inert,false);
 access.sync(null);assert.equal(f.background.inert,false);assert.equal(f.savebar.inert,false);assert.equal(f.existing.inert,true);
 access.sync(f.dialog);access.destroy();assert.equal(f.savebar.inert,false);
});
test('every Tab cycles controls including links and summaries despite Safari button-skipping preferences',()=>{
 const f=fixture(),access=modalAccess(f.root);let prevented=0;
 const tab=(shiftKey=false)=>access.key({key:'Tab',shiftKey,preventDefault(){prevented++;}},f.dialog);
 f.doc.activeElement=f.heading;tab();assert.equal(f.doc.activeElement,f.close);
 tab();assert.equal(f.doc.activeElement,f.link);tab();assert.equal(f.doc.activeElement,f.summary);
 tab();assert.equal(f.doc.activeElement,f.close);tab(true);assert.equal(f.doc.activeElement,f.summary);
 assert.equal(prevented,5);
});
test('Shift-Tab from heading reaches final control; non-Tab keys remain untouched',()=>{
 const f=fixture(),access=modalAccess(f.root);f.doc.activeElement=f.heading;
 access.key({key:'Tab',shiftKey:true,preventDefault(){}},f.dialog);assert.equal(f.doc.activeElement,f.summary);
 assert.equal(access.key({key:'ArrowRight',preventDefault(){assert.fail()}},f.dialog),false);
});
test('focus returns to an equivalent newly rendered trigger, not a stale DOM element',()=>{
 const f=fixture();f.link.dataset={j:'source',refs:'source-two'};f.doc.activeElement=f.link;
 const token=focusToken(f.root),replacement=f.node('Support',{dataset:{j:'source',refs:'source-two'}});
 f.root.querySelectorAll=()=>[f.node('Support',{dataset:{j:'source',refs:'source-one'}}),replacement];
 assert.equal(restoreFocus(f.root,token),true);assert.equal(f.doc.activeElement,replacement);
 replacement.disabled=true;assert.equal(restoreFocus(f.root,token),false);
});
