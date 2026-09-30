import { customerId,conversation } from '../demo-data.js';
export const bookingScenarios={kind:'booking',options:[['booking','7 · Marcar horário'],['booking-empty','7 · Sem horários'],['booking-loading','7 · Carregando agenda'],['booking-error','7 · Erro na agenda'],['booking-rejected','7 · Horário ocupado'],['booking-uncertain','7 · Marcação incerta']]};
export const ownerId='00000000-0000-4000-8000-000000000081';
export const service={id:'00000000-0000-4000-8000-000000000082',name:'Escolha de acabamentos',duration_minutes:30,active:true};
const day=new Date().toISOString().slice(0,10);const next=new Date(Date.now()+86400000).toISOString().slice(0,10);
export const slots=[`${day}T10:00:00-04:00`,`${day}T11:00:00-04:00`,`${next}T09:00:00-04:00`,`${next}T10:30:00-04:00`].map(starts_at=>({starts_at,ends_at:new Date(Date.parse(starts_at)+30*60000).toISOString()}));
export const query={customer_id:customerId,owner_user_id:ownerId,service_id:service.id,from:`${day}T00:00:00-04:00`,to:`${next}T23:59:00-04:00`};
export function bookingStage(scenario:string){if(scenario==='booking-error')return {isError:true};return {structuredContent:{conversation:conversation(),customer_id:customerId,service,query,meeting_requested:true,availability:{time_zone:'America/Manaus',schedule_published:true,slots:scenario==='booking-empty'?[]:slots}}};}
export async function bookingTool(name:string,args:Record<string,any>,scenario:string){
  if(name==='list_users')return {structuredContent:{data:[{id:ownerId,user_id:ownerId,name:'Sofia Almeida'}]}};
  if(name==='get_appointment_availability')return {structuredContent:{data:{time_zone:'America/Manaus',schedule_published:true,slots:scenario==='booking-rejected'?[]:slots}}};
  if(name==='create_appointment'){await new Promise(r=>setTimeout(r,500));if(scenario==='booking-uncertain')return {isError:true,structuredContent:{error:{outcome:'unknown',message:'Não foi possível confirmar a criação.'}}};return {structuredContent:{data:{id:'00000000-0000-4000-8000-000000000083',...args,revision:1}}};}
  if(name==='prepare_send_intent')return {structuredContent:{idempotency_key:crypto.randomUUID()}};
}
