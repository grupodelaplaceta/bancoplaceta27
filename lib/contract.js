// Contrato de alta generado con los datos reales del producto y del cliente. PLANTILLA: la entidad debe sustituir
// los textos de CLAUSES por los aprobados por su asesoría jurídica (el resto —datos, huella, aceptación— ya está).
import { eur, fmtDate, facts, pick } from './shape'

const SKIP = ['id', 'codigo', 'code', 'nombre', 'name', 'titulo', 'descripcion', 'description', 'activo', 'active']

export function buildContract({ kind, bank, client, product, data }) {
  const today = fmtDate(new Date(), { day: 'numeric', month: 'long', year: 'numeric' })
  const entidad = bank?.nombre ? `${bank.nombre}${bank.codigo ? ' (entidad ' + bank.codigo + ')' : ''}` : 'la entidad'
  const pname = product ? pick(product, ['nombre', 'name', 'titulo'], 'Producto') : kind === 'prestamo' ? 'Préstamo personal' : 'Cuenta personal estándar'
  const title = kind === 'prestamo' ? 'Solicitud y contrato de préstamo' : 'Contrato de apertura: ' + pname
  const rows = [['Producto', pname]]
  if (product?.codigo || product?.code) rows.push(['Código', product.codigo || product.code])
  if (kind === 'cuenta') rows.push(['Nombre de la cuenta', data.nombre])
  if (kind === 'prestamo') rows.push(['Importe solicitado', eur(data.importe)], ['Número de cuotas', String(data.cuotas)], ['Finalidad', data.motivo || 'No indicada'])
  if (product) rows.push(...facts(product, SKIP, 'PZ').map(([k, v]) => [k, v]))
  const desc = product ? pick(product, ['descripcion', 'description'], '') : ''

  const CLAUSES = [
    ['1. Partes', `De una parte, ${entidad}, en adelante «la Entidad». De otra, ${client}, en adelante «el Cliente», identificado/a mediante su PlacetaID. Fecha: ${today}.`],
    ['2. Objeto', kind === 'prestamo'
      ? 'El Cliente solicita a la Entidad un préstamo con las condiciones indicadas en el cuadro de datos. La concesión queda sujeta al análisis y a la aprobación de la Entidad; hasta entonces la solicitud permanece pendiente y no genera obligación de concesión.'
      : `El presente contrato regula la apertura y el uso del producto «${pname}».${desc ? ' ' + desc : ''} ${product ? 'La contratación del producto queda sujeta a la aprobación de la Entidad.' : ''}`.trim()],
    ['3. Condiciones del producto', 'Las condiciones económicas y características del producto son las del cuadro de datos de este documento, vigentes en la fecha de aceptación. Cualquier modificación posterior se comunicará al Cliente con antelación.'],
    ['4. Obligaciones del Cliente', 'El Cliente declara que los datos facilitados son veraces, se compromete a mantenerlos actualizados, a custodiar sus credenciales y a comunicar de inmediato cualquier uso no autorizado.'],
    ['5. Duración y baja', 'El contrato tiene duración indefinida, salvo que el producto establezca otra cosa. El Cliente puede solicitar la baja en cualquier momento, sin perjuicio de las obligaciones pendientes.'],
    ['6. Aceptación', 'El Cliente declara haber leído y comprendido este documento y lo acepta mediante la escritura de su nombre completo. La huella digital (SHA-256) y la fecha de aceptación quedan registradas en la solicitud.'],
  ]
  const text = [title, ...rows.map(([k, v]) => `${k}: ${v}`), ...CLAUSES.map(([h, t]) => `${h}\n${t}`)].join('\n')
  return { title, rows, clauses: CLAUSES, text, date: today }
}

export async function sha256(text) {
  try {
    const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
    return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('')
  } catch { let h = 0; for (const c of text) h = (h * 31 + c.charCodeAt(0)) | 0; return ('00000000' + (h >>> 0).toString(16)).repeat(8) }
}
export const fold = (x) => String(x || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()
