import test from 'node:test';import assert from 'node:assert/strict';
import {DOMParser} from '@xmldom/xmldom';import {zipSync,strToU8} from 'fflate';
import {extractDelimited,extractSpreadsheet,extractDocument,extractOffice} from '../src/document-extraction.js';
import {extractResource} from '../server/content-service.js';
const workbook=(sheet,more={})=>zipSync(Object.fromEntries(Object.entries({'xl/workbook.xml':'<workbook xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Factory output" r:id="r1"/></sheets></workbook>','xl/_rels/workbook.xml.rels':'<Relationships><Relationship Id="r1" Target="worksheets/sheet1.xml"/></Relationships>','xl/worksheets/sheet1.xml':sheet,...more}).map(([k,v])=>[k,strToU8(v)])));
test('CSV preserves quotation, blank row coordinates, Unicode and formula literals without execution',async()=>{
 const r=extractDelimited('\ufeffTopic,Observation\r\n"Steam, power","Output rises\nwhen capacity grows"\r\n\r\n水,=A1+1\r\n');assert.match(r.text,/Row 4:/);assert.match(r.text,/Steam, power/);assert.match(r.text,/\\nwhen capacity grows/);assert.match(r.text,/水/);assert.match(r.text,/=A1\+1/);assert.throws(()=>extractDelimited('a,"unfinished'),/quoted/);assert.throws(()=>extractDelimited('"a"bad,b'),/malformed/);
 const source=await extractResource({title:'Factories',filename:'factory.csv',text:r.text});assert.match(source.units[0].locator,/Sheet Data; rows 1-4/);
});
test('XLSX keeps cell coordinates, shared strings and explicit cached formula warnings',()=>{
 const r=extractSpreadsheet(workbook('<worksheet><sheetData><row r="3"><c r="A3" t="s"><v>0</v></c><c r="B3"><f>1+2</f><v>3</v></c><c r="C3"><f>external()</f></c></row></sheetData></worksheet>',{'xl/sharedStrings.xml':'<sst><si><t>Income per factory worker</t></si></sst>'}),DOMParser);assert.match(r.text,/A3 = "Income/);assert.match(r.text,/B3 = "3 \[cached/);assert.match(r.text,/no cached value/);assert.match(r.warnings.join(' '),/2 formula cells/);
});
test('XLSX rejects external sheet references, corrupt shared strings and oversized XML',()=>{
 assert.throws(()=>extractSpreadsheet(workbook('<worksheet/>',{'xl/_rels/workbook.xml.rels':'<Relationships><Relationship Id="r1" Target="https://example.com/secret" TargetMode="External"/></Relationships>'}),DOMParser),/safely/);
 assert.throws(()=>extractSpreadsheet(workbook('<worksheet><row r="1"><c r="A1" t="s"><v>9</v></c></row></worksheet>'),DOMParser),/shared-string/);
 assert.throws(()=>extractSpreadsheet(workbook('<worksheet>'+ ' '.repeat(2000001)+'</worksheet>'),DOMParser),/expanded/);
 assert.throws(()=>extractSpreadsheet(workbook('<!DOCTYPE x [<!ENTITY a SYSTEM "file:///private">]><worksheet/>'),DOMParser),/entities/);
});
test('spreadsheet document import uses the existing text and source bounds',async()=>{
 const bytes=new TextEncoder().encode('Concept,Explanation\nRevenue,"Revenue is the money received from sales before costs are deducted."');const r=await extractDocument({name:'business.csv',size:bytes.length,arrayBuffer:async()=>bytes.buffer});assert.equal(r.filename,'business.csv');assert.match(r.text,/Revenue/);
});

test('Word tables retain cell relationships and mathematical notation asks for checked explanation',()=>{
 const xml='<w:document xmlns:w="urn:word" xmlns:m="urn:math"><w:body><w:p><w:r><w:t>Compare output before and after the change.</w:t></w:r></w:p><w:tbl><w:tr><w:tc><w:p><w:r><w:t>Year</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>Units produced</w:t></w:r></w:p></w:tc></w:tr><w:tr><w:tc><w:p><w:r><w:t>1800</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>120</w:t></w:r></w:p></w:tc></w:tr></w:tbl><w:p><m:oMath/></w:p></w:body></w:document>';
 const r=extractOffice(zipSync({'word/document.xml':strToU8(xml)}),'docx',DOMParser);assert.match(r.text,/A2 = "1800".*B2 = "120"/);assert.match(r.text,/Word table 1/);assert.match(r.warnings.join(' '),/mathematical notation/);
});
