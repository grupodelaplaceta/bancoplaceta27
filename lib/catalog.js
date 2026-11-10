// Catálogo de funciones de la API. Cada módulo se muestra según el TIPO DE CUENTA seleccionada.
// Los nombres de campo son los más probables según la documentación; cada formulario tiene además
// «Opciones avanzadas (JSON)» que se fusiona con el cuerpo, por si la API pide algún campo distinto.

export const KINDS = { personal: 'Personal', junior: 'Junior', empresa: 'Empresa', institucional: 'Institucional', prepago: 'Prepago / RBU' }

// Detecta el tipo de cuenta a partir de lo que devuelva la ficha de la cuenta.
export function kindOf(a = {}) {
  const t = String(a.kind || a.type || a.account_type || a.product || a.category || '').toLowerCase()
  if (/junior|menor|joven/.test(t)) return 'junior'
  if (/empresa|company|business|comerc|aut[oó]nom/.test(t)) return 'empresa'
  if (/institu|entidad|p[uú]blic|ayunt|gobiern|organi[sz]a|ong|asociaci/.test(t)) return 'institucional'
  if (/prepago|prepaid|rbu|bono/.test(t)) return 'prepago'
  return 'personal'
}

const ALL = '*'
const INST = ['institucional']
const EMP = ['empresa']
const BONOS = ['institucional', 'prepago']
const NOMINA = ['institucional', 'empresa']
const COBROS = ['empresa', 'institucional']

// t: text|number|date|select|checkbox|textarea|json|list|file   r: obligatorio   d:'iban' → se rellena con la cuenta activa
const f = (k, l, t = 'text', o = {}) => ({ k, l, t, ...o })
const id = (l = 'Identificador') => f('id', l, 'text', { r: true })
const L = (title, path, scope, fields = [], o = {}) => ({ t: 'list', method: 'GET', title, path, scope, fields, ...o })
const A = (title, method, path, scope, fields = [], o = {}) => ({ t: 'act', title, method, path, scope, fields, ...o })
const SEL = (k, l, opts, o = {}) => f(k, l, 'select', { opts, ...o })
const IMP = (k = 'importe', l = 'Importe (€)') => f(k, l, 'number', { r: true, step: '0.01', min: '0.01' })

export const MODULES = [
  // ───────────── Cliente (cualquier usuario con sesión) ─────────────
  { id: 'membresia', aud: 'client', title: 'Membresía Junior', kinds: ['junior'], desc: 'Estado y renovación de la membresía de la cuenta Junior.',
    sections: [
      L('Estado de la membresía', 'accounts/{iban}/membership', 'memberships:read'),
      A('Renovar la membresía', 'POST', 'accounts/{iban}/membership/renew', 'memberships:write', [], { danger: true, confirm: 'Se renovará la membresía y puede cobrarse su importe. ¿Continuar?' }),
    ] },
  { id: 'catalogo', aud: 'client', title: 'Catálogo', kinds: [ALL], desc: 'Productos y diseños de tarjeta disponibles, y estado de transferencias.',
    sections: [
      L('Productos de la entidad', 'products', 'products:read'),
      L('Catálogo de diseños', 'designs', 'products:read'),
      L('Estado de una transferencia', 'transfers/{ref}', 'transfers:read'),
    ] },

  // ───────────── Gestión de la entidad (administradores) ─────────────
  { id: 'cuentas', aud: 'admin', title: 'Cuentas y personas', kinds: [ALL], desc: 'Cuentas de la entidad, apertura desde un producto y vinculación de usuarios.',
    sections: [
      L('Cuentas de la entidad con saldo', 'bk/cuentas', 'accounts:read'),
      L('Ficha de una cuenta', 'accounts/{iban}', 'accounts:read'),
      A('Abrir una cuenta desde un producto', 'POST', 'accounts', 'accounts:write', [f('product_id', 'Producto', 'text', { r: true }), f('holder_dip', 'DIP del titular'), f('name', 'Nombre de la cuenta')], { danger: true }),
      L('Buscar cuentas de una persona (DIP)', 'bk/personas', 'personas:buscar', [f('dip', 'DIP', 'text', { r: true })]),
      A('Vincular un usuario a una cuenta', 'POST', 'bk/link-account', 'usuarios:gestionar', [f('dip', 'DIP del usuario', 'text', { r: true }), f('iban', 'IBAN', 'text', { r: true, d: 'iban' })]),
    ] },

  { id: 'organigrama', aud: 'admin', title: 'Organigrama', kinds: INST, desc: 'Unidades, puestos y nombramientos de una entidad institucional.',
    sections: [
      L('Árbol del organigrama', 'bk/organigrama', 'organigrama:leer'),
      A('Crear una unidad', 'POST', 'bk/organigrama', 'organigrama:gestionar', [f('nombre', 'Nombre', 'text', { r: true }), f('superior_id', 'Unidad superior (id)')], { fixed: { accion: 'unidad' } }),
      A('Crear un puesto', 'POST', 'bk/organigrama', 'organigrama:gestionar', [f('unidad_id', 'Unidad (id)', 'text', { r: true }), f('nombre', 'Nombre del puesto', 'text', { r: true })], { fixed: { accion: 'puesto' } }),
      A('Nombrar a una persona', 'POST', 'bk/organigrama', 'organigrama:gestionar', [f('puesto_id', 'Puesto (id)', 'text', { r: true }), f('dip', 'DIP de la persona', 'text', { r: true }), f('desde', 'Desde', 'date')], { fixed: { accion: 'nombrar' } }),
      A('Cesar un nombramiento', 'POST', 'bk/organigrama', 'organigrama:gestionar', [f('puesto_id', 'Puesto (id)', 'text', { r: true }), f('dip', 'DIP', 'text', { r: true }), f('hasta', 'Hasta', 'date')], { fixed: { accion: 'cesar' }, danger: true }),
      A('Configurar permisos de un puesto', 'POST', 'bk/organigrama', 'organigrama:gestionar', [f('puesto_id', 'Puesto (id)', 'text', { r: true }), f('permiso', 'Permiso', 'text', { r: true, ph: 'p. ej. aprobar_gastos' }), f('valor', 'Concedido', 'checkbox')], { fixed: { accion: 'permiso' } }),
      A('Cerrar una unidad', 'POST', 'bk/organigrama', 'organigrama:gestionar', [f('unidad_id', 'Unidad (id)', 'text', { r: true })], { fixed: { accion: 'cerrar_unidad' }, danger: true, confirm: 'Se cerrará la unidad. ¿Continuar?' }),
    ] },

  { id: 'presupuestos', aud: 'admin', title: 'Presupuestos', kinds: INST, desc: 'Presupuestos anuales y mensuales por unidad, planes plurianuales, reasignaciones y fondos.',
    sections: [
      L('Informe de una unidad', 'bk/presupuestos', 'presupuestos:leer', [f('unidad_id', 'Unidad (vacío = general)'), f('ejercicio', 'Ejercicio', 'number', { ph: String(new Date().getFullYear()) })]),
      A('Fijar presupuesto anual', 'PUT', 'bk/presupuestos', 'presupuestos:gestionar', [f('unidad_id', 'Unidad (vacío = general de la entidad)'), f('ejercicio', 'Ejercicio', 'number', { r: true }), IMP('importe', 'Importe anual (€)')], { danger: true }),
      A('Fijar presupuesto de un mes', 'POST', 'bk/presupuestos/mensual', 'presupuestos:gestionar', [f('unidad_id', 'Unidad', 'text', { r: true }), f('ejercicio', 'Ejercicio', 'number', { r: true }), f('mes', 'Mes (1-12)', 'number', { r: true, min: 1, max: 12 }), IMP('importe', 'Importe del mes (€)')]),
      A('Crear plan plurianual', 'POST', 'bk/presupuestos/planes', 'presupuestos:gestionar', [f('nombre', 'Nombre', 'text', { r: true }), f('unidad_id', 'Unidad'), f('ejercicio_desde', 'Desde (ejercicio)', 'number', { r: true }), f('ejercicio_hasta', 'Hasta (ejercicio)', 'number', { r: true }), IMP('importe', 'Importe total (€)')]),
      A('Reasignar presupuesto entre unidades', 'POST', 'bk/presupuestos/reasignaciones', 'presupuestos:gestionar', [f('desde_unidad_id', 'Unidad origen', 'text', { r: true }), f('hasta_unidad_id', 'Unidad destino', 'text', { r: true }), IMP(), f('motivo', 'Motivo')], { danger: true, confirm: 'Las dos unidades deben compartir unidad superior. ¿Mover el presupuesto?' }),
      A('Crear un fondo restringido a una finalidad', 'POST', 'bk/fondos', 'presupuestos:gestionar', [f('nombre', 'Nombre', 'text', { r: true }), f('finalidad', 'Finalidad', 'text', { r: true }), f('unidad_id', 'Unidad'), IMP()]),
    ] },

  { id: 'gastos', aud: 'admin', title: 'Gastos y pagos recurrentes', kinds: INST, desc: 'Propuesta, aprobación y pago de gastos de una unidad.',
    sections: [
      A('Proponer un gasto', 'POST', 'bk/gastos', 'gastos:gestionar', [f('unidad_id', 'Unidad que lo asume', 'text', { r: true }), IMP(), f('concepto', 'Concepto', 'text', { r: true }), f('beneficiario_iban', 'IBAN beneficiario')]),
      A('Aprobar, rechazar o pagar un gasto', 'POST', 'bk/gastos/{id}/accion', 'gastos:gestionar', [SEL('accion', 'Acción', ['aprobar', 'rechazar', 'pagar'], { r: true }), f('motivo', 'Motivo (opcional)')], { danger: true, confirm: 'Esta acción puede mover dinero. ¿Continuar?' }),
      A('Autorizar un pago recurrente', 'POST', 'bk/recurrentes', 'recurrentes:gestionar', [f('unidad_id', 'Unidad', 'text', { r: true }), f('concepto', 'Concepto', 'text', { r: true }), IMP(), SEL('periodicidad', 'Periodicidad', ['mensual', 'trimestral', 'anual'], { r: true }), f('beneficiario_iban', 'IBAN beneficiario')]),
      A('Generar propuestas de un periodo', 'POST', 'bk/recurrentes/generar', 'recurrentes:gestionar', [f('periodo', 'Periodo', 'text', { r: true, ph: '2026-11' })]),
    ] },

  { id: 'solicitudes', aud: 'admin', title: 'Solicitudes y convocatorias', kinds: INST, desc: 'Solicitudes de las unidades, convocatorias internas de financiación y doble firma.',
    sections: [
      A('Crear una solicitud', 'POST', 'bk/solicitudes', 'solicitudes:gestionar', [f('unidad_id', 'Unidad', 'text', { r: true }), SEL('tipo', 'Tipo', ['prorroga', 'ampliacion', 'reserva_extra', 'financiacion', 'otra'], { r: true }), f('importe', 'Importe (€)', 'number', { step: '0.01' }), f('motivo', 'Motivo', 'textarea')]),
      A('Resolver una solicitud', 'POST', 'bk/solicitudes/{id}/resolver', 'solicitudes:gestionar', [SEL('resolucion', 'Resolución', ['concedida', 'denegada'], { r: true }), f('comentario', 'Comentario')], { danger: true }),
      A('Abrir una convocatoria de financiación', 'POST', 'bk/convocatorias', 'convocatorias:gestionar', [f('nombre', 'Nombre', 'text', { r: true }), f('importe', 'Importe total (€)', 'number', { step: '0.01' }), f('desde', 'Abre', 'date'), f('hasta', 'Cierra', 'date'), f('descripcion', 'Descripción', 'textarea')]),
      A('Configurar solicitudes y doble firma', 'PUT', 'bk/entidad/configuracion', 'entidad:configurar', [f('solicitudes_activas', 'Activar solicitudes de unidades', 'checkbox'), f('doble_firma', 'Exigir doble firma', 'checkbox'), f('umbral_doble_firma', 'Umbral de doble firma (€)', 'number', { step: '0.01' })], { danger: true }),
    ] },

  { id: 'nominas', aud: 'admin', title: 'Nóminas y retribuciones', kinds: NOMINA, desc: 'Contratos, retribuciones, tareas con complemento, expedientes y planes.',
    sections: [
      L('Contratos de nómina', 'bk/nominas', 'nominas:read'),
      L('Planes a plazos y suscripciones', 'bk/planes', 'planes:read'),
      A('Generar y pagar la nómina de un periodo', 'POST', 'bk/nominas/periodos', 'nominas:generar', [f('periodo', 'Periodo', 'text', { r: true, ph: '2026-11' })], { danger: true, confirm: 'Se generará y pagará la nómina del periodo. ¿Continuar?' }),
      A('Fijar retribución o complemento', 'POST', 'bk/retribuciones', 'retribuciones:gestionar', [f('dip', 'DIP', 'text', { r: true }), SEL('tipo', 'Tipo', ['fija', 'complemento'], { r: true }), IMP(), f('concepto', 'Concepto'), f('puesto_id', 'Puesto (id)')]),
      L('Expediente de una persona', 'bk/expedientes', 'retribuciones:gestionar', [f('dip', 'DIP', 'text', { r: true })]),
      A('Registrar una tarea con complemento', 'POST', 'bk/tareas', 'tareas:gestionar', [f('dip', 'DIP', 'text', { r: true }), f('descripcion', 'Descripción', 'text', { r: true }), IMP(), f('referencia', 'Referencia externa (p. ej. NEXE)')]),
      A('Validar, pagar o rechazar una tarea', 'POST', 'bk/tareas/{id}/accion', 'tareas:gestionar', [SEL('accion', 'Acción', ['validar', 'pagar', 'rechazar'], { r: true })], { danger: true }),
    ] },

  { id: 'subvenciones', aud: 'admin', title: 'Subvenciones y bonos', kinds: BONOS, desc: 'Programas de subvención o bono, concesiones y justificaciones de gasto.',
    sections: [
      L('Programas', 'bk/programas', 'subvenciones:gestionar'),
      A('Crear un programa', 'POST', 'bk/programas', 'subvenciones:gestionar', [f('nombre', 'Nombre', 'text', { r: true }), SEL('tipo', 'Tipo', ['subvencion', 'bono'], { r: true }), f('presupuesto', 'Presupuesto (€)', 'number', { step: '0.01' }), f('desde', 'Desde', 'date'), f('hasta', 'Hasta', 'date'), f('descripcion', 'Descripción', 'textarea')]),
      L('Concesiones de un programa', 'bk/programas/{id}/concesiones', 'subvenciones:gestionar'),
      A('Conceder un importe a un beneficiario', 'POST', 'bk/programas/{id}/concesiones', 'subvenciones:gestionar', [f('beneficiario_iban', 'IBAN beneficiario', 'text', { r: true }), IMP('importe_maximo', 'Importe máximo (€)')], { danger: true }),
      L('Justificaciones', 'bk/justificaciones', 'subvenciones:gestionar', [f('concesion_id', 'Concesión (opcional)')]),
      A('Justificar un gasto ya hecho', 'POST', 'bk/justificaciones', 'subvenciones:gestionar', [f('concesion_id', 'Concesión (id)', 'text', { r: true }), IMP(), f('concepto', 'Concepto'), f('comercio_iban', 'IBAN del comercio')]),
      A('Aprobar y pagar una justificación', 'POST', 'bk/justificaciones/{id}/pagar', 'subvenciones:gestionar', [], { danger: true, confirm: 'Se transferirá el importe desde la cuenta de fondos. ¿Pagar?' }),
      A('Rechazar una justificación', 'POST', 'bk/justificaciones/{id}/rechazar', 'subvenciones:gestionar', [f('motivo', 'Motivo')], { danger: true }),
    ] },

  { id: 'politicas', aud: 'admin', title: 'Reglas de uso (RBU y programas)', kinds: BONOS, desc: 'Define dónde pueden gastarse los bonos: tipos de cuenta, comercios y categorías.',
    sections: [
      L('Reglas activas', 'bk/politicas', 'politicas:gestionar'),
      A('Crear una regla (sustituye a la activa del mismo ámbito)', 'POST', 'bk/politicas', 'politicas:gestionar', [f('ambito', 'Ámbito (RBU o id de programa)', 'text', { r: true }), f('tipos_destino', 'Tipos de cuenta permitidos', 'list', { ph: 'separados por comas' }), f('comercios', 'Comercios permitidos', 'list', { ph: 'IBAN o id, separados por comas' }), f('categorias', 'Categorías permitidas', 'list', { ph: 'separadas por comas' })], { danger: true }),
      A('Desactivar una regla', 'POST', 'bk/politicas/{id}/desactivar', 'politicas:gestionar', [], { danger: true }),
      L('Categorías de comercio', 'bk/categorias', 'politicas:gestionar'),
      L('Tipos de cuenta de destino', 'bk/tipos-destino', 'politicas:gestionar'),
      L('Directorio de comercios', 'bk/comercios', 'politicas:gestionar'),
    ] },

  { id: 'tarjetas', aud: 'admin', title: 'Tarjetas', kinds: [ALL], desc: 'Tarjetas de una cuenta, NFC y cargos de tarjeta (autorizar, liquidar, liberar).',
    sections: [
      L('Tarjetas de una cuenta', 'accounts/{iban}/cards', 'cards:read'),
      L('Identificador / enlace NFC', 'bk/tarjetas/{ref}/nfc', 'tarjetas:gestionar'),
      A('Registrar o cambiar el NFC', 'PUT', 'bk/tarjetas/{ref}/nfc', 'tarjetas:gestionar', [f('nfc_id', 'Identificador NFC'), f('nfc_url', 'Enlace NFC')]),
      A('Autorizar un cargo', 'POST', 'bk/tarjetas/cargos', 'tarjetas:cobrar', [f('card_ref', 'Referencia de tarjeta', 'text', { r: true }), IMP('amount', 'Importe (€)'), f('merchant', 'Comercio'), f('memo', 'Concepto')], { danger: true }),
      A('Liquidar un cargo autorizado', 'POST', 'bk/tarjetas/cargos/{id}/liquidar', 'tarjetas:cobrar', [f('amount', 'Importe final (opcional)', 'number', { step: '0.01' })], { danger: true, confirm: 'Se cobrará el cargo. ¿Liquidar?' }),
      A('Liberar un cargo que no se liquidará', 'POST', 'bk/tarjetas/cargos/{id}/liberar', 'tarjetas:cobrar', [], { danger: true }),
    ] },

  { id: 'pasarela', aud: 'admin', title: 'Pasarela de pago', kinds: COBROS, desc: 'Cobros online: pasarela, pagos, confirmación por el banco e identidad visual.',
    sections: [
      L('Producto pasarela de la entidad', 'bk/pasarela', 'pasarela:configurar'),
      A('Activar la pasarela y fijar parámetros', 'PUT', 'bk/pasarela', 'pasarela:configurar', [f('activa', 'Activa', 'checkbox'), f('webhook_url', 'URL de notificación'), f('moneda', 'Moneda', 'text', { ph: 'EUR' })], { danger: true }),
      L('Pagos de mi cliente de API', 'bk/checkouts', 'checkout:crear'),
      A('Crear un pago', 'POST', 'bk/checkouts', 'checkout:crear', [IMP('amount', 'Importe (€)'), f('concept', 'Concepto'), f('reference', 'Referencia'), f('return_url', 'URL de retorno'), f('cancel_url', 'URL de cancelación')]),
      L('Estado de un pago', 'bk/checkouts/{id}', 'checkout:crear'),
      L('Pagos pendientes de confirmación', 'bk/pagos', 'pagos:resolver'),
      A('Canjear el código de pago de un cliente', 'POST', 'bk/pagos/canjear', 'pagos:resolver', [f('codigo', 'Código de pago', 'text', { r: true })]),
      A('Aprobar o rechazar un pago', 'POST', 'bk/pagos/{id}/resolucion', 'pagos:resolver', [SEL('decision', 'Decisión', ['aprobar', 'rechazar'], { r: true }), f('motivo', 'Motivo')], { danger: true }),
      L('Identidad visual de la entidad', 'bk/branding', 'branding:gestionar'),
      A('Fijar nombre, color y texto legal', 'PUT', 'bk/branding', 'branding:gestionar', [f('nombre', 'Nombre'), f('color', 'Color', 'text', { ph: '#6d28d9' }), f('texto_legal', 'Texto legal', 'textarea')]),
      A('Subir el logo de la entidad', 'POST', 'bk/branding/logo', 'branding:gestionar', [f('logo', 'Imagen', 'file', { r: true })]),
      A('Fijar el aspecto de mi comercio', 'PUT', 'bk/comercio/branding', 'branding:gestionar', [f('nombre', 'Nombre'), f('color', 'Color', 'text', { ph: '#6d28d9' })]),
      A('Subir el logo de mi comercio', 'POST', 'bk/comercio/logo', 'branding:gestionar', [f('logo', 'Imagen', 'file', { r: true })]),
    ] },

  { id: 'comisiones', aud: 'admin', title: 'Comisiones, tasas y restricciones', kinds: [ALL], desc: 'Quién paga la comisión interbancaria, tasas de pasarelas y comercios, y medios de pago prohibidos.',
    sections: [
      L('Política de comisiones', 'bk/comisiones', 'comisiones:configurar'),
      A('Decidir quién paga la comisión interbancaria', 'PUT', 'bk/comisiones', 'comisiones:configurar', [SEL('ambito', 'Aplica a', ['cuenta', 'tarjeta'], { r: true }), SEL('paga', 'Paga', ['cliente', 'comercio', 'banco'], { r: true })], { danger: true }),
      L('Tasas de la entidad', 'bk/tasas', 'tasas:gestionar'),
      A('Crear una tasa sobre los pagos', 'POST', 'bk/tasas', 'tasas:gestionar', [f('nombre', 'Nombre', 'text', { r: true }), f('porcentaje', 'Porcentaje (%)', 'number', { step: '0.01' }), f('fijo', 'Importe fijo (€)', 'number', { step: '0.01' }), f('comercio_id', 'Comercio (vacío = todos)')], { danger: true }),
      A('Desactivar una tasa', 'POST', 'bk/tasas/{id}/desactivar', 'tasas:gestionar', [], { danger: true }),
      L('Restricciones de pago del banco', 'bk/restricciones', 'pagos:restringir'),
      A('Prohibir o permitir un medio de pago', 'PUT', 'bk/restricciones', 'pagos:restringir', [SEL('tipo', 'Qué restringir', ['medio', 'tipo_tarjeta', 'modalidad', 'operacion'], { r: true }), f('valor', 'Valor', 'text', { r: true, ph: 'p. ej. prepago, nfc, online' }), f('prohibido', 'Prohibido', 'checkbox')], { danger: true }),
    ] },

  { id: 'empresas', aud: 'admin', title: 'Empresas', kinds: EMP, desc: 'Alta de empresas, titulares, contrato y pasarela propia.',
    sections: [
      L('Empresas de la entidad', 'bk/empresas', 'empresas:gestionar'),
      A('Dar de alta una empresa', 'POST', 'bk/empresas', 'empresas:gestionar', [f('nombre', 'Nombre', 'text', { r: true }), f('cif', 'CIF'), f('titular_dip', 'DIP del titular inicial', 'text', { r: true })]),
      L('Ficha de una empresa', 'bk/empresas/{id}', 'empresas:gestionar'),
      L('Ficha completa (organigrama, presupuesto, nóminas)', 'bk/empresas/{id}/ficha', 'empresas:gestionar'),
      L('Contrato vigente', 'bk/empresas/{id}/contrato', 'empresas:gestionar'),
      A('Vincular la entidad institucional (CIP)', 'POST', 'bk/empresas/{id}/entidad', 'empresas:gestionar', [f('cip', 'CIP de la entidad', 'text', { r: true })]),
      A('Activar, suspender o dar de baja', 'POST', 'bk/empresas/{id}/estado', 'empresas:gestionar', [SEL('estado', 'Estado', ['activa', 'suspendida', 'baja'], { r: true })], { danger: true }),
      A('Dar de alta la pasarela de la empresa', 'POST', 'bk/empresas/{id}/pasarela', 'empresas:gestionar', [], { danger: true }),
      A('Rotar la clave de la pasarela', 'POST', 'bk/empresas/{id}/pasarela/rotar', 'empresas:gestionar', [], { danger: true, confirm: 'La clave anterior dejará de valer. ¿Rotar?' }),
      A('Dar de alta un titular, autorizado o lector', 'POST', 'bk/empresas/{id}/titulares', 'empresas:gestionar', [f('dip', 'DIP', 'text', { r: true }), SEL('rol', 'Rol', ['titular', 'autorizado', 'lector'], { r: true })]),
      A('Dar de baja a un titular', 'POST', 'bk/empresas/{id}/titulares/cese', 'empresas:gestionar', [f('dip', 'DIP', 'text', { r: true })], { danger: true }),
    ] },

  { id: 'interbancario', aud: 'admin', title: 'Interbancario y disputas', kinds: [ALL], desc: 'Operaciones y posición neta frente a otros bancos, y reclamaciones de deudas.',
    sections: [
      L('Operaciones interbancarias', 'bk/interbancarias', 'interbancarias:gestionar', [f('desde', 'Desde', 'date'), f('hasta', 'Hasta', 'date')]),
      L('Posición neta por banco', 'bk/interbancarias/posicion', 'interbancarias:gestionar', [f('desde', 'Desde', 'date'), f('hasta', 'Hasta', 'date')]),
      L('Reclamaciones de deudas', 'bk/disputas', 'disputas:gestionar'),
      A('Resolver una reclamación (banco acreedor)', 'POST', 'bk/disputas/{id}/resolver', 'disputas:gestionar', [SEL('resolucion', 'Resolución', ['aceptar', 'rechazar'], { r: true }), f('comentario', 'Comentario')], { danger: true }),
    ] },

  { id: 'integraciones', aud: 'admin', title: 'Integraciones y claves', kinds: [ALL], desc: 'Claves de API de la entidad, orígenes de navegador (CORS) y webhooks.',
    sections: [
      L('Claves de API de la entidad', 'bk/clientes', 'clientes:gestionar'),
      A('Crear una clave de API', 'POST', 'bk/clientes', 'clientes:gestionar', [f('nombre', 'Nombre', 'text', { r: true }), f('permisos', 'Permisos (scopes)', 'list', { r: true, ph: 'accounts:read, transfers:read' })], { danger: true }),
      A('Rotar una clave de API', 'POST', 'bk/clientes/{id}/rotar', 'clientes:gestionar', [], { danger: true, confirm: 'La clave anterior dejará de valer. ¿Rotar?' }),
      A('Desactivar una clave de API', 'POST', 'bk/clientes/{id}/desactivar', 'clientes:gestionar', [], { danger: true }),
      L('Orígenes de navegador (CORS)', 'bk/origenes', 'origenes:gestionar'),
      A('Solicitar un origen', 'POST', 'bk/origenes', 'origenes:gestionar', [f('origen', 'Origen', 'text', { r: true, ph: 'https://mi-app.vercel.app' })]),
      A('Retirar un origen', 'DELETE', 'bk/origenes', 'origenes:gestionar', [f('origen', 'Origen', 'text', { r: true })], { danger: true }),
      L('Webhooks', 'bk/webhooks', 'webhooks:gestionar'),
      A('Dar de alta un webhook', 'POST', 'bk/webhooks', 'webhooks:gestionar', [f('url', 'URL', 'text', { r: true }), f('eventos', 'Eventos', 'list', { ph: 'separados por comas (vacío = todos)' })]),
      A('Rotar el secreto de un webhook', 'POST', 'bk/webhooks/{id}/rotar', 'webhooks:gestionar', [], { danger: true }),
      A('Dar de baja un webhook', 'DELETE', 'bk/webhooks/{id}', 'webhooks:gestionar', [], { danger: true }),
      L('Entregas de eventos', 'bk/webhooks/entregas', 'webhooks:gestionar'),
      A('Reintentar una entrega fallida', 'POST', 'bk/webhooks/entregas/{id}/reintentar', 'webhooks:gestionar'),
    ] },
]

export const visible = (aud, kind, showAll) =>
  MODULES.filter((m) => m.aud === aud && (showAll || !kind || m.kinds.includes('*') || m.kinds.includes(kind)))

// Todos los permisos que usa el catálogo (útil para revisar qué debe tener la clave de API)
export const SCOPES = [...new Set(MODULES.flatMap((m) => m.sections.map((s) => s.scope)))].sort()
