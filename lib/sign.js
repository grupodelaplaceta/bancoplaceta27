// Firma HMAC de las llamadas del backend (clave plk_…). SOLO servidor.
// Formato FIJO, igual que el SDK oficial del banco (sdk/placeta-servidor.ts) y su verificación en /api/v1/sessions:
//   · firma `${ts}.${cuerpo}` (cuerpo = el JSON exacto que se envía), HMAC-SHA256 en hex
//   · ts = Date.now() en milisegundos (ventana de ±5 minutos en el banco)
//   · x-nonce: 12 bytes aleatorios en base64url, único por petición (el banco rechaza repeticiones)
// El formato no se configura por variables de entorno: una variable antigua en el despliegue no puede romperlo.
// PLACETA_BANCO_FIRMA (o PLACETA_API_SECRET) debe ser el «secreto de firma» que muestra el banco al crear el cliente (64 caracteres hex).
import crypto from 'crypto'

export function signedHeaders(bodyStr = '') {
  // bodyStr puede ser un string (JSON) o un Buffer (subida de logo): se firma exactamente lo que se envía.
  // trim: un espacio o salto de línea pegado en el panel de Vercel cambia la clave y da «Firma no válida».
  const secret = (process.env.PLACETA_BANCO_FIRMA || process.env.PLACETA_API_SECRET || '').trim()
  if (!secret) return null
  const ts = String(Date.now())
  const nonce = crypto.randomBytes(12).toString('base64url')
  const sig = crypto.createHmac('sha256', secret).update(`${ts}.`).update(bodyStr).digest('hex')
  return { 'x-timestamp': ts, 'x-nonce': nonce, 'x-signature': sig }
}
