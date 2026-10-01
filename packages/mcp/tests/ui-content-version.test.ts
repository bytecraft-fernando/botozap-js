import {expect,it} from 'vitest';
import {versionedUiContent} from '../src/resources/versioned-ui.js';
const html='<div id="app"></div><script>original()</script>';
const meta={ui:{csp:{connectDomains:[],resourceDomains:[]}},'openai/widgetCSP':{connect_domains:[],resource_domains:[],redirect_domains:['https://botozap.com.br']}};
it('content hash is deterministic and changes for HTML, JavaScript, CSS and metadata',()=>{
 const initial=versionedUiContent('review',html,meta);expect(versionedUiContent('review',html,structuredClone(meta)).uri).toBe(initial.uri);
 for(const changed of [html+'<p>Changed</p>',html.replace('original()','updated()'),html+'<style>body{padding:20px}</style>'])expect(versionedUiContent('review',changed,meta).uri).not.toBe(initial.uri);
 expect(versionedUiContent('review',html,{...meta,'openai/widgetDescription':'Updated'}).uri).not.toBe(initial.uri);
 expect(versionedUiContent('review',html,{...meta,ui:{csp:{connectDomains:[],resourceDomains:[],frameDomains:[]}}}).uri).not.toBe(initial.uri);
 expect(initial.text).toContain('data-initial-mode="inline" data-view="review"');expect(initial.uri).toMatch(/\/review\/[a-f0-9]{10}\.html$/);
 expect(versionedUiContent('review',html,{...meta,'openai/ui':{preferredDisplayMode:'inline'}}).uri).not.toBe(versionedUiContent('review',html,{...meta,'openai/ui':{preferredDisplayMode:'fullscreen'}}).uri);
});
it('each UI view serves its own rendered HTML at a distinct content URI',()=>{
 const reply=versionedUiContent('reply',html,meta),cards=versionedUiContent('radar-cards',html,meta);expect(reply.uri).not.toBe(cards.uri);expect(cards.text).toContain('data-view="carousel"');expect(reply.text).toContain('data-view="review"');expect(reply.text).toContain('data-initial-mode="inline"');
});
