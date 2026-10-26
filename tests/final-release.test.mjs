import test from 'node:test';
import assert from 'node:assert/strict';
import { validateMetadata, safeSourceURL } from '../src/metadata.mjs';
import { reportHTML } from '../src/report.mjs';
import { cropData, maskData, fileData } from '../src/images.ts';

test('metadata preserves supplied dates and sources without inferring missing data',()=>{
 const input={dates:['2000-06-16','2024-06-26'],organization:' NASA ',attribution:' User supplied ',urls:['https://example.org/source','']};
 const output=validateMetadata(input);
 assert.deepEqual(output,{...input,organization:'NASA',attribution:'User supplied'});
 assert.deepEqual(validateMetadata().dates,['','']);
 assert.equal(input.organization,' NASA ');
 for(const date of ['2025-02-29','2024-13-01','16/06/2000'])assert.throws(()=>validateMetadata({dates:[date,'']}),/date/i);
 assert.equal(validateMetadata({dates:['2024-02-29','']}).dates[0],'2024-02-29');
});
test('source links reject script URLs and credentials but preserve public HTTP sources',()=>{
 for(const url of ['javascript:alert(1)','file:///secret','https://user:password@example.org']){
  assert.equal(safeSourceURL(url),'');
  assert.throws(()=>validateMetadata({urls:[url,'']}),/HTTP/);
 }
 assert.equal(safeSourceURL('https://example.org/a?b=1'),'https://example.org/a?b=1');
});
test('dense reports limit primary evidence to largest five and retain all actual observations in appendix',()=>{
 const regions=Array.from({length:175},(_,i)=>({id:i+1,area:i+1,centroid:[i,10],bbox:[i,9,i+1,11],meanDifference:40}));
 const html=reportHTML({title:'Dense fixture',scene:{dates:['2000-06-16','2024-06-26'],files:[{file:'before.jpg',sourceUrl:'javascript:alert(1)'},{file:'after.jpg',sourceUrl:'https://example.org/after'}],bbox:null,caveats:[],sourceOrganization:'Test source',attribution:'Authorized source credit & imagery',metadataOrigin:'user'},result:{regions,changedPercent:34,processingMs:1,width:200,height:100,threshold:35,minArea:1,runId:'dense',createdAt:'now',smoothingRadius:0},reviews:{175:{status:'approved',category:'Visual change',notes:'Current note'},999:{status:'approved',notes:'STALE REVIEW'}},before:'data:before',after:'data:after',overlay:'data:mask',evidence:[...regions.map(r=>({id:r.id,before:`data:crop-before-${r.id}`,after:`data:crop-after-${r.id}`})),{id:999,before:'STALE CROP',after:'STALE CROP'}],generatedAt:'now'});
 assert.equal((html.match(/class="evidence"/g)||[]).length,5);
 assert.ok(html.includes('data:crop-before-175'));
 assert.ok(!html.includes('data:crop-before-170"'));
 const appendix=html.split('<details class="appendix">')[1];
 assert.equal((appendix.match(/<tr><td>OBS-/g)||[]).length,175);
 assert.ok(html.includes('1 approved'));
 assert.ok(!html.includes('STALE'));
 assert.ok(!html.includes('javascript:'));
 assert.ok(html.includes('Test source'));
 assert.ok(html.includes('Authorized source credit &amp; imagery'));
 assert.ok(html.includes('User-provided metadata'));
 assert.ok(html.includes('Unsmoothed RGB'));
 assert.ok(html.includes('Print full register'));
});
test('evidence crops map processing coordinates to source pixels and masks color only detected pixels',async()=>{
 let drawn, mask;
 globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>({drawImage:(...args)=>{drawn=args},createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),putImageData:data=>{mask=data.data}}),toDataURL:()=> 'data:image/png;base64,test'})};
 const source={width:800,height:400};
 await cropData(source,{bbox:[20,30,40,50]},{width:200,height:100});
 assert.deepEqual(drawn.slice(1,5),[32,72,176,176]);
 maskData({width:3,height:1,labels:new Int32Array([0,2,0])});
 assert.deepEqual([...mask],[0,0,0,0,245,176,65,175,0,0,0,0]);
 delete globalThis.document;
});
test('aborted file reads reject instead of leaving uploads pending',async()=>{
 globalThis.FileReader=class {readAsDataURL(){queueMicrotask(()=>this.onabort())}};
 await assert.rejects(fileData({type:'image/png',size:1}),/interrupted/);
 delete globalThis.FileReader;
});

test('complete report export reuses decoded sources, embeds five paired crops and propagates decode failures', async()=>{
 const { createReport }=await import('../src/export.ts');
 const decoded=[], canvases=[];
 globalThis.Image=class {
  width=400; height=200;
  set src(value){ this.source=value;decoded.push(value);queueMicrotask(()=>value==='broken'?this.onerror():this.onload()); }
 };
 globalThis.document={createElement:()=>{
  const draws=[];
  const canvas={width:0,height:0,draws,getContext:()=>({globalAlpha:1,drawImage:(...args)=>draws.push(args),createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),putImageData:()=>{}}),toDataURL:()=>`data:image/png;base64,canvas${canvases.indexOf(canvas)}`};
  canvases.push(canvas);return canvas;
 }};
 try {
  const pair={before:'data:before',after:'data:after',width:400,height:200,scene:{files:[{file:'a.png'},{file:'b.png'}],dates:['',''],bbox:null,caveats:[]}};
  const regions=Array.from({length:8},(_,i)=>({id:i+1,area:i+1,centroid:[20,20],bbox:[18,18,22,22]}));
  const result={regions,labels:new Int32Array(200*100),width:200,height:100,threshold:35,minArea:1,changedPercent:1,processingMs:1,runId:'export-run',createdAt:'now'};
  const html=await createReport('Export fixture',pair,result,{8:{status:'approved',category:'Visual change',notes:'Verified note'}});
  assert.equal(decoded.filter(s=>s===pair.before).length,1);
  assert.equal(decoded.filter(s=>s===pair.after).length,1);
  assert.equal(canvases.length,12); // Overlay, mask and ten crops.
  assert.equal((html.match(/class="evidence"/g)||[]).length,5);
  assert.ok(html.includes('export-run')&&html.includes('Verified note'));
  const cropCanvases=canvases.slice(2);
  cropCanvases.forEach((canvas,i)=>{
   assert.equal(canvas.draws[0][0].source,i%2===0?pair.before:pair.after);
   assert.ok(html.includes(canvas.toDataURL()));
  });
  await assert.rejects(createReport('Broken',{...pair,after:'broken'},result,{}),/decoded/);
 }finally{delete globalThis.Image;delete globalThis.document;}
});

test('crops retain native detail, cap output size and preserve the exact source footprint',async()=>{
 let canvas,drawn;
 globalThis.document={createElement:()=>canvas={width:0,height:0,getContext:()=>({drawImage:(...args)=>{drawn=args}}),toDataURL:()=> 'data:image/jpeg;base64,test'}};
 try {
  const source={naturalWidth:1600,naturalHeight:800,width:400,height:200};
  await cropData(source,{bbox:[20,30,40,50]},{width:200,height:100});
  assert.deepEqual(drawn.slice(1,5),[64,144,352,352]);
  assert.deepEqual([canvas.width,canvas.height],[352,352]);
  await cropData(source,{bbox:[0,0,200,100]},{width:200,height:100});
  assert.deepEqual(drawn.slice(1,5),[0,0,1600,800]);
  assert.deepEqual([canvas.width,canvas.height],[680,340]);
  await cropData({width:200,height:100},{bbox:[0,0,20,10]},{width:200,height:100});
  assert.deepEqual([canvas.width,canvas.height],[32,22]);
 } finally {delete globalThis.document;}
});
