// Firma HMAC de las llamadas del backend (clave plk_…). SOLO servidor.
// El OpenAPI dice "requiere además firma HMAC" pero NO especifica el formato exacto.
// Por eso todo el formato se configura aquí, con variables de entorno, sin tocar código:
//   PLACETA_API_SECRET     secreto HMAC de tu cliente (obligatorio para las llamadas firmadas)
//   PLACETA_TS_HEADER      cabecera con la marca de tiempo        (def. x-timestamp)
//   PLACETA_SIGN_HEADER    cabecera con la firma                  (def. x-signature)
//   PLACETA_TS_UNIT        s | ms                                 (def. s)
//   PLACETA_SIGN_TEMPLATE  texto a firmar; admite {ts} {method} {path} {body}   (def. {ts}.{method}.{path}.{body})
//   PLACETA_SIGN_ENCODING  hex | base64                           (def. hex)
// {path} es la ruta completa con query tal y como se envía (p. ej. /api/v1/sessions).
import crypto from 'crypto'

export function signedHeaders(method, pathWithQuery, bodyStr = '') {
  const secret = process.env.PLACETA_API_SECRET
  if (!secret) return null
  const ts = String(process.env.PLACETA_TS_UNIT === 'ms' ? Date.now() : Math.floor(Date.now() / 1000))
  const tpl = process.env.PLACETA_SIGN_TEMPLATE || '{ts}.{method}.{path}.{body}'
  const msg = tpl.replace('{ts}', ts).replace('{method}', method.toUpperCase()).replace('{path}', pathWithQuery).replace('{body}', bodyStr)
  const sig = crypto.createHmac('sha256', secret).update(msg).digest(process.env.PLACETA_SIGN_ENCODING === 'base64' ? 'base64' : 'hex')
  return { [process.env.PLACETA_TS_HEADER || 'x-timestamp']: ts, [process.env.PLACETA_SIGN_HEADER || 'x-signature']: sig }
}
