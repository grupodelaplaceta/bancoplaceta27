// Prueba la firma contra el banco con TUS valores, sin desplegar la app.
//   PLACETA_API_URL=https://placetaone.vercel.app/api/v1 PLACETA_BANCO_CLAVE=plk_... PLACETA_BANCO_FIRMA=... DIP=12345678Z node scripts/probar-firma.mjs
// Hace UNA sola petición a POST /sessions y muestra la respuesta del banco. Nunca imprime el secreto.
import crypto from 'node:crypto'

const base = (process.env.PLACETA_API_URL || 'https://placetaone.vercel.app/api/v1').replace(/\/$/, '')
const key = (process.env.PLACETA_BANCO_CLAVE || process.env.PLACETA_API_KEY || '').trim(), secret = (process.env.PLACETA_BANCO_FIRMA || process.env.PLACETA_API_SECRET || '').trim(), dip = (process.env.DIP || '').trim()
if (!key || !secret || !dip) { console.log('Faltan PLACETA_BANCO_CLAVE, PLACETA_BANCO_FIRMA o DIP.'); process.exit(1) }
if (!/^[0-9a-f]{64}$/i.test(secret)) console.log('⚠ El secreto no tiene 64 caracteres hexadecimales. ¿Es el «secreto de firma» del cliente (no la clave plk_ ni el secreto de PlacetaID)?')

const cuerpo = JSON.stringify({ dip, minutos: 5, permisos: ['me:read'] })
const ts = String(Date.now())
const nonce = crypto.randomBytes(12).toString('base64url')
const firma = crypto.createHmac('sha256', secret).update(`${ts}.${cuerpo}`).digest('hex')

let r
try { r = await fetch(base + '/sessions', {
  method: 'POST',
  headers: { 'content-type': 'application/json', 'x-api-key': key, 'x-timestamp': ts, 'x-nonce': nonce, 'x-signature': firma },
  body: cuerpo,
}) } catch (e) { console.log('No se ha podido contactar con', base, '-', e.cause?.code || e.message); process.exit(1) }
const texto = await r.text()
console.log('HTTP', r.status, texto.slice(0, 300))
const pistas = {
  401: texto.includes('Firma') ? 'La firma no coincide: el secreto no es el de firma del cliente, o el cliente se regeneró.' : 'La clave no existe o está desactivada.',
  403: 'La clave no tiene el permiso sesiones:crear.',
  201: '✓ Firma correcta. Si la app sigue fallando, revisa las variables de Vercel (PLACETA_API_SECRET y PLACETA_API_URL) y vuelve a desplegar.',
}
if (pistas[r.status]) console.log(pistas[r.status])
