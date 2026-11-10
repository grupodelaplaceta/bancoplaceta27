// Cliente de las operaciones de gestión (solo navegador). Siempre contra /api/ops: el servidor decide si puedes.
import { request, newKey } from './client'
export { newKey }
export const runOp = (iban, op, valores = {}, idem) => request('/api/ops', { method: 'POST', body: { op, iban, valores }, idem })
