// Convierte una identidad (DIP) en una sesión de Placeta: POST /sessions firmado → token pus_…
import { upstream, errMsg } from './upstream'
import { setSession, minutes, PERMISOS } from './session'
import { list, fold } from './shape'

/** Devuelve null si todo va bien, o un mensaje de error para el usuario. */
export async function startSession(res, { uid, name, dip, verify }) {
  if (!dip) return 'Falta el DIP.'
  const mins = minutes()
  const r = await upstream('sessions', { method: 'POST', signed: true, body: { dip, minutos: mins, permisos: PERMISOS } })
  if (r.status >= 300 || !r.json?.token) {
    if (r.status === 404 || r.status === 422) return errMsg(r.json, 'No tienes cuentas en esta entidad.')
    if (r.status === 401) {
      // Motivo que devuelve el banco (p. ej. «Clave de API ausente o inválida» o «Firma no válida»).
      const motivo = errMsg(r.json, '')
      console.error('[login] El banco rechazó POST /sessions (401):', motivo || '(sin mensaje)')
      return 'El servidor no tiene una clave o firma válida para el banco.' + (motivo ? ' Motivo del banco: ' + motivo : '')
    }
    return errMsg(r.json, 'No se ha podido abrir tu sesión bancaria.')
  }
  // DIP escrito a mano: con VERIFY_HOLDER=1 se exige que el titular (enmascarado, p. ej. «Ma***») encaje con el nombre de PlacetaID.
  if (verify && process.env.VERIFY_HOLDER === '1') {
    const a = await upstream('me/accounts', { token: r.json.token }), first = list(a.json, 'cuentas')[0]
    const l = first ? await upstream('me/lookup', { token: r.json.token, search: '?iban=' + encodeURIComponent(first.iban) }) : null
    const mask = fold(String(l?.json?.titular || '').split('*')[0])
    const ok = mask.length >= 2 && fold(name).split(' ').some((w) => w.startsWith(mask))
    if (!ok) { await upstream('sessions', { method: 'DELETE', token: r.json.token }).catch(() => {}); return 'Ese DIP no coincide con tu PlacetaID.' }
  }
  const expMs = Date.parse(r.json.expira) || Date.now() + mins * 6e4
  try { setSession(res, { uid, name, dip: String(dip).toUpperCase().replace(/[\s-]/g, ''), tok: r.json.token, perms: r.json.permisos || PERMISOS, expMs }) } catch (e) { return e.message }
  return null
}
