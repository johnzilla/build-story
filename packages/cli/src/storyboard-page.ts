import { randomBytes } from 'node:crypto'
import type { StoryArc } from '@buildstory/core'
import type { SpeechCacheScene } from '@buildstory/video'

export interface StoryboardData {
  arc: StoryArc
  scenes: Array<Omit<SpeechCacheScene, 'audioPath'> & { image?: string; audio?: string }>
  voice: string; speed: number; model: string; pricePer1000: number
  pronunciationConfigured: boolean
}

/** Standalone editor: no server, remote resources, eval, or markup from source data. */
export function storyboardPage(data: StoryboardData): string {
  const nonce = randomBytes(18).toString('base64')
  const serialized = JSON.stringify(data).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029')
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline'; img-src 'self' data:; media-src 'self'; connect-src 'none'; base-uri 'none'; form-action 'none'">
<title>BuildStory storyboard</title><style>
body{font:16px/1.5 system-ui,sans-serif;background:#111925;color:#edf3fa;margin:0}main{max-width:1140px;margin:auto;padding:36px 24px}h1{margin-bottom:8px}p{color:#b8c7d9}header{position:sticky;top:0;background:#111925f5;padding:12px 0;z-index:1;border-bottom:1px solid #41536b}button{background:#7bc7ff;border:0;border-radius:6px;padding:10px 16px;color:#102236;font-weight:600;cursor:pointer;margin:4px}button:disabled{opacity:.35;cursor:default}article{background:#1b283a;border:1px solid #40536d;border-radius:12px;margin:24px 0;padding:24px}label{display:block;margin:12px 0 4px}input:not([type=checkbox]),textarea{width:100%;box-sizing:border-box;background:#101b2a;color:#fff;border:1px solid #536985;border-radius:5px;padding:10px;font:inherit}textarea{min-height:90px}img{display:block;width:100%;border-radius:6px;margin:16px 0}audio{width:100%}.meta{color:#94cefa}.error{color:#ffb6a6}pre{white-space:pre-wrap;overflow-wrap:anywhere;font:14px/1.5 ui-monospace,monospace}summary{cursor:pointer}a{color:#9bd5ff}.tools{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.tools label{margin:0}.notice{border-left:3px solid #edc27a;padding-left:14px}#status{white-space:pre-wrap}small{color:#b8c7d9}
</style><main><h1>Review the development story</h1><p id="settings"></p>
<p>Change scene text, reorder with the arrows, or exclude scenes. Download the edited arc to save your work; this page does not write to your repository or make API calls.</p>
<p class="notice">Stills show the saved version. After edits or reordering, regenerate the storyboard to refresh layout, captions, source review, and costs. Cached audio previews contain only previously generated speech. A speech override takes priority over narration edits; edit or clear it to change spoken words.</p>
<header><div class="tools"><button id="download">Download edited story arc</button><strong id="total"></strong></div><div id="status" role="status" aria-live="polite"></div></header>
<details><summary>Story review notes</summary><pre id="warnings"></pre></details><section id="scenes"></section></main>
<script type="application/json" id="data" nonce="${nonce}">${serialized}</script><script nonce="${nonce}">${clientScript}</script></html>`
}

const clientScript = String.raw`
'use strict';
const data = JSON.parse(document.getElementById('data').textContent);
const rows = data.arc.beats.map((beat, originalIndex) => ({beat: structuredClone(beat), originalIndex, included:true}));
const root = document.getElementById('scenes'), status = document.getElementById('status');
function el(tag,text,parent){const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(parent)parent.append(node);return node;}
function message(text,error=false){status.textContent=text;status.className=error?'error':'';}
function speech(beat){return beat.speechText === undefined ? beat.summary : beat.speechText;}
function updateCost(){
 const seen=new Set();let total=0,count=0;
 rows.forEach(row=>{let cost=0;const text=speech(row.beat);const cached=data.scenes.find(scene=>scene.speech===text);
 if(row.included){count++;if(cached){cached.missingChunks.forEach(chunk=>{if(!seen.has(chunk.key)){seen.add(chunk.key);cost+=chunk.costUSD;}});}else{const key='edited:'+text;if(!seen.has(key)){seen.add(key);cost=text.length*data.pricePer1000/1000;}}total+=cost;}
 const node=document.getElementById('cost-'+row.originalIndex);if(node)node.textContent=(cached?cached.status:'edited; assumes no cache')+' · Additional speech estimate: $'+cost.toFixed(4)+(row.included?'':' · excluded');
 const audio=document.getElementById('audio-'+row.originalIndex);if(audio){audio.hidden=text!==data.scenes[row.originalIndex].speech;if(audio.hidden)audio.pause();}
 });
 document.getElementById('total').textContent=count+' scenes · Estimated additional TTS: $'+total.toFixed(4);
}
function changed(){message('Unsaved edits. Stills and prior source reviews may be stale. Download and regenerate to verify.');updateCost();}
function field(card,row,key,label,large=false){el('label',label,card);const node=el(large?'textarea':'input',undefined,card);node.setAttribute('aria-label',label);node.value=row.beat[key]??'';node.addEventListener('input',()=>{if(node.value===''&&['displayText','speechText','chapter'].includes(key))delete row.beat[key];else row.beat[key]=node.value;changed();});}
function render(){root.replaceChildren();rows.forEach((row,position)=>{
 const card=el('article',undefined,root),toolbar=el('div',undefined,card);toolbar.className='tools';el('h2','Scene '+(position+1),toolbar);
 const label=el('label',undefined,toolbar),include=el('input',undefined,label);include.type='checkbox';include.checked=row.included;label.append(document.createTextNode(' Include'));include.addEventListener('change',()=>{row.included=include.checked;changed();});
 for(const [name,delta]of [['Move up',-1],['Move down',1]]){const button=el('button',name,toolbar);button.disabled=position+delta<0||position+delta>=rows.length;button.addEventListener('click',()=>{[rows[position],rows[position+delta]]=[rows[position+delta],rows[position]];render();changed();});}
 const original=data.scenes[row.originalIndex];const cost=el('p','',card);cost.id='cost-'+row.originalIndex;cost.className='meta';el('small','Speech duration: '+original.durationSeconds.toFixed(1)+'s ('+original.durationBasis+'; excludes scene padding).',card);
 if(original.image){const img=el('img',undefined,card);img.src=original.image;img.alt='Saved preview of original scene '+(row.originalIndex+1);}
 if(original.audio){const audio=el('audio',undefined,card);audio.id='audio-'+row.originalIndex;audio.src=original.audio;audio.controls=true;audio.preload='none';}
 field(card,row,'title','Title');field(card,row,'chapter','Chapter');field(card,row,'summary','Narration / readable captions',true);field(card,row,'displayText','Short display text',true);field(card,row,'speechText','Speech override (optional pronunciation)',true);
 const details=el('details',undefined,card);el('summary','Evidence and source references',details);
 el('pre',JSON.stringify({sourceEventIds:row.beat.sourceEventIds,evidence:row.beat.evidence,visual:row.beat.visual,review:data.arc.metadata.review?.beats.find(entry=>entry.beatIndex===row.originalIndex)},null,2),details);
 });updateCost();}
function exportArc(){
 const included=rows.filter(row=>row.included);if(!included.length)throw new Error('Include at least one scene.');
 for(const row of included){if(!row.beat.title.trim()||!row.beat.summary.trim())throw new Error('Every included scene needs a title and narration.');if(row.beat.displayText!==undefined&&(!row.beat.displayText.trim()||row.beat.displayText.length>240))throw new Error('Display text must be at most 240 characters.');if(row.beat.chapter!==undefined&&(!row.beat.chapter.trim()||row.beat.chapter.length>80))throw new Error('Chapter must be at most 80 characters.');if(row.beat.speechText!==undefined&&!row.beat.speechText.trim())throw new Error('Speech override must contain text or be cleared.');}
 const arc=structuredClone(data.arc);arc.beats=included.map(row=>row.beat);
 arc.metadata.warnings=['Storyboard edited: review claims and chronology again with the original timeline before publishing.',...(arc.metadata.warnings??[]).map(note=>'Prior review: '+note)];
 if(arc.metadata.review){arc.metadata.review.beats=included.flatMap((row,index)=>{const review=data.arc.metadata.review.beats.find(entry=>entry.beatIndex===row.originalIndex);if(!review)return [];const copy=structuredClone(review);copy.beatIndex=index;copy.status='needs-review';copy.notes.push('Storyboard edited; claims and chronology need fresh review.');return [copy];});}
 if(arc.metadata.editorial){const words=arc.beats.reduce((n,beat)=>n+beat.summary.trim().split(/\s+/).filter(Boolean).length,0);arc.metadata.editorial.wordCount=words;arc.metadata.editorial.estimatedRuntimeSeconds=Math.round(words*60/130);}
 return arc;
}
document.getElementById('download').addEventListener('click',()=>{try{const arc=exportArc();const url=URL.createObjectURL(new Blob([JSON.stringify(arc,null,2)],{type:'application/json'}));const link=el('a');link.href=url;link.download='story-arc.edited.json';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);message('Downloaded edited arc. Regenerate the storyboard with --timeline for fresh source review and previews.');}catch(error){message(error.message,true);}});
document.getElementById('settings').textContent='Remotion review · '+data.model+' / '+data.voice+' / speed '+data.speed+'. Cache inspection is a snapshot; costs exclude narration, video services, and local rendering. Edited text estimates are provisional.'+(data.pronunciationConfigured?' A pronunciation dictionary is configured; regenerate after text edits to apply it and refresh estimates.':'');
document.getElementById('warnings').textContent=(data.arc.metadata.warnings??[]).join('\n')||'No saved review notes. Source matching is not independent fact checking.';
render();
`
