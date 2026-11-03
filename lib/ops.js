// Operaciones de ENTIDAD (cuentas institucionales, nóminas, organigrama…). SOLO servidor decide y valida.
// El navegador solo ve el catálogo (GET /api/ops) y envía { op, valores }. Nunca rutas ni campos libres:
// cada operación declara sus campos; cualquier otro campo se descarta. Los campos `auto` no los rellena el
// navegador: el CIP sale de ENTIDAD_CIP y `dip_actor` sale de la sesión del operador (la separación de
// funciones la aplica el banco con ese DIP, no con lo que envíe el navegador).
import { isSegment, isIban, normIban, cleanText } from './validate'

const q = (k, l, t = 'text', o = {}) => ({ k, l, t, in: 'query', ...o })
const b = (k, l, t = 'text', o = {}) => ({ k, l, t, in: 'body', ...o })
const p = (k, l, o = {}) => ({ k, l, t: 'text', in: 'path', req: true, ...o })
const CIP_Q = { k: 'cip', in: 'query', auto: 'cip' }
const CIP_B = { k: 'cip', in: 'body', auto: 'cip' }
const ACTOR = { k: 'dip_actor', in: 'body', auto: 'actor' }
const DIP_B = (o = {}) => b('dip', 'DIP de la persona', 'text', { req: true, ...o })
const IBAN = (k, l, o = {}) => b(k, l, 'iban', { req: true, ...o })
const NUM = (k, l, o = {}) => b(k, l, 'num', { req: true, ...o })
const SEL = (k, l, opts, o = {}) => b(k, l, 'sel', { opts, req: true, ...o })
const EXTRA = { k: 'extra', l: 'Campos adicionales (JSON, opcional)', t: 'json', in: 'body' }

export const OPS = {
  // ---- Organigrama ----
  org_ver:       { g: 'Organigrama', l: 'Ver organigrama', m: 'GET', p: 'bk/organigrama', f: [CIP_Q] },
  org_cambiar:   { g: 'Organigrama', l: 'Cambiar organigrama', m: 'POST', p: 'bk/organigrama', confirm: true,
    f: [CIP_B, ACTOR, SEL('accion', 'Acción', ['unidad', 'puesto', 'nombrar', 'cesar', 'permiso', 'cerrar_unidad']), b('dip', 'DIP (si aplica)', 'text'), b('puesto', 'Puesto (id)', 'text'), b('motivo', 'Motivo', 'text', { max: 200 }), EXTRA] },
  // ---- Presupuestos ----
  pres_ver:      { g: 'Presupuestos', l: 'Ver presupuesto de una unidad', m: 'GET', p: 'bk/presupuestos', f: [CIP_Q, q('unidad', 'Unidad (id)', 'text', { req: true }), q('ejercicio', 'Ejercicio (AAAA)', 'num')] },
  pres_fijar:    { g: 'Presupuestos', l: 'Fijar presupuesto anual', m: 'PUT', p: 'bk/presupuestos', confirm: true,
    f: [CIP_B, ACTOR, b('unidad', 'Unidad (id, vacío = general)', 'text'), NUM('ejercicio', 'Ejercicio (AAAA)'), NUM('importe', 'Importe anual (Pz)')] },
  pres_reasignar:{ g: 'Presupuestos', l: 'Reasignar presupuesto entre unidades', m: 'POST', p: 'bk/presupuestos/reasignaciones', confirm: true,
    f: [CIP_B, ACTOR, b('desde', 'Unidad origen (id)', 'text', { req: true }), b('hasta', 'Unidad destino (id)', 'text', { req: true }), NUM('ejercicio', 'Ejercicio (AAAA)'), NUM('importe', 'Importe (Pz)'), b('motivo', 'Motivo', 'text', { max: 200 })] },
  // ---- Gastos ----
  gasto_proponer:{ g: 'Gastos', l: 'Proponer gasto', m: 'POST', p: 'bk/gastos', idem: true, confirm: true,
    f: [CIP_B, ACTOR, b('unidad', 'Unidad (id)', 'text', { req: true }), NUM('ejercicio', 'Ejercicio (AAAA)'), NUM('importe', 'Importe (Pz)'), b('concepto', 'Concepto', 'text', { req: true, max: 140 }), IBAN('beneficiario_iban', 'IBAN beneficiario')] },
  gasto_accion:  { g: 'Gastos', l: 'Aprobar, rechazar o pagar gasto', m: 'POST', p: 'bk/gastos/{id}/accion', confirm: true,
    f: [p('id', 'Id del gasto'), ACTOR, SEL('accion', 'Acción', ['aprobar', 'rechazar', 'pagar'])] },
  // ---- Tareas y retribuciones ----
  tarea_registrar:{ g: 'Tareas', l: 'Registrar tarea con complemento', m: 'POST', p: 'bk/tareas', confirm: true,
    f: [CIP_B, DIP_B(), b('unidad', 'Unidad (id)', 'text', { req: true }), b('concepto', 'Concepto', 'text', { req: true, max: 140 }), NUM('importe', 'Importe (Pz)'), b('referencia_externa', 'Referencia externa (única)', 'text', { req: true, max: 80 })] },
  tarea_accion:  { g: 'Tareas', l: 'Validar, pagar o rechazar tarea', m: 'POST', p: 'bk/tareas/{id}/accion', confirm: true,
    f: [p('id', 'Id de la tarea'), ACTOR, SEL('accion', 'Acción', ['validar', 'pagar', 'rechazar'])] },
  retrib_fijar:  { g: 'Retribuciones', l: 'Fijar retribución', m: 'POST', p: 'bk/retribuciones', confirm: true,
    f: [CIP_B, DIP_B(), ACTOR, b('concepto', 'Concepto', 'text', { req: true, max: 140 }), NUM('importe', 'Importe (Pz)'), b('desde', 'Desde (AAAA-MM-DD)', 'date', { req: true }), b('motivo', 'Motivo', 'text', { max: 200 })] },
  expediente:    { g: 'Retribuciones', l: 'Expediente de una persona', m: 'GET', p: 'bk/expedientes', f: [CIP_Q, q('dip', 'DIP de la persona', 'text', { req: true })] },
  // ---- Personas y vínculos ----
  personas:      { g: 'Personas', l: 'Buscar cuentas por DIP', m: 'GET', p: 'bk/personas', f: [q('dip', 'DIP', 'text', { req: true })] },
  vincular:      { g: 'Personas', l: 'Vincular persona a cuenta', m: 'POST', p: 'bk/link-account', confirm: true,
    f: [DIP_B(), IBAN('iban', 'IBAN de la cuenta de la entidad'), SEL('rol', 'Rol', ['holder', 'coholder', 'authorized'])] },
  // ---- Nóminas y planes ----
  nominas_ver:   { g: 'Nóminas', l: 'Contratos de nómina', m: 'GET', p: 'bk/nominas', f: [] },
  nomina_pagar:  { g: 'Nóminas', l: 'Generar y pagar nómina de un periodo', m: 'POST', p: 'bk/nominas/periodos', confirm: true, typed: 'PAGAR',
    f: [CIP_B, b('periodo', 'Periodo (AAAA-MM)', 'period', { req: true }), ACTOR] },
  planes_ver:    { g: 'Nóminas', l: 'Planes a plazos de la entidad', m: 'GET', p: 'bk/planes', f: [] },
  // ---- Tarjetas (cobros de la entidad) ----
  cargo_crear:   { g: 'Tarjetas', l: 'Autorizar cargo en tarjeta', m: 'POST', p: 'bk/tarjetas/cargos', idem: true, confirm: true,
    f: [b('card_ref', 'Referencia de tarjeta', 'text', { req: true }), NUM('importe', 'Importe (Pz)'), IBAN('iban_comercio', 'IBAN del comercio')] },
  cargo_liquidar:{ g: 'Tarjetas', l: 'Liquidar cargo autorizado', m: 'POST', p: 'bk/tarjetas/cargos/{id}/liquidar', idem: true, confirm: true, f: [p('id', 'Id del cargo')] },
  cargo_liberar: { g: 'Tarjetas', l: 'Liberar cargo autorizado', m: 'POST', p: 'bk/tarjetas/cargos/{id}/liberar', confirm: true, f: [p('id', 'Id del cargo')] },
  // ---- Cuentas (API de cuentas de la entidad) ----
  cuenta_ver:    { g: 'Cuentas', l: 'Ficha de una cuenta', m: 'GET', p: 'accounts/{iban}', f: [p('iban', 'IBAN')] },
  cuenta_crear:  { g: 'Cuentas', l: 'Crear cuenta', m: 'POST', p: 'accounts', idem: true, confirm: true,
    f: [b('name', 'Nombre de la cuenta', 'text', { req: true, max: 60 }), b('owner', 'Titular (id)', 'text', { req: true }), b('product_id', 'Producto (id)', 'text', { req: true })] },
  cuenta_movs:   { g: 'Cuentas', l: 'Movimientos de una cuenta', m: 'GET', p: 'accounts/{iban}/transactions', f: [p('iban', 'IBAN')] },
  cuenta_recibos:{ g: 'Cuentas', l: 'Recibos de una cuenta', m: 'GET', p: 'accounts/{iban}/receipts', f: [p('iban', 'IBAN')] },
  cuenta_tarj:   { g: 'Cuentas', l: 'Tarjetas de una cuenta', m: 'GET', p: 'accounts/{iban}/cards', f: [p('iban', 'IBAN')] },
  membresia_ver: { g: 'Cuentas', l: 'Membresía (cuenta Junior)', m: 'GET', p: 'accounts/{iban}/membership', f: [p('iban', 'IBAN')] },
  membresia_ren: { g: 'Cuentas', l: 'Renovar membresía', m: 'POST', p: 'accounts/{iban}/membership/renew', confirm: true,
    f: [p('iban', 'IBAN'), b('user_id', 'Usuario (id)', 'text', { req: true })] },
  transferir:    { g: 'Transferencias', l: 'Transferir entre cuentas de la entidad', m: 'POST', p: 'transfers', idem: true, confirm: true,
    f: [IBAN('from_iban', 'IBAN origen'), IBAN('to_iban', 'IBAN destino'), NUM('amount', 'Importe (Pz)'), b('memo', 'Concepto', 'text', { max: 140 }), b('user_id', 'Usuario (id, opcional)', 'text')] },
  transferencia_ver: { g: 'Transferencias', l: 'Estado de una transferencia', m: 'GET', p: 'transfers/{ref}', f: [p('ref', 'Referencia')] },
  disenos_ver:   { g: 'Catálogo', l: 'Catálogo de diseños', m: 'GET', p: 'designs', f: [] },
  productos_ver: { g: 'Catálogo', l: 'Productos de la entidad', m: 'GET', p: 'products', f: [] },
  // ---- Versión nueva del banco: identidad, pasarela y pagos ----
  branding_ver:  { g: 'Pasarela', l: 'Ver identidad de la entidad en la ventana de pago', m: 'GET', p: 'bk/branding', f: [] },
  branding_fijar:{ g: 'Pasarela', l: 'Fijar nombre, logo, color y texto legal de la entidad', m: 'PUT', p: 'bk/branding', f: [b('nombre', 'Nombre', 'text', { max: 80 }), b('logo', 'Logo (URL https)', 'text', { max: 300 }), b('color', 'Color (#RRGGBB)', 'text', { max: 7 }), b('texto_legal', 'Texto legal', 'text', { max: 500 }), EXTRA] },
  comercio_branding:{ g: 'Pasarela', l: 'Fijar nombre, logo y color de mi comercio', m: 'PUT', p: 'bk/comercio/branding', f: [b('nombre', 'Nombre', 'text', { max: 80 }), b('logo', 'Logo (URL https)', 'text', { max: 300 }), b('color', 'Color (#RRGGBB)', 'text', { max: 7 })] },
  pasarela_ver:  { g: 'Pasarela', l: 'Ver el producto pasarela de la entidad', m: 'GET', p: 'bk/pasarela', f: [] },
  pasarela_fijar:{ g: 'Pasarela', l: 'Activar la pasarela y fijar sus parámetros', m: 'PUT', p: 'bk/pasarela', confirm: true, f: [EXTRA] },
  restr_ver:     { g: 'Pasarela', l: 'Ver restricciones de pago de la entidad', m: 'GET', p: 'bk/restricciones', f: [] },
  restr_fijar:   { g: 'Pasarela', l: 'Prohibir o permitir medio, tarjeta u operación de pago', m: 'PUT', p: 'bk/restricciones', confirm: true, f: [EXTRA] },
  pagos_ver:     { g: 'Pagos', l: 'Pagos pendientes de confirmación', m: 'GET', p: 'bk/pagos', f: [] },
  pagos_canjear: { g: 'Pagos', l: 'Canjear código de pago de un cliente', m: 'POST', p: 'bk/pagos/canjear', f: [b('codigo', 'Código de pago', 'text', { req: true, max: 20 })] },
  pagos_resolver:{ g: 'Pagos', l: 'Aprobar o rechazar un pago', m: 'POST', p: 'bk/pagos/{id}/resolucion', confirm: true,
    f: [p('id', 'Id del pago'), SEL('accion', 'Decisión', ['aprobar', 'rechazar'])] },
  comisiones_ver:{ g: 'Pagos', l: 'Ver política de comisiones interbancarias', m: 'GET', p: 'bk/comisiones', f: [] },
  comisiones_fijar:{ g: 'Pagos', l: 'Decidir quién paga la comisión interbancaria', m: 'PUT', p: 'bk/comisiones', confirm: true, f: [EXTRA] },
  // ---- Versión nueva del banco: entidad institucional ----
  entidad_config:{ g: 'Entidad', l: 'Activar solicitudes y fijar la doble firma', m: 'PUT', p: 'bk/entidad/configuracion', confirm: true, f: [EXTRA] },
  presup_mensual:{ g: 'Presupuestos', l: 'Fijar presupuesto de un mes', m: 'POST', p: 'bk/presupuestos/mensual', f: [CIP_B, b('unidad', 'Unidad (id, vacío = general)', 'text'), NUM('ejercicio', 'Ejercicio (AAAA)'), NUM('mes', 'Mes (1-12)'), NUM('importe', 'Importe del mes (Pz)'), EXTRA] },
  presup_plan:   { g: 'Presupuestos', l: 'Crear plan plurianual', m: 'POST', p: 'bk/presupuestos/planes', confirm: true, f: [CIP_B, b('nombre', 'Nombre del plan', 'text', { max: 120 }), EXTRA] },
  fondo_crear:   { g: 'Presupuestos', l: 'Crear fondo restringido a una finalidad', m: 'POST', p: 'bk/fondos', confirm: true, f: [CIP_B, b('nombre', 'Nombre', 'text', { req: true, max: 120 }), b('finalidad', 'Finalidad', 'text', { max: 200 }), EXTRA] },
  recurrente_auto:{ g: 'Recurrentes', l: 'Autorizar pago recurrente de una unidad', m: 'POST', p: 'bk/recurrentes', confirm: true,
    f: [CIP_B, b('unidad', 'Unidad (id)', 'text', { req: true }), NUM('importe', 'Importe (Pz)'), b('concepto', 'Concepto', 'text', { req: true, max: 140 }), IBAN('beneficiario_iban', 'IBAN beneficiario'), b('periodicidad', 'Periodicidad (mensual, trimestral…)', 'text', { max: 40 }), EXTRA] },
  recurrente_gen:{ g: 'Recurrentes', l: 'Generar propuestas de gasto de un periodo', m: 'POST', p: 'bk/recurrentes/generar', confirm: true, f: [CIP_B, b('periodo', 'Periodo (AAAA-MM)', 'period', { req: true })] },
  convocatoria_abrir:{ g: 'Entidad', l: 'Abrir convocatoria interna de financiación', m: 'POST', p: 'bk/convocatorias', confirm: true, f: [CIP_B, b('titulo', 'Título', 'text', { req: true, max: 140 }), EXTRA] },
  solicitud_crear:{ g: 'Solicitudes', l: 'Crear solicitud de una unidad', m: 'POST', p: 'bk/solicitudes', f: [CIP_B, SEL('tipo', 'Tipo', ['prorroga', 'ampliacion', 'reserva_extra', 'financiacion', 'otra']), b('unidad', 'Unidad (id)', 'text', { req: true }), NUM('importe', 'Importe (Pz)'), b('motivo', 'Motivo', 'text', { max: 300 }), EXTRA] },
  solicitud_resolver:{ g: 'Solicitudes', l: 'Resolver solicitud (concedida o denegada)', m: 'POST', p: 'bk/solicitudes/{id}/resolver', confirm: true,
    f: [p('id', 'Id de la solicitud'), SEL('decision', 'Decisión', ['concedida', 'denegada']), b('motivo', 'Motivo', 'text', { max: 300 })] },
  cuentas_entidad:{ g: 'Cuentas', l: 'Cuentas de la entidad con saldo disponible', m: 'GET', p: 'bk/cuentas', f: [] },
  // ---- Versión nueva del banco: webhooks ----
  webhooks_ver:  { g: 'Webhooks', l: 'Listar webhooks de la entidad', m: 'GET', p: 'bk/webhooks', f: [] },
  webhook_alta:  { g: 'Webhooks', l: 'Dar de alta un webhook (el secreto se muestra una vez)', m: 'POST', p: 'bk/webhooks', confirm: true, f: [b('url', 'URL https de destino', 'text', { req: true, max: 300 }), b('eventos', 'Eventos (separados por comas)', 'text', { max: 300 }), EXTRA] },
  webhook_baja:  { g: 'Webhooks', l: 'Dar de baja un webhook', m: 'DELETE', p: 'bk/webhooks/{id}', confirm: true, f: [p('id', 'Id del webhook')] },
  webhook_rotar: { g: 'Webhooks', l: 'Rotar el secreto de un webhook', m: 'POST', p: 'bk/webhooks/{id}/rotar', confirm: true, f: [p('id', 'Id del webhook')] },
  webhook_entregas:{ g: 'Webhooks', l: 'Últimas entregas de eventos', m: 'GET', p: 'bk/webhooks/entregas', f: [] },
}

/** Lo que ve el navegador: sin rutas internas ni campos automáticos. */
export const catalogoPublico = () => Object.entries(OPS).map(([id, o]) => ({
  id, g: o.g, l: o.l, m: o.m, idem: !!o.idem, confirm: !!o.confirm, typed: o.typed || null,
  f: o.f.filter((x) => !x.auto).map(({ k, l, t, req, opts, max }) => ({ k, l, t, req: !!req, opts: opts || null, max: max || null })),
}))

const DATE = /^\d{4}-\d{2}-\d{2}$/
const PERIOD = /^\d{4}-(0[1-9]|1[0-2])$/

/** Valida y construye { path, query, body } para el banco. Devuelve { error } o { path, query, body }. */
export function construir(opId, valores, { cip, actor }) {
  const o = OPS[opId]
  if (!o) return { error: 'Operación no disponible.' }
  const v = valores && typeof valores === 'object' ? valores : {}
  let path = o.p, query = {}, body = {}
  let extra = null

  for (const f of o.f) {
    if (f.t === 'json' && f.k === 'extra') { extra = v.extra; continue }
    let val
    if (f.auto === 'cip') { if (!cip) return { error: 'Falta configurar ENTIDAD_CIP en el servidor.' }; val = cip }
    else if (f.auto === 'actor') { if (!actor) return { error: 'Tu DIP de operador no está en la sesión. Vuelve a entrar.' }; val = actor }
    else {
      val = v[f.k]
      if (typeof val === 'string') val = val.trim()
      const vacio = val === undefined || val === null || val === ''
      if (vacio) { if (f.req) return { error: `Falta: ${f.l}.` }; continue }
      if (f.t === 'num') { const n = Number(String(val).replace(',', '.')); if (!Number.isFinite(n)) return { error: `${f.l} no es un número.` }; val = n }
      else if (f.t === 'iban') { val = normIban(val); if (!isIban(val)) return { error: `${f.l} no es un IBAN válido.` } }
      else if (f.t === 'date') { if (!DATE.test(val)) return { error: `${f.l} debe tener formato AAAA-MM-DD.` } }
      else if (f.t === 'period') { if (!PERIOD.test(val)) return { error: `${f.l} debe tener formato AAAA-MM.` } }
      else if (f.t === 'sel') { if (!(f.opts || []).includes(val)) return { error: `${f.l}: valor no válido.` } }
      else if (f.t === 'text') { val = cleanText(String(val), f.max || 200); if (!val) { if (f.req) return { error: `Falta: ${f.l}.` }; continue } }
    }
    if (f.in === 'path') {
      const s = String(f.k === 'iban' ? normIban(val) : val)
      if (!isSegment(s)) return { error: `${f.l}: identificador no válido.` }
      path = path.replace('{' + f.k + '}', encodeURIComponent(s))
    } else if (f.in === 'query') query[f.k] = val
    else body[f.k] = val
  }
  if (extra !== undefined && extra !== null && String(extra).trim() !== '') {
    let e
    try { e = typeof extra === 'string' ? JSON.parse(extra) : extra } catch { return { error: 'Los campos adicionales deben ser JSON válido.' } }
    if (!e || typeof e !== 'object' || Array.isArray(e)) return { error: 'Los campos adicionales deben ser un objeto JSON.' }
    for (const [k, val] of Object.entries(e)) if (!(k in body) && !(k in query)) body[k] = val
  }
  return { path, query, body: o.m === 'GET' || o.m === 'DELETE' ? null : body }
}

/** Operadores: DIP en ENTIDAD/OPERADORES_DIP (servidor). */
export const isOperador = (s) => {
  const lista = (process.env.OPERADORES_DIP || '').split(',').map((x) => x.toUpperCase().replace(/[\s-]/g, '')).filter(Boolean)
  return !!s?.dip && lista.includes(String(s.dip).toUpperCase().replace(/[\s-]/g, ''))
}
