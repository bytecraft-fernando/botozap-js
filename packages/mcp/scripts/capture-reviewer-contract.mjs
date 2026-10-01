// Offline: execute the app's serializers using fictional rows, never credentials.
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import ts from 'typescript';
import {transform} from 'esbuild';
const app=process.argv[2];if(!app)throw new Error('Pass the readonly app repository path.');
const specs=[
 ['src/lib/identity.ts',null],
 ['src/lib/api/channel.ts',['serializeChannelAccount','channelOf','channelFields']],
 ['src/lib/channels/window.ts',['isFuture','messagingWindowState']],
 ['src/lib/whatsapp/window.ts',['isSessionWindowOpen']],
 ['src/lib/whatsapp/free-entry-point.ts',['fepReplyBy','FEP_REPLY_WINDOW_MS']],
 ['src/app/api/v1/contacts/serialize.ts',['serializeContact']],
 ['src/app/api/v1/conversations/serialize.ts',['serializeConversation','serializeReferral','referralText','conversationStatus']],
 ['src/app/api/v1/customers/route.ts',['toCustomer']],
 ['src/app/api/v1/messages/serialize.ts',['serializeMessage','MEDIA_KINDS']],
 ['src/lib/api/pagination.ts',['buildOffsetMeta']],
];
const provenance=[];const chunks=[];
for(const [path,names] of specs){const source=await readFile(`${app}/${path}`,'utf8');provenance.push({path,sha256:createHash('sha256').update(source).digest('hex')});const ast=ts.createSourceFile(path,source,ts.ScriptTarget.Latest,true);for(const n of ast.statements){if((ts.isFunctionDeclaration(n)&&(!names||names.includes(n.name?.text)))||(ts.isVariableStatement(n)&&(!names||n.declarationList.declarations.some(d=>names.includes(d.name.getText(ast))))))chunks.push(n.getText(ast).replace(/^export /,''));}}
const code=await transform(chunks.join('\n')+'\nglobalThis.contract={serializeContact,serializeConversation,toCustomer,buildOffsetMeta,serializeMessage};',{loader:'ts',format:'cjs'});const scope={};new Function('globalThis',code.code)(scope);const f=scope.contract;
const uuid=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;const at='2026-10-01T12:00:00Z';const channel={id:uuid(4),channel:'whatsapp',display:null};
const contacts=Array.from({length:12},(_,i)=>f.serializeContact({id:uuid(100+i),wa_id:i<10?`BR.188Fixture${i}`:`17840000000000${i}`,phone:(i<2||i>=10)?null:`55110000000${i}`,profile_name:`Contato ${i+1}`,display_name:null,user_id:i<10?`BR.188Fixture${i}`:null,parent_user_id:null,username:i>=10?'contato_instagram':i===0?'contato_revisor':null,phone_number_id:i>=10?null:uuid(4),created_at:at,last_seen_at:null,notes:null,metadata:{tags:[]},stage:null,profile_picture_url:null,channel_accounts:i>=10?{...channel,id:uuid(5),channel:'instagram',display:'@negocio_revisor'}:channel}));
const conversations=contacts.map((c,i)=>f.serializeConversation({id:uuid(200+i),phone_number_id:c.phone_number_id,contact_id:c.id,contacts:c,phone_numbers:i>=10?null:{phone_number_id:'123456789',display_phone_number:null},channel_accounts:c.channel_account,window_expires_at:null,last_message_at:at,last_read_at:null,created_at:at},i===0?at:null));
const messages=contacts.map((c,i)=>f.serializeMessage({id:uuid(400+i),wamid:i>=10?null:'wamid.fixture',conversation_id:conversations[i].id,phone_number_id:c.phone_number_id,contact_id:c.id,direction:'inbound',kind:'text',status:'received',source:'customer',content:{body:'Olá, preciso de ajuda.'},context:null,error:null,created_at:at,event_at:at,wa_timestamp:null,revoked_at:null,channel_accounts:c.channel_account}));
const customers=[f.toCustomer({id:uuid(1),name:'Negócio revisor',external_id:null,is_self:true,created_at:at,updated_at:at})];
const meta=f.buildOffsetMeta({page:1,perPage:100},1).meta;
// Radar has no per-row serializer: route forwards listRadar RPC rows unchanged.
const radarSource=await readFile(`${app}/src/lib/crm/radar.ts`,'utf8');provenance.push({path:'src/lib/crm/radar.ts',sha256:createHash('sha256').update(radarSource).digest('hex')});
const radar={data:[{id:uuid(300),customer_id:uuid(1),contact_id:contacts[0].id,conversation_id:conversations[0].id,entity_type:'return',bucket:'critical',reason:'overdue',title:'Retorno pendente',next_step:null,next_step_at:null}],meta:{...meta,counts:{critical:1,at_risk:0,scheduled:0}}};
await writeFile(new URL('../tests/fixtures/app-reviewer.ts',import.meta.url),`// Generated from actual app serializers; fictional identities, no reviewer data.\nexport const provenance=${JSON.stringify(provenance,null,2)};\nexport const reviewerContract=${JSON.stringify({contacts,conversations,messages,customers,meta,radar,account_name:'Meta Reviewer'},null,2)};\n`);
