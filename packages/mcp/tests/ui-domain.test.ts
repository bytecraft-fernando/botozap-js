import {afterEach,expect,it,vi} from 'vitest';
import {uiResourceMetadata} from '../src/resources/ui-metadata.js';
import {versionedUiContent} from '../src/resources/versioned-ui.js';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {InMemoryTransport} from '@modelcontextprotocol/sdk/inMemory.js';
import {buildServer} from '../src/server.js';
import {fullAccessIdentity} from './helpers/identity.js';
vi.mock('node:fs/promises',async original=>({...await original<any>(),readFile:vi.fn(async()=>'<main id="app"></main>')}));
afterEach(()=>vi.unstubAllEnvs());
it('applies the configured origin on contents and descriptors for every resource and versioned tool',async()=>{
 vi.stubEnv('BOTOZAP_MCP_UI_DOMAIN','https://mcp.botozap.com.br/');
 const server=await buildServer({apiKey:'bz_live_test',baseUrl:'https://api.test/v1',uiEnabled:true},fullAccessIdentity);
 const client=new Client({name:'domain',version:'1'},{capabilities:{extensions:{'io.modelcontextprotocol/ui':{mimeTypes:['text/html;profile=mcp-app']}}} as any});
 const [ct,st]=InMemoryTransport.createLinkedPair();await Promise.all([server.connect(st),client.connect(ct)]);
 try{const resources=(await client.listResources()).resources.filter(r=>r.uri.startsWith('ui://'));expect(resources).toHaveLength(8);
 for(const resource of resources){const read=await client.readResource({uri:resource.uri});for(const meta of [resource._meta,read.contents[0]._meta]){expect(meta?.ui).toMatchObject({domain:'https://mcp.botozap.com.br'});expect(meta?.['openai/widgetDomain']).toBe('https://mcp.botozap.com.br');}}
 const uris=new Set(resources.map(r=>r.uri));for(const tool of (await client.listTools()).tools){const uri=(tool._meta?.ui as any)?.resourceUri;if(uri){expect(uris.has(uri)).toBe(true);expect(tool._meta?.['openai/outputTemplate']).toBe(uri);}}
 }finally{await client.close();await server.close();}
});
it('preserves the default metadata and changes the URI when the domain changes',()=>{
 vi.stubEnv('BOTOZAP_MCP_UI_DOMAIN',undefined);const plain=uiResourceMetadata(true);expect(plain.ui).not.toHaveProperty('domain');expect(plain).not.toHaveProperty('openai/widgetDomain');
 vi.stubEnv('BOTOZAP_MCP_UI_DOMAIN','https://mcp.botozap.com.br');const domain=uiResourceMetadata(true);expect(domain.ui.csp).toEqual(plain.ui.csp);expect(versionedUiContent('global','<main id="app"></main>',domain).uri).not.toBe(versionedUiContent('global','<main id="app"></main>',plain).uri);
});
it.each(['http://mcp.botozap.com.br','https://user:secret@example.com','https://example.com/path','https://example.com?x=1','https://example.com#x','invalid'])('rejects a non-HTTPS origin or extra URL components: %s',value=>{vi.stubEnv('BOTOZAP_MCP_UI_DOMAIN',value);expect(()=>uiResourceMetadata(false)).toThrow(/BOTOZAP_MCP_UI_DOMAIN/);});
