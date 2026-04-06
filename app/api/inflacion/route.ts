export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const [monthly, yoy] = await Promise.all([
      fetch('https://api.argentinadatos.com/v1/finanzas/indices/inflacion',           { cache: 'no-store' }).then(r => r.json()),
      fetch('https://api.argentinadatos.com/v1/finanzas/indices/inflacionInteranual', { cache: 'no-store' }).then(r => r.json()),
    ])
    return NextResponse.json({ monthly: monthly.slice(-24), yoy: yoy.slice(-24) })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
