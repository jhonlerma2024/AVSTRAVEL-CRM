// ═══════════════════════════════════════════════════════════════
//  AVS Working · Correos automáticos a los clientes del coworking
//
//  1) MENSAJE MOTIVADOR DEL LUNES (planes de mes y de semana)
//     • Solo motivación: una frase distinta cada semana del año (52),
//       sin ofrecer productos ni servicios. Aviso opcional de la semana.
//     • A cada puesto: a su ocupante con correo, o al cliente si la reserva
//       no tiene ocupantes. Sale lunes, martes o miércoles; después no.
//  2) ENCUESTAS (planes mensuales)
//     • Mitad del plan (día 12): encuesta de percepción a cada ocupante
//       (los trabajadores). No pregunta por precio.
//     • 5 días antes del vencimiento: al empresario (quien paga), con los
//       resultados de la encuesta de su equipo y su propia evaluación.
//
//  PARA NO INCOMODAR A NADIE
//     • Un correo se agrupa por destinatario: si la misma persona aparece
//       en varias reservas (p. ej. dos reservas de la misma empresa), le
//       llega UN solo correo de cada tipo y se marca en todas.
//     • Máximo UN correo al día por dirección. Si ya recibió uno hoy, el
//       siguiente sale otro día (prioridad: lunes, renovación, encuesta).
//     • Cada envío se marca en coworking/reservas/{id}/correos/{clave} con
//       una transacción, para que nunca se repita aunque el CRM esté
//       abierto en dos computadores.
//
//  Configuración: coworking/config/correos = { templateId, encuestas,
//  motivacion, nota, notaSemana }.  Usa del CRM: cwReservas, cwOpiniones,
//  currentUser, escH, toast, waNum, cwOcupantes, cwNombrePuesto y
//  window.VOUCHER_COWORK_CFG.
// ═══════════════════════════════════════════════════════════════
(function(){
const DIA_MITAD = 12;          // días después del inicio para la encuesta de mitad de plan
const DIAS_ANTES_FIN = 5;      // días antes del vencimiento para la de renovación
const VENTANA_ENCUESTA = 5;    // días que la encuesta sigue pendiente antes de darse por perdida
const DIAS_MOTIVACION = 3;     // lunes, martes y miércoles
const MAX_INTENTOS = 3;
const MIN_RESPUESTAS = 2;      // respuestas mínimas para mostrar resultados del equipo al empresario (privacidad)
const PRIORIDAD = { lunes:0, renovacion:1, mitad:2 };

// ── Frases del lunes: una por semana del año, no se repiten en 52 semanas ──
const FRASES = [
  'Que esta semana tenga más avances que pendientes.',
  'Lo grande se construye con días ordinarios bien trabajados.',
  'Empieza por la tarea que más te cuesta: el resto de la semana se siente más liviano.',
  'La constancia mueve montañas, como la marea mueve el mar. Feliz semana.',
  'Tu esfuerzo de hoy es la tranquilidad de mañana.',
  'Una semana nueva es una oportunidad nueva. Aprovéchala a tu manera.',
  'Haz una pausa, respira y sigue: el buen trabajo también necesita descanso.',
  'Rodéate de personas que suman y suma tú también.',
  'Las metas se cumplen paso a paso. Que este lunes sea el primero de una gran semana.',
  'El éxito es la suma de pequeños esfuerzos repetidos día tras día.',
  'No tienes que hacerlo todo hoy; solo tienes que empezar.',
  'La disciplina es elegir entre lo que quieres ahora y lo que más quieres.',
  'Cada día trae algo que aprender. Que esta semana te enseñe algo bueno.',
  'Hacer las cosas bien también es hacerlas con calma.',
  'Lo que hoy parece difícil, mañana será parte de tu experiencia.',
  'Confía en lo que sabes y atrévete con lo que aún no.',
  'Un buen comienzo es la mitad del camino. Feliz lunes.',
  'El talento abre puertas; la constancia las mantiene abiertas.',
  'Celebra los avances pequeños: también son avances.',
  'Organiza tu semana como organizas tu escritorio: lo importante, a la mano.',
  'Trabajar en equipo es llegar más lejos, aunque cada uno tenga su tarea.',
  'La mejor manera de predecir el futuro es construirlo cada día.',
  'Que tu energía de hoy contagie a quienes trabajan a tu lado.',
  'Equivocarse es parte del proceso; rendirse no tiene por qué serlo.',
  'Una sonrisa al empezar el día también es productividad.',
  'Enfócate en lo que puedes controlar y suelta lo demás.',
  'Cada lunes es una página en blanco. Escríbela con ganas.',
  'La paciencia y el trabajo bien hecho siempre encuentran su recompensa.',
  'Lo que haces con dedicación deja huella, aunque nadie lo vea de inmediato.',
  'Pide ayuda cuando la necesites: nadie construye solo.',
  'Pequeños hábitos, grandes resultados.',
  'Hoy es un buen día para terminar lo que empezaste.',
  'El orgullo de un trabajo bien hecho no tiene precio.',
  'Avanza aunque sea despacio; lo importante es no detenerse.',
  'Tu actitud define el ritmo de tu semana.',
  'Escucha más, aprende más, crece más.',
  'Las buenas ideas llegan a quien está trabajando.',
  'Que esta semana tengas claridad para decidir y energía para hacer.',
  'Agradece lo que ya lograste y ve por lo que sigue.',
  'Los retos de hoy son la fortaleza de mañana.',
  'Trabaja con propósito y descansa sin culpa.',
  'La calidad está en los detalles. Dales tiempo.',
  'Cree en tu proceso, incluso cuando los resultados tarden.',
  'Hoy puedes ser un poco mejor que ayer. Con eso basta.',
  'La motivación te pone en marcha; el hábito te mantiene en camino.',
  'Lo que siembras con trabajo, lo cosechas con orgullo.',
  'Una mente tranquila decide mejor. Empieza la semana en calma.',
  'Cumplir lo que prometes construye confianza, contigo y con los demás.',
  'Hay días para correr y días para pensar. Los dos cuentan.',
  'Que tu trabajo de esta semana te haga sentir orgulloso.',
  'Termina el año con la misma fuerza con la que empezaste.',
  'Gracias por cada semana compartida. Que la próxima sea aún mejor.'
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
const norm = t => String(t||'').trim().toLowerCase();
const esc = t => String(t??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const html = t => esc(t).replace(/\n/g,'<br>');
const dec = n => n.toFixed(1).replace('.',',');
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
const contacto = r => ({id:'cliente', nombre:r.nombre, email:r.email, telefono:r.telefono, puesto:r.recursoNom||'', o:null});

// Tareas sueltas (una por reserva y persona)
function sueltas(){
  const c=cfg(), lunes=lunesDe(hoyISO()), out=[];
  reservas().forEach(r=>{
    if(!vigente(r)) return;
    if(c.encuestas!==false && r.plan==='mes'){
      const dM=sumar(r.fechaInicio, DIA_MITAD);
      personas(r).forEach(p=>out.push({tipo:'mitad', r, p, clave:`mitad_${p.id}`, desde:dM, hasta:sumar(dM,VENTANA_ENCUESTA), ref:r.fechaInicio}));
      out.push({tipo:'renovacion', r, p:contacto(r), clave:'renovacion', desde:sumar(r.fechaFin,-DIAS_ANTES_FIN), hasta:r.fechaFin, ref:r.fechaFin});
    }
    if(c.motivacion!==false && (r.plan==='mes'||r.plan==='semana')){
      const hasta=sumar(lunes, DIAS_MOTIVACION);
      if(r.fechaInicio < hasta && ultimoDia(r) >= lunes)
        personas(r).forEach(p=>out.push({tipo:'lunes', r, p, clave:`lunes_${lunes}_${p.id}`, semana:lunes,
          desde:r.fechaInicio>lunes?r.fechaInicio:lunes, hasta, ref:lunes}));
    }
  });
  return out;
}

// Agrupa por destinatario: mismo correo + mismo tipo + mismo periodo = un solo correo
function todas(){
  const grupos=new Map();
  sueltas().forEach(t=>{
    const k = correoOk(t.p.email) ? `${t.tipo}|${norm(t.p.email)}|${t.ref}` : `${t.tipo}|${t.r.id}|${t.p.id}|${t.ref}`;
    let g=grupos.get(k);
    if(!g){ g={id:'g'+grupos.size, tipo:t.tipo, p:t.p, r:t.r, semana:t.semana, desde:t.desde, hasta:t.hasta, items:[]}; grupos.set(k,g); }
    g.items.push({r:t.r, clave:t.clave, p:t.p});
    if(t.desde<g.desde) g.desde=t.desde;
    if(t.hasta>g.hasta) g.hasta=t.hasta;
  });
  return [...grupos.values()].map(g=>{ g.items.sort((x,y)=>String(x.r.consecutivo||'').localeCompare(String(y.r.consecutivo||''))); g.r=g.items[0].r; g.id=`${g.tipo}:${g.items.map(i=>i.r.id+'/'+i.clave).join(',')}`; return g; });
}

function marcas(g){ return g.items.map(i=>((i.r.correos||{})[i.clave])||null); }
function marcaPrincipal(g){
  const ms=marcas(g);
  return ms.find(m=>m&&(m.estado==='enviado'||m.estado==='whatsapp')) || ms[0] || null;
}
function respondida(g){
  if(g.tipo==='lunes') return null;
  return opiniones().find(o=>o.etapa===g.tipo && g.items.some(i=>o.reservaId===i.r.id && (g.tipo==='renovacion' || !i.p.o || o.ocupanteId===i.p.id))) || null;
}
// Direcciones que ya recibieron un correo hoy (de cualquier tipo, en cualquier reserva)
function correosDeHoy(){
  const hoy=hoyISO(), s=new Set();
  reservas().forEach(r=>Object.values(r.correos||{}).forEach(m=>{
    if(!m || !m.para) return;
    const deHoy = m.fecha===hoy || (m.ts && new Date(m.ts).toLocaleDateString('en-CA')===hoy);
    if(deHoy && (m.estado==='enviado' || m.estado==='enviando')) s.add(norm(m.para));
  }));
  return s;
}
// k: programada | hoy | pospuesto | enviada | whatsapp | respondida | reintento | error | sin-correo | vencida
function estado(g, hoyUsados){
  const m=marcaPrincipal(g), hoy=hoyISO();
  const op=respondida(g); if(op) return {k:'respondida', op, m};
  if(m && m.estado==='enviado') return {k:'enviada', m};
  if(m && m.estado==='whatsapp') return {k:'whatsapp', m};
  if(hoy < g.desde) return {k:'programada'};
  if(hoy >= g.hasta) return {k:'vencida'};
  if(!correoOk(g.p.email)) return {k:'sin-correo'};
  if(m && m.estado==='error' && (m.intentos||0)>=MAX_INTENTOS) return {k:'error', m};
  if((hoyUsados||correosDeHoy()).has(norm(g.p.email))) return {k:'pospuesto', m};
  if(m && m.estado==='error') return {k:'reintento', m};
  return {k:'hoy', m};
}

// ── Contenido de cada correo ────────────────────────────────────────
function frase(lunes){
  const n=Math.round((new Date(lunes+'T12:00:00') - new Date('2026-01-05T12:00:00'))/604800000);
  return FRASES[((n % FRASES.length)+FRASES.length) % FRASES.length];
}
function notaSemana(lunes){ const c=cfg(); return c.nota && c.notaSemana===lunes ? String(c.nota).trim() : ''; }

function textoLunes(g){
  const n=primerNombre(g.p.nombre), nota=notaSemana(g.semana);
  let m = `${frase(g.semana)}\n\nTe deseamos una excelente semana de trabajo.`;
  if(nota) m += `\n\n📌 ${nota}`;
  return {
    asunto: `☀️ Tu frase de la semana${n?', '+n:''}`,
    titulo: `¡Feliz inicio de semana${n?', '+n:''}!`,
    mensaje: m,
    boton_texto: 'Estamos para ayudarte',
    boton_url: waLink('Hola AVS Working, '),
    pie: `Equipo AVS Working · ${C().direccion||''}`
  };
}

// Resultados de la encuesta de mitad de plan del equipo (solo promedios, sin nombres ni comentarios)
const ASP = [['internet','Internet'],['comodidad','Comodidad del puesto'],['ambiente','Ambiente y tranquilidad'],['limpieza','Limpieza'],['atencion','Atención del equipo'],['cafe','Café y agua']];
function resultadosEquipo(rs){
  const ids=new Set(rs.map(r=>r.id));
  const ops=opiniones().filter(o=>ids.has(o.reservaId) && o.etapa==='mitad');
  const total=rs.reduce((t,r)=>t+Math.max(ocupantesDe(r).length,1),0);
  if(!ops.length) return {n:0, total, texto:''};
  if(ops.length < MIN_RESPUESTAS) return {n:ops.length, total, texto:`Tu equipo empezó a responder la encuesta de experiencia (${ops.length} de ${total}). Para cuidar la privacidad de cada persona, compartimos los resultados desde ${MIN_RESPUESTAS} respuestas.`};
  const prom=a=>a.reduce((x,y)=>x+y,0)/a.length;
  const gen=prom(ops.map(o=>o.general||0));
  const filas=ASP.map(([k,t])=>{ const v=ops.map(o=>(o.aspectos||{})[k]).filter(Boolean); return v.length?{t,v:prom(v)}:null; }).filter(Boolean);
  const rec=ops.filter(o=>o.recomienda).length, recSi=ops.filter(o=>o.recomienda==='Sí, seguro').length;
  const conteo={}; ops.forEach(o=>(o.gusto||[]).forEach(x=>conteo[x]=(conteo[x]||0)+1));
  const top=Object.entries(conteo).sort((a,b)=>b[1]-a[1]).slice(0,3).map(x=>x[0]);
  const estrellas=v=>'★'.repeat(Math.round(v))+'☆'.repeat(5-Math.round(v));
  let t=`Resultados de la encuesta de tu equipo (${ops.length} de ${total} personas respondieron):\n`;
  t+=`• Experiencia general: ${estrellas(gen)} ${dec(gen)} de 5\n`;
  if(filas.length) t+=filas.map(f=>`• ${f.t}: ${dec(f.v)}`).join('\n')+'\n';
  if(rec) t+=`• ${recSi} de ${rec} recomendarían AVS Working a un colega\n`;
  if(top.length) t+=`• Lo que más valoran: ${top.join(', ')}\n`;
  const bajos=filas.filter(f=>f.v<4).sort((a,b)=>a.v-b.v);
  if(bajos.length) t+=`\nVamos a trabajar en mejorar: ${bajos.slice(0,2).map(f=>f.t.toLowerCase()).join(' y ')}.`;
  return {n:ops.length, total, texto:t.trim()};
}

function textoEncuesta(g){
  const r=g.r, n=primerNombre(g.p.nombre);
  if(g.tipo==='mitad') return {
    asunto: `${n?n+', ¿':'¿'}cómo te sientes en AVS Working?`,
    titulo: `¿Cómo va tu experiencia${n?', '+n:''}?`,
    mensaje: `Ya llevas unos días trabajando en AVS Working${g.p.puesto?' ('+g.p.puesto+')':''} y queremos saber cómo te sientes en el espacio: internet, comodidad, ambiente, limpieza y atención. Tu opinión nos ayuda a mejorar y es anónima frente a tu empresa.`,
    boton_texto: 'Contar mi experiencia', boton_url: urlOpinion(r, g.p.o, 'mitad'),
    pie: `Si algo necesita atención inmediata, escríbenos al WhatsApp ${C().whatsapp||''}.`
  };
  // Renovación: puede cubrir varias reservas del mismo empresario
  const rs=g.items.map(i=>i.r);
  const espacios=rs.map(x=>x.recursoNom||x.consecutivo||'').filter(Boolean).join(', ');
  const res=resultadosEquipo(rs);
  let m = `El plan mensual${r.empresa?' de '+r.empresa:''} (${espacios||'coworking'}) vence el ${larga(r.fechaFin)}.`;
  if(res.texto) m += `\n\n${res.texto}`;
  m += `\n\nAntes de renovar, queremos conocer también tu evaluación del servicio. Toma menos de 1 minuto.\n\nSi deseas renovar y conservar los mismos puestos, responde este correo o escríbenos al WhatsApp ${C().whatsapp||''}.`;
  return {
    asunto: `Resultados de tu equipo y renovación · AVS Working`,
    titulo: `${n?n+', así':'Así'} le fue a tu equipo en AVS Working`,
    mensaje: m,
    boton_texto: 'Evaluar el servicio', boton_url: urlOpinion(r, null, 'renovacion'),
    pie: `Reserva${rs.length>1?'s':''} ${rs.map(x=>x.consecutivo||'').filter(Boolean).join(', ')} · ${C().direccion||''}`
  };
}
const contenido = g => g.tipo==='lunes' ? textoLunes(g) : textoEncuesta(g);

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
// El candado va en la primera reserva del grupo; al enviar se marca en todas.
async function enviarGrupo(g, quien){
  const ruta=i=>`coworking/reservas/${i.r.id}/correos/${i.clave}`;
  if(marcas(g).some(m=>m&&(m.estado==='enviado'||m.estado==='whatsapp'))) return false;
  const path=ruta(g.items[0]), ahora=Date.now();
  const res = await window._tx(window._ref(window._db,path), cur=>{
    if(cur && (cur.estado==='enviado' || cur.estado==='whatsapp')) return;
    if(cur && cur.estado==='enviando' && ahora-(cur.ts||0) < 10*60*1000) return;
    if(!quien && cur && cur.estado==='error' && (cur.intentos||0)>=MAX_INTENTOS) return;
    return {...(cur||{}), estado:'enviando', ts:ahora, para:g.p.email, tipo:g.tipo};
  });
  if(!res.committed) return false;
  const intentos=((res.snapshot.val()||{}).intentos||0)+1;
  try{
    await enviarCorreo(g.p.email, g.p.nombre, contenido(g));
    const up={}, fecha=hoyISO(), ts=Date.now();
    g.items.forEach(i=>{ up[ruta(i)]={estado:'enviado', para:g.p.email, tipo:g.tipo, fecha, ts, intentos, por:quien||'automático', ...(g.items.length>1?{agrupado:g.items.length}:{})}; });
    await window._upd(window._ref(window._db), up);
    return true;
  }catch(e){
    console.warn('Correo no enviado', g.id, e);
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
    const usados=correosDeHoy();
    const pend=todas().filter(g=>['hoy','reintento'].includes(estado(g,usados).k))
      .sort((a,b)=>PRIORIDAD[a.tipo]-PRIORIDAD[b.tipo] || a.hasta.localeCompare(b.hasta));
    for(const g of pend){
      const k=norm(g.p.email);
      if(usados.has(k)) continue;                    // ya recibió un correo hoy: sale otro día
      usados.add(k);
      if(await enviarGrupo(g)) n[g.tipo==='lunes'?'lunes':'encuesta']++;
    }
    const partes=[];
    if(n.lunes) partes.push(`${n.lunes} mensaje${n.lunes!==1?'s':''} del lunes`);
    if(n.encuesta) partes.push(`${n.encuesta} encuesta${n.encuesta!==1?'s':''}`);
    if(partes.length) toast('📧 Enviado: '+partes.join(' y '));
  }finally{ _corriendo=false; pintar(); }
}
window.cwCorreosRevisar = revisar;
setInterval(()=>revisar(false), 60*1000);

// ── Panel en la sección Coworking ───────────────────────────────────
const ETQ = {
  programada:['Programado','#5E7889','#EEF2F5'], hoy:['Por enviar','#854F0B','#FFF4DE'],
  pospuesto:['Ya recibió un correo hoy · sale otro día','#5E7889','#EEF2F5'],
  enviada:['Enviado','#0B6E4F','#E3F5EC'], whatsapp:['Enviado por WhatsApp','#0B6E4F','#E3F5EC'],
  respondida:['Respondida','#185FA5','#E6F0FA'], reintento:['Falló, se reintenta','#854F0B','#FFF4DE'], error:['No se pudo enviar','#9B2525','#FBE9E9'],
  'sin-correo':['Sin correo','#9B2525','#FBE9E9'], vencida:['No se envió a tiempo','#5E7889','#EEF2F5']
};
const TIPO = { lunes:'☀️ Lunes', mitad:'📝 Encuesta del equipo', renovacion:'🔁 Renovación + resultados' };
let _filtro='semana';
let _grupos=[];

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

  _grupos=todas();
  const usados=correosDeHoy();
  let lista=_grupos.map(g=>({g, e:estado(g,usados)}));
  if(_filtro==='semana') lista=lista.filter(x=>x.g.tipo==='lunes');
  else lista=lista.filter(x=>x.g.tipo!=='lunes' && (x.e.k!=='vencida' || x.g.hasta>=sumar(hoy,-20)));
  const orden={hoy:0,reintento:1,pospuesto:1,'sin-correo':2,error:2,programada:3,enviada:4,whatsapp:4,respondida:5,vencida:6};
  lista.sort((a,b)=>(orden[a.e.k]-orden[b.e.k]) || a.g.desde.localeCompare(b.g.desde));
  document.querySelectorAll('#cwm-tabs button').forEach(b=>b.classList.toggle('btn-primary', b.dataset.f===_filtro));

  if(!lista.length){ el.innerHTML=`<div class="empty" style="padding:14px"><div class="empty-title">${_filtro==='semana'?'No hay puestos activos esta semana':'No hay encuestas programadas'}</div></div>`; return; }
  el.innerHTML=lista.map(({g,e})=>{
    const [txt,col,bg]=ETQ[e.k];
    const idx=_grupos.indexOf(g);
    const empresa=[...new Set(g.items.map(i=>i.r.empresa||i.r.consecutivo||''))].join(', ');
    const cuando = e.m&&e.m.fecha&&(e.k==='enviada'||e.k==='whatsapp') ? 'el '+corta(e.m.fecha) : e.k==='programada' ? 'desde el '+corta(g.desde) : '';
    const btns=[];
    if(['hoy','error','reintento','programada','pospuesto'].includes(e.k) && correoOk(g.p.email))
      btns.push(`<button class="btn btn-sm" onclick="cwCorreoEnviarYa(${idx})">📧 Enviar ya</button>`);
    if(['sin-correo','hoy','error','reintento','pospuesto'].includes(e.k) && g.p.telefono && g.tipo==='lunes')
      btns.push(`<button class="btn btn-sm" title="Abrir WhatsApp con el mensaje y marcarlo como enviado" onclick="cwCorreoWhatsApp(${idx})">💬 WhatsApp</button>`);
    if(g.tipo==='renovacion') btns.push(`<button class="btn btn-sm" title="Ver el correo con los resultados del equipo" onclick="cwCorreoVer(${idx})">👁</button>`);
    if(e.k==='respondida') btns.push(`<span style="font-size:12px">${'⭐'.repeat(e.op.general||0)}</span>`);
    return `<div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;align-items:center;border:1px solid var(--bdr);border-radius:8px;padding:8px 10px;margin-bottom:6px">
      <div style="min-width:0">
        <div style="font-size:12.5px"><b>${escH(g.p.nombre||'(sin nombre)')}</b> <span style="color:var(--muted)">· ${escH(empresa)}${g.p.puesto&&g.tipo!=='renovacion'?' · '+escH(g.p.puesto):''}</span></div>
        <div style="font-size:11px;color:var(--muted)">${TIPO[g.tipo]} · ${correoOk(g.p.email)?escH(g.p.email):'<span style="color:#9B2525">sin correo registrado</span>'}${g.items.length>1?` · <b>1 solo correo por ${g.items.length} reservas</b>`:''}${e.m&&e.m.error&&(e.k==='error'||e.k==='reintento')?' · '+escH(e.m.error):''}</div>
      </div>
      <div style="display:flex;gap:5px;align-items:center;flex-wrap:wrap">
        <span style="font-size:11px;font-weight:600;color:${col};background:${bg};border-radius:20px;padding:3px 9px;white-space:nowrap">${txt}${cuando?' '+cuando:''}</span>${btns.join('')}
      </div></div>`;
  }).join('');
}
window.cwCorreosPintar = pintar;
window.cwCorreosFiltro = f => { _filtro=f; pintar(); };

window.cwCorreoEnviarYa = async idx=>{
  const g=_grupos[idx]; if(!g) return;
  if(!cfg().templateId){ toast('Primero pega el ID de la plantilla y guarda','warn'); return; }
  if(correosDeHoy().has(norm(g.p.email)) && !confirm(`${g.p.nombre||g.p.email} ya recibió un correo de AVS Working hoy. ¿Enviar este también?`)) return;
  const ok=await enviarGrupo(g, usuario()?usuario().nombre:'manual');
  toast(ok?'📧 Correo enviado a '+g.p.email:'No se pudo enviar (o ya se había enviado)', ok?'ok':'err'); pintar();
};
window.cwCorreoWhatsApp = async idx=>{
  const g=_grupos[idx]; if(!g||!g.p.telefono) return;
  const v=textoLunes(g);
  const txt=`*${v.titulo}*\n\n${v.mensaje}\n\n— Equipo AVS Working 💚`;
  window.open(`https://wa.me/${waNum(g.p.telefono)}?text=${encodeURIComponent(txt)}`,'_blank');
  const up={}, fecha=hoyISO(), ts=Date.now(), por=usuario()?usuario().nombre:'';
  g.items.forEach(i=>{ up[`coworking/reservas/${i.r.id}/correos/${i.clave}`]={estado:'whatsapp', fecha, ts, por, tipo:g.tipo}; });
  await window._upd(window._ref(window._db), up);
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

// Grupo de ejemplo para la prueba y la vista previa (usa una reserva real si hay)
function ejemplo(tipo, email, nombre){
  const lunes=lunesDe(hoyISO());
  const r=reservas().find(x=>vigente(x) && (tipo==='lunes' ? (x.plan==='mes'||x.plan==='semana') : x.plan==='mes'))
       || {id:'prueba', consecutivo:'AVW-0000', nombre:'Cliente de prueba', empresa:'Empresa de prueba', recursoNom:'Piso 1 · Puesto 3', plan:'mes', fechaInicio:lunes, fechaFin:sumar(lunes,30), estado:'Confirmada'};
  const base = tipo==='renovacion' ? contacto(r) : personas(r)[0];
  const p={...base, email:email||base.email, nombre:nombre||base.nombre};
  return {tipo, r, p, semana:lunes, items:[{r, clave:'prueba', p}]};
}
window.cwCorreosPrueba = async ()=>{
  const para=(document.getElementById('cwm-prueba').value||'').trim();
  if(!correoOk(para)){ toast('Escribe un correo válido para la prueba','warn'); return; }
  const tpl=(document.getElementById('cwm-tpl').value||'').trim();
  if(!tpl){ toast('Pega primero el ID de la plantilla','warn'); return; }
  const g=ejemplo(document.getElementById('cwm-prueba-tipo').value, para, usuario()?usuario().nombre:'Equipo AVS');
  const ant=window.cwCorreosCfg; window.cwCorreosCfg={...(ant||{}), templateId:tpl};
  try{ await enviarCorreo(para, g.p.nombre, contenido(g)); toast('📧 Prueba enviada a '+para); }
  catch(e){ toast('No se pudo enviar la prueba: '+((e&&(e.text||e.message))||e),'err'); }
  finally{ window.cwCorreosCfg=ant; }
};

function abrirVista(g){
  const v=contenido(g);
  const w=window.open('','_blank'); if(!w){ toast('Permite las ventanas emergentes para ver la vista previa','warn'); return; }
  w.document.write(`<title>Vista previa</title><body style="font-family:sans-serif;background:#EEF4F8;padding:20px"><div style="max-width:560px;margin:auto;background:#fff;border-radius:14px;padding:22px">
    <div style="font-size:12px;color:#5E7889">Asunto: <b>${esc(v.asunto)}</b> · Para: ${esc(g.p.nombre||'')} ${g.p.email?'&lt;'+esc(g.p.email)+'&gt;':''}</div>
    <h2 style="color:#0A2A4A">${esc(v.titulo)}</h2><p style="line-height:1.55;color:#0D1B2A">${html(v.mensaje)}</p>
    <a style="display:inline-block;background:#5BA829;color:#fff;padding:12px 22px;border-radius:30px;text-decoration:none;font-weight:700">${esc(v.boton_texto)}</a>
    <p style="font-size:12px;color:#5E7889;margin-top:18px">${esc(v.pie)}</p></div></body>`);
  w.document.close();
}
window.cwCorreoVer = idx => { const g=_grupos[idx]; if(g) abrirVista(g); };
window.cwCorreosVistaPrevia = ()=>{
  const nota=document.getElementById('cwm-nota');
  const ant=window.cwCorreosCfg; window.cwCorreosCfg={...(ant||{}), nota:nota?nota.value:'', notaSemana:lunesDe(hoyISO())};
  try{ abrirVista(ejemplo(document.getElementById('cwm-prueba-tipo').value)); } finally{ window.cwCorreosCfg=ant; }
};

window.cwCorreosConfig = datos => {
  window.cwCorreosCfg = datos || {};
  pintar(); setTimeout(()=>revisar(false), 3000);
};
})();
