// Pasarela de pago para empresas. La ENTIDAD decide qué pueden configurar sus empresas con GATEWAY_CONFIG (JSON):
//   {"enabled":true,"min":1,"max":5000,"maxMinutes":30,"defaultMinutes":15,"defaultOrigin":"https://app.tubanco.es",
//    "requireConcept":true,"allow":{"origen":false,"minutos":true,"concepto":true}}
// y quién administra los orígenes aprobados con GATEWAY_ADMINS (ids de PlacetaID separados por comas).
const DEFAULTS = { enabled: true, min: 0.5, max: 5000, maxMinutes: 60, defaultMinutes: 15, defaultOrigin: '', requireConcept: true, allow: { origen: true, minutos: true, concepto: true } }

export const gwConfig = () => {
  let o = {}
  try { o = JSON.parse(process.env.GATEWAY_CONFIG || '{}') } catch {}
  const c = { ...DEFAULTS, ...o, allow: { ...DEFAULTS.allow, ...(o.allow || {}) } }
  c.maxMinutes = Math.min(60, Math.max(1, Number(c.maxMinutes) || 60))
  c.defaultMinutes = Math.min(c.maxMinutes, Math.max(1, Number(c.defaultMinutes) || 15))
  return c
}
export const isGwAdmin = (s) => (process.env.GATEWAY_ADMINS || '').split(',').map((x) => x.trim()).filter(Boolean).includes(String(s.uid))

export const cleanDip = (v) => String(v ?? '').toUpperCase().replace(/[\s-]/g, '')
export const isDip = (v) => /^[A-Z0-9]{5,15}$/.test(v)
export const cleanOrigin = (v) => { try { const u = new URL(String(v)); return u.protocol === 'https:' || u.hostname === 'localhost' ? u.origin : '' } catch { return '' } }
