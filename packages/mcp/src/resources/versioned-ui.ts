import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { RESOURCE_MIME_TYPE } from '@modelcontextprotocol/ext-apps/server';
import { uiResourceMetadata } from './ui-metadata.js';
const views = ['review','reply','radar-cards','template','cases','booking','live','global'] as const;
export type UiView = typeof views[number];
/** Hash the exact HTML served and the complete resource metadata, never identity data. */
export function versionedUiContent(view: UiView, html: string, meta: Record<string,unknown>) {
  const mode='inline';
  const renderView=view==='radar-cards'?'carousel':['review','reply'].includes(view)?'review':view;
  const text=html.replace('id="app"',`id="app" data-initial-mode="${mode}" data-view="${renderView}"`);
  const hash=createHash('sha256').update(text).update('\0').update(JSON.stringify(meta)).digest('hex').slice(0,10);
  return {uri:`ui://botozap/${view}/${hash}.html`,mimeType:RESOURCE_MIME_TYPE,text,_meta:meta};
}
function metadata(view: UiView) {
  return {'openai/ui':{availableDisplayModes:['inline','fullscreen'],preferredDisplayMode:'inline'},...uiResourceMetadata(view!=='review')};
}
let contents: Map<UiView,ReturnType<typeof versionedUiContent>> | undefined;
let startup: Promise<void> | undefined;
/** Once per process: tools, resources/list and resources/read share an immutable snapshot. */
export function loadUiResources(): Promise<void> {
  return startup ??= readFile(new URL('../../dist/ui/review.html',import.meta.url),'utf8').then(html=>{
    contents=new Map(views.map(view=>[view,versionedUiContent(view,html,metadata(view))]));
  });
}
export function uiContent(view: UiView) {
  const content=contents?.get(view);
  if(!content)throw new Error('UI resources must be loaded before registration.');
  return content;
}
export function uiToolMetadata(view: UiView) {
  const uri=uiContent(view).uri;
  return {ui:{resourceUri:uri,visibility:['model','app']},'openai/outputTemplate':uri};
}
