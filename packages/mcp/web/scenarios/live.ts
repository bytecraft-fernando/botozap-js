import {conversationId} from '../demo-data.js';
export const liveScenarios={kind:'live',options:[['live','5 · Plantão ao vivo']]};
let started=Date.now(),step=0,repliedAt='';
export const liveReplyText='Pode confirmar! Vocês conseguem embalar cada lembrança separadamente?';
export function liveReply(){return repliedAt?{id:'latest-live',conversation_id:conversationId,direction:'inbound',content:{text:{body:liveReplyText}},created_at:repliedAt}:null;}
export function resetLive(){started=Date.now();step=0;repliedAt='';}
export function liveStage(){const at=new Date(started-12*60000).toISOString();return {structuredContent:{conversation_id:conversationId,contact_name:'Marina Oliveira',session_active:true,cursor:'1',has_more:false,events:[{id:'sent',at,kind:'sent'}]}};}
export function liveTool(name:string){if(name!=='open_live_conversation')return;step++;const result=liveStage();if(step>=1)result.structuredContent.events.push({id:'delivered',at:new Date(started+1000).toISOString(),kind:'delivered'});if(step>=2)result.structuredContent.events.push({id:'read',at:new Date(started+2000).toISOString(),kind:'read'});if(step===3)result.structuredContent.events.push({id:'typing',at:new Date().toISOString(),kind:'typing'});if(step>=4){repliedAt||=new Date().toISOString();result.structuredContent.events.push({id:'reply',at:repliedAt,kind:'reply',text:liveReplyText} as any);}result.structuredContent.cursor=String(step+1);return result;}
