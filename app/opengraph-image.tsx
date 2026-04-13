import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'Argentina Macro Dashboard'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

async function fetchData() {
  try {
    const [dolaresRes, inflacionRes, riesgoPaisRes] = await Promise.allSettled([
      fetch('https://dolarapi.com/v1/dolares', { cache: 'no-store' }).then(r => r.json()),
      fetch('https://api.argentinadatos.com/v1/finanzas/indices/inflacion', { cache: 'no-store' }).then(r => r.json()),
      fetch('https://api.argentinadatos.com/v1/finanzas/indices/riesgo-pais', { cache: 'no-store' }).then(r => r.json()),
    ])

    const dolares  = dolaresRes.status  === 'fulfilled' ? dolaresRes.value  : []
    const inflData = inflacionRes.status === 'fulfilled' ? inflacionRes.value : []
    const rpData   = riesgoPaisRes.status === 'fulfilled' ? riesgoPaisRes.value : []

    const blue    = Array.isArray(dolares) ? dolares.find((d: { casa: string }) => d.casa === 'blue') : null
    const oficial = Array.isArray(dolares) ? dolares.find((d: { casa: string }) => d.casa === 'oficial') : null
    const brecha  = blue && oficial ? ((blue.venta - oficial.venta) / oficial.venta * 100) : null
    const infl    = Array.isArray(inflData) && inflData.length > 0 ? inflData[inflData.length - 1] : null
    const rp      = Array.isArray(rpData)   && rpData.length > 0   ? rpData[rpData.length - 1]   : null

    return {
      blue:    blue    ? `$${Math.round(blue.venta).toLocaleString('es-AR')}`       : '—',
      brecha:  brecha  != null ? `${brecha >= 0 ? '+' : ''}${brecha.toFixed(1)}%` : '—',
      inflacion: infl  ? `${infl.valor}%`                                           : '—',
      riesgoPais: rp   ? `${Math.round(rp.valor)} bps`                             : '—',
    }
  } catch {
    return { blue: '—', brecha: '—', inflacion: '—', riesgoPais: '—' }
  }
}

export default async function OGImage() {
  const data = await fetchData()

  const metrics = [
    { label: 'DÓLAR BLUE',   value: data.blue,       sub: 'Mercado informal',   color: '#74ACDF' },
    { label: 'BRECHA',       value: data.brecha,     sub: 'Blue / Oficial',     color: '#22c55e' },
    { label: 'INFLACIÓN',    value: data.inflacion,  sub: 'Mensual · INDEC',    color: '#ef4444' },
    { label: 'RIESGO PAÍS',  value: data.riesgoPais, sub: 'EMBI+ Argentina',    color: '#f97316' },
  ]

  return new ImageResponse(
    (
      <div
        style={{
          background: '#0d0d10',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          fontFamily: 'system-ui, sans-serif',
          overflow: 'hidden',
        }}
      >
        {/* Flag stripe top */}
        <div style={{ display: 'flex', height: 8, width: '100%' }}>
          <div style={{ flex: 1, background: '#74ACDF' }} />
          <div style={{ flex: 1, background: '#FFFFFF' }} />
          <div style={{ flex: 1, background: '#74ACDF' }} />
        </div>

        {/* Content */}
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, padding: '60px 80px', justifyContent: 'space-between' }}>

          {/* Top: flag + title */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <span style={{ fontSize: 56 }}>🇦🇷</span>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: 48, fontWeight: 800, color: '#ffffff', letterSpacing: '-1px' }}>
                Argentina Macro
              </span>
              <span style={{ fontSize: 22, color: '#74ACDF', marginTop: 4 }}>
                Dashboard macroeconómico en tiempo real
              </span>
            </div>
            {/* LIVE badge */}
            <div style={{
              marginLeft: 'auto',
              display: 'flex', alignItems: 'center', gap: 8,
              background: '#74ACDF18', border: '1px solid #74ACDF40',
              borderRadius: 12, padding: '8px 20px',
            }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#74ACDF' }} />
              <span style={{ fontSize: 20, fontWeight: 700, color: '#74ACDF' }}>LIVE</span>
            </div>
          </div>

          {/* Middle: metric cards */}
          <div style={{ display: 'flex', gap: 20, marginTop: 48 }}>
            {metrics.map(m => (
              <div key={m.label} style={{
                flex: 1,
                background: '#1a1a1f',
                border: '1px solid #26262e',
                borderRadius: 16,
                padding: '24px 28px',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#4b5563', letterSpacing: '3px', textTransform: 'uppercase' }}>
                  {m.label}
                </span>
                <span style={{ fontSize: 34, fontWeight: 800, color: '#ffffff', fontVariantNumeric: 'tabular-nums' }}>
                  {m.value}
                </span>
                <span style={{ fontSize: 13, color: '#4b5563' }}>{m.sub}</span>
              </div>
            ))}
          </div>

          {/* Bottom */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 48 }}>
            <span style={{ fontSize: 18, color: '#374151' }}>
              Dólar · Inflación · Riesgo País · Plazo Fijo · Brecha Histórica
            </span>
            <span style={{ fontSize: 18, color: '#4b5563', fontFamily: 'monospace' }}>
              argentina-macro.vercel.app
            </span>
          </div>
        </div>

        {/* Flag stripe bottom */}
        <div style={{ display: 'flex', height: 6, width: '100%' }}>
          <div style={{ flex: 1, background: '#74ACDF' }} />
          <div style={{ flex: 1, background: '#FFFFFF' }} />
          <div style={{ flex: 1, background: '#74ACDF' }} />
        </div>
      </div>
    ),
    { ...size }
  )
}
