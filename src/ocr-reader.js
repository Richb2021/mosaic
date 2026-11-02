export const OCR_MAX_PAGES=12,OCR_MAX_PIXELS=6000000;
export function ocrSize(width,height,{allowLarge=false}={}){
 if(!Number.isFinite(width*height)||width<=0||height<=0||!allowLarge&&width*height>24000000)throw Error('This image is too large to read safely. Resize it below 24 megapixels.');
 const scale=Math.min(1,Math.sqrt(OCR_MAX_PIXELS/(width*height)),8192/width,8192/height);
 return {width:Math.max(1,Math.floor(width*scale)),height:Math.max(1,Math.floor(height*scale))};
}
export function createOCR({signal,onProgress=()=>{},WorkerClass=globalThis.Worker,timeoutMs=180000}={}){
 signal?.throwIfAborted();const worker=new WorkerClass('/extraction/ocr-reader-worker.js',{type:'module'});let pending=null,closed=false,serial=0,closeError;
 function close(error){if(closed)return;closed=true;closeError=error||Error('Text reading cancelled.');clearTimeout(timer);signal?.removeEventListener('abort',abort);worker.terminate();pending?.reject(closeError);pending=null}
 const abort=()=>close(Error('Text reading cancelled.'));
 const timer=setTimeout(()=>close(Error('Text reading took too long. Split the document into fewer pages and try again.')),timeoutMs);
 signal?.addEventListener('abort',abort,{once:true});
 worker.onerror=()=>close(Error('The text reader could not start. Check your connection and try again.'));
 worker.onmessage=({data})=>{if(!pending||pending.id!==data.id)return;if(data.progress){onProgress(data.progress);return}const p=pending;pending=null;if(data.error)p.reject(Error(data.phase==='load'?'The text reader could not start. Check your connection and use an up-to-date browser, or paste a checked transcription.':'Could not read this scan. Try a clearer image or paste a checked transcription.'));else p.resolve(data.result)};
 return {close,recognize:async canvas=>{if(closed)throw closeError;signal?.throwIfAborted();const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob)throw Error('This page could not be rendered.');const bytes=new Uint8Array(await blob.arrayBuffer());if(closed)throw closeError;return new Promise((resolve,reject)=>{pending={id:++serial,resolve,reject};worker.postMessage({id:serial,bytes},[bytes.buffer])})}};
}
export async function extractImage(bytes,options={}){
 const bitmap=await createImageBitmap(new Blob([bytes]));let reader,canvas;
 try{options.signal?.throwIfAborted();const size=ocrSize(bitmap.width,bitmap.height);canvas=document.createElement('canvas');Object.assign(canvas,size);const ctx=canvas.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,size.width,size.height);ctx.drawImage(bitmap,0,0,size.width,size.height);reader=createOCR(options);const r=await reader.recognize(canvas);return {text:r.text,warnings:[`English printed-text OCR · recognition confidence ${Math.round(r.confidence)}%. This is not an accuracy guarantee. Compare every passage with the original; handwriting, tables, diagrams and equations may be wrong or missing.`]}}finally{bitmap.close();reader?.close();if(canvas)canvas.width=canvas.height=0}
}
