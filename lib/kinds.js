// Tipos de cuenta y qué ve cada uno. SE PUEDE EDITAR: aquí decide la entidad qué secciones y botones rápidos
// tiene cada tipo de cuenta. Sirve en servidor y cliente (sin dependencias).
const INSTITUTION = /institu|entidad|p[uú]blic|ayunt|gobiern|administraci|organi[sz]aci|asociaci|fundaci|\bong\b|ministerio|departamento|colegio|cooperativa/i
const BUSINESS = /empresa|business|negocio|comercio|corporat|company|aut[oó]nomo/i

/** Tipo de una cuenta de GET /me/accounts ({ tipo, nombre, … }). */
export const kindOf = (a) => {
  const x = `${a?.tipo || a?.type || ''} ${a?.nombre || a?.name || ''}`
  return INSTITUTION.test(x) ? 'institucional' : BUSINESS.test(x) ? 'empresa' : /junior|joven|menor/i.test(x) ? 'junior' : /ahorro|saving|dep[oó]sito/i.test(x) ? 'ahorro' : 'personal'
}
export const isInstitution = (a) => kindOf(a) === 'institucional'
export const isBusiness = (a) => kindOf(a) === 'empresa'

export const KIND_LABEL = { personal: 'Cuenta personal', junior: 'Cuenta joven', ahorro: 'Cuenta de ahorro', empresa: 'Cuenta de empresa', institucional: 'Cuenta institucional' }

/** Secciones que NO se muestran para cada tipo (las demás salen siempre). */
export const HIDE = {
  personal: ['gateway'],
  junior: ['gateway'],
  ahorro: ['gateway'],
  empresa: [],
  institucional: ['gateway'],
}
/** Pestañas de «Planes y ayudas» que NO se muestran para cada tipo. */
export const HIDE_PLAN_TABS = { empresa: ['rbu'], institucional: ['rbu'], junior: ['req'] }

/** Botones rápidos de Inicio por tipo (ids de ACTIONS). */
export const QUICK = {
  personal: ['transfer', 'schedule', 'cards', 'documents', 'alta'],
  junior: ['transfer', 'cards', 'documents'],
  ahorro: ['transfer', 'schedule', 'documents', 'alta'],
  empresa: ['charge', 'transfer', 'statement', 'receipts', 'documents'],
  institucional: ['entity', 'transfer', 'statement', 'documents', 'schedule'],
}
export const ACTIONS = {
  transfer: { label: 'Transferir', icon: 'send', needs: 'me:transfer', run: 'transfer' },
  schedule: { label: 'Programar pago', icon: 'cal', needs: 'me:transfer', run: 'schedule' },
  cards: { label: 'Tarjetas', icon: 'card', view: 'cards' },
  documents: { label: 'Documentos', icon: 'doc', view: 'documents' },
  receipts: { label: 'Recibos', icon: 'receipt', view: 'receipts' },
  statement: { label: 'Extracto', icon: 'list', view: 'documents' },
  charge: { label: 'Cobrar', icon: 'bag', view: 'gateway' },
  entity: { label: 'Gestión', icon: 'users', view: 'ops', needs: 'gestion' },
  alta: { label: 'Contratar', icon: 'plus', needs: 'me:contratar', run: 'alta' },
}

// ── Gestión de la entidad: quién y desde qué cuenta ──────────────────────────────────────────────
/** Rol del usuario en una cuenta (lo devuelve el banco en GET /me/accounts). Administran el titular y el cotitular. */
export const isAdminRole = (rol) => /^(holder|co-?holder|titular|co-?titular)$/i.test(String(rol ?? '').trim())
/** Nombre de la sección de gestión según el tipo de la cuenta activa. */
export const OPS_LABEL = { institucional: 'Entidad', empresa: 'Gestión de empresa', junior: 'Membresía' }
