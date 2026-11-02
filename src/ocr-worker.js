import {createWorker} from 'tesseract.js';
// A document owns this worker (and its Tesseract child). Terminating it cancels
// initialization as well as recognition; no document pixels are persisted.
let engine,activeId;
self.onmessage=async({data:{id,bytes}})=>{
 let phase='load';
 try{
  activeId=id;
  engine ||= createWorker('eng',1,{workerPath:location.origin+'/extraction/ocr/worker.min.js',corePath:location.origin+'/extraction/ocr',langPath:location.origin+'/extraction/ocr',workerBlobURL:false,cacheMethod:'none',logger:p=>postMessage({id:activeId,progress:p}),errorHandler:()=>{}});
  const worker=await engine;phase='recognize';const {data}=await worker.recognize(bytes,{}, {text:true});
  postMessage({id,result:{text:data.text,confidence:data.confidence}});
 }catch(e){postMessage({id,error:true,phase})}
};
