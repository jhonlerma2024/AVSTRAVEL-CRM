/**
 * AVSTRAVEL · Firmador de pagos Bold (Cloudflare Worker, plan gratuito)
 *
 * Bold exige, cuando el botón lleva un monto fijo, una "firma de integridad":
 *   SHA-256( orderId + monto + "COP" + LLAVE_SECRETA )
 * La llave secreta NO puede ir en la página web (cualquiera la vería).
 * Este pequeño servicio la guarda en secreto y devuelve solo la firma.
 *
 * Instalación (10 minutos):
 *  1. Crear cuenta gratis en https://dash.cloudflare.com → Workers & Pages → Create → "Hello World".
 *  2. Pegar este código y desplegar ("Deploy").
 *  3. Settings → Variables and Secrets → Add → tipo "Secret":
 *        Nombre: BOLD_SECRET_KEY   Valor: (la llave secreta del panel de Bold → Integraciones)
 *  4. Copiar la URL del worker (ej. https://avs-bold.tu-usuario.workers.dev)
 *     y pegarla en tienda.html y coworking.html en:  const BOLD_FIRMA_URL = '...';
 */
const ORIGENES = ['https://jhonlerma2024.github.io'];

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const cors = {
      'Access-Control-Allow-Origin': ORIGENES.includes(origin) ? origin : ORIGENES[0],
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
    if (request.method !== 'POST' || !ORIGENES.includes(origin)) {
      return new Response('No permitido', { status: 403, headers: cors });
    }
    try {
      const { orderId, amount, currency = 'COP' } = await request.json();
      const oid = String(orderId || '');
      const monto = Math.round(Number(amount));
      if (!/^[A-Za-z0-9_-]{1,60}$/.test(oid) || !(monto >= 1000) || !['COP', 'USD'].includes(currency)) {
        return Response.json({ error: 'Datos inválidos' }, { status: 400, headers: cors });
      }
      const texto = `${oid}${monto}${currency}${env.BOLD_SECRET_KEY}`;
      const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto));
      const signature = [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, '0')).join('');
      return Response.json({ signature }, { headers: cors });
    } catch (e) {
      return Response.json({ error: 'Error interno' }, { status: 500, headers: cors });
    }
  },
};
