import { NextResponse } from 'next/server'
import { readSession } from '../../../lib/session'
import { upstream } from '../../../lib/upstream'
import { hit } from '../../../lib/ratelimit'

export const dynamic = 'force-dynamic'

// Catálogo de productos de la entidad (GET /products, llamada de servidor firmada). Es información comercial, no personal.
export async function GET(req) {
  const s = readSession((n) => req.cookies.get(n)?.value)
  if (!s) return NextResponse.json({ error: { message: 'Sesión caducada.' } }, { status: 401 })
  if (!hit('cat:' + s.uid, 30, 60_000).ok) return NextResponse.json({ error: { message: 'Demasiadas peticiones.' } }, { status: 429 })
  const r = await upstream('products', { signed: true })
  return NextResponse.json(r.status < 300 ? r.json : { error: { message: 'No se ha podido cargar el catálogo.' } }, { status: r.status < 300 ? 200 : 502, headers: { 'cache-control': 'no-store' } })
}
