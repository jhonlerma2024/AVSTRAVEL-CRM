/* ════════════════════════════════════════════════════════════════
   AVS Working · Voucher de bienvenida (imprimible / PDF) y correo
   Lo usan coworking.html (cliente) y index.html (CRM).
   ════════════════════════════════════════════════════════════════ */
(function(){
  // ── Configuración editable ──────────────────────────────────────
  const CFG = {
    direccion: 'Calle 3 #5A-16, Buenaventura',
    whatsapp: '315 685 0066',
    horario: 'Lunes a viernes 8:00 a. m. – 6:00 p. m. · Sábados 8:00 a. m. – 1:00 p. m.',
    // Beneficio de fidelización que aparece en el voucher (cámbialo o déjalo vacío para ocultarlo)
    beneficio: '10% de descuento en tu próximo plan de viaje con AVSTRAVEL presentando este voucher.',
    // EmailJS: se reutiliza la plantilla de la tienda
    emailjs: { publicKey:'76x3V_WsIHvGZhtuT', serviceId:'service_ni1br3m', templateId:'template_2kdrjnk' },
    urlReservas: 'https://jhonlerma2024.github.io/AVSTRAVEL-CRM/coworking.html'
  };
  window.VOUCHER_COWORK_CFG = CFG;
  // Se precarga el logo como imagen incrustada para que siempre salga en el voucher y en el PDF
  let LOGO = new URL('logo-avs.png', location.href).href;
  try{ fetch(LOGO).then(r=>r.ok?r.blob():null).then(b=>{ if(!b) return; const fr=new FileReader(); fr.onload=()=>{ LOGO=fr.result; }; fr.readAsDataURL(b); }).catch(()=>{}); }catch(e){}

  const esc = t => String(t ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt = n => '$' + (Math.round(n) || 0).toLocaleString('es-CO');
  const parse = s => { const [y,m,d] = String(s).split('-').map(Number); return new Date(y, m-1, d); };
  const larga = s => s ? parse(s).toLocaleDateString('es-CO', { weekday:'long', day:'numeric', month:'long', year:'numeric' }) : '';
  function fechas(r){
    if(r.horaInicio) return `${larga(r.fechaInicio)} · ${r.horaInicio} a ${r.horaFin}`;
    if(!r.fechaFin || r.fechaFin === r.fechaInicio || r.plan === 'dia') return larga(r.fechaInicio);
    return `Del ${larga(r.fechaInicio)} al ${larga(r.fechaFin)}`;
  }
  function codigoBienvenida(r){
    return 'AVSW-' + String(r.consecutivo || '').replace(/\D/g,'').padStart(4,'0') + '-' + String(r.id || '').slice(-3).toUpperCase();
  }

  // ── Voucher imprimible ─────────────────────────────────────────
  window.abrirVoucherCowork = function(r){
    const confirmada = r.estado === 'Confirmada';
    const pagado = r.pagoEstado && /aprob|pagad|verific/i.test(r.pagoEstado);
    const estado = confirmada ? 'Reserva confirmada' : pagado ? 'Pago recibido · en verificación' : 'Pendiente de confirmación de pago';
    const espacios = (r.detalle && r.detalle.length)
      ? r.detalle.map(d => `<li>${esc(d.nom)}</li>`).join('')
      : `<li>${esc(r.recursoNom || '')}</li>`;
    const nombre = esc((r.nombre || 'Cliente').trim());
    const primer = esc((r.nombre || '').trim().split(' ')[0] || 'Bienvenido');
    const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
<title>Voucher ${esc(r.consecutivo)} · AVS Working</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,600;1,500&family=Jost:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Jost',Arial,sans-serif;color:#0D1B2A;background:#EEF4F8;padding:24px}
  .v{max-width:720px;margin:0 auto;background:#fff;border-radius:18px;overflow:hidden;box-shadow:0 10px 40px rgba(10,42,74,.15)}
  .top{background:linear-gradient(135deg,#0A2A4A,#0A4A6E);color:#fff;padding:26px 30px;display:flex;justify-content:space-between;align-items:center;gap:16px}
  .top img{height:54px;background:#fff;border-radius:10px;padding:6px 10px}
  .top .tag{font-size:11px;letter-spacing:.18em;text-transform:uppercase;opacity:.75;text-align:right}
  .top .tag b{display:block;font-size:20px;letter-spacing:.04em;color:#F2A922;margin-top:2px}
  .hero{padding:28px 30px 8px}
  .hero h1{font-family:'Cormorant Garamond',serif;font-size:34px;line-height:1.1;color:#0A2A4A}
  .hero h1 em{color:#5BA829;font-style:italic}
  .hero p{color:#4A6577;margin-top:8px;font-size:14.5px;line-height:1.6}
  .estado{display:inline-block;margin-top:12px;padding:5px 14px;border-radius:30px;font-size:12px;font-weight:700;background:${confirmada?'#E3F5EF':'#FFF3D6'};color:${confirmada?'#0B6E4F':'#854F0B'}}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:18px 30px}
  .box{background:#F5F9FB;border:1px solid #DCE6EC;border-radius:12px;padding:12px 14px}
  .box .l{font-size:10.5px;letter-spacing:.12em;text-transform:uppercase;color:#6B8798;font-weight:700}
  .box .val{font-size:15px;font-weight:600;margin-top:3px;color:#0A2A4A}
  .box ul{margin:4px 0 0 18px;font-size:14px;font-weight:600;color:#0A2A4A}
  .full{grid-column:1/-1}
  .amen{display:flex;flex-wrap:wrap;gap:8px;padding:4px 30px 6px}
  .amen span{background:#EEF4F8;border-radius:20px;padding:5px 12px;font-size:12.5px}
  .ben{margin:16px 30px;border:2px dashed #5BA829;border-radius:14px;padding:14px 16px;display:flex;gap:14px;align-items:center}
  .ben .ic{font-size:30px}
  .ben b{color:#3E7E1B}
  .code{font-family:monospace;font-size:16px;font-weight:700;letter-spacing:.08em;background:#0A2A4A;color:#fff;padding:3px 10px;border-radius:6px;display:inline-block;margin-top:4px}
  .normas{padding:6px 30px 18px;font-size:12.5px;color:#4A6577;line-height:1.7}
  .normas h3{font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#0A2A4A;margin-bottom:4px}
  .pie{background:#0A2A4A;color:rgba(255,255,255,.85);padding:16px 30px;font-size:12.5px;display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px}
  .acc{max-width:720px;margin:16px auto 0;display:flex;gap:10px;justify-content:center}
  .acc button{font-family:inherit;border:none;border-radius:30px;padding:12px 22px;font-size:14px;font-weight:700;cursor:pointer;background:#5BA829;color:#fff}
  .acc button.sec{background:#fff;color:#0A2A4A;border:2px solid #0A2A4A}
  @media(max-width:560px){.grid{grid-template-columns:1fr}.top{flex-direction:column;align-items:flex-start}.top .tag{text-align:left}}
  @media print{body{background:#fff;padding:0}.v{box-shadow:none;border-radius:0}.acc{display:none}
    *{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
</style></head><body>
<div class="v">
  <div class="top">
    <img src="${LOGO}" alt="AVSTRAVEL" onerror="this.style.display='none'">
    <div class="tag">Voucher de bienvenida<b>${esc(r.consecutivo || '')}</b></div>
  </div>
  <div class="hero">
    <h1>¡Bienvenido(a) a <em>AVS Working</em>, ${primer}!</h1>
    <p>Gracias por elegirnos para trabajar. Este voucher confirma los datos de tu reserva. Preséntalo al llegar, impreso o desde tu celular.</p>
    <span class="estado">${estado}</span>
  </div>
  <div class="grid">
    <div class="box"><div class="l">Cliente</div><div class="val">${nombre}</div>${r.empresa?`<div style="font-size:13px;color:#4A6577">${esc(r.empresa)}</div>`:''}</div>
    <div class="box"><div class="l">Plan</div><div class="val">${esc(r.planNom || r.plan || '')}</div></div>
    <div class="box full"><div class="l">${(r.detalle||[]).length>1?'Espacios reservados':'Espacio reservado'}</div><ul>${espacios}</ul></div>
    <div class="box full"><div class="l">Fechas</div><div class="val">${esc(fechas(r))}</div></div>
    <div class="box"><div class="l">Valor</div><div class="val">${fmt(r.total)}</div></div>
    <div class="box"><div class="l">Horario</div><div class="val" style="font-size:13px">${esc(CFG.horario)}</div></div>
  </div>
  <div class="amen"><span>📶 Internet de fibra</span><span>☕ Café ilimitado</span><span>💧 Agua ilimitada</span><span>❄️ Aire acondicionado</span><span>🪑 Mobiliario de oficina</span></div>
  ${CFG.beneficio ? `<div class="ben"><div class="ic">🎁</div><div><b>Beneficio de bienvenida:</b> ${esc(CFG.beneficio)}<br><span class="code">${codigoBienvenida(r)}</span></div></div>` : ''}
  <div class="normas">
    <h3>Para una buena convivencia</h3>
    Llega en el horario de tu plan · Mantén tu puesto ordenado al salir · Usa audífonos en llamadas · Reserva la sala de juntas con anticipación · Avísanos por WhatsApp si necesitas cambiar fechas.
  </div>
  <div class="pie"><span>📍 ${esc(CFG.direccion)}</span><span>💬 WhatsApp ${esc(CFG.whatsapp)}</span><span>AVSTRAVEL · RNT 47142</span></div>
</div>
<div class="acc"><button onclick="window.print()">🖨️ Imprimir / Guardar PDF</button><button class="sec" onclick="window.close()">Cerrar</button></div>
<script>setTimeout(()=>{ try{ window.print(); }catch(e){} }, 700);<\/script>
</body></html>`;
    const w = window.open('', '_blank');
    if(!w){ alert('Tu navegador bloqueó la ventana del voucher. Permite las ventanas emergentes e inténtalo de nuevo.'); return; }
    w.document.open(); w.document.write(html); w.document.close();
  };

  // ── Correo de bienvenida (EmailJS, misma plantilla de la tienda) ──
  let iniciado = false;
  window.enviarCorreoCowork = function(r, tipo){
    if(!r || !r.email || !window.emailjs) return Promise.resolve(false);
    if(!iniciado){ try{ emailjs.init({ publicKey: CFG.emailjs.publicKey }); iniciado = true; }catch(e){ return Promise.resolve(false); } }
    const confirmada = tipo === 'confirmada' || r.estado === 'Confirmada';
    const params = {
      to_name: r.nombre, to_email: r.email,
      reserva_id: r.consecutivo,
      plan_nombre: `AVS Working · ${r.recursoNom || ''} · ${r.planNom || ''}`,
      destino: 'Coworking AVS Working · ' + CFG.direccion,
      linea: 'Coworking',
      fecha: fechas(r),
      personas: (r.detalle && r.detalle.length) || r.cantidad || 1,
      total: fmt(r.total),
      estado_pago: confirmada ? '¡Bienvenido(a)! Tu reserva está confirmada ✅' : 'Reserva recibida · pendiente de pago',
      telefono_contacto: CFG.whatsapp
    };
    return emailjs.send(CFG.emailjs.serviceId, CFG.emailjs.templateId, params)
      .then(() => true).catch(err => { console.warn('Correo no enviado:', err); return false; });
  };
})();
