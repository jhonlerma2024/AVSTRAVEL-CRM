// ═══════════════════════════════════════════════════════════════
//  AVS Working · Lista de espera (CRM)
//  Las personas se inscriben desde coworking.html (pestaña ⏳ Lista de espera)
//  y quedan en  coworking/espera/{id}.
//  Aquí se ven en orden de llegada, se cambia su estado, se les escribe
//  por WhatsApp cuando se libera un puesto, y se ven los puestos que
//  pronto podrían liberarse (planes que vencen en los próximos 15 días).
//  Interruptor "Estamos completos" → coworking/config/espera/completo
//    true  = la página siempre muestra el aviso de completos
//    false = nunca lo muestra
//    sin valor (automático) = lo muestra si hoy no queda ningún puesto libre
//  Usa del CRM: cwReservas, escH, waNum, toast, toXLS, currentUser.
// ═══════════════════════════════════════════════════════════════
(function(){
const ESTADOS = ['En espera','Contactado','Reservó','Descartado'];
const COL = { 'En espera':['#854F0B','#FFF4DE'], 'Contactado':['#185FA5','#E6F0FA'], 'Reservó':['#0B6E4F','#E3F5EC'], 'Descartado':['#5E7889','#EEF2F5'] };
let _filtro = 'activos';
window.cwEspera = window.cwEspera || [];
window.cwEsperaCfg = window.cwEsperaCfg || {};

const hoyISO = () => new Date().toLocaleDateString('en-CA');
const sumar = (iso,n) => { const [y,m,d]=iso.split('-').map(Number); return new Date(y,m-1,d+n).toLocaleDateString('en-CA'); };
const corta = iso => { if(!iso) return ''; const [y,m,d]=iso.split('-').map(Number); return new Date(y,m-1,d).toLocaleDateString('es-CO',{day:'numeric',month:'short'}); };
const dias = ts => Math.max(0, Math.floor((Date.now()-(ts||Date.now()))/86400000));
const nombre1 = t => { const p=String(t||'').trim().split(/\s+/)[0]||''; return p ? p[0].toUpperCase()+p.slice(1).toLowerCase() : ''; };
const reservas = () => (typeof cwReservas!=='undefined' ? cwReservas : window.cwReservas) || [];
const upd = (id, datos) => window._upd(window._ref(window._db,'coworking/espera/'+id), datos);

function lista(){ return [...window.cwEspera].sort((a,b)=>(a.ts||0)-(b.ts||0)); }
function activos(){ return lista().filter(e=>e.estado==='En espera' || e.estado==='Contactado'); }
window.cwEsperaNuevos = () => window.cwEspera.filter(e=>!e.leida).length;

// Planes confirmados que vencen en los próximos 15 días: puestos que podrían liberarse
function porLiberarse(){
  const hoy=hoyISO(), lim=sumar(hoy,15);
  return reservas().filter(r=>r.estado==='Confirmada' && r.fechaFin && r.fechaFin>=hoy && r.fechaFin<=lim && (r.plan==='mes'||r.plan==='semana'))
    .sort((a,b)=>a.fechaFin.localeCompare(b.fechaFin));
}

function pintar(){
  const el=document.getElementById('cwe-lista'); if(!el) return;
  const act=activos();
  const cfg=window.cwEsperaCfg||{};
  const modo = cfg.completo===true ? 'si' : cfg.completo===false ? 'no' : 'auto';
  const sel=document.getElementById('cwe-completo'); if(sel && document.activeElement!==sel) sel.value=modo;
  const res=document.getElementById('cwe-resumen');
  if(res) res.textContent = act.length ? `${act.length} persona${act.length!==1?'s':''} esperando` : '';

  // Puestos que pronto podrían liberarse
  const lib=porLiberarse();
  const pl=document.getElementById('cwe-liberan');
  if(pl) pl.innerHTML = lib.length
    ? `<div style="font-size:12px;font-weight:700;color:#185FA5;margin-bottom:5px">🔓 Planes que vencen en los próximos 15 días (si no renuevan, hay cupo)</div>`+
      lib.map(r=>`<div style="font-size:12px;padding:3px 0">• <b>${escH(r.empresa||r.nombre||'')}</b> · ${escH(r.recursoNom||'')} · vence el ${corta(r.fechaFin)}</div>`).join('')
    : '';

  document.querySelectorAll('#cwe-tabs button').forEach(b=>b.classList.toggle('btn-primary', b.dataset.f===_filtro));
  const items = _filtro==='activos' ? act : lista().filter(e=>e.estado==='Reservó'||e.estado==='Descartado');
  if(!items.length){ el.innerHTML=`<div class="empty" style="padding:14px"><div class="empty-title">${_filtro==='activos'?'Nadie en lista de espera':'Sin registros cerrados'}</div></div>`; return; }

  el.innerHTML = items.map(e=>{
    const pos = _filtro==='activos' ? act.indexOf(e)+1 : '';
    const [c,bg]=COL[e.estado]||COL['En espera'];
    const espera = dias(e.ts);
    return `<div style="border:1px solid var(--bdr);border-radius:8px;padding:9px 10px;margin-bottom:6px;${e.leida?'':'border-left:3px solid var(--amber)'}">
      <div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;align-items:flex-start">
        <div style="min-width:0;display:flex;gap:9px;align-items:flex-start">
          ${pos?`<div style="min-width:26px;height:26px;border-radius:50%;background:var(--navy,#0A2A4A);color:#fff;display:grid;place-items:center;font-size:12px;font-weight:700">${pos}</div>`:''}
          <div style="min-width:0">
            <div style="font-size:13px"><b>${escH(e.nombre||'')}</b>${e.empresa?` <span style="color:var(--muted)">· ${escH(e.empresa)}</span>`:''}</div>
            <div style="font-size:11.5px;color:var(--muted)">${escH(e.puestos||'')} · plan ${escH(e.plan||'')}${e.desde?' · desde el '+corta(e.desde):' · lo antes posible'} · esperando ${espera} día${espera!==1?'s':''}</div>
            <div style="font-size:11px;color:var(--muted);word-break:break-all">${e.telefono?escH(e.telefono):''}${e.email?' · '+escH(e.email):''}</div>
            ${e.notas?`<div style="font-size:12px;font-style:italic;margin-top:3px">“${escH(e.notas)}”</div>`:''}
            ${e.contactado?`<div style="font-size:10.5px;color:#185FA5;margin-top:2px">Contactado el ${escH(e.contactado)}${e.contactadoPor?' por '+escH(e.contactadoPor):''}</div>`:''}
          </div>
        </div>
        <div style="display:flex;gap:5px;align-items:center;flex-wrap:wrap">
          <select class="fs" style="font-size:11.5px;padding:4px 6px;color:${c};background:${bg};border-color:${bg};font-weight:600" onchange="cwEsperaEstado('${e.id}',this.value)">
            ${ESTADOS.map(x=>`<option ${x===e.estado?'selected':''}>${x}</option>`).join('')}</select>
          ${e.telefono?`<button class="btn btn-sm" title="Avisar que se liberó un puesto" onclick="cwEsperaAvisar('${e.id}')">💬 Avisar cupo</button>`:''}
          ${!e.leida?`<button class="btn btn-sm" onclick="cwEsperaLeida('${e.id}')">✓</button>`:''}
          <button class="btn btn-sm" title="Quitar de la lista" onclick="cwEsperaQuitar('${e.id}')">🗑</button>
        </div>
      </div></div>`;
  }).join('');
}
window.cwEsperaPintar = pintar;
window.cwEsperaFiltro = f => { _filtro=f; pintar(); };

window.cwEsperaEstado = (id, estado) => {
  const datos={estado, leida:true};
  if(estado==='Contactado'){ datos.contactado=new Date().toLocaleDateString('es-CO'); datos.contactadoPor=currentUser?currentUser.nombre:''; }
  upd(id,datos).then(()=>toast('✓ '+estado)).catch(e=>toast('No se pudo actualizar: '+e.message,'err'));
};
window.cwEsperaLeida = id => upd(id,{leida:true});
window.cwEsperaQuitar = id => {
  const e=window.cwEspera.find(x=>x.id===id); if(!e) return;
  if(!confirm(`¿Quitar a ${e.nombre} de la lista de espera?`)) return;
  window._remove(window._ref(window._db,'coworking/espera/'+id)).then(()=>toast('Quitado de la lista'));
};
window.cwEsperaAvisar = id => {
  const e=window.cwEspera.find(x=>x.id===id); if(!e) return;
  const n=nombre1(e.nombre);
  const txt=`¡Hola${n?' '+n:''}! 👋 Te escribimos de *AVS Working*. Estabas en nuestra lista de espera (${e.puestos}, plan ${e.plan}) y *se liberó un cupo*. 🎉\n\nSi aún te interesa, respóndenos este mensaje y te lo separamos. Lo guardamos por 48 horas; después pasa a la siguiente persona de la lista.\n\nTambién puedes reservar aquí: https://jhonlerma2024.github.io/AVSTRAVEL-CRM/coworking.html`;
  window.open(`https://wa.me/${waNum(e.telefono)}?text=${encodeURIComponent(txt)}`,'_blank');
  if(e.estado==='En espera') cwEsperaEstado(id,'Contactado');
};
window.cwEsperaCompleto = v => {
  const val = v==='si' ? true : v==='no' ? false : null;
  window._set(window._ref(window._db,'coworking/config/espera/completo'), val)
    .then(()=>toast(v==='si'?'La página muestra "Estamos completos"':v==='no'?'Aviso de completos apagado':'Aviso automático (si no hay puestos libres)'))
    .catch(e=>{ console.error(e); toast(String(e&&e.message).includes('PERMISSION_DENIED')?'Firebase no deja guardar: falta permiso para coworking/config/espera':'No se pudo guardar: '+((e&&e.message)||e),'err'); pintar(); });
};
window.cwEsperaCopiarEnlace = () => {
  const url='https://jhonlerma2024.github.io/AVSTRAVEL-CRM/coworking.html#espera';
  (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject()).then(()=>toast('📋 Enlace copiado')).catch(()=>prompt('Copia el enlace:',url));
};
window.cwEsperaExportar = () => toXLS(lista().map((e,i)=>({'#':i+1,'Fecha':e.fecha||'','Nombre':e.nombre||'','Empresa':e.empresa||'','WhatsApp':e.telefono||'','Correo':e.email||'',
  'Puestos':e.puestos||'','Plan':e.plan||'','Desde':e.desde||'Lo antes posible','Notas':e.notas||'','Estado':e.estado||'','Contactado':e.contactado||''})),'Lista_espera_AVS_Working');
})();
