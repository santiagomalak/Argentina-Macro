export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'

interface BancoRate {
  entidad: string
  logo?: string
  tnaClientes: number | null
  tnaNoClientes: number | null
  enlace?: string
}

export async function GET() {
  try {
    const res  = await fetch('https://api.argentinadatos.com/v1/finanzas/tasas/plazoFijo', { cache: 'no-store' })
    const data: BancoRate[] = await res.json()

    const valid = data.filter(b => b.tnaClientes !== null && b.tnaClientes > 0)

    // Best 5 rates
    const top5 = [...valid]
      .sort((a, b) => (b.tnaClientes ?? 0) - (a.tnaClientes ?? 0))
      .slice(0, 5)
      .map(b => ({
        entidad: b.entidad,
        tna: b.tnaClientes!,
        tea: Number((Math.pow(1 + b.tnaClientes! / 365, 365) - 1).toFixed(4)),
        tna30: Number(((b.tnaClientes! / 12) * 100).toFixed(1)), // monthly equivalent %
        enlace: b.enlace ?? null,
      }))

    // Average traditional banks (Nacion, Santander, Galicia, BBVA etc)
    const traditional = valid.filter(b =>
      ['NACION','SANTANDER','GALICIA','BBVA','MACRO','CIUDAD','PROVINCIA','FRANCES','ICBC'].some(n =>
        b.entidad.toUpperCase().includes(n)
      )
    )
    const avgTraditional = traditional.length
      ? traditional.reduce((s, b) => s + b.tnaClientes!, 0) / traditional.length
      : null

    // Best digital
    const best = top5[0] ?? null

    return NextResponse.json({ top5, avgTraditional, best })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
