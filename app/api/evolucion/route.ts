export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const res = await fetch('https://api.bluelytics.com.ar/v2/evolution.json', { cache: 'no-store' })
    const data: { date: string; source: string; value_sell: number; value_buy: number }[] = await res.json()

    const cutoff = new Date()
    cutoff.setMonth(cutoff.getMonth() - 14)
    const filtered = data.filter(d => new Date(d.date) >= cutoff)

    const byMonth: Record<string, { oficial: number[]; blue: number[] }> = {}
    filtered.forEach(d => {
      const month = d.date.slice(0, 7)
      if (!byMonth[month]) byMonth[month] = { oficial: [], blue: [] }
      if (d.source === 'Oficial') byMonth[month].oficial.push(d.value_sell)
      if (d.source === 'Blue')    byMonth[month].blue.push(d.value_sell)
    })

    const result = Object.entries(byMonth)
      .map(([month, vals]) => ({
        month,
        oficial: vals.oficial.length ? Math.round(vals.oficial.reduce((a, b) => a + b) / vals.oficial.length) : null,
        blue:    vals.blue.length    ? Math.round(vals.blue.reduce((a, b) => a + b)    / vals.blue.length)    : null,
      }))
      .sort((a, b) => a.month.localeCompare(b.month))

    return NextResponse.json(result)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
