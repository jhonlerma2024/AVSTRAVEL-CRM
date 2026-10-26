// ═══════════════════════════════════════════════════════════════
//  AVS Working · Pagos y comprobantes (compartido por CRM y página de clientes)
//  Los pagos se guardan en  coworking/pagos/{id}
//  Los archivos (foto o PDF del comprobante) en  coworking/comprobantes/{id}
// ═══════════════════════════════════════════════════════════════
(function(){
// Datos para pagar que se muestran al cliente. Deja vacío lo que no uses.
const CUENTAS = {
  nequi: '',        // ej. '315 685 0066'
  daviplata: '',
  banco: '',        // ej. 'Bancolombia ahorros 123-456789-00'
  titular: 'AVSTRAVEL'
};
const METODOS = ['Nequi','Bold','Transferencia bancaria','Daviplata','Efectivo','Otro'];
const MAX_PDF_KB = 900;

function leerDataURL(file){ return new Promise((ok,no)=>{ const fr=new FileReader(); fr.onload=()=>ok(fr.result); fr.onerror=no; fr.readAsDataURL(file); }); }

// Reduce fotos a máx. 1400 px en JPEG (~150–300 KB) para guardarlas rápido.
async function prepararComprobante(file){
  if(!file) return null;
  const tipo=file.type||'';
  if(tipo.startsWith('image/')){
    const url=await leerDataURL(file);
    const img=await new Promise((ok,no)=>{ const i=new Image(); i.onload=()=>ok(i); i.onerror=no; i.src=url; });
    const max=1400, s=Math.min(1, max/Math.max(img.width,img.height));
    const cv=document.createElement('canvas'); cv.width=Math.round(img.width*s); cv.height=Math.round(img.height*s);
    const ctx=cv.getContext('2d'); ctx.fillStyle='#fff'; ctx.fillRect(0,0,cv.width,cv.height); ctx.drawImage(img,0,0,cv.width,cv.height);
    const dataUrl=cv.toDataURL('image/jpeg',0.72);
    return { dataUrl, nombre:(file.name||'comprobante').replace(/\.[^.]+$/,'')+'.jpg', tipo:'image/jpeg', kb:Math.round(dataUrl.length*0.75/1024) };
  }
  if(tipo==='application/pdf' || /\.pdf$/i.test(file.name||'')){
    if(file.size/1024 > MAX_PDF_KB) throw new Error('pdf-grande');
    const dataUrl=await leerDataURL(file);
    return { dataUrl, nombre:file.name||'comprobante.pdf', tipo:'application/pdf', kb:Math.round(file.size/1024) };
  }
  throw new Error('tipo');
}
function mensajeErrorArchivo(e){
  return e&&e.message==='pdf-grande' ? `El PDF pesa más de ${MAX_PDF_KB} KB. Envía mejor una captura de pantalla del pago.`
       : e&&e.message==='tipo' ? 'Sube una foto/captura (JPG, PNG) o un PDF.'
       : 'No se pudo leer el archivo.';
}
// Abre el comprobante en una pestaña nueva
function verComprobante(c){
  if(!c||!c.dataUrl) return;
  const w=window.open('','_blank'); if(!w) return;
  const esPdf=(c.tipo||'').includes('pdf');
  w.document.write(`<!doctype html><title>${(c.nombre||'Comprobante').replace(/</g,'')}</title><body style="margin:0;background:#222;display:flex;justify-content:center;align-items:flex-start;min-height:100vh">${esPdf?`<iframe src="${c.dataUrl}" style="border:0;width:100vw;height:100vh"></iframe>`:`<img src="${c.dataUrl}" style="max-width:100%;height:auto">`}</body>`);
  w.document.close();
}
function lineasCuentas(){
  const l=[];
  if(CUENTAS.nequi) l.push(`<b>Nequi:</b> ${CUENTAS.nequi}`);
  if(CUENTAS.daviplata) l.push(`<b>Daviplata:</b> ${CUENTAS.daviplata}`);
  if(CUENTAS.banco) l.push(`<b>Cuenta:</b> ${CUENTAS.banco}`);
  if(l.length&&CUENTAS.titular) l.push(`<b>A nombre de:</b> ${CUENTAS.titular}`);
  return l;
}
window.PagosCowork = { CUENTAS, METODOS, prepararComprobante, mensajeErrorArchivo, verComprobante, lineasCuentas };
})();
