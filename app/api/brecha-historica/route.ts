export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const res  = await fetch('https://api.bluelytics.com.ar/v2/evolution.json', { cache: 'no-store' })
    const data: { date: string; source: string; value_sell: number }[] = await res.json()

    // Last 18 months
    const cutoff = new Date()
    cutoff.setMonth(cutoff.getMonth() - 18)
    const recent = data.filter(d => new Date(d.date) >= cutoff)

    // Group by date
    const byDate: Record<string, { oficial?: number; blue?: number }> = {}
    recent.forEach(d => {
      if (!byDate[d.date]) byDate[d.date] = {}
      if (d.source === 'Oficial') byDate[d.date].oficial = d.value_sell
      if (d.source === 'Blue')    byDate[d.date].blue    = d.value_sell
    })

    // Compute daily brecha %, then aggregate to weekly to reduce noise
    const sorted = Object.entries(byDate)
      .filter(([, v]) => v.oficial && v.blue)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({
        date,
        brecha: Number((((v.blue! - v.oficial!) / v.oficial!) * 100).toFixed(1)),
        blue:   v.blue!,
        oficial: v.oficial!,
      }))

    // Weekly samples (every 5 trading days)
    const weekly = sorted.filter((_, i) => i % 5 === 0)

    return NextResponse.json(weekly)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
