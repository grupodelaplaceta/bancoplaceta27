// Organigrama: normaliza la respuesta de GET /bk/organigrama a { id, name, posts[], children[] } de forma tolerante
// (la API puede llamar a las cosas de varias maneras). Si no reconoce la forma, devuelve null y la app muestra los datos tal cual.
const first = (o, keys) => { for (const k of keys) if (o && o[k] != null) return o[k]; return undefined }
const arr = (v) => (Array.isArray(v) ? v : [])
const isNode = (o) => o && typeof o === 'object' && !Array.isArray(o) && first(o, ['id', 'codigo', 'uuid']) != null && first(o, ['nombre', 'name', 'titulo']) != null

function person(p) {
  if (p == null) return null
  if (typeof p === 'string') return { dip: p, name: p }
  const inner = p.persona && typeof p.persona === 'object' ? p.persona : {}
  const dip = first(p, ['dip', 'persona_dip', 'titular_dip']) ?? first(inner, ['dip']) ?? ''
  return { dip: String(dip), name: first(p, ['nombre', 'name', 'persona']) && typeof first(p, ['nombre', 'name', 'persona']) === 'string' ? first(p, ['nombre', 'name', 'persona']) : first(inner, ['nombre', 'name']) || String(dip) || 'Sin nombre', since: first(p, ['desde', 'inicio', 'since']), until: first(p, ['hasta', 'fin']) }
}
function post(p) {
  const people = arr(first(p, ['nombramientos', 'titulares', 'ocupantes', 'personas', 'asignaciones'])).map(person).filter(Boolean)
  if (!people.length && first(p, ['titular', 'ocupante'])) people.push(person(first(p, ['titular', 'ocupante'])))
  return { id: String(first(p, ['id', 'codigo']) ?? ''), name: String(first(p, ['nombre', 'name', 'titulo']) ?? 'Puesto'), people: people.filter((x) => x && !x.until) }
}
function node(n) {
  return {
    id: String(first(n, ['id', 'codigo', 'uuid'])),
    name: String(first(n, ['nombre', 'name', 'titulo'])),
    closed: /cerrad|closed|baja/i.test(String(first(n, ['estado', 'status']) ?? '')),
    posts: arr(first(n, ['puestos', 'cargos', 'posts'])).filter((x) => x && typeof x === 'object').map(post),
    children: arr(first(n, ['hijos', 'children', 'unidades', 'subunidades', 'hijas'])).filter(isNode).map(node),
  }
}

export function normOrg(d) {
  let root = d
  if (root && !Array.isArray(root) && typeof root === 'object') {
    const inner = first(root, ['unidades', 'arbol', 'tree', 'organigrama', 'units', 'raiz', 'root'])
    if (inner != null) root = inner
  }
  const list = Array.isArray(root) ? root : root && typeof root === 'object' ? [root] : []
  const nodes = list.filter(isNode).map(node)
  return nodes.length ? nodes : null
}

/** Todas las unidades en plano, con su ruta («Ayuntamiento › Hacienda»), para los selectores. */
export function flatUnits(nodes, path = []) {
  return (nodes || []).flatMap((n) => [{ id: n.id, name: n.name, path: [...path, n.name].join(' › '), depth: path.length }, ...flatUnits(n.children, [...path, n.name])])
}
export const countPeople = (n) => n.posts.reduce((a, p) => a + p.people.length, 0) + n.children.reduce((a, c) => a + countPeople(c), 0)
