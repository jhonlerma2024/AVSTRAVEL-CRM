// ═══════════════════════════════════════════════════════════════
//  AVS Working · Tarjetas en imagen para WhatsApp
//  - Bienvenida (al llegar): saludo con su nombre, Wi-Fi, su espacio y horario
//  - Despedida (al salir): agradecimiento + código QR a su formulario de opinión
//  - Testimonio: convierte una opinión de un cliente en imagen para redes
//  Se dibujan en el navegador (canvas) y se comparten como imagen PNG.
// ═══════════════════════════════════════════════════════════════
(function(){
const TW = {
  wifiRed: 'AVSTRAVEL',
  wifiClave: 'avstravel2026',
  whatsapp: '315 685 0066',
  horario1: 'Lunes a viernes · 8:00 a. m. – 6:00 p. m.',
  horario2: 'Sábados · 8:00 a. m. – 1:00 p. m.',
  direccion: 'Calle 3 #5A-16 · Buenaventura',
  fotoBienvenida: 'cw-puesto.jpg',
  fotoTestimonio: 'cw-oficina.jpg',
  logo: 'logo-avs.png'
};
window.TARJETAS_WA_CFG = TW;

const C = { navy:'#0A2A4A', navy2:'#123A60', green:'#5BA829', greenL:'#8FD162', gold:'#F2A922', ink:'#0D1B2A', mist:'#EEF4F8', cream:'#FBF8F2', muted:'#4A6375' };
const SERIF = '"DM Serif Display", Georgia, serif';
const SANS  = '"DM Sans", "Helvetica Neue", Arial, sans-serif';
const MESES = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];

const imgCache = {};
function cargarImg(src){
  if(!imgCache[src]) imgCache[src] = new Promise((ok)=>{ const i=new Image(); i.onload=()=>ok(i); i.onerror=()=>ok(null); i.src=src; });
  return imgCache[src];
}
async function cargarFuentes(){
  if(!document.fonts) return;
  try{ await Promise.race([
    Promise.all(['400 60px "DM Serif Display"','italic 400 60px "DM Serif Display"','400 30px "DM Sans"','600 30px "DM Sans"','700 30px "DM Sans"'].map(f=>document.fonts.load(f))),
    new Promise(r=>setTimeout(r,2500))
  ]); }catch(e){}
}
function rr(x,ctx,X,Y,W,H,R){ ctx.beginPath(); ctx.moveTo(X+R,Y); ctx.arcTo(X+W,Y,X+W,Y+H,R); ctx.arcTo(X+W,Y+H,X,Y+H,R); ctx.arcTo(X,Y+H,X,Y,R); ctx.arcTo(X,Y,X+W,Y,R); ctx.closePath(); }
function caja(ctx,X,Y,W,H,R,fill,stroke,lw){ rr(0,ctx,X,Y,W,H,R); if(fill){ctx.fillStyle=fill;ctx.fill();} if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=lw||2;ctx.stroke();} }
function cubrir(ctx,img,X,Y,W,H,posY){
  if(!img){ ctx.fillStyle=C.navy2; ctx.fillRect(X,Y,W,H); return; }
  const s=Math.max(W/img.width,H/img.height), w=img.width*s, h=img.height*s;
  ctx.save(); ctx.beginPath(); ctx.rect(X,Y,W,H); ctx.clip();
  ctx.drawImage(img, X+(W-w)/2, Y+(H-h)*(posY==null?.5:posY), w, h);
  ctx.restore();
}
function texto(ctx,t,x,y,{font,color,align='left',spacing=0,maxW}={}){
  ctx.font=font; ctx.fillStyle=color; ctx.textAlign=align; ctx.textBaseline='alphabetic';
  if('letterSpacing' in ctx) ctx.letterSpacing=spacing+'px';
  if(maxW){ let size=parseFloat(font.match(/(\d+)px/)[1]); while(ctx.measureText(t).width>maxW && size>14){ size-=2; ctx.font=font.replace(/\d+px/,size+'px'); } }
  ctx.fillText(t,x,y);
  if('letterSpacing' in ctx) ctx.letterSpacing='0px';
  return ctx.measureText(t).width;
}
function lineas(ctx,t,maxW){
  const out=[]; let cur='';
  String(t||'').split(/\s+/).forEach(w=>{ const p=cur?cur+' '+w:w; if(ctx.measureText(p).width>maxW && cur){ out.push(cur); cur=w; } else cur=p; });
  if(cur) out.push(cur); return out;
}
function estrella(ctx,cx,cy,r,fill){
  ctx.beginPath();
  for(let i=0;i<10;i++){ const a=-Math.PI/2+i*Math.PI/5, rr2=i%2?r*0.45:r; ctx.lineTo(cx+rr2*Math.cos(a), cy+rr2*Math.sin(a)); }
  ctx.closePath(); ctx.fillStyle=fill; ctx.fill();
}
async function logoPastilla(ctx,X,Y,H,centrar){
  const lg=await cargarImg(TW.logo); if(!lg) return;
  const h=H-28, w=lg.width*h/lg.height, W=w+44;
  const x=centrar?X-W/2:X;
  ctx.save(); ctx.shadowColor='rgba(0,0,0,.18)'; ctx.shadowBlur=24; ctx.shadowOffsetY=6; caja(ctx,x,Y,W,H,22,'#fff'); ctx.restore();
  ctx.drawImage(lg,x+22,Y+14,w,h);
}
function primerNombre(n){ const p=String(n||'').trim().split(/\s+/)[0]||''; return p? p.charAt(0).toUpperCase()+p.slice(1).toLowerCase() : ''; }
function fCorta(iso){ if(!iso) return ''; const [y,m,d]=String(iso).split('-').map(Number); return d? `${d} ${MESES[m-1]}` : iso; }
function lienzo(W,H){ const cv=document.createElement('canvas'); cv.width=W; cv.height=H; return [cv,cv.getContext('2d')]; }
function aBlob(cv){ return new Promise(ok=>cv.toBlob(b=>ok(b),'image/png')); }
function iconoWifi(ctx,cx,cy,s,color){
  ctx.save(); ctx.strokeStyle=color; ctx.lineWidth=s*0.11; ctx.lineCap='round';
  [1,0.66,0.33].forEach(f=>{ ctx.beginPath(); ctx.arc(cx,cy,s*f,Math.PI*1.22,Math.PI*1.78); ctx.stroke(); });
  ctx.beginPath(); ctx.arc(cx,cy,s*0.08,0,Math.PI*2); ctx.fillStyle=color; ctx.fill(); ctx.restore();
}

// ── 1. BIENVENIDA ───────────────────────────────────────────────
async function tarjetaBienvenida(r){
  await cargarFuentes();
  const W=1080,H=1350,[cv,ctx]=lienzo(W,H);
  ctx.fillStyle=C.cream; ctx.fillRect(0,0,W,H);
  // foto con degradado
  const foto=await cargarImg(TW.fotoBienvenida);
  cubrir(ctx,foto,0,0,W,700,.35);
  const g=ctx.createLinearGradient(0,0,0,700); g.addColorStop(0,'rgba(10,42,74,.10)'); g.addColorStop(.45,'rgba(10,42,74,.45)'); g.addColorStop(1,'rgba(10,42,74,.97)');
  ctx.fillStyle=g; ctx.fillRect(0,0,W,700);
  await logoPastilla(ctx,60,56,96);
  const n=primerNombre(r&&r.nombre);
  texto(ctx,'AVS WORKING · COWORKING EN BUENAVENTURA',64,520,{font:`700 26px ${SANS}`,color:C.greenL,spacing:4});
  texto(ctx,n?`¡Hola, ${n}!`:'¡Hola!',60,612,{font:`400 104px ${SERIF}`,color:'#fff',maxW:960});
  texto(ctx,'te damos la bienvenida',62,680,{font:`italic 400 62px ${SERIF}`,color:C.gold});
  // tarjetas Wi-Fi y espacio
  const y0=740;
  ctx.save(); ctx.shadowColor='rgba(10,42,74,.25)'; ctx.shadowBlur=30; ctx.shadowOffsetY=10; caja(ctx,60,y0,470,250,30,C.navy); ctx.restore();
  iconoWifi(ctx,112,y0+92,42,C.greenL);
  texto(ctx,'WI-FI',160,y0+80,{font:`700 26px ${SANS}`,color:'#fff',spacing:4});
  texto(ctx,'Red',96,y0+142,{font:`500 24px ${SANS}`,color:'#A9C1D4'});
  texto(ctx,TW.wifiRed,96,y0+176,{font:`700 36px ${SANS}`,color:'#fff',maxW:400});
  texto(ctx,'Clave',96,y0+210,{font:`500 24px ${SANS}`,color:'#A9C1D4'});
  texto(ctx,TW.wifiClave,190,y0+212,{font:`700 36px ${SANS}`,color:C.gold,maxW:320});
  caja(ctx,550,y0,470,250,30,'#fff',C.mist,3);
  texto(ctx,'TU ESPACIO',590,y0+66,{font:`700 26px ${SANS}`,color:C.green,spacing:4});
  const esp = (r&&(r.recursoNom||r.recurso)) || 'AVS Working';
  texto(ctx,esp,588,y0+128,{font:`400 54px ${SERIF}`,color:C.navy,maxW:400});
  const plan = r&&(r.planNom||r.plan) ? `Plan ${r.planNom||r.plan}` : '';
  if(plan) texto(ctx,plan,590,y0+172,{font:`600 28px ${SANS}`,color:C.muted,maxW:400});
  const fechas = r&&r.fechaInicio ? (r.fechaFin&&r.fechaFin!==r.fechaInicio ? `${fCorta(r.fechaInicio)} → ${fCorta(r.fechaFin)}` : fCorta(r.fechaInicio)) : '';
  if(fechas) texto(ctx,fechas,590,y0+214,{font:`500 28px ${SANS}`,color:C.muted,maxW:400});
  // incluidos
  texto(ctx,'INCLUIDO EN TU PLAN',62,1046,{font:`700 24px ${SANS}`,color:C.green,spacing:4});
  let x=60; const yc=1072;
  ['⚡ Internet de fibra','☕ Café y agua','❄️ Aire acondicionado'].forEach(t=>{
    ctx.font=`600 26px ${SANS}`; const w=ctx.measureText(t).width+44;
    if(x+w>1020) return; caja(ctx,x,yc,w,58,29,'#fff',C.green,3); texto(ctx,t,x+22,yc+38,{font:`600 26px ${SANS}`,color:C.ink}); x+=w+12;
  });
  texto(ctx,TW.horario1,62,1186,{font:`600 30px ${SANS}`,color:C.navy});
  texto(ctx,TW.horario2,62,1228,{font:`500 30px ${SANS}`,color:C.muted});
  // franja inferior
  ctx.fillStyle=C.green; ctx.fillRect(0,1262,W,88);
  texto(ctx,`¿Necesitas algo? Escríbenos aquí · ${TW.whatsapp}`,W/2,1318,{font:`700 32px ${SANS}`,color:'#fff',align:'center',maxW:980});
  return aBlob(cv);
}

// ── 2. DESPEDIDA (pide la opinión con QR) ───────────────────────
function dibujarQR(ctx,url,X,Y,S){
  if(typeof qrcode!=='function'){ caja(ctx,X,Y,S,S,12,null,C.navy,4); texto(ctx,'Toca el enlace',X+S/2,Y+S/2,{font:`600 28px ${SANS}`,color:C.navy,align:'center'}); return; }
  const q=qrcode(0,'M'); q.addData(url); q.make();
  const n=q.getModuleCount(), m=S/n;
  ctx.fillStyle='#fff'; ctx.fillRect(X,Y,S,S); ctx.fillStyle=C.navy;
  for(let r=0;r<n;r++) for(let c=0;c<n;c++) if(q.isDark(r,c)) ctx.fillRect(X+c*m, Y+r*m, Math.ceil(m), Math.ceil(m));
}
async function tarjetaDespedida(r,urlOpinion){
  await cargarFuentes();
  const W=1080,H=1350,[cv,ctx]=lienzo(W,H);
  const g=ctx.createLinearGradient(0,0,0,H); g.addColorStop(0,C.navy); g.addColorStop(1,'#071E36');
  ctx.fillStyle=g; ctx.fillRect(0,0,W,H);
  // círculos decorativos
  ctx.globalAlpha=.10; ctx.fillStyle=C.green; ctx.beginPath(); ctx.arc(980,120,260,0,Math.PI*2); ctx.fill();
  ctx.fillStyle=C.gold; ctx.beginPath(); ctx.arc(60,1040,200,0,Math.PI*2); ctx.fill(); ctx.globalAlpha=1;
  await logoPastilla(ctx,W/2,64,92,true);
  const n=primerNombre(r&&r.nombre);
  texto(ctx,'GRACIAS POR TRABAJAR CON NOSOTROS',W/2,240,{font:`700 26px ${SANS}`,color:C.greenL,align:'center',spacing:4});
  texto(ctx,'¿Cómo te fue',W/2,336,{font:`400 92px ${SERIF}`,color:'#fff',align:'center'});
  texto(ctx,n?`hoy, ${n}?`:'hoy?',W/2,428,{font:`italic 400 92px ${SERIF}`,color:C.gold,align:'center',maxW:960});
  texto(ctx,'Déjanos un mensaje sobre tu estadía.',W/2,500,{font:`500 32px ${SANS}`,color:'#D7E3EC',align:'center'});
  texto(ctx,'Tu opinión nos ayuda a mejorar AVS Working.',W/2,544,{font:`500 32px ${SANS}`,color:'#D7E3EC',align:'center'});
  // QR
  const S=360, qx=(W-S)/2-30, qy=600;
  caja(ctx,qx,qy,S+60,S+120,36,'#fff');
  dibujarQR(ctx,urlOpinion||'https://jhonlerma2024.github.io/AVSTRAVEL-CRM/opinion.html',qx+30,qy+30,S);
  texto(ctx,'Escanea o toca el enlace',W/2,qy+S+86,{font:`700 28px ${SANS}`,color:C.navy,align:'center'});
  // estrellas
  for(let i=0;i<5;i++) estrella(ctx,W/2-128+i*64,1150,26,C.gold);
  texto(ctx,'Toma menos de 1 minuto',W/2,1212,{font:`500 28px ${SANS}`,color:'#A9C1D4',align:'center'});
  ctx.fillStyle=C.green; ctx.fillRect(0,1262,W,88);
  texto(ctx,`¿Vuelves pronto? Reserva por WhatsApp ${TW.whatsapp}`,W/2,1318,{font:`700 32px ${SANS}`,color:'#fff',align:'center',maxW:980});
  return aBlob(cv);
}

// ── 3. TESTIMONIO (opinión de un cliente para redes) ────────────
async function tarjetaTestimonio(o){
  await cargarFuentes();
  const W=1080,H=1080,[cv,ctx]=lienzo(W,H);
  const foto=await cargarImg(TW.fotoTestimonio);
  cubrir(ctx,foto,0,0,W,H,.5);
  ctx.fillStyle='rgba(7,30,54,.82)'; ctx.fillRect(0,0,W,H);
  await logoPastilla(ctx,W/2,56,84,true);
  const est=Math.max(0,Math.min(5,o&&o.general||5));
  for(let i=0;i<5;i++) estrella(ctx,W/2-128+i*64,232,26,i<est?C.gold:'rgba(255,255,255,.25)');
  texto(ctx,'“',W/2,430,{font:`400 200px ${SERIF}`,color:'rgba(242,169,34,.35)',align:'center'});
  // cita con ajuste automático
  const msg=String(o&&o.mensaje||'Excelente espacio para trabajar.').trim();
  let size=58, ls=[];
  for(;size>=34;size-=4){ ctx.font=`italic 400 ${size}px ${SERIF}`; ls=lineas(ctx,msg,860); if(ls.length*size*1.25<=470) break; }
  if(ls.length*size*1.25>470){ const max=Math.floor(470/(size*1.25)); ls=ls.slice(0,max); ls[max-1]=ls[max-1].replace(/\s*\S*$/,'')+'…'; }
  const top=330+(470-ls.length*size*1.25)/2+size;
  ls.forEach((l,i)=>texto(ctx,l,W/2,top+i*size*1.25,{font:`italic 400 ${size}px ${SERIF}`,color:'#fff',align:'center'}));
  const n=primerNombre(o&&o.nombre)||'Cliente';
  texto(ctx,`— ${n}`,W/2,890,{font:`700 36px ${SANS}`,color:C.greenL,align:'center'});
  texto(ctx,'Cliente de AVS Working',W/2,934,{font:`500 28px ${SANS}`,color:'#A9C1D4',align:'center'});
  ctx.fillStyle=C.green; ctx.fillRect(0,992,W,88);
  texto(ctx,`Coworking en Buenaventura · WhatsApp ${TW.whatsapp}`,W/2,1048,{font:`700 30px ${SANS}`,color:'#fff',align:'center',maxW:980});
  return aBlob(cv);
}

window.TarjetasWA = { tarjetaBienvenida, tarjetaDespedida, tarjetaTestimonio };
})();
