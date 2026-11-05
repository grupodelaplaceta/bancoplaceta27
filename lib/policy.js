// Política de acceso del proxy: qué puede llamar cada usuario de la app.
// - bk/*  → solo administradores de la entidad (ADMIN_USERS)
// - cuentas, transferencias, productos y diseños → cualquier usuario con sesión
// - /me/* y /sessions no se exponen (son para sesiones de usuario firmadas, no para esta app)
const METHODS = ['GET', 'POST', 'PUT', 'DELETE']
const no = (status, message) => ({ status, message })

export function authorize(method, segs, sess) {
  if (!METHODS.includes(method)) return no(405, 'Método no permitido')
  if (!segs?.length || segs.some((x) => !x || x === '.' || x === '..')) return no(400, 'Ruta no válida')
  const [a, b, c] = segs
  const admin = !!sess?.admin

  if (a === 'bk') return admin ? null : no(403, 'Solo los administradores de la entidad pueden usar esta función')

  if (a === 'accounts') {
    if (segs.length === 1) return method === 'POST' ? (admin ? null : no(403, 'Solo administradores pueden abrir cuentas')) : no(405, 'Método no permitido')
    if (method === 'GET') return null
    if (method === 'POST' && c === 'membership' && segs[3] === 'renew' && segs.length === 4) return null
    return no(405, 'Método no permitido')
  }
  if (a === 'transfers') return method === 'GET' || (method === 'POST' && segs.length === 1) ? null : no(405, 'Método no permitido')
  if (a === 'products' || a === 'designs') return method === 'GET' ? null : no(405, 'Método no permitido')
  return no(403, 'Función no disponible en esta aplicación')
}
