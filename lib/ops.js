// Operaciones de ENTIDAD (cuentas institucionales, nóminas, organigrama…). SOLO servidor decide y valida.
// El navegador solo ve el catálogo (GET /api/ops) y envía { op, valores }. Nunca rutas ni campos libres:
// cada operación declara sus campos; cualquier otro campo se descarta. Los campos `auto` no los rellena el
// navegador: el CIP sale de ENTIDAD_CIP y `dip_actor` sale de la sesión del operador (la separación de
// funciones la aplica el banco con ese DIP, no con lo que envíe el navegador).
// QUIÉN: solo el titular o cotitular de la cuenta activa (lib/titular.js). QUÉ: cada operación declara en `k` para qué
// tipos de cuenta existe (por defecto solo 'institucional'). Los campos `own` de una cuenta que no es institucional
// no los elige el navegador: el servidor pone la propia cuenta activa.
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
const OPT = (o = {}) => ({ req: false, ...o })
const EXTRA = { k: 'extra', l: 'Campos adicionales (JSON, opcional)', t: 'json', in: 'body' }

export const OPS = {
  // ---- Organigrama ----
  org_ver:       { g: 'Organigrama', l: 'Ver organigrama', m: 'GET', p: 'bk/organigrama', f: [CIP_Q] },
  org_unidad:    { g: 'Organigrama', l: 'Crear unidad / departamento', m: 'POST', p: 'bk/organigrama', confirm: true,
    f: [CIP_B, ACTOR, { k: 'accion', in: 'body', auto: 'const', v: 'unidad' }, b('nombre', 'Nombre de la unidad', 'text', { req: true, max: 120 }), b('superior', 'Unidad superior (id, vacío = raíz)', 'text'), EXTRA] },
  org_puesto:    { g: 'Organigrama', l: 'Crear puesto en una unidad', m: 'POST', p: 'bk/organigrama', confirm: true,
    f: [CIP_B, ACTOR, { k: 'accion', in: 'body', auto: 'const', v: 'puesto' }, b('unidad', 'Unidad (id)', 'text', { req: true }), b('nombre', 'Nombre del puesto', 'text', { req: true, max: 120 }), EXTRA] },
  org_nombrar:   { g: 'Organigrama', l: 'Nombrar a una persona en un puesto', m: 'POST', p: 'bk/organigrama', confirm: true,
    f: [CIP_B, ACTOR, { k: 'accion', in: 'body', auto: 'const', v: 'nombrar' }, b('puesto', 'Puesto (id)', 'text', { req: true }), DIP_B(), b('desde', 'Desde (AAAA-MM-DD)', 'date'), EXTRA] },
  org_cesar:     { g: 'Organigrama', l: 'Cesar un nombramiento', m: 'POST', p: 'bk/organigrama', confirm: true,
    f: [CIP_B, ACTOR, { k: 'accion', in: 'body', auto: 'const', v: 'cesar' }, b('puesto', 'Puesto (id)', 'text', { req: true }), DIP_B(), b('motivo', 'Motivo', 'text', { max: 200 }), EXTRA] },
  org_permiso:   { g: 'Organigrama', l: 'Configurar un permiso de un puesto', m: 'POST', p: 'bk/organigrama', confirm: true,
    f: [CIP_B, ACTOR, { k: 'accion', in: 'body', auto: 'const', v: 'permiso' }, b('puesto', 'Puesto (id)', 'text', { req: true }), b('permiso', 'Permiso', 'text', { req: true, max: 60 }), SEL('concedido', 'Concedido', ['si', 'no'], { bool: true }), EXTRA] },
  org_cerrar:    { g: 'Organigrama', l: 'Cerrar una unidad', m: 'POST', p: 'bk/organigrama', confirm: true,
    f: [CIP_B, ACTOR, { k: 'accion', in: 'body', auto: 'const', v: 'cerrar_unidad' }, b('unidad', 'Unidad (id)', 'text', { req: true }), b('motivo', 'Motivo', 'text', { max: 200 }), EXTRA] },
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
  cargo_crear:   { g: 'Tarjetas', l: 'Autorizar cargo en tarjeta', k: ['institucional', 'empresa'], m: 'POST', p: 'bk/tarjetas/cargos', idem: true, confirm: true,
    f: [b('card_ref', 'Referencia de tarjeta', 'text', { req: true }), NUM('importe', 'Importe (Pz)'), IBAN('iban_comercio', 'IBAN del comercio', { own: true })] },
  cargo_liquidar:{ g: 'Tarjetas', l: 'Liquidar cargo autorizado', m: 'POST', p: 'bk/tarjetas/cargos/{id}/liquidar', idem: true, confirm: true, f: [p('id', 'Id del cargo')] },
  cargo_liberar: { g: 'Tarjetas', l: 'Liberar cargo autorizado', m: 'POST', p: 'bk/tarjetas/cargos/{id}/liberar', confirm: true, f: [p('id', 'Id del cargo')] },
  // ---- Cuentas (API de cuentas de la entidad) ----
  cuenta_ver:    { g: 'Cuentas', l: 'Ficha de una cuenta', m: 'GET', p: 'accounts/{iban}', f: [p('iban', 'IBAN')] },
  cuenta_crear:  { g: 'Cuentas', l: 'Crear cuenta', m: 'POST', p: 'accounts', idem: true, confirm: true,
    f: [b('name', 'Nombre de la cuenta', 'text', { req: true, max: 60 }), b('owner', 'Titular (id)', 'text', { req: true }), b('product_id', 'Producto (id)', 'text', { req: true })] },
  cuenta_movs:   { g: 'Cuentas', l: 'Movimientos de una cuenta', m: 'GET', p: 'accounts/{iban}/transactions', f: [p('iban', 'IBAN')] },
  cuenta_recibos:{ g: 'Cuentas', l: 'Recibos de una cuenta', m: 'GET', p: 'accounts/{iban}/receipts', f: [p('iban', 'IBAN')] },
  cuenta_tarj:   { g: 'Cuentas', l: 'Tarjetas de una cuenta', m: 'GET', p: 'accounts/{iban}/cards', f: [p('iban', 'IBAN')] },
  membresia_ver: { g: 'Cuentas', l: 'Membresía (cuenta Junior)', k: ['institucional', 'junior'], m: 'GET', p: 'accounts/{iban}/membership', f: [p('iban', 'IBAN', { own: true })] },
  membresia_ren: { g: 'Cuentas', l: 'Renovar membresía', k: ['institucional', 'junior'], m: 'POST', p: 'accounts/{iban}/membership/renew', confirm: true,
    f: [p('iban', 'IBAN', { own: true }), b('user_id', 'Usuario (id)', 'text', { req: true })] },
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
  // ---- Tarjetas: NFC ----
  nfc_ver:       { g: 'Tarjetas', l: 'Ver identificador / enlace NFC de una tarjeta', m: 'GET', p: 'bk/tarjetas/{ref}/nfc', f: [p('ref', 'Referencia de tarjeta')] },
  nfc_fijar:     { g: 'Tarjetas', l: 'Registrar o cambiar el NFC de una tarjeta', m: 'PUT', p: 'bk/tarjetas/{ref}/nfc', confirm: true, f: [p('ref', 'Referencia de tarjeta'), b('nfc_id', 'Identificador NFC', 'text', { max: 80 }), b('nfc_url', 'Enlace NFC (https)', 'text', { max: 300 }), EXTRA] },
  // ---- Subvenciones y bonos ----
  prog_ver:      { g: 'Subvenciones y bonos', l: 'Programas de subvención o bono', m: 'GET', p: 'bk/programas', f: [] },
  prog_crear:    { g: 'Subvenciones y bonos', l: 'Crear programa de subvención o bono', m: 'POST', p: 'bk/programas', confirm: true,
    f: [ACTOR, b('nombre', 'Nombre', 'text', { req: true, max: 120 }), SEL('tipo', 'Tipo', ['subvencion', 'bono']), b('presupuesto', 'Presupuesto del programa (Pz)', 'num'), b('desde', 'Desde (AAAA-MM-DD)', 'date'), b('hasta', 'Hasta (AAAA-MM-DD)', 'date'), b('descripcion', 'Descripción', 'text', { max: 300 }), EXTRA] },
  conc_ver:      { g: 'Subvenciones y bonos', l: 'Concesiones de un programa', m: 'GET', p: 'bk/programas/{id}/concesiones', f: [p('id', 'Id del programa')] },
  conc_crear:    { g: 'Subvenciones y bonos', l: 'Conceder un importe máximo a un beneficiario', m: 'POST', p: 'bk/programas/{id}/concesiones', confirm: true,
    f: [p('id', 'Id del programa'), ACTOR, DIP_B({ l: 'DIP del beneficiario' }), NUM('importe_maximo', 'Importe máximo (Pz)'), EXTRA] },
  just_ver:      { g: 'Subvenciones y bonos', l: 'Justificaciones de gasto', m: 'GET', p: 'bk/justificaciones', f: [q('concesion', 'Concesión (id, opcional)', 'text')] },
  just_crear:    { g: 'Subvenciones y bonos', l: 'Justificar un gasto ya hecho', m: 'POST', p: 'bk/justificaciones', idem: true, confirm: true,
    f: [b('concesion', 'Concesión (id)', 'text', { req: true }), NUM('importe', 'Importe (Pz)'), b('concepto', 'Concepto', 'text', { max: 140 }), IBAN('iban_comercio', 'IBAN del comercio', OPT()), EXTRA] },
  just_pagar:    { g: 'Subvenciones y bonos', l: 'Aprobar y pagar una justificación', m: 'POST', p: 'bk/justificaciones/{id}/pagar', idem: true, confirm: true, f: [p('id', 'Id de la justificación'), ACTOR] },
  just_rechazar: { g: 'Subvenciones y bonos', l: 'Rechazar una justificación pendiente', m: 'POST', p: 'bk/justificaciones/{id}/rechazar', confirm: true, f: [p('id', 'Id de la justificación'), ACTOR, b('motivo', 'Motivo', 'text', { max: 300 })] },
  // ---- Reglas de uso (RBU y subvenciones) ----
  pol_ver:       { g: 'Reglas de uso', l: 'Reglas de uso activas (RBU y programas)', m: 'GET', p: 'bk/politicas', f: [] },
  pol_crear:     { g: 'Reglas de uso', l: 'Crear regla de uso (sustituye a la activa del mismo ámbito)', m: 'POST', p: 'bk/politicas', confirm: true,
    f: [ACTOR, b('ambito', 'Ámbito (rbu o id de programa)', 'text', { req: true, max: 60 }), b('tipos_destino', 'Tipos de cuenta permitidos (separados por comas)', 'list'), b('comercios', 'Comercios permitidos (separados por comas)', 'list'), b('categorias', 'Categorías permitidas (separadas por comas)', 'list'), EXTRA] },
  pol_desactivar:{ g: 'Reglas de uso', l: 'Desactivar una regla de uso', m: 'POST', p: 'bk/politicas/{id}/desactivar', confirm: true, f: [p('id', 'Id de la regla')] },
  categorias_ver:{ g: 'Reglas de uso', l: 'Categorías de comercio de Placeta', m: 'GET', p: 'bk/categorias', f: [] },
  comercios_ver: { g: 'Reglas de uso', l: 'Directorio de comercios con su categoría', m: 'GET', p: 'bk/comercios', f: [] },
  destinos_ver:  { g: 'Reglas de uso', l: 'Tipos de cuenta de destino de la plataforma', m: 'GET', p: 'bk/tipos-destino', f: [] },
  // ---- Tasas ----
  tasas_ver:     { g: 'Tasas', l: 'Tasas de la entidad sobre pasarelas y comercios', m: 'GET', p: 'bk/tasas', f: [] },
  tasa_crear:    { g: 'Tasas', l: 'Crear tasa sobre los pagos de la pasarela', m: 'POST', p: 'bk/tasas', confirm: true,
    f: [b('nombre', 'Nombre', 'text', { req: true, max: 80 }), b('porcentaje', 'Porcentaje (%)', 'num'), b('fijo', 'Importe fijo (Pz)', 'num'), b('comercio', 'Comercio (vacío = todos)', 'text'), EXTRA] },
  tasa_desactivar:{ g: 'Tasas', l: 'Desactivar una tasa', m: 'POST', p: 'bk/tasas/{id}/desactivar', confirm: true, f: [p('id', 'Id de la tasa')] },
  // ---- Interbancario y disputas ----
  interb_ver:    { g: 'Interbancario', l: 'Operaciones interbancarias (pagadas y cobradas)', m: 'GET', p: 'bk/interbancarias', f: [q('desde', 'Desde (AAAA-MM-DD)', 'date'), q('hasta', 'Hasta (AAAA-MM-DD)', 'date')] },
  interb_pos:    { g: 'Interbancario', l: 'Posición neta frente a cada banco', m: 'GET', p: 'bk/interbancarias/posicion', f: [q('desde', 'Desde (AAAA-MM-DD)', 'date'), q('hasta', 'Hasta (AAAA-MM-DD)', 'date')] },
  disputas_ver:  { g: 'Interbancario', l: 'Reclamaciones de deudas de la entidad', m: 'GET', p: 'bk/disputas', f: [] },
  disputa_resolver:{ g: 'Interbancario', l: 'Resolver una reclamación (banco acreedor)', m: 'POST', p: 'bk/disputas/{id}/resolver', confirm: true,
    f: [p('id', 'Id de la reclamación'), ACTOR, SEL('decision', 'Decisión', ['aceptar', 'rechazar']), b('motivo', 'Motivo', 'text', { max: 300 }), EXTRA] },
  // ---- Empresas ----
  empresas_ver:  { g: 'Empresas', l: 'Empresas de la entidad', m: 'GET', p: 'bk/empresas', f: [] },
  empresa_alta:  { g: 'Empresas', l: 'Dar de alta una empresa con su titular inicial', m: 'POST', p: 'bk/empresas', idem: true, confirm: true,
    f: [b('nombre', 'Nombre de la empresa', 'text', { req: true, max: 120 }), b('cif', 'CIF / identificación fiscal', 'text', { max: 30 }), DIP_B({ l: 'DIP del titular inicial' }), EXTRA] },
  empresa_ver:   { g: 'Empresas', l: 'Ficha de una empresa (titulares, cuentas, pasarela)', m: 'GET', p: 'bk/empresas/{id}', f: [p('id', 'Id de la empresa')] },
  empresa_ficha: { g: 'Empresas', l: 'Ficha completa (entidad, organigrama, presupuesto, nóminas)', m: 'GET', p: 'bk/empresas/{id}/ficha', f: [p('id', 'Id de la empresa')] },
  empresa_contrato:{ g: 'Empresas', l: 'Contrato vigente de la empresa', m: 'GET', p: 'bk/empresas/{id}/contrato', f: [p('id', 'Id de la empresa')] },
  empresa_entidad:{ g: 'Empresas', l: 'Vincular la entidad institucional (CIP) a la empresa', m: 'POST', p: 'bk/empresas/{id}/entidad', confirm: true, f: [p('id', 'Id de la empresa'), CIP_B] },
  empresa_estado:{ g: 'Empresas', l: 'Activar, suspender o dar de baja una empresa', m: 'POST', p: 'bk/empresas/{id}/estado', confirm: true, f: [p('id', 'Id de la empresa'), SEL('estado', 'Estado', ['activa', 'suspendida', 'baja'])] },
  empresa_pasarela:{ g: 'Empresas', l: 'Dar de alta la pasarela de la empresa (cliente de API y contrato)', m: 'POST', p: 'bk/empresas/{id}/pasarela', confirm: true, f: [p('id', 'Id de la empresa'), EXTRA] },
  empresa_rotar: { g: 'Empresas', l: 'Rotar la clave de la pasarela (la anterior deja de valer)', m: 'POST', p: 'bk/empresas/{id}/pasarela/rotar', confirm: true, f: [p('id', 'Id de la empresa')] },
  empresa_titular:{ g: 'Empresas', l: 'Dar de alta titular, autorizado o lector', m: 'POST', p: 'bk/empresas/{id}/titulares', confirm: true, f: [p('id', 'Id de la empresa'), DIP_B(), SEL('rol', 'Rol', ['titular', 'autorizado', 'lector'])] },
  empresa_cese:  { g: 'Empresas', l: 'Dar de baja a un titular de la empresa', m: 'POST', p: 'bk/empresas/{id}/titulares/cese', confirm: true, f: [p('id', 'Id de la empresa'), DIP_B()] },
  // ---- Claves de API de la entidad ----
  clientes_ver:  { g: 'Claves de API', l: 'Claves de API de la entidad (sin claves)', m: 'GET', p: 'bk/clientes', f: [] },
  cliente_crear: { g: 'Claves de API', l: 'Crear una clave de API (se muestra una sola vez)', m: 'POST', p: 'bk/clientes', confirm: true,
    f: [b('nombre', 'Nombre', 'text', { req: true, max: 80 }), b('permisos', 'Permisos (scopes, separados por comas)', 'list', { req: true }), EXTRA] },
  cliente_rotar: { g: 'Claves de API', l: 'Rotar una clave de API (la anterior deja de valer)', m: 'POST', p: 'bk/clientes/{id}/rotar', confirm: true, f: [p('id', 'Id de la clave')] },
  cliente_baja:  { g: 'Claves de API', l: 'Desactivar una clave de API', m: 'POST', p: 'bk/clientes/{id}/desactivar', confirm: true, f: [p('id', 'Id de la clave')] },
  webhook_reintentar:{ g: 'Webhooks', l: 'Reintentar una entrega fallida', m: 'POST', p: 'bk/webhooks/entregas/{id}/reintentar', f: [p('id', 'Id de la entrega')] },
  webhook_entregas:{ g: 'Webhooks', l: 'Últimas entregas de eventos', m: 'GET', p: 'bk/webhooks/entregas', f: [] },
}

/** Tipos de cuenta para los que existe cada operación (por defecto, solo la cuenta institucional = la entidad). */
export const kindsOf = (o) => o.k || ['institucional']
const enEntidad = (kind) => kind === 'institucional'

/** Lo que ve el navegador para una cuenta de este tipo: sin rutas internas, sin campos automáticos y sin los `own`. */
export const catalogoPublico = (kind) => Object.entries(OPS).filter(([, o]) => kindsOf(o).includes(kind)).map(([id, o]) => ({
  id, g: o.g, l: o.l, m: o.m, idem: !!o.idem, confirm: !!o.confirm, typed: o.typed || null,
  f: o.f.filter((x) => !x.auto && !(x.own && !enEntidad(kind))).map(({ k, l, t, req, opts, max }) => ({ k, l, t, req: !!req, opts: opts || null, max: max || null })),
}))

const DATE = /^\d{4}-\d{2}-\d{2}$/
const PERIOD = /^\d{4}-(0[1-9]|1[0-2])$/

/** Valida y construye { path, query, body } para el banco. Devuelve { error } o { path, query, body }. */
export function construir(opId, valores, { cip, actor, iban, kind }) {
  const o = OPS[opId]
  if (!o || !kindsOf(o).includes(kind)) return { error: 'Operación no disponible para este tipo de cuenta.' }
  const v = valores && typeof valores === 'object' ? valores : {}
  let path = o.p, query = {}, body = {}
  let extra = null

  for (const f of o.f) {
    if (f.t === 'json' && f.k === 'extra') { extra = v.extra; continue }
    let val
    if (f.auto === 'cip') { if (!cip) return { error: 'Falta configurar ENTIDAD_CIP en el servidor.' }; val = cip }
    else if (f.auto === 'const') val = f.v
    else if (f.own && !enEntidad(kind)) val = iban
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
      else if (f.t === 'sel') { if (!(f.opts || []).includes(val)) return { error: `${f.l}: valor no válido.` }; if (f.bool) val = val === 'si' }
      else if (f.t === 'list') { val = String(val).split(',').map((x) => cleanText(x, 80)).filter(Boolean).slice(0, 50); if (!val.length) { if (f.req) return { error: `Falta: ${f.l}.` }; continue } }
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
