// Tipos de cuenta y qué ve cada uno. SE PUEDE EDITAR: aquí decide la entidad qué secciones y botones rápidos
// tiene cada tipo de cuenta. Sirve en servidor y cliente (sin dependencias).
const BUSINESS = /empresa|business|negocio|comercio|corporat|company|aut[oó]nomo/i

/** Tipo de una cuenta de GET /me/accounts ({ tipo, nombre, … }). */
export const kindOf = (a) => {
  const x = `${a?.tipo || a?.type || ''} ${a?.nombre || a?.name || ''}`
  return BUSINESS.test(x) ? 'empresa' : /junior|joven|menor/i.test(x) ? 'junior' : /ahorro|saving|dep[oó]sito/i.test(x) ? 'ahorro' : 'personal'
}
export const isBusiness = (a) => kindOf(a) === 'empresa'

export const KIND_LABEL = { personal: 'Cuenta personal', junior: 'Cuenta joven', ahorro: 'Cuenta de ahorro', empresa: 'Cuenta de empresa' }

/** Secciones que NO se muestran para cada tipo (las demás salen siempre). */
export const HIDE = {
  personal: ['gateway'],
  junior: ['gateway'],
  ahorro: ['gateway'],
  empresa: [],
}
/** Pestañas de «Planes y ayudas» que NO se muestran para cada tipo. */
export const HIDE_PLAN_TABS = { empresa: ['rbu'], junior: ['req'] }

/** Botones rápidos de Inicio por tipo (ids de ACTIONS). */
export const QUICK = {
  personal: ['transfer', 'schedule', 'cards', 'documents', 'alta'],
  junior: ['transfer', 'cards', 'documents'],
  ahorro: ['transfer', 'schedule', 'documents', 'alta'],
  empresa: ['charge', 'transfer', 'statement', 'receipts', 'documents'],
}
export const ACTIONS = {
  transfer: { label: 'Transferir', icon: 'send', needs: 'me:transfer', run: 'transfer' },
  schedule: { label: 'Programar pago', icon: 'cal', needs: 'me:transfer', run: 'schedule' },
  cards: { label: 'Tarjetas', icon: 'card', view: 'cards' },
  documents: { label: 'Documentos', icon: 'doc', view: 'documents' },
  receipts: { label: 'Recibos', icon: 'receipt', view: 'receipts' },
  statement: { label: 'Extracto', icon: 'list', view: 'documents' },
  charge: { label: 'Cobrar', icon: 'bag', view: 'gateway' },
  alta: { label: 'Contratar', icon: 'plus', needs: 'me:contratar', run: 'alta' },
}
