// ═══════════════════════════════════════════════════════════════
//  AVS Working · Correos automáticos a los clientes del coworking
//
//  1) ENCUESTAS (planes mensuales)
//     • Mitad del plan (día 12): encuesta de experiencia a cada ocupante
//       con correo; si la reserva no tiene ocupantes, al cliente.
//     • 5 días antes del vencimiento: evaluación del servicio + invitación
//       a renovar, al contacto de la empresa (quien paga).
//  2) MENSAJE MOTIVADOR DEL LUNES (planes de mes y de semana)
//     • Cada semana, a cada puesto contratado: a su ocupante con correo,
//       o al cliente si la reserva no tiene ocupantes.
//     • Sale el lunes; si ese día nadie abre el CRM, sale el martes o el
//       miércoles. Después del miércoles esa semana ya no se envía.
//
//  Se envían solos con EmailJS cuando alguien con sesión abre el CRM
//  (máximo una revisión cada 5 minutos). Cada envío queda marcado en
//     coworking/reservas/{id}/correos/{clave}
//  con una transacción, para que nunca se repita aunque el CRM esté
//  abierto en dos computadores.
//
//  Configuración (Firebase, desde el panel del CRM):
//     coworking/config/correos = { templateId, encuestas, motivacion,
//                                  nota, notaSemana }
//  Usa del CRM: cwReservas, cwOpiniones, currentUser, escH, toast,
//  waNum, cwOcupantes, cwNombrePuesto y window.VOUCHER_COWORK_CFG.
// ═══════════════════════════════════════════════════════════════
(function(){
const DIA_MITAD = 12;          // días después del inicio para la encuesta de mitad de plan
const DIAS_ANTES_FIN = 5;      // días antes del vencimiento para la de renovación
const VENTANA_ENCUESTA = 5;    // días que la encuesta sigue pendiente antes de darse por perdida
const DIAS_MOTIVACION = 3;     // lunes, martes y miércoles
const MAX_INTENTOS = 3;

// ── Frases del lunes (se rotan una por semana; edítalas libremente) ──
const FRASES = [
  'Que esta semana tenga más avances que pendientes. Tu puesto ya está listo, con café recién hecho y buen internet.',
  'Lo grande se construye con días ordinarios bien trabajados. Arranquemos este lunes con toda.',
  'Cada correo enviado, cada trámite cerrado y cada cliente atendido suma. Gracias por hacer de AVS Working tu lugar de trabajo.',
  'Empieza por la tarea que más te cuesta: el resto de la semana se siente más liviano.',
  'El Pacífico nos enseña que la constancia mueve montañas, como la marea. Feliz semana de trabajo.',
  'Tu esfuerzo de hoy es la tranquilidad de mañana. Aquí estamos para que trabajes cómodo.',
  'Una semana nueva es una oportunidad nueva. Que los negocios fluyan y las reuniones rindan.',
  'Haz una pausa, toma un café y sigue: el buen trabajo también necesita respirar.',
  'Rodéate de personas que suman. Esta semana compartes espacio con profesionales que también están construyendo lo suyo.',
  'Las metas se cumplen paso a paso. Que este lunes sea el primer paso de una gran semana.',
  'Trabajar bien también es trabajar a gusto. Si algo de tu puesto se puede mejorar, cuéntanos.',
  'El éxito es la suma de pequeños esfuerzos repetidos día tras día. ¡Vamos con toda esta semana!'
];

// ── Utilidades ─────────────────────────────────────────────────────
const hoyISO = () => new Date().toLocaleDateString('en-CA');
const sumar = (iso,n) => { const [y,m,d]=iso.split('-').map(Number); return new Date(y,m-1,d+n).toLocaleDateString('en-CA'); };
const diaSemana = iso => { const [y,m,d]=iso.split('-').map(Number); return new Date(y,m-1,d).getDay(); };
const lunesDe = iso => { const w=diaSemana(iso); return sumar(iso, w===0 ? -6 : 1-w); };
const larga = iso => { if(!iso) return ''; const [y,m,d]=iso.split('-').map(Number); return new Date(y,m-1,d).toLocaleDateString('es-CO',{weekday:'long',day:'numeric',month:'long'}); };
const corta = iso => { if(!iso) return ''; const [y,m,d]=iso.split('-').map(Number); return new Date(y,m-1,d).toLocaleDateString('es-CO',{day:'numeric',month:'short'}); };
const primerNombre = t => { const p=String(t||'').trim().split(/\s+/)[0]||''; return p ? p[0].toUpperCase()+p.slice(1).toLowerCase() : ''; };
const correoOk = t => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(t||'').trim());
const esc = t => String(t??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const html = t => esc(t).replace(/\n/g,'<br>');
const C = () => window.VOUCHER_COWORK_CFG || {};
const cfg = () => window.cwCorreosCfg || {};
const reservas = () => (typeof cwReservas!=='undefined' ? cwReservas : window.cwReservas) || [];
const opiniones = () => (typeof cwOpiniones!=='undefined' ? cwOpiniones : window.cwOpiniones) || [];
const usuario = () => (typeof currentUser!=='undefined' ? currentUser : null);
const listo = () => !!(window._db && window._tx && window.emailjs && C().emailjs);
const ocupantesDe = r => (window.cwOcupantes ? window.cwOcupantes(r) : Object.entries(r.ocupantes||{}).map(([id,o])=>({id,...o})));
const puesto = k => (window.cwNombrePuesto ? window.cwNombrePuesto(k) : k) || '';
const baseUrl = () => { try{ return new URL('.', C().urlReservas || location.href).href; }catch(e){ return location.href; } };
const waLink = txt => `https://wa.me/57${String(C().whatsapp||'').replace(/\D/g,'')}?text=${encodeURIComponent(txt)}`;
const vigente = r => r && r.estado==='Confirmada' && r.fechaInicio && r.fechaFin;
// Último día que la persona trabaja: el plan mes entrega el puesto el mismo día del mes siguiente
const ultimoDia = r => r.plan==='mes' ? sumar(r.fechaFin,-1) : r.fechaFin;

function urlOpinion(r, o, etapa){
  const u=new URL('opinion.html', baseUrl());
  u.searchParams.set('r', r.id);
  if(r.consecutivo) u.searchParams.set('c', r.consecutivo);
  const n=primerNombre(o ? o.nombre : r.nombre); if(n) u.searchParams.set('n', n);
  if(o && o.id) u.searchParams.set('o', o.id);
  u.searchParams.set('e', etapa); u.searchParams.set('src','correo');
  return u.href;
}

// ── Qué hay que enviar ─────────────────────────────────────────────
// Destinatarios de una reserva: sus ocupantes; si no tiene, el cliente.
function personas(r){
  const oc=ocupantesDe(r);
  if(oc.length) return oc.map(o=>({id:o.id, nombre:o.nombre, email:o.email, telefono:o.telefono, puesto:puesto(o.puesto)||r.recursoNom||'', o}));
  return [{id:'cliente', nombre:r.nombre, email:r.email, telefono:r.telefono, puesto:r.recursoNom||'', o:null}];
}

function tareasEncuesta(r){
  if(!vigente(r) || r.plan!=='mes') return [];
  const out=[];
  const dMitad=sumar(r.fechaInicio, DIA_MITAD);
  personas(r).forEach(p=>out.push({tipo:'mitad', r, p, clave:`mitad_${p.id}`, desde:dMitad, hasta:sumar(dMitad,VENTANA_ENCUESTA)}));
  const dRen=sumar(r.fechaFin, -DIAS_ANTES_FIN);
  out.push({tipo:'renovacion', r, p:{id:'cliente', nombre:r.nombre, email:r.email, telefono:r.telefono, puesto:r.recursoNom||'', o:null},
            clave:'renovacion', desde:dRen, hasta:r.fechaFin});
  return out;
}

function tareasMotivacion(r, lunes){
  if(!vigente(r) || (r.plan!=='mes' && r.plan!=='semana')) return [];
  const hasta=sumar(lunes, DIAS_MOTIVACION);
  // La reserva tiene que estar activa algún día entre lunes y miércoles
  if(r.fechaInicio >= hasta || ultimoDia(r) < lunes) return [];
  return personas(r).map(p=>({tipo:'lunes', r, p, clave:`lunes_${lunes}_${p.id}`, semana:lunes,
                              desde:r.fechaInicio>lunes ? r.fechaInicio : lunes, hasta}));
}

function todas(){
  const c=cfg(), hoy=hoyISO(), lunes=lunesDe(hoy);
  const out=[];
  reservas().forEach(r=>{
    if(c.encuestas!==false) out.push(...tareasEncuesta(r));
    if(c.motivacion!==false) out.push(...tareasMotivacion(r, lunes));
  });
  // Una misma persona en dos reservas recibe un solo mensaje del lunes
  const vistos=new Set();
  return out.filter(t=>{
    if(t.tipo!=='lunes' || !correoOk(t.p.email)) return true;
    const k=String(t.p.email).trim().toLowerCase();
    if(vistos.has(k)) return false; vistos.add(k); return true;
  });
}

function marca(t){ return ((t.r.correos||{})[t.clave]) || null; }
function respondida(t){
  if(t.tipo==='lunes') return null;
  return opiniones().find(o=>o.reservaId===t.r.id && o.etapa===t.tipo && (t.tipo==='renovacion' || !t.p.o || o.ocupanteId===t.p.id)) || null;
}
// k: programada | hoy | enviada | respondida | error | sin-correo | vencida
function estado(t){
  const m=marca(t), hoy=hoyISO();
  const op=respondida(t); if(op) return {k:'respondida', op, m};
  if(m && m.estado==='enviado') return {k:'enviada', m};
  if(m && m.estado==='whatsapp') return {k:'whatsapp', m};
  if(hoy < t.desde) return {k:'programada'};
  if(hoy >= t.hasta) return {k:'vencida'};
  if(!correoOk(t.p.email)) return {k:'sin-correo'};
  if(m && m.estado==='error') return {k:(m.intentos||0)>=MAX_INTENTOS?'error':'reintento', m};
  return {k:'hoy', m};
}

// ── Contenido de cada correo (variables de la plantilla de EmailJS) ──
function frase(lunes){
  const n=Math.floor((new Date(lunes+'T12:00:00') - new Date('2026-01-05T12:00:00'))/604800000);
  return FRASES[((n % FRASES.length)+FRASES.length) % FRASES.length];
}
function notaSemana(lunes){ const c=cfg(); return c.nota && c.notaSemana===lunes ? String(c.nota).trim() : ''; }

function textoLunes(t){
  const n=primerNombre(t.p.nombre), r=t.r, nota=notaSemana(t.semana);
  const finPlan=ultimoDia(r);
  const cerca = finPlan <= sumar(t.semana, 6);
  let m = `${frase(t.semana)}\n\n`;
  m += `Esta semana en AVS Working:\n• Café y agua ilimitados, desde las 8:00 a. m.\n• Wi-Fi: AVSTRAVEL\n• ¿Necesitas reunirte con un cliente? Reserva la sala de juntas por WhatsApp.`;
  if(nota) m += `\n\n📌 ${nota}`;
  m += cerca ? `\n\nTu plan termina el ${larga(finPlan)}. Si quieres seguir con tu puesto, escríbenos y te lo dejamos separado.`
             : `\n\nTu plan está activo hasta el ${larga(finPlan)}.`;
  return {
    asunto: `☀️ Buena semana${n?', '+n:''} · AVS Working`,
    titulo: `¡Feliz inicio de semana${n?', '+n:''}!`,
    mensaje: m,
    boton_texto: cerca ? 'Renovar mi puesto' : 'Escribir por WhatsApp',
    boton_url: waLink(cerca ? `Hola AVS Working, quiero renovar mi puesto${r.consecutivo?' (reserva '+r.consecutivo+')':''}.` : 'Hola AVS Working, '),
    pie: `${t.p.puesto?t.p.puesto+' · ':''}${C().direccion||''} · WhatsApp ${C().whatsapp||''}`
  };
}

function textoEncuesta(t){
  const r=t.r, n=primerNombre(t.p.nombre);
  if(t.tipo==='mitad') return {
    asunto: `${n?n+', ¿':'¿'}cómo te sientes en AVS Working?`,
    titulo: `¿Cómo va tu experiencia${n?', '+n:''}?`,
    mensaje: `Ya llevas unos días trabajando en AVS Working${t.p.puesto?' ('+t.p.puesto+')':''} y queremos saber cómo te sientes en el espacio. Tu opinión nos ayuda a ajustar lo que haga falta: internet, comodidad, ambiente, café…`,
    boton_texto: 'Contar mi experiencia', boton_url: urlOpinion(r, t.p.o, 'mitad'),
    pie: `Si algo necesita atención inmediata, escríbenos al WhatsApp ${C().whatsapp||''}.`
  };
  return {
    asunto: `Tu plan en AVS Working vence el ${corta(r.fechaFin)} · cuéntanos cómo te fue`,
    titulo: `${n?n+', ¿':'¿'}cómo calificas nuestro servicio?`,
    mensaje: `El plan mensual${r.empresa?' de '+r.empresa:''} (${r.recursoNom||'coworking'}) vence el ${larga(r.fechaFin)}. Antes de renovar, queremos conocer tu evaluación del servicio${ocupantesDe(r).length?' y de la experiencia de tu equipo':''}, para mejorar lo que haga falta.\n\nSi deseas renovar y conservar los mismos puestos, responde este correo o escríbenos al WhatsApp ${C().whatsapp||''}.`,
    boton_texto: 'Evaluar el servicio', boton_url: urlOpinion(r, null, 'renovacion'),
    pie: `Reserva ${r.consecutivo||''} · ${C().direccion||''}`
  };
}
const contenido = t => t.tipo==='lunes' ? textoLunes(t) : textoEncuesta(t);

let _emailjsIniciado=false;
function enviarCorreo(email, nombre, v){
  const tpl=cfg().templateId;
  if(!tpl) return Promise.reject(new Error('Falta el ID de plantilla de EmailJS'));
  if(!_emailjsIniciado){ emailjs.init({publicKey:C().emailjs.publicKey}); _emailjsIniciado=true; }
  return emailjs.send(C().emailjs.serviceId, tpl, {
    to_email:String(email).trim(), to_name:nombre||'',
    asunto:v.asunto, titulo:v.titulo, mensaje:html(v.mensaje),
    boton_texto:v.boton_texto, boton_url:v.boton_url, pie:v.pie
  });
}

// ── Envío con candado (transacción) para no duplicar ───────────────
async function enviarTarea(t, quien){
  const path=`coworking/reservas/${t.r.id}/correos/${t.clave}`;
  const ahora=Date.now();
  const res = await window._tx(window._ref(window._db,path), cur=>{
    if(cur && (cur.estado==='enviado' || cur.estado==='whatsapp')) return;           // ya se envió
    if(cur && cur.estado==='enviando' && ahora-(cur.ts||0) < 10*60*1000) return;     // otro equipo lo está enviando
    if(!quien && cur && cur.estado==='error' && (cur.intentos||0)>=MAX_INTENTOS) return;
    return {...(cur||{}), estado:'enviando', ts:ahora, para:t.p.email, tipo:t.tipo};
  });
  if(!res.committed) return false;
  const intentos=((res.snapshot.val()||{}).intentos||0)+1;
  try{
    await enviarCorreo(t.p.email, t.p.nombre, contenido(t));
    await window._upd(window._ref(window._db,path),{estado:'enviado', fecha:hoyISO(), ts:Date.now(), intentos, por:quien||'automático', error:null});
    return true;
  }catch(e){
    console.warn('Correo no enviado', t.clave, e);
    await window._upd(window._ref(window._db,path),{estado:'error', ts:Date.now(), intentos, error:String((e&&(e.text||e.message))||e).slice(0,200)});
    return false;
  }
}

// ── Revisión automática ─────────────────────────────────────────────
let _corriendo=false, _ultima=0;
async function revisar(forzar){
  if(_corriendo || !listo() || !usuario()) return;
  const c=cfg(); if(!c.templateId || (c.encuestas===false && c.motivacion===false)) return;
  if(!forzar && Date.now()-_ultima < 5*60*1000) return;
  _corriendo=true; _ultima=Date.now();
  const n={lunes:0, encuesta:0};
  try{
    for(const t of todas().filter(t=>['hoy','reintento'].includes(estado(t).k))){
      if(await enviarTarea(t)) n[t.tipo==='lunes'?'lunes':'encuesta']++;
    }
    const partes=[];
    if(n.lunes) partes.push(`${n.lunes} mensaje${n.lunes!==1?'s':''} del lunes`);
    if(n.encuesta) partes.push(`${n.encuesta} encuesta${n.encuesta!==1?'s':''}`);
    if(partes.length) toast('📧 Enviado: '+partes.join(' y '));
  }finally{ _corriendo=false; pintar(); }
}
window.cwCorreosRevisar = revisar;
// Revisa al cargar la configuración y luego cada minuto (la revisión real es cada 5 min)
setInterval(()=>revisar(false), 60*1000);

// ── Panel en la sección Coworking ───────────────────────────────────
const ETQ = {
  programada:['Programado','#5E7889','#EEF2F5'], hoy:['Por enviar','#854F0B','#FFF4DE'],
  enviada:['Enviado','#0B6E4F','#E3F5EC'], whatsapp:['Enviado por WhatsApp','#0B6E4F','#E3F5EC'],
  respondida:['Respondida','#185FA5','#E6F0FA'], reintento:['Falló, se reintenta','#854F0B','#FFF4DE'], error:['No se pudo enviar','#9B2525','#FBE9E9'],
  'sin-correo':['Sin correo','#9B2525','#FBE9E9'], vencida:['No se envió a tiempo','#5E7889','#EEF2F5']
};
const TIPO = { lunes:'☀️ Lunes', mitad:'📝 Encuesta mitad', renovacion:'🔁 Renovación' };
let _filtro='semana';

function pintar(){
  const el=document.getElementById('cwm-lista'); if(!el) return;
  const c=cfg(), hoy=hoyISO(), lunes=lunesDe(hoy);
  const chk=(id,v)=>{ const x=document.getElementById(id); if(x && document.activeElement!==x) x.checked=v; };
  const val=(id,v)=>{ const x=document.getElementById(id); if(x && document.activeElement!==x && !x.dataset.editando) x.value=v; };
  val('cwm-tpl', c.templateId||'');
  chk('cwm-enc', c.encuestas!==false); chk('cwm-mot', c.motivacion!==false);
  val('cwm-nota', notaSemana(lunes));
  const lbl=document.getElementById('cwm-nota-lbl'); if(lbl) lbl.textContent=`Aviso para la semana del ${corta(lunes)} (opcional)`;
  const est=document.getElementById('cwm-estado');
  if(est) est.innerHTML = !c.templateId ? '<span style="color:#9B2525">⚪ Inactivo: falta el ID de la plantilla</span>'
    : (c.encuestas===false && c.motivacion===false) ? '<span style="color:#9B2525">⚪ Inactivo: los dos envíos están apagados</span>'
    : '<span style="color:#0B6E4F">🟢 Activo</span>';
  const fr=document.getElementById('cwm-frase'); if(fr) fr.textContent=`“${frase(lunes)}”`;

  let lista=todas().map(t=>({t, e:estado(t)}));
  if(_filtro==='semana') lista=lista.filter(x=>x.t.tipo==='lunes');
  else lista=lista.filter(x=>x.t.tipo!=='lunes' && (x.e.k!=='vencida' || x.t.hasta>=sumar(hoy,-20)));
  const orden={hoy:0,reintento:1,'sin-correo':1,error:2,programada:3,enviada:4,whatsapp:4,respondida:5,vencida:6};
  lista.sort((a,b)=>(orden[a.e.k]-orden[b.e.k]) || a.t.desde.localeCompare(b.t.desde));
  document.querySelectorAll('#cwm-tabs button').forEach(b=>b.classList.toggle('btn-primary', b.dataset.f===_filtro));

  if(!lista.length){ el.innerHTML=`<div class="empty" style="padding:14px"><div class="empty-title">${_filtro==='semana'?'No hay puestos activos esta semana':'No hay encuestas programadas'}</div></div>`; return; }
  el.innerHTML=lista.map(({t,e})=>{
    const [txt,col,bg]=ETQ[e.k];
    const quien=t.p.nombre||'(sin nombre)';
    const cuando = e.m&&e.m.fecha ? 'el '+corta(e.m.fecha) : e.k==='programada' ? 'desde el '+corta(t.desde) : '';
    const btns=[];
    if(['hoy','error','reintento','programada'].includes(e.k) && correoOk(t.p.email))
      btns.push(`<button class="btn btn-sm" onclick="cwCorreoEnviarYa('${t.r.id}','${t.clave}')">📧 Enviar ya</button>`);
    if(['sin-correo','hoy','error','reintento'].includes(e.k) && t.p.telefono && t.tipo==='lunes')
      btns.push(`<button class="btn btn-sm" title="Abrir WhatsApp con el mensaje y marcarlo como enviado" onclick="cwCorreoWhatsApp('${t.r.id}','${t.clave}')">💬 WhatsApp</button>`);
    if(e.k==='respondida') btns.push(`<span style="font-size:12px">${'⭐'.repeat(e.op.general||0)}</span>`);
    return `<div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;align-items:center;border:1px solid var(--bdr);border-radius:8px;padding:8px 10px;margin-bottom:6px">
      <div style="min-width:0">
        <div style="font-size:12.5px"><b>${escH(quien)}</b> <span style="color:var(--muted)">· ${escH(t.r.empresa||t.r.consecutivo||'')}${t.p.puesto?' · '+escH(t.p.puesto):''}</span></div>
        <div style="font-size:11px;color:var(--muted)">${TIPO[t.tipo]} · ${correoOk(t.p.email)?escH(t.p.email):'<span style="color:#9B2525">sin correo registrado</span>'}${e.m&&e.m.error&&(e.k==='error'||e.k==='reintento')?' · '+escH(e.m.error):''}</div>
      </div>
      <div style="display:flex;gap:5px;align-items:center;flex-wrap:wrap">
        <span style="font-size:11px;font-weight:600;color:${col};background:${bg};border-radius:20px;padding:3px 9px;white-space:nowrap">${txt}${cuando?' '+cuando:''}</span>${btns.join('')}
      </div></div>`;
  }).join('');
}
window.cwCorreosPintar = pintar;
window.cwCorreosFiltro = f => { _filtro=f; pintar(); };

function buscar(rid, clave){ return todas().find(t=>t.r.id===rid && t.clave===clave); }
window.cwCorreoEnviarYa = async (rid, clave)=>{
  const t=buscar(rid,clave); if(!t) return;
  if(!cfg().templateId){ toast('Primero pega el ID de la plantilla y guarda','warn'); return; }
  const ok=await enviarTarea(t, usuario()?usuario().nombre:'manual');
  toast(ok?'📧 Correo enviado a '+t.p.email:'No se pudo enviar el correo', ok?'ok':'err'); pintar();
};
window.cwCorreoWhatsApp = async (rid, clave)=>{
  const t=buscar(rid,clave); if(!t||!t.p.telefono) return;
  const v=textoLunes(t);
  const txt=`*${v.titulo}*\n\n${v.mensaje}\n\n— AVS Working 💚`;
  window.open(`https://wa.me/${waNum(t.p.telefono)}?text=${encodeURIComponent(txt)}`,'_blank');
  await window._upd(window._ref(window._db,`coworking/reservas/${rid}/correos/${clave}`),{estado:'whatsapp', fecha:hoyISO(), ts:Date.now(), por:usuario()?usuario().nombre:''});
  pintar();
};

window.cwCorreosGuardar = async ()=>{
  const lunes=lunesDe(hoyISO());
  const datos={
    templateId:(document.getElementById('cwm-tpl').value||'').trim(),
    encuestas:document.getElementById('cwm-enc').checked,
    motivacion:document.getElementById('cwm-mot').checked,
    nota:(document.getElementById('cwm-nota').value||'').trim().slice(0,300), notaSemana:lunes
  };
  if(datos.templateId && !/^template_/.test(datos.templateId)){ toast('El ID de la plantilla empieza por template_','warn'); return; }
  document.querySelectorAll('#cwm-tpl,#cwm-nota').forEach(x=>delete x.dataset.editando);
  await window._set(window._ref(window._db,'coworking/config/correos'), datos);
  toast('✓ Configuración de correos guardada');
};

window.cwCorreosPrueba = async ()=>{
  const para=(document.getElementById('cwm-prueba').value||'').trim();
  if(!correoOk(para)){ toast('Escribe un correo válido para la prueba','warn'); return; }
  const tpl=(document.getElementById('cwm-tpl').value||'').trim();
  if(!tpl){ toast('Pega primero el ID de la plantilla','warn'); return; }
  const lunes=lunesDe(hoyISO());
  const r=reservas().find(x=>vigente(x)) || {id:'prueba', consecutivo:'CW-0000', nombre:'Cliente de prueba', recursoNom:'Piso 1 · Puesto 3', plan:'mes', fechaInicio:lunes, fechaFin:sumar(lunes,30), estado:'Confirmada'};
  const p={id:'prueba', nombre:usuario()?usuario().nombre:'Equipo AVS', email:para, puesto:r.recursoNom||'', o:null};
  const tipo=document.getElementById('cwm-prueba-tipo').value;
  const t={tipo, r, p, semana:lunes, clave:'prueba'};
  const ant=window.cwCorreosCfg; window.cwCorreosCfg={...(ant||{}), templateId:tpl};
  try{ await enviarCorreo(para, p.nombre, contenido(t)); toast('📧 Prueba enviada a '+para); }
  catch(e){ toast('No se pudo enviar la prueba: '+((e&&(e.text||e.message))||e),'err'); }
  finally{ window.cwCorreosCfg=ant; }
};

// Vista previa del mensaje del lunes (para revisar el texto antes de que salga)
window.cwCorreosVistaPrevia = ()=>{
  const lunes=lunesDe(hoyISO());
  const nota=document.getElementById('cwm-nota');
  const ant=window.cwCorreosCfg; window.cwCorreosCfg={...(ant||{}), nota:nota?nota.value:'', notaSemana:lunes};
  const r=reservas().find(x=>vigente(x) && (x.plan==='mes'||x.plan==='semana')) || {id:'x', nombre:'Ana Pérez', recursoNom:'Piso 1 · Puesto 3', plan:'mes', fechaInicio:lunes, fechaFin:sumar(lunes,30)};
  const p=personas(r)[0];
  const v=textoLunes({tipo:'lunes', r, p, semana:lunes});
  window.cwCorreosCfg=ant;
  const w=window.open('','_blank'); if(!w){ toast('Permite las ventanas emergentes para ver la vista previa','warn'); return; }
  w.document.write(`<title>Vista previa</title><body style="font-family:sans-serif;background:#EEF4F8;padding:20px"><div style="max-width:560px;margin:auto;background:#fff;border-radius:14px;padding:22px">
    <div style="font-size:12px;color:#5E7889">Asunto: <b>${esc(v.asunto)}</b> · Para: ${esc(p.nombre||'')}</div>
    <h2 style="color:#0A2A4A">${esc(v.titulo)}</h2><p style="line-height:1.55;color:#0D1B2A">${html(v.mensaje)}</p>
    <a style="display:inline-block;background:#5BA829;color:#fff;padding:12px 22px;border-radius:30px;text-decoration:none;font-weight:700">${esc(v.boton_texto)}</a>
    <p style="font-size:12px;color:#5E7889;margin-top:18px">${esc(v.pie)}</p></div></body>`);
  w.document.close();
};

// index.html llama esto cuando llega la configuración desde Firebase
window.cwCorreosConfig = datos => {
  window.cwCorreosCfg = datos || {};
  pintar(); setTimeout(()=>revisar(false), 3000);
};
})();
