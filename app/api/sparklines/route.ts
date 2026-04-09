export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const res  = await fetch('https://api.bluelytics.com.ar/v2/evolution.json', { cache: 'no-store' })
    const data: { date: string; source: string; value_sell: number }[] = await res.json()

    // Last 14 calendar days
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - 14)
    const recent = data.filter(d => new Date(d.date) >= cutoff)

    // Group by date → pick latest entry per date
    const byDate: Record<string, { oficial?: number; blue?: number }> = {}
    recent.forEach(d => {
      if (!byDate[d.date]) byDate[d.date] = {}
      if (d.source === 'Oficial') byDate[d.date].oficial = d.value_sell
      if (d.source === 'Blue')    byDate[d.date].blue    = d.value_sell
    })

    const sorted = Object.entries(byDate)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-10) // last 10 trading days

    return NextResponse.json({
      oficial: sorted.map(([, v]) => v.oficial ?? null).filter(Boolean),
      blue:    sorted.map(([, v]) => v.blue    ?? null).filter(Boolean),
      dates:   sorted.map(([d]) => d),
    })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
