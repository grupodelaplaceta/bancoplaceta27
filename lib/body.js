// Saneadores de cuerpo: al banco solo llegan los campos esperados y ya validados.
// Cada uno devuelve { body } o { error }. `m` son los grupos de la ruta (m[1] = id/ref/código).
import { normIban, isIban, cleanAmount, isDesign, cleanDate, cleanText } from './validate'

const ok = (body) => ({ body })
const no = (error) => ({ error })

export const SANITIZE = {
  openAccount: (b) => { const nombre = cleanText(b.nombre, 60); return nombre ? ok({ nombre }) : no('Ponle un nombre a la cuenta.') },

  transfer: (b) => {
    const desde_iban = normIban(b.desde_iban), hacia_iban = normIban(b.hacia_iban), importe = cleanAmount(b.importe)
    if (!isIban(desde_iban) || !isIban(hacia_iban)) return no('Los IBAN no son válidos.')
    if (desde_iban === hacia_iban) return no('El destino no puede ser la misma cuenta.')
    if (importe === null) return no('El importe no es válido (máximo 2 decimales).')
    const concepto = cleanText(b.concepto, 140)
    return ok({ desde_iban, hacia_iban, importe, ...(concepto && { concepto }) })
  },

  scheduled: (b) => {
    const t = SANITIZE.transfer(b); if (t.error) return t
    const fecha = cleanDate(b.fecha); if (!fecha) return no('La fecha no es válida.')
    if (new Date(fecha) < new Date(Date.now() - 6e4)) return no('La fecha ya ha pasado.')
    const out = { ...t.body, fecha }
    if (b.periodicidad_dias !== undefined && b.periodicidad_dias !== null && b.periodicidad_dias !== '') {
      const p = Number(b.periodicidad_dias)
      if (!Number.isInteger(p) || p < 1 || p > 366) return no('La periodicidad debe ser de 1 a 366 días.')
      out.periodicidad_dias = p
    }
    return ok(out)
  },

  beneficiary: (b) => {
    const iban = normIban(b.iban), alias = cleanText(b.alias, 40)
    if (!isIban(iban)) return no('El IBAN no es válido.')
    return alias ? ok({ alias, iban }) : no('Ponle un nombre al destinatario.')
  },

  cardState: (b) => (b.estado === 'suspended' || b.estado === 'active' ? ok({ estado: b.estado }) : no('Estado de tarjeta no válido.')),

  cardDesign: (b) => (b.codigo === null || isDesign(b.codigo) ? ok({ codigo: b.codigo }) : no('Diseño no válido.')),

  markRead: (b) => {
    const ids = Array.isArray(b.ids) ? b.ids.filter((x) => Number.isFinite(x) || (typeof x === 'string' && x.length <= 80)).slice(0, 200) : []
    return ids.length ? ok({ ids }) : no('No hay avisos que marcar.')
  },

  request: (b) => {
    if (b.tipo !== 'prestamo' && b.tipo !== 'cuenta') return no('Elige el tipo de solicitud.')
    const out = { tipo: b.tipo }
    if (b.tipo === 'prestamo') {
      const importe = cleanAmount(b.importe); if (importe === null) return no('El importe no es válido.')
      const cuotas = Number(b.cuotas); if (!Number.isInteger(cuotas) || cuotas < 1 || cuotas > 360) return no('Las cuotas deben ser de 1 a 360.')
      Object.assign(out, { importe, cuotas })
    }
    const motivo = cleanText(b.motivo, 200); if (motivo) out.motivo = motivo
    return ok(out)
  },

  buyDesign: (b) => { const iban = normIban(b.iban); return isIban(iban) ? ok({ iban }) : no('Elige la cuenta con la que pagar.') },
}
