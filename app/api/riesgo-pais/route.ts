export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const res = await fetch('https://api.argentinadatos.com/v1/finanzas/indices/riesgo-pais', { cache: 'no-store' })
    const data = await res.json()
    return NextResponse.json(data.slice(-90))
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
