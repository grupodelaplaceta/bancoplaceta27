// Convierte una identidad (DIP) en una sesión de Placeta: POST /sessions firmado → token pus_…
import { upstream, errMsg } from './upstream'
import { setSession, minutes, PERMISOS } from './session'

/** Devuelve null si todo va bien, o un mensaje de error para el usuario. */
export async function startSession(res, { uid, name, dip }) {
  if (!dip) return 'Tu PlacetaID no ha devuelto un DIP. Revisa PLACETAID_DIP_FIELD.'
  const mins = minutes()
  const r = await upstream('sessions', { method: 'POST', signed: true, body: { dip, minutos: mins, permisos: PERMISOS } })
  if (r.status >= 300 || !r.json?.token) {
    if (r.status === 404 || r.status === 422) return errMsg(r.json, 'No tienes cuentas en esta entidad.')
    if (r.status === 401) return 'El servidor no tiene una clave o firma válida para el banco.'
    return errMsg(r.json, 'No se ha podido abrir tu sesión bancaria.')
  }
  const expMs = Date.parse(r.json.expira) || Date.now() + mins * 6e4
  try { setSession(res, { uid, name, tok: r.json.token, perms: r.json.permisos || PERMISOS, expMs }) } catch (e) { return e.message }
  return null
}
