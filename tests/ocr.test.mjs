import test from 'node:test';import assert from 'node:assert/strict';
import {createOCR,ocrSize,OCR_MAX_PIXELS} from '../src/ocr-reader.js';
import {extractDocument} from '../src/document-extraction.js';
import {extractResource} from '../server/content-service.js';
const text='Plants use sunlight to make food. Caterpillars eat leaves and birds eat caterpillars.';
const file=name=>({name,size:100,arrayBuffer:async()=>new ArrayBuffer(100)});
test('scan reading requires an explicit choice and keeps image bytes local to the injected reader',async()=>{
 let calls=0;const imageReader=async bytes=>{calls++;assert.equal(bytes.length,100);return {text,warnings:['Check every word.']}};
 await assert.rejects(()=>extractDocument(file('scan.png'),{imageReader}),/Enable/);assert.equal(calls,0);
 const r=await extractDocument(file('scan.png'),{imageReader,ocr:true});assert.equal(r.text,text);assert.deepEqual(r.warnings,['Check every word.']);assert.equal(calls,1);
});
test('PDF scan option, progress and abort signal reach the reader; text bounds still apply',async()=>{
 const c=new AbortController(),onProgress=()=>{};let seen;
 await extractDocument(file('scan.pdf'),{ocr:true,signal:c.signal,onProgress,pdfReader:async(bytes,opts)=>{seen=opts;return {text,warnings:[]}}});
 assert.equal(seen.signal,c.signal);assert.equal(seen.ocr,true);assert.equal(seen.onProgress,onProgress);
 c.abort();await assert.rejects(()=>extractDocument(file('scan.pdf'),{signal:c.signal}));
 await assert.rejects(()=>extractDocument(file('scan.png'),{ocr:true,imageReader:async()=>({text:'x'.repeat(60001),warnings:[]})}),/nothing was silently truncated/);
});
test('OCR pixel budget rejects huge images and scales ordinary scans without changing aspect ratio',()=>{
 assert.throws(()=>ocrSize(10000,10000),/too large/);assert.throws(()=>ocrSize(0,100));
 const size=ocrSize(4000,4000);assert.ok(size.width*size.height<=OCR_MAX_PIXELS);assert.equal(size.width,size.height);
 const poster=ocrSize(4896,6912,{allowLarge:true});assert.ok(poster.width*poster.height<=OCR_MAX_PIXELS);
 assert.ok(ocrSize(20000,20).width<=8192);
});
test('a worker failure before canvas conversion finishes retains its startup error',async()=>{
 let complete;const reader=createOCR({WorkerClass:FakeWorker}),p=reader.recognize({toBlob:fn=>{complete=fn}});FakeWorker.last.onerror();complete(new Blob(['pixels']));await assert.rejects(()=>p,/could not start/);
});
test('missing language assets are reported as startup failures, not poor scan quality',async()=>{
 const reader=createOCR({WorkerClass:FakeWorker}),p=reader.recognize(canvas);await new Promise(r=>setImmediate(r));const w=FakeWorker.last;w.onmessage({data:{id:w.data.id,error:true,phase:'load'}});await assert.rejects(()=>p,/could not start/);reader.close();
});
test('checked image transcriptions pass source ingestion with exact canonical excerpts, while unsupported formats fail',async()=>{
 for(const ext of ['png','jpg','jpeg','webp']){const r=await extractResource({title:'Checked scan',filename:'scan.'+ext,text});assert.equal(r.text,text);assert.equal(r.units[0].excerpt,text)}
 await assert.rejects(()=>extractResource({title:'Unsafe file',filename:'scan.svg',text}),/supported document/);
});
class FakeWorker {static last;constructor(){FakeWorker.last=this}postMessage(data){this.data=data}terminate(){this.stopped=true}}
const canvas={toBlob:fn=>fn(new Blob(['pixels']))};
test('cancellation terminates the document worker during initialization and rejects pending recognition',async()=>{
 const c=new AbortController(),ocr=createOCR({signal:c.signal,WorkerClass:FakeWorker}),pending=ocr.recognize(canvas);await new Promise(r=>setImmediate(r));c.abort();
 await assert.rejects(()=>pending,/cancelled/);assert.equal(FakeWorker.last.stopped,true);await assert.rejects(()=>ocr.recognize(canvas),/cancelled/);
});
test('deadline stops a stuck reader, and result/error messages cannot resolve another request',async()=>{
 const ocr=createOCR({WorkerClass:FakeWorker,timeoutMs:15});await assert.rejects(()=>ocr.recognize(canvas),/too long/);assert.equal(FakeWorker.last.stopped,true);
 const reader=createOCR({WorkerClass:FakeWorker});const p=reader.recognize(canvas);await new Promise(r=>setImmediate(r));const w=FakeWorker.last;w.onmessage({data:{id:99,result:{text:'wrong'}}});w.onmessage({data:{id:w.data.id,result:{text,confidence:90}}});assert.equal((await p).text,text);reader.close();assert.equal(w.stopped,true);
});
