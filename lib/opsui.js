// Presentación de las operaciones (solo ids, ningún dato del banco): qué botones salen en cada fila de una lista.
export const ROW_ACTIONS = {
  prog_ver: ['conc_ver', 'conc_crear'],
  just_ver: ['just_pagar', 'just_rechazar'],
  pol_ver: ['pol_desactivar'],
  tasas_ver: ['tasa_desactivar'],
  clientes_ver: ['cliente_rotar', 'cliente_baja'],
  empresas_ver: ['empresa_ver', 'empresa_ficha', 'empresa_contrato', 'empresa_estado', 'empresa_titular', 'empresa_cese', 'empresa_entidad', 'empresa_pasarela', 'empresa_rotar'],
  webhooks_ver: ['webhook_rotar', 'webhook_baja'],
  webhook_entregas: ['webhook_reintentar'],
  disputas_ver: ['disputa_resolver'],
  pagos_ver: ['pagos_resolver'],
  checkouts_ver: ['checkout_ver'],
  gasto_lista: ['gasto_accion'],
}
/** Clave que identifica una fila para las operaciones con {id}. */
export const rowId = (r) => r?.id ?? r?.codigo ?? r?.ref ?? r?.uuid ?? ''
/** Etiquetas cortas de los botones de fila. */
export const SHORT = {
  conc_ver: 'Concesiones', conc_crear: 'Conceder', just_pagar: 'Pagar', just_rechazar: 'Rechazar', pol_desactivar: 'Desactivar', tasa_desactivar: 'Desactivar',
  cliente_rotar: 'Rotar clave', cliente_baja: 'Desactivar', empresa_ver: 'Ficha', empresa_ficha: 'Ficha completa', empresa_contrato: 'Contrato', empresa_estado: 'Estado',
  empresa_titular: 'Alta titular', empresa_cese: 'Baja titular', empresa_entidad: 'Vincular CIP', empresa_pasarela: 'Alta pasarela', empresa_rotar: 'Rotar pasarela',
  webhook_rotar: 'Rotar secreto', webhook_baja: 'Dar de baja', webhook_reintentar: 'Reintentar', disputa_resolver: 'Resolver', pagos_resolver: 'Aprobar / rechazar', checkout_ver: 'Estado', gasto_accion: 'Aprobar / rechazar / pagar',
}
