// ═══════════════════════════════════════════════════════════════
//  AVS Working · Ocupantes de una reserva
//  Cuando una empresa reserva varios puestos (ej. la oficina completa),
//  la empresa sigue siendo la clienta y sus trabajadores quedan como
//  ocupantes de la reserva, cada uno con su puesto y su bienvenida.
//  Se guardan en  coworking/reservas/{id}/ocupantes/{ocupanteId}
//  Usa funciones del CRM (index.html): cwReservas, escH, waNum, toast,
//  openM, closeM, toXLS, cwTarjeta, currentUser.
// ═══════════════════════════════════════════════════════════════
(function(){
let _ocRes = null;   // id de la reserva abierta en el modal

const NOMBRE_PUESTO = {P1:'Piso 1 · Puesto 1',P2:'Piso 1 · Puesto 2',P3:'Piso 1 · Puesto 3',P4:'Piso 1 · Puesto 4',
  O1:'Oficina · Puesto 1',O2:'Oficina · Puesto 2',O3:'Oficina · Puesto 3',O4:'Oficina · Puesto 4',O5:'Oficina · Puesto 5',O6:'Oficina · Puesto 6',
  GER:'Oficina · Gerencia',SALA:'Sala de juntas'};
const nombrePuesto = k => NOMBRE_PUESTO[k] || k || '';

function reserva(id){ return (window.cwReservas||cwReservas).find(x=>x.id===id); }
function listaOcupantes(r){
  return Object.entries((r&&r.ocupantes)||{}).map(([id,o])=>({id,...o}))
    .sort((a,b)=>(a.orden||0)-(b.orden||0) || String(a.nombre).localeCompare(String(b.nombre)));
}
window.cwOcupantes = listaOcupantes;
window.cwNombrePuesto = nombrePuesto;

// Nombre bonito: "MIRIAM GONZALEZ caicedo" → "Miriam Gonzalez Caicedo"
function capitalizar(t){
  return String(t||'').trim().replace(/\s+/g,' ').toLowerCase()
    .replace(/(^|[\s'-])(\p{L})/gu,(m,a,b)=>a+b.toUpperCase());
}
function soloDigitos(t){ return String(t||'').replace(/\D/g,''); }
function telValido(t){ const d=soloDigitos(t); return d.length===10 || (d.length===12 && d.startsWith('57')); }
function correoValido(t){ return !t || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t); }

// Lee una lista pegada (de WhatsApp, Excel o correo). Una persona por línea.
// Acepta "Nombre - celular - correo" en cualquier orden y con cualquier separador.
function leerLista(txt){
  const out=[];
  String(txt||'').split(/\r?\n/).forEach(linea=>{
    let l=linea.trim(); if(!l) return;
    const mail=(l.match(/[^\s,;|<>()]+@[^\s,;|<>()]+\.[a-z]{2,}(\.[a-z]{2,})?/i)||[''])[0];
    if(mail) l=l.replace(mail,' ');
    // celular: 10 dígitos, con espacios/guiones/puntos entre grupos, con o sin +57
    const mt=l.match(/(\+?57[\s.-]?)?3\d{2}[\s.-]?\d{3}[\s.-]?\d{4}|(\+?57[\s.-]?)?\b\d[\d\s.-]{6,}\d\b/);
    let tel='';
    if(mt){ tel=soloDigitos(mt[0]); if(tel.length>10&&tel.startsWith('57')) tel=tel.slice(2); l=l.replace(mt[0],' '); }
    const nombre=capitalizar(l.replace(/[\t|;,:–—\-]+/g,' ').replace(/\s+/g,' '));
    if(!nombre && !tel && !mail) return;
    out.push({nombre, telefono:tel, email:mail.toLowerCase()});
  });
  return out;
}
window.cwLeerListaOcupantes = leerLista;

// ── Modal ───────────────────────────────────────────────────────
window.cwAbrirOcupantes=function(id){
  const r=reserva(id); if(!r) return;
  _ocRes=id;
  document.getElementById('oc-titulo').textContent=`👥 Ocupantes · ${r.empresa||r.nombre||''}`;
  document.getElementById('oc-info').innerHTML=`<b>${escH(r.consecutivo||'')}</b> · ${escH(r.recursoNom||'')} · ${escH(r.planNom||r.plan||'')}<br>
    Clienta / quien paga: <b>${escH(r.nombre||'')}</b>${r.empresa?' ('+escH(r.empresa)+')':''}`;
  document.getElementById('oc-pegar').value='';
  document.getElementById('oc-prev').innerHTML='';
  pintar();
  openM('m-ocupantes');
};
function opcionesPuesto(r,actual){
  const recs=(r.recursos||[r.recurso]).filter(Boolean).filter(x=>x!=='SALA');
  return `<option value="">Sin asignar</option>`+recs.map(k=>`<option value="${k}" ${k===actual?'selected':''}>${escH(nombrePuesto(k))}</option>`).join('');
}
function pintar(){
  const r=reserva(_ocRes); if(!r) return;
  const oc=listaOcupantes(r);
  const usados={}; oc.forEach(o=>{ if(o.puesto) usados[o.puesto]=(usados[o.puesto]||0)+1; });
  const pend=oc.filter(o=>!o.bienvenida).length;
  document.getElementById('oc-resumen').innerHTML = oc.length
    ? `${oc.length} persona${oc.length!==1?'s':''} · ${oc.length-pend} con bienvenida enviada${pend?` · <b style="color:#854F0B">${pend} pendiente${pend!==1?'s':''}</b>`:' ✅'}`
    : 'Aún no hay ocupantes. Pega la lista que envió la empresa aquí abajo.';
  document.getElementById('oc-sig').style.display = pend ? '' : 'none';
  document.getElementById('oc-lista').innerHTML = oc.map(o=>{
    const avisos=[];
    if(o.telefono && !telValido(o.telefono)) avisos.push('celular incompleto');
    if(!o.telefono) avisos.push('sin celular');
    if(o.email && !correoValido(o.email)) avisos.push('correo con error');
    if(o.puesto && usados[o.puesto]>1) avisos.push('puesto repetido');
    return `<div style="border:1px solid var(--bdr);border-radius:var(--rs);padding:9px 10px;margin-bottom:7px;${o.bienvenida?'':'border-left:3px solid var(--amber)'}">
      <div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;align-items:flex-start">
        <div style="min-width:0">
          <div style="font-weight:700;font-size:13px">${escH(o.nombre||'(sin nombre)')}</div>
          <div style="font-size:11px;color:var(--muted);word-break:break-all">${o.telefono?`<a href="https://wa.me/${waNum(o.telefono)}" target="_blank">${escH(o.telefono)}</a>`:''}${o.email?` · ${escH(o.email)}`:''}</div>
          ${avisos.length?`<div style="font-size:10.5px;color:#9B2525;margin-top:2px">⚠️ ${avisos.join(' · ')}</div>`:''}
          <div style="font-size:10.5px;color:${o.bienvenida?'#0B6E4F':'#854F0B'};margin-top:2px">${o.bienvenida?'✓ Bienvenida enviada '+escH(o.bienvenida):'Bienvenida pendiente'}</div>
        </div>
        <div style="display:flex;gap:5px;align-items:center;flex-wrap:wrap">
          <select class="fs" style="font-size:11.5px;padding:4px 6px" onchange="cwOcPuesto('${o.id}',this.value)">${opcionesPuesto(r,o.puesto)}</select>
          ${o.telefono?`<button class="btn btn-sm" title="Bienvenida en imagen por WhatsApp" onclick="cwOcBienvenida('${o.id}')">🤝</button>`:''}
          <button class="btn btn-sm" title="Editar datos" onclick="cwOcEditar('${o.id}')">✏️</button>
          <button class="btn btn-sm" title="Quitar de la reserva" onclick="cwOcQuitar('${o.id}')">🗑</button>
        </div>
      </div>
    </div>`;
  }).join('');
}
window.cwOcPintar=function(){ if(_ocRes && document.getElementById('m-ocupantes').classList.contains('open')) pintar(); };

// Vista previa de la lista pegada
window.cwOcPrevisualizar=function(){
  const filas=leerLista(document.getElementById('oc-pegar').value);
  const el=document.getElementById('oc-prev');
  if(!filas.length){ el.innerHTML=''; return; }
  el.innerHTML=`<div style="font-size:11px;color:var(--muted);margin:6px 0 4px">Se van a agregar ${filas.length}:</div>`+
    filas.map(f=>`<div style="font-size:11.5px;padding:3px 0;border-bottom:1px dashed var(--bdr)"><b>${escH(f.nombre||'¿nombre?')}</b> · ${escH(f.telefono||'sin celular')}${f.telefono&&!telValido(f.telefono)?' <span style="color:#9B2525">⚠️ incompleto</span>':''} · ${escH(f.email||'sin correo')}</div>`).join('');
};

window.cwOcImportar=async function(){
  const r=reserva(_ocRes); if(!r||!window._db) return;
  const filas=leerLista(document.getElementById('oc-pegar').value);
  if(!filas.length){ toast('Pega primero la lista de personas','warn'); return; }
  const ya=listaOcupantes(r);
  const existe=f=>ya.some(o=>(f.telefono&&soloDigitos(o.telefono)===f.telefono)||(f.email&&o.email===f.email));
  const nuevas=filas.filter(f=>!existe(f));
  if(!nuevas.length){ toast('Esas personas ya estaban registradas','warn'); return; }
  // Asignar puestos libres en orden (O1, O2, …) a quienes llegan
  const libres=(r.recursos||[r.recurso]).filter(k=>k&&k!=='SALA'&&k!=='GER'&&!ya.some(o=>o.puesto===k));
  const quien=currentUser?currentUser.nombre:'';
  const up={}; let orden=ya.length;
  nuevas.forEach(f=>{
    const k=window._push(window._ref(window._db,`coworking/reservas/${r.id}/ocupantes`)).key;
    up[`coworking/reservas/${r.id}/ocupantes/${k}`]={...f,puesto:libres.shift()||'',orden:++orden,registrado:Date.now(),registradoPor:quien};
  });
  try{
    await window._upd(window._ref(window._db),up);
    toast(`✓ ${nuevas.length} ocupante${nuevas.length!==1?'s':''} agregado${nuevas.length!==1?'s':''}${filas.length>nuevas.length?` (${filas.length-nuevas.length} ya estaba${filas.length-nuevas.length!==1?'n':''})`:''}`);
    document.getElementById('oc-pegar').value=''; document.getElementById('oc-prev').innerHTML='';
  }catch(e){ toast('No se pudo guardar: '+e.message,'err'); }
};

function ocRef(oid){ return window._ref(window._db,`coworking/reservas/${_ocRes}/ocupantes/${oid}`); }
window.cwOcPuesto=function(oid,puesto){ if(window._db) window._upd(ocRef(oid),{puesto}).then(()=>toast('✓ Puesto asignado')).catch(e=>toast('No se pudo guardar: '+e.message,'err')); };
window.cwOcEditar=function(oid){
  const r=reserva(_ocRes); const o=listaOcupantes(r).find(x=>x.id===oid); if(!o) return;
  const nombre=prompt('Nombre completo:',o.nombre||''); if(nombre===null) return;
  const tel=prompt('Celular (WhatsApp), 10 dígitos:',o.telefono||''); if(tel===null) return;
  const email=prompt('Correo:',o.email||''); if(email===null) return;
  const cambios={nombre:capitalizar(nombre),telefono:soloDigitos(tel),email:email.trim().toLowerCase()};
  if(cambios.telefono && !telValido(cambios.telefono)) toast('Ojo: el celular no tiene 10 dígitos','warn');
  if(!correoValido(cambios.email)) toast('Ojo: el correo parece tener un error','warn');
  window._upd(ocRef(oid),cambios).then(()=>toast('✓ Datos actualizados')).catch(e=>toast('No se pudo guardar: '+e.message,'err'));
};
window.cwOcQuitar=function(oid){
  const r=reserva(_ocRes); const o=listaOcupantes(r).find(x=>x.id===oid); if(!o) return;
  if(!confirm(`¿Quitar a ${o.nombre} de esta reserva?`)) return;
  window._remove(ocRef(oid)).then(()=>toast('✓ Quitado')).catch(e=>toast('No se pudo quitar: '+e.message,'err'));
};
// Tarjeta de bienvenida de un ocupante (usa el mismo diseño del CRM)
window.cwOcBienvenida=function(oid){ closeM('m-ocupantes'); cwTarjeta('bienvenida',_ocRes,oid); };
// Abre la bienvenida del siguiente que esté pendiente
window.cwOcSiguiente=function(){
  const r=reserva(_ocRes); const o=listaOcupantes(r).find(x=>!x.bienvenida&&x.telefono);
  if(!o){ toast('Todos tienen la bienvenida enviada ✅'); return; }
  cwOcBienvenida(o.id);
};
// Lo llama el modal de tarjetas cuando se envía o se abre el chat
window.cwOcMarcarBienvenida=function(resId,oid){
  if(!window._db||!resId||!oid) return;
  window._upd(window._ref(window._db,`coworking/reservas/${resId}/ocupantes/${oid}`),{bienvenida:today(),bienvenidaPor:currentUser?currentUser.nombre:''}).catch(()=>{});
};
window.cwOcExportar=function(){
  const r=reserva(_ocRes); if(!r) return;
  const oc=listaOcupantes(r); if(!oc.length){ toast('No hay ocupantes para exportar','warn'); return; }
  toXLS(oc.map(o=>({'Reserva':r.consecutivo||'','Empresa':r.empresa||r.nombre||'','Nombre':o.nombre||'','Celular':o.telefono||'','Correo':o.email||'','Puesto':nombrePuesto(o.puesto),'Bienvenida':o.bienvenida||'Pendiente'})),`Ocupantes_${(r.empresa||r.nombre||'reserva').replace(/\W+/g,'_')}`);
};
})();
