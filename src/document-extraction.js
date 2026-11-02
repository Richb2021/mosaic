import {unzipSync} from 'fflate';
export const DOCUMENT_ACCEPT='.txt,.md,.markdown,.pdf,.docx,.pptx,.vtt,.srt,.png,.jpg,.jpeg,.webp';
const need=(v,m)=>{if(!v)throw Error(m)};
const decode=bytes=>new TextDecoder('utf-8',{fatal:true}).decode(bytes);
const normal=text=>text.replace(/\r\n?/g,'\n').replace(/[\t ]+\n/g,'\n').trim();
export function checkExtractedText(text){
 const clean=normal(text);need(clean.length>=60,'This file contains too little readable text. Add at least 60 characters of source material.');
 need(clean.length<=60000&&new TextEncoder().encode(clean).length<=65536,'The extracted text exceeds 60,000 characters or 64 KB. Split the document; nothing was silently truncated.');
 need(!/[\x00-\x08\x0b\x0c\x0e-\x1f\ufffd]/.test(clean),'The document contains unreadable text. Export a readable copy first.');return clean;
}
function xml(bytes,Parser){const text=decode(bytes);need(!/<!DOCTYPE|<!ENTITY/i.test(text),'Documents with XML entities are not supported.');const d=new Parser().parseFromString(text,'application/xml');need(!d.getElementsByTagName('parsererror').length,'The document XML could not be read.');return d;}
const nodes=(parent,name)=>Array.from(parent.getElementsByTagNameNS('*',name));
function paragraphs(doc){return nodes(doc,'p').map(p=>nodes(p,'t').map(t=>t.textContent).join('')).filter(t=>t.trim());}
export function extractOffice(bytes,extension,Parser=globalThis.DOMParser){
 need(Parser,'This browser cannot read Office documents. Export a text copy instead.');
 let total=0,count=0;
 // Check expanded sizes before allocating; never extract images, macros or links.
 const files=unzipSync(bytes,{filter:f=>{need(++count<=2000,'This document contains too many ZIP entries.');const selected=extension==='docx'?f.name==='word/document.xml':/^ppt\/(presentation\.xml|_rels\/presentation\.xml\.rels|slides\/slide[0-9]+\.xml)$/.test(f.name);if(selected){total+=f.originalSize;need(f.originalSize<=2000000&&total<=4000000,'This document’s expanded text is too large. Split it first.');}return selected;}});
 if(extension==='docx'){
  need(files['word/document.xml'],'Choose a valid .docx document.');const lines=paragraphs(xml(files['word/document.xml'],Parser));
  return {text:lines.join('\n\n'),warnings:['Word body text only. Check table reading order. Images, equations, comments, headers, footnotes and tracked deletions are not interpreted.']};
 }
 need(files['ppt/presentation.xml']&&files['ppt/_rels/presentation.xml.rels'],'Choose a valid .pptx presentation.');
 const rels=new Map(nodes(xml(files['ppt/_rels/presentation.xml.rels'],Parser),'Relationship').filter(r=>r.getAttribute('TargetMode')!=='External').map(r=>[r.getAttribute('Id'),r.getAttribute('Target')]));
 const slides=nodes(xml(files['ppt/presentation.xml'],Parser),'sldId');need(slides.length>0&&slides.length<=80,'Use a presentation with 1–80 slides.');let empty=[];
 const sections=slides.map((s,i)=>{const id=s.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships','id')||s.getAttribute('r:id'),target=rels.get(id);need(typeof target==='string'&&/^slides\/slide[0-9]+\.xml$/.test(target),'A slide reference cannot be read safely.');need(files['ppt/'+target],'A slide is missing from this file.');const text=paragraphs(xml(files['ppt/'+target],Parser)).join('\n');if(!text)empty.push(i+1);return text?`[Slide ${i+1}]\n${text}`:'';});
 return {text:sections.filter(Boolean).join('\n\n'),warnings:['Slide text in presentation order. Check columns and diagrams. Images, speaker notes and animations are not interpreted.',...(empty.length?[`No text on slides ${empty.join(', ')}. Add their teaching content manually before review.`]:[])]};
}
export function extractTranscript(text){
 const blocks=normal(text).split(/\n\s*\n/),sections=[];
 for(const block of blocks){const lines=block.split('\n'),at=lines.findIndex(l=>/^(?:\d{2}:)?\d{2}:\d{2}[.,]\d{3}\s+-->\s+(?:\d{2}:)?\d{2}:\d{2}[.,]\d{3}/.test(l));if(at<0)continue;
  const timestamp=lines[at].split(/\s+-->\s+/)[0],words=lines.slice(at+1).join(' ').replace(/<[^>]*>/g,'').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>');if(words.trim())sections.push(`[Time ${timestamp}]\n${words}`);
 }
 need(sections.length,'No timed captions were found in this transcript.');return {text:sections.join('\n\n'),warnings:['Caption timing is preserved. Check transcription errors, speaker names and missing context.']};
}
export async function extractDocument(file,{pdfReader,imageReader,Parser=globalThis.DOMParser,...options}={}){
 const extension=file.name.split('.').at(-1).toLowerCase();need(DOCUMENT_ACCEPT.split(',').includes('.'+extension),'Choose text, PDF, DOCX, PPTX, captions, PNG, JPEG or WebP.');need(file.size>0&&file.size<=8*1024*1024,'Choose a file up to 8 MB.');options.signal?.throwIfAborted();
 const bytes=new Uint8Array(await file.arrayBuffer());need(bytes.length<=8*1024*1024,'The file exceeds 8 MB.');let result;
 if(extension==='pdf'){const read=pdfReader||(await import('/extraction/pdf-reader.js')).extractPDF;result=await read(bytes,options);}
 else if(['png','jpg','jpeg','webp'].includes(extension)){need(options.ocr===true,'Enable “Read printed scans” before choosing an image.');const read=imageReader||(await import('/extraction/ocr-reader.js')).extractImage;result=await read(bytes,options);}
 else if(['docx','pptx'].includes(extension))result=extractOffice(bytes,extension,Parser);
 else if(['vtt','srt'].includes(extension))result=extractTranscript(decode(bytes));
 else result={text:decode(bytes),warnings:[]};
 return {...result,text:checkExtractedText(result.text),filename:file.name,title:file.name.replace(/\.[^.]+$/,'')};
}
