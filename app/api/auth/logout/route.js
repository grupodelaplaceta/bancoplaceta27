import { NextResponse } from 'next/server'
export async function GET() {
  const r = NextResponse.redirect((process.env.APP_URL || 'https://bancoplaceta27.vercel.app') + '/')
  r.cookies.delete('sess'); return r
}
