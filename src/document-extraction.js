import {unzipSync} from 'fflate';
export const DOCUMENT_ACCEPT='.txt,.md,.markdown,.pdf,.docx,.pptx,.csv,.tsv,.xlsx,.vtt,.srt,.png,.jpg,.jpeg,.webp';
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
const column=n=>{let s='';for(n++;n;n=Math.floor((n-1)/26))s=String.fromCharCode(65+(n-1)%26)+s;return s};
function tableText(name,rows){
 const sections=[];for(let start=0;start<rows.length;start+=12){const batch=rows.slice(start,start+12);sections.push(`[Sheet ${name.replace(/[\[\]\r\n]/g,' ')}; rows ${batch[0].number}-${batch.at(-1).number}]\n`+batch.map(r=>`Row ${r.number}: `+r.cells.map(c=>`${c.ref} = ${JSON.stringify(c.value)}`).join(' | ')).join('\n'));}return sections.join('\n\n');
}
export function extractDelimited(text,separator=','){
 text=text.replace(/^\ufeff/,'').replace(/\r\n?/g,'\n');need(text.length<=1000000,'This spreadsheet is too large. Split it before importing.');
 const rows=[];let cells=[],value='',quoted=false,closed=false,rowNumber=0;
 const cell=()=>{need(cells.length<100,'Use at most 100 columns.');cells.push(value);value='';closed=false};
 const row=()=>{cell();rowNumber++;if(cells.some(v=>v!==''))rows.push({number:rowNumber,cells:cells.map((v,i)=>({ref:column(i),value:v}))});cells=[];need(rows.length<=1000,'Use at most 1,000 rows per import.');};
 for(let i=0;i<text.length;i++){const c=text[i];if(quoted){if(c==='"'){if(text[i+1]==='"'){value+='"';i++}else{quoted=false;closed=true}}else value+=c;}
  else if(c===separator)cell();else if(c==='\n')row();else if(c==='"'&&!value&&!closed)quoted=true;else{need(!closed&&c!=='"','The delimited file has malformed quotation marks. Export a clean CSV or TSV.');value+=c;}}
 need(!quoted,'The delimited file ends inside a quoted value.');if(value||cells.length||closed)row();need(rows.length,'The spreadsheet contains no values.');
 return {text:tableText('Data',rows),warnings:['Cell coordinates and literal values are preserved. Formula-like text is never executed. Check headings, units, dates and the meaning of each column before review.']};
}
export function extractSpreadsheet(bytes,Parser=globalThis.DOMParser){
 need(Parser,'This browser cannot read spreadsheets. Export CSV instead.');let count=0,total=0;
 const files=unzipSync(bytes,{filter:f=>{need(++count<=2000,'This document contains too many ZIP entries.');const selected=/^xl\/(workbook\.xml|_rels\/workbook\.xml\.rels|sharedStrings\.xml|worksheets\/sheet[0-9]+\.xml)$/.test(f.name);if(selected){total+=f.originalSize;need(f.originalSize<=2000000&&total<=4000000,'This spreadsheet’s expanded text is too large. Split it first.');}return selected}});
 need(files['xl/workbook.xml']&&files['xl/_rels/workbook.xml.rels'],'Choose a valid .xlsx workbook.');
 const strings=files['xl/sharedStrings.xml']?nodes(xml(files['xl/sharedStrings.xml'],Parser),'si').map(s=>nodes(s,'t').map(t=>t.textContent).join('')):[];
 const rels=new Map(nodes(xml(files['xl/_rels/workbook.xml.rels'],Parser),'Relationship').filter(r=>r.getAttribute('TargetMode')!=='External').map(r=>[r.getAttribute('Id'),r.getAttribute('Target')]));
 const sheets=nodes(xml(files['xl/workbook.xml'],Parser),'sheet');need(sheets.length&&sheets.length<=20,'Use a workbook with 1–20 sheets.');let formulas=0,missing=0,hidden=0;
 const texts=sheets.map(s=>{const target=rels.get(s.getAttribute('r:id')||s.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships','id'))?.replace(/^\/xl\//,'');need(/^worksheets\/sheet[0-9]+\.xml$/.test(target||'')&&files['xl/'+target],'A worksheet reference cannot be read safely.');if(s.getAttribute('state')&&s.getAttribute('state')!=='visible')hidden++;
  const rows=nodes(xml(files['xl/'+target],Parser),'row');need(rows.length<=1000,'Use at most 1,000 rows per sheet.');
  const values=rows.map((row,i)=>{const number=Number(row.getAttribute('r')||i+1);need(Number.isInteger(number)&&number>0&&number<=1048576,'Invalid spreadsheet row.');const cells=nodes(row,'c');need(cells.length<=100,'Use at most 100 filled cells per row.');return {number,cells:cells.map(c=>{const ref=c.getAttribute('r');need(/^[A-Z]{1,3}[1-9][0-9]{0,6}$/.test(ref),'Invalid cell coordinate.');const type=c.getAttribute('t'),v=nodes(c,'v')[0]?.textContent,formula=nodes(c,'f').length>0;let value;
   if(formula){formulas++;if(v===undefined){missing++;return {ref,value:'[Formula has no cached value; supply a checked value before review]'}}}
   if(type==='s'){need(/^\d+$/.test(v||'')&&Number(v)<strings.length,'A shared-string cell cannot be read.');value=strings[Number(v)]}else if(type==='inlineStr')value=nodes(c,'t').map(t=>t.textContent).join('');else if(type==='b'){need(v==='0'||v==='1','Invalid Boolean cell.');value=v==='1'?'TRUE':'FALSE'}else value=v??'';
   return {ref,value:formula?value+' [cached formula result]':value};})};}).filter(r=>r.cells.some(c=>c.value!==''));return values.length?tableText(s.getAttribute('name')||'Sheet',values):'';});
 return {text:texts.filter(Boolean).join('\n\n'),warnings:['Worksheet cell values only. Dates and formatted percentages may be stored as numbers: check units and formats against the workbook. Charts, images, comments and merged-cell meaning need a written explanation.',...(formulas?[`${formulas} formula cells use saved results; formulas are not recalculated. ${missing} have no saved value. Check against the original.`]:[]),...(hidden?[`${hidden} hidden sheets were included. Remove any material you do not intend to share before saving.`]:[])]};
}
export function extractOffice(bytes,extension,Parser=globalThis.DOMParser){
 need(Parser,'This browser cannot read Office documents. Export a text copy instead.');
 let total=0,count=0;
 // Check expanded sizes before allocating; never extract images, macros or links.
 const files=unzipSync(bytes,{filter:f=>{need(++count<=2000,'This document contains too many ZIP entries.');const selected=extension==='docx'?f.name==='word/document.xml':/^ppt\/(presentation\.xml|_rels\/presentation\.xml\.rels|slides\/slide[0-9]+\.xml)$/.test(f.name);if(selected){total+=f.originalSize;need(f.originalSize<=2000000&&total<=4000000,'This document’s expanded text is too large. Split it first.');}return selected;}});
 if(extension==='docx'){
  need(files['word/document.xml'],'Choose a valid .docx document.');const doc=xml(files['word/document.xml'],Parser),body=nodes(doc,'body')[0];need(body,'The Word document has no readable body.');let tables=0;
  const lines=Array.from(body.childNodes).filter(n=>n.nodeType===1).map(n=>{if(n.localName==='tbl'){tables++;const rows=nodes(n,'tr').map((r,i)=>({number:i+1,cells:nodes(r,'tc').map((c,j)=>({ref:column(j)+(i+1),value:paragraphs(c).join(' / ')}))}));return rows.length?tableText('Word table '+tables,rows):''}if(n.localName==='p')return nodes(n,'t').map(t=>t.textContent).join('');return paragraphs(n).join('\n');}).filter(t=>t.trim());
  return {text:lines.join('\n\n'),warnings:['Word body text only. Tables retain row and cell coordinates; verify merged cells and headings. Images, equations, comments, headers, footnotes and tracked deletions are not interpreted.',...(nodes(doc,'oMath').length?['This document contains mathematical notation. Add a checked plain-text equation and explain each variable before review.']:[])]};
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
 const extension=file.name.split('.').at(-1).toLowerCase();need(DOCUMENT_ACCEPT.split(',').includes('.'+extension),'Choose text, PDF, Office, CSV, TSV, captions, PNG, JPEG or WebP.');need(file.size>0&&file.size<=8*1024*1024,'Choose a file up to 8 MB.');options.signal?.throwIfAborted();
 const bytes=new Uint8Array(await file.arrayBuffer());need(bytes.length<=8*1024*1024,'The file exceeds 8 MB.');let result;
 if(extension==='pdf'){const read=pdfReader||(await import('/extraction/pdf-reader.js')).extractPDF;result=await read(bytes,options);}
 else if(['png','jpg','jpeg','webp'].includes(extension)){need(options.ocr===true,'Enable “Read printed scans” before choosing an image.');const read=imageReader||(await import('/extraction/ocr-reader.js')).extractImage;result=await read(bytes,options);}
 else if(['docx','pptx'].includes(extension))result=extractOffice(bytes,extension,Parser);
 else if(extension==='xlsx')result=extractSpreadsheet(bytes,Parser);
 else if(['csv','tsv'].includes(extension))result=extractDelimited(decode(bytes),extension==='tsv'?'\t':',');
 else if(['vtt','srt'].includes(extension))result=extractTranscript(decode(bytes));
 else result={text:decode(bytes),warnings:[]};
 return {...result,text:checkExtractedText(result.text),filename:file.name,title:file.name.replace(/\.[^.]+$/,'')};
}
