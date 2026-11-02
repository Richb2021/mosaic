import {createOCR,OCR_MAX_PAGES,ocrSize} from './ocr-reader.js';
import {getDocument,GlobalWorkerOptions} from 'pdfjs-dist/build/pdf.mjs';
GlobalWorkerOptions.workerSrc='/extraction/pdf.worker.mjs';
export async function extractPDF(bytes,{ocr=false,signal,onProgress=()=>{}}={}){
 signal?.throwIfAborted();let reader,currentPage=0,rejectAbort;const cancelled=new Promise((_,reject)=>{rejectAbort=reject});const abort=()=>{rejectAbort(Error('Text reading cancelled.'));reader?.close();void task.destroy().catch(()=>{})};
 const task=getDocument({data:bytes,disableFontFace:true,isEvalSupported:false,useSystemFonts:false,stopAtErrors:true,enableXfa:false,useWasm:false,disableAutoFetch:true,disableStream:true,standardFontDataUrl:'/extraction/standard_fonts/',cMapUrl:'/extraction/cmaps/',cMapPacked:true});
 signal?.addEventListener('abort',abort,{once:true});
 let timer;try{
  return await Promise.race([cancelled,(async()=>{
   const pdf=await task.promise;if(pdf.numPages>80)throw Error('Use a PDF with at most 80 pages. Split this document first.');if(ocr&&pdf.numPages>OCR_MAX_PAGES)throw Error('Use at most 12 pages when reading scans. Split the PDF; no pages were skipped.');const sections=[],empty=[],scanned=[];let length=0;
   for(let i=1;i<=pdf.numPages;i++){currentPage=i;signal?.throwIfAborted();onProgress({status:`Reading page ${i} of ${pdf.numPages}`,progress:0});const page=await pdf.getPage(i),content=await page.getTextContent();let text='',lastY=null;
    for(const item of content.items){if(typeof item.str!=='string')continue;const y=item.transform?.[5];if(lastY!==null&&y!==lastY)text+='\n';text+=item.str+(item.hasEOL?'\n':' ');lastY=y;}
    text=text.replace(/[ \t]+/g,' ').replace(/ *\n */g,'\n').trim();if(ocr){
     const view=page.getViewport({scale:2}),size=ocrSize(view.width,view.height,{allowLarge:true}),canvas=document.createElement('canvas');Object.assign(canvas,size);
     try{await page.render({canvasContext:canvas.getContext('2d'),viewport:page.getViewport({scale:2*size.width/view.width})}).promise;reader ||= createOCR({signal,onProgress:p=>onProgress({...p,status:`Reading scan on page ${currentPage} of ${pdf.numPages}: ${p.status}`})});const result=await reader.recognize(canvas);text=result.text.trim();scanned.push(`page ${i}: ${Math.round(result.confidence)}%`);}finally{canvas.width=canvas.height=0}
    }if(text){sections.push(`[Page ${i}]\n${text}`);length+=text.length;if(length>60000)throw Error('The PDF contains too much text. Split it; nothing was truncated.');}else empty.push(i);page.cleanup();
   }
   if(!sections.length)throw Error('This PDF has no readable text layer. Enable “Read printed scans”, then choose the PDF again, or paste a checked transcription.');
   return {text:sections.join('\n\n'),warnings:[ocr?'English printed-text OCR on every page. Compare all text with the original; handwriting, diagrams, tables and equations may be wrong or missing.':'PDF text only. Check reading order, tables, mathematical symbols and diagrams against the original.',...(scanned.length?['Recognition confidence (not an accuracy guarantee): '+scanned.join('; ')]:[]),...(empty.length?[`No text on pages ${empty.join(', ')}. Their content was not extracted; add it before review.`]:[])]};
  })(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('PDF extraction took too long. Split the file or upload a text export.')),ocr?180000:30000)})]);
 }catch(e){if(e.name==='PasswordException')throw Error('This PDF is password protected. Upload an unlocked copy you have permission to use.');throw e;}finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);reader?.close();await task.destroy();}
}
