import {getDocument,GlobalWorkerOptions} from 'pdfjs-dist/build/pdf.mjs';
GlobalWorkerOptions.workerSrc='/extraction/pdf.worker.mjs';
export async function extractPDF(bytes){
 const task=getDocument({data:bytes,disableFontFace:true,isEvalSupported:false,useSystemFonts:false,stopAtErrors:true,enableXfa:false,useWasm:false,disableAutoFetch:true,disableStream:true,standardFontDataUrl:'/extraction/standard_fonts/',cMapUrl:'/extraction/cmaps/',cMapPacked:true});
 let timer;try{
  return await Promise.race([(async()=>{
   const pdf=await task.promise;if(pdf.numPages>80)throw Error('Use a PDF with at most 80 pages. Split this document first.');const sections=[],empty=[];let length=0;
   for(let i=1;i<=pdf.numPages;i++){const page=await pdf.getPage(i),content=await page.getTextContent();let text='',lastY=null;
    for(const item of content.items){if(typeof item.str!=='string')continue;const y=item.transform?.[5];if(lastY!==null&&y!==lastY)text+='\n';text+=item.str+(item.hasEOL?'\n':' ');lastY=y;}
    text=text.replace(/[ \t]+/g,' ').replace(/ *\n */g,'\n').trim();if(text){sections.push(`[Page ${i}]\n${text}`);length+=text.length;if(length>60000)throw Error('The PDF contains too much text. Split it; nothing was truncated.');}else empty.push(i);page.cleanup();
   }
   if(!sections.length)throw Error('This PDF has no readable text layer. OCR is not connected yet. Upload a text export or paste a checked transcription.');
   return {text:sections.join('\n\n'),warnings:['PDF text only. Check reading order, tables, mathematical symbols and diagrams against the original.',...(empty.length?[`No text on pages ${empty.join(', ')}. Their content was not extracted; add it before review.`]:[])]};
  })(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('PDF extraction took too long. Split the file or upload a text export.')),30000)})]);
 }catch(e){if(e.name==='PasswordException')throw Error('This PDF is password protected. Upload an unlocked copy you have permission to use.');throw e;}finally{clearTimeout(timer);await task.destroy();}
}
