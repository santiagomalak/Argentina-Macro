'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { RefreshCw, TrendingUp, TrendingDown, Minus, Calculator, Thermometer, PiggyBank, ExternalLink } from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────────────────────
interface Dolar {
  casa: string; nombre: string
  compra: number; venta: number
  fechaActualizacion: string
  variacion?: number
}
interface EvolucionRow  { month: string; oficial: number | null; blue: number | null }
interface DataRow       { fecha: string; valor: number }
interface Sparklines    { oficial: number[]; blue: number[]; dates: string[] }
interface BrechaRow     { date: string; brecha: number; blue: number; oficial: number }
interface PlazoFijoRate { entidad: string; tna: number; tea: number; tna30: number; enlace: string | null }
interface PlazoFijoData { top5: PlazoFijoRate[]; avgTraditional: number | null; best: PlazoFijoRate | null }

// ── Design tokens ─────────────────────────────────────────────────────────────
const BG      = '#0d0d10'
const SURFACE = '#141418'
const CARD    = '#1a1a1f'
const BORDER  = '#26262e'
const CELESTE = '#74ACDF'   // Official Argentine flag celeste
const UP      = '#22c55e'
const DOWN    = '#ef4444'

const META: Record<string, { label: string; desc: string }> = {
  oficial:         { label: 'Oficial',   desc: 'Banco Nación Argentina' },
  blue:            { label: 'Blue',      desc: 'Mercado informal' },
  bolsa:           { label: 'MEP',       desc: 'Mercado Electrónico de Pagos' },
  contadoconliqui: { label: 'CCL',       desc: 'Contado con Liquidación' },
  cripto:          { label: 'Cripto',    desc: 'Vía stablecoins (USDT)' },
  tarjeta:         { label: 'Tarjeta',   desc: 'Oficial + impuestos' },
  mayorista:       { label: 'Mayorista', desc: 'Mercado interbancario' },
}
const ORDER      = ['oficial', 'blue', 'bolsa', 'contadoconliqui', 'cripto', 'tarjeta', 'mayorista']
const CALC_ORDER = ['oficial', 'blue', 'bolsa', 'contadoconliqui', 'cripto', 'tarjeta']

// ── Formatters ────────────────────────────────────────────────────────────────
const fmt = {
  ars:   (n: number) => new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(n),
  pct:   (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`,
  month: (s: string) => {
    const [y, m] = s.split('-')
    const months = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
    return `${months[parseInt(m) - 1]} '${y.slice(2)}`
  },
  date: (s: string) => {
    const d = new Date(s + 'T00:00:00')
    return d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })
  },
}

const ttStyle = {
  contentStyle: { background: '#111116', border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 12, padding: '10px 14px' },
  labelStyle:   { color: '#6b7280', marginBottom: 4 },
  itemStyle:    { color: '#e5e5e5' },
  cursor:       { stroke: '#ffffff10' },
}

// ── Sol de Mayo (watermark) ───────────────────────────────────────────────────
function SolDeMayo({ size = 320, opacity = 0.035 }: { size?: number; opacity?: number }) {
  const cx = size / 2, cy = size / 2
  const rInner = size * 0.18, rOuter = size * 0.38, rFace = size * 0.15
  const rays = Array.from({ length: 16 }, (_, i) => {
    const angle = (i * 22.5 - 90) * (Math.PI / 180)
    const x1 = cx + rInner * Math.cos(angle), y1 = cy + rInner * Math.sin(angle)
    const x2 = cx + rOuter * Math.cos(angle), y2 = cy + rOuter * Math.sin(angle)
    if (i % 2 === 0) return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={CELESTE} strokeWidth={size * 0.025} strokeLinecap="round" />
    const mid = (rInner + rOuter) / 2, perp = Math.PI / 2
    const bx = cx + mid * Math.cos(angle) + (size * 0.04) * Math.cos(angle + perp)
    const by = cy + mid * Math.sin(angle) + (size * 0.04) * Math.sin(angle + perp)
    return <path key={i} d={`M${x1},${y1} Q${bx},${by} ${x2},${y2}`} stroke={CELESTE} strokeWidth={size * 0.018} fill="none" strokeLinecap="round" />
  })
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ opacity }} aria-hidden>
      {rays}
      <circle cx={cx} cy={cy} r={rFace} fill={CELESTE} />
      <circle cx={cx - rFace * 0.28} cy={cy - rFace * 0.15} r={rFace * 0.1} fill={BG} />
      <circle cx={cx + rFace * 0.28} cy={cy - rFace * 0.15} r={rFace * 0.1} fill={BG} />
      <path d={`M${cx - rFace * 0.28},${cy + rFace * 0.15} Q${cx},${cy + rFace * 0.42} ${cx + rFace * 0.28},${cy + rFace * 0.15}`}
        stroke={BG} strokeWidth={rFace * 0.1} fill="none" strokeLinecap="round" />
    </svg>
  )
}

// ── Sparkline SVG ─────────────────────────────────────────────────────────────
function Sparkline({ values, color, w = 80, h = 28 }: { values: number[]; color: string; w?: number; h?: number }) {
  if (values.length < 2) return null
  const min = Math.min(...values), max = Math.max(...values), range = max - min || 1
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w
    const y = h - ((v - min) / range) * (h - 4) - 2
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity={0.7} />
    </svg>
  )
}

// ── Section Header ────────────────────────────────────────────────────────────
function SectionHeader({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <span className="block w-[3px] h-5 rounded-full shrink-0" style={{ background: CELESTE }} />
      <h2 className="text-xs font-bold uppercase tracking-[3px] text-white">{title}</h2>
      {sub && <span className="text-[11px]" style={{ color: '#4b5563' }}>{sub}</span>}
      <div className="flex-1 h-px" style={{ background: BORDER }} />
    </div>
  )
}

// ── Ticker tape ───────────────────────────────────────────────────────────────
function TickerTape({ dolares }: { dolares: Dolar[] }) {
  const items = [...ORDER.map(c => dolares.find(d => d.casa === c)).filter(Boolean) as Dolar[]]
  const doubled = [...items, ...items]
  return (
    <div className="overflow-hidden border-b" style={{ background: SURFACE, borderColor: BORDER }}>
      <div className="ticker-track flex items-center whitespace-nowrap py-2.5">
        {doubled.map((d, i) => {
          const m = META[d.casa]
          const hasVar = d.variacion !== undefined && d.variacion !== null
          const varColor = (d.variacion ?? 0) > 0 ? UP : (d.variacion ?? 0) < 0 ? DOWN : '#4b5563'
          return (
            <span key={i} className="inline-flex items-center gap-2.5 px-6 text-xs border-r" style={{ borderColor: BORDER }}>
              <span className="font-semibold uppercase tracking-wider text-gray-400">{m?.label}</span>
              <span className="font-bold text-white tabnum">${fmt.ars(d.venta)}</span>
              {hasVar && (
                <span className="font-semibold tabnum text-[11px]" style={{ color: varColor }}>
                  {(d.variacion ?? 0) > 0 ? '▲' : (d.variacion ?? 0) < 0 ? '▼' : '—'} {Math.abs(d.variacion!).toFixed(1)}%
                </span>
              )}
            </span>
          )
        })}
      </div>
    </div>
  )
}

// ── Hero KPI ──────────────────────────────────────────────────────────────────
function HeroKPI({ label, value, sub, trend }: {
  label: string; value: string; sub: string; trend?: 'up' | 'down' | 'neutral'
}) {
  const valueColor = trend === 'up' ? UP : trend === 'down' ? DOWN : '#f0f0f0'
  return (
    <div className="flex flex-col gap-3 px-6 py-5 rounded-lg" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
      <p className="text-[10px] font-semibold uppercase tracking-[3px]" style={{ color: '#4b5563' }}>{label}</p>
      <p className="text-4xl font-bold tabnum leading-none" style={{ color: valueColor }}>{value}</p>
      <p className="text-xs" style={{ color: '#6b7280' }}>{sub}</p>
    </div>
  )
}

// ── Dollar Card ───────────────────────────────────────────────────────────────
function DollarCard({ d, oficialVenta, sparkValues }: {
  d: Dolar; oficialVenta: number; sparkValues?: number[]
}) {
  const m = META[d.casa] ?? { label: d.nombre, desc: '' }
  const brecha = oficialVenta > 0 && d.casa !== 'oficial'
    ? ((d.venta - oficialVenta) / oficialVenta) * 100 : null
  const hasVar = d.variacion !== undefined && d.variacion !== null
  const varUp  = (d.variacion ?? 0) > 0
  const varColor = varUp ? UP : (d.variacion ?? 0) < 0 ? DOWN : '#4b5563'

  return (
    <div className="rounded-lg p-5 flex flex-col gap-4 transition-all hover:brightness-105"
      style={{ background: CARD, border: `1px solid ${BORDER}` }}>

      {/* Header row */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[2px] text-white">{m.label}</p>
          <p className="text-[11px] mt-0.5" style={{ color: '#4b5563' }}>{m.desc}</p>
        </div>
        {sparkValues && sparkValues.length > 1 && (
          <Sparkline values={sparkValues} color={CELESTE} w={64} h={24} />
        )}
      </div>

      {/* Price */}
      <div>
        <p className="text-4xl font-bold text-white tabnum leading-none">${fmt.ars(d.venta)}</p>
        <p className="text-sm mt-1.5" style={{ color: '#4b5563' }}>
          Compra <span className="tabnum" style={{ color: '#9ca3af' }}>${fmt.ars(d.compra)}</span>
        </p>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-3 border-t" style={{ borderColor: BORDER }}>
        {hasVar ? (
          <div className="flex items-center gap-1 text-sm font-semibold" style={{ color: varColor }}>
            {varUp ? <TrendingUp size={13}/> : (d.variacion ?? 0) < 0 ? <TrendingDown size={13}/> : <Minus size={13}/>}
            {fmt.pct(d.variacion!)}
            <span className="text-[11px] font-normal ml-1" style={{ color: '#4b5563' }}>vs ayer</span>
          </div>
        ) : <div />}
        {brecha !== null && (
          <span className="text-xs" style={{ color: '#4b5563' }}>
            brecha <span className="font-bold tabnum" style={{ color: Math.abs(brecha) < 5 ? UP : Math.abs(brecha) < 20 ? '#facc15' : DOWN }}>
              {fmt.pct(brecha)}
            </span>
          </span>
        )}
      </div>
    </div>
  )
}

// ── Mini Dollar Row ───────────────────────────────────────────────────────────
function MiniCard({ d, oficialVenta }: { d: Dolar; oficialVenta: number }) {
  const m = META[d.casa] ?? { label: d.nombre, desc: '' }
  const brecha = oficialVenta > 0 ? ((d.venta - oficialVenta) / oficialVenta) * 100 : null
  const hasVar = d.variacion !== undefined && d.variacion !== null
  const varColor = (d.variacion ?? 0) > 0 ? UP : (d.variacion ?? 0) < 0 ? DOWN : '#4b5563'

  return (
    <div className="rounded-lg px-5 py-4 flex items-center gap-4 transition-all hover:brightness-105"
      style={{ background: CARD, border: `1px solid ${BORDER}` }}>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-white">{m.label}</p>
        <p className="text-[11px] mt-0.5 truncate" style={{ color: '#4b5563' }}>{m.desc}</p>
      </div>
      {brecha !== null && (
        <span className="text-xs tabnum hidden sm:block" style={{ color: '#4b5563' }}>
          <span style={{ color: Math.abs(brecha) < 5 ? UP : Math.abs(brecha) < 20 ? '#facc15' : DOWN }}>{fmt.pct(brecha)}</span> brecha
        </span>
      )}
      {hasVar && (
        <span className="text-xs font-semibold tabnum" style={{ color: varColor }}>
          {(d.variacion ?? 0) >= 0 ? '▲' : '▼'} {Math.abs(d.variacion!).toFixed(1)}%
        </span>
      )}
      <p className="text-xl font-bold text-white tabnum shrink-0">${fmt.ars(d.venta)}</p>
    </div>
  )
}

// ── Brecha Comparador ─────────────────────────────────────────────────────────
function BrechaComparador({ dolares }: { dolares: Dolar[] }) {
  const oficial = dolares.find(d => d.casa === 'oficial')
  if (!oficial) return null
  const comparables = dolares
    .filter(d => d.casa !== 'oficial' && d.casa !== 'mayorista')
    .sort((a, b) => a.venta - b.venta)
  const max = Math.max(...comparables.map(d => d.venta))

  return (
    <div className="rounded-lg p-6" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
      <SectionHeader title="Comparador de tipos de cambio"
        sub={`Referencia oficial $${fmt.ars(oficial.venta)}`} />
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-4">
          <span className="text-sm font-semibold w-20 text-right shrink-0 text-white">Oficial</span>
          <div className="flex-1 relative h-8 rounded-md overflow-hidden" style={{ background: SURFACE }}>
            <div className="absolute left-0 top-0 h-full rounded-md transition-all duration-700"
              style={{ width: `${(oficial.venta / max) * 100}%`, background: `${CELESTE}25`, border: `1px solid ${CELESTE}50` }} />
            <span className="absolute inset-0 flex items-center px-3 text-sm font-bold tabnum" style={{ color: CELESTE }}>
              ${fmt.ars(oficial.venta)}
            </span>
          </div>
          <span className="text-sm font-semibold w-16 shrink-0" style={{ color: '#4b5563' }}>base</span>
        </div>
        {comparables.map(d => {
          const m = META[d.casa]
          const brecha = ((d.venta - oficial.venta) / oficial.venta) * 100
          const col = brecha < 5 ? UP : brecha < 20 ? '#facc15' : brecha < 60 ? '#fb923c' : DOWN
          return (
            <div key={d.casa} className="flex items-center gap-4">
              <span className="text-sm font-semibold w-20 text-right shrink-0 text-white">{m.label}</span>
              <div className="flex-1 relative h-8 rounded-md overflow-hidden" style={{ background: SURFACE }}>
                <div className="absolute left-0 top-0 h-full rounded-md transition-all duration-700"
                  style={{ width: `${(d.venta / max) * 100}%`, background: `${col}18`, border: `1px solid ${col}35` }} />
                <span className="absolute inset-0 flex items-center px-3 text-sm font-bold tabnum text-white">
                  ${fmt.ars(d.venta)}
                </span>
              </div>
              <span className="text-sm font-bold w-16 shrink-0 tabnum" style={{ color: col }}>
                {fmt.pct(brecha)}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Calculadora ───────────────────────────────────────────────────────────────
function Calculadora({ dolares }: { dolares: Dolar[] }) {
  const [usd, setUsd] = useState(100)
  const [dir, setDir] = useState<'usd2ars' | 'ars2usd'>('usd2ars')

  return (
    <div className="rounded-lg p-6" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
      <SectionHeader title="Calculadora de brecha" />

      <div className="flex items-center gap-2 mb-4">
        {(['usd2ars', 'ars2usd'] as const).map(d => (
          <button key={d} onClick={() => setDir(d)}
            className="px-5 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200"
            style={{
              background: dir === d ? CELESTE : CARD,
              color: dir === d ? BG : '#6b7280',
              border: `1px solid ${dir === d ? CELESTE : BORDER}`,
            }}>
            {d === 'usd2ars' ? 'USD → ARS' : 'ARS → USD'}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-3 mb-5 rounded-md px-4 py-3" style={{ background: SURFACE, border: `1px solid ${BORDER}` }}>
        <span className="text-base font-bold shrink-0" style={{ color: CELESTE }}>
          {dir === 'usd2ars' ? 'USD' : 'ARS'}
        </span>
        <input type="number" value={usd} onChange={e => setUsd(Math.max(1, Number(e.target.value)))}
          className="flex-1 bg-transparent text-2xl font-bold text-white outline-none tabnum min-w-0" min={1} />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {CALC_ORDER.map(casa => {
          const d = dolares.find(x => x.casa === casa)
          if (!d) return null
          const m = META[casa]
          const rate = d.venta
          const result = dir === 'usd2ars' ? usd * rate : usd / rate
          const label  = dir === 'usd2ars' ? `$${fmt.ars(result)}` : `U$S ${result.toFixed(2)}`
          return (
            <div key={casa} className="rounded-md p-3 transition-all hover:brightness-110"
              style={{ background: SURFACE, border: `1px solid ${BORDER}` }}>
              <p className="text-[10px] font-bold uppercase tracking-wider mb-1.5" style={{ color: '#6b7280' }}>{m.label}</p>
              <p className="text-base font-bold text-white tabnum leading-tight">{label}</p>
              <p className="text-[10px] mt-1 tabnum" style={{ color: '#4b5563' }}>@ ${fmt.ars(rate)}</p>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Charts ────────────────────────────────────────────────────────────────────
type Tab = 'evolucion' | 'inflacion' | 'riesgo'

function EvolucionChart({ data }: { data: EvolucionRow[] }) {
  return (
    <div>
      <div className="flex gap-6 mb-4">
        {[['Oficial', CELESTE], ['Blue', '#a78bfa']].map(([l, c]) => (
          <span key={l} className="flex items-center gap-2 text-xs" style={{ color: '#6b7280' }}>
            <span className="w-6 h-0.5 rounded inline-block" style={{ background: c }} />{l}
          </span>
        ))}
      </div>
      <div style={{ width: '100%' }}>
        <ResponsiveContainer width="100%" height={340}>
          <LineChart data={data} margin={{ top: 8, right: 32, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={BORDER} vertical={false} />
            <XAxis dataKey="month" tick={{ fill: '#4b5563', fontSize: 11 }}
              tickFormatter={fmt.month} interval="preserveStartEnd" axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#4b5563', fontSize: 11 }}
              tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} axisLine={false} tickLine={false} width={42} />
            <Tooltip {...ttStyle} labelFormatter={s => fmt.month(String(s))}
              formatter={(v, name) => [`$${fmt.ars(Number(v))}`, name === 'oficial' ? 'Oficial' : 'Blue']} />
            <Line type="monotone" dataKey="oficial" stroke={CELESTE} strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="blue" stroke="#a78bfa" strokeWidth={2} dot={false} strokeDasharray="5 3" />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

function InflacionChart({ data }: { data: { monthly: DataRow[]; yoy: DataRow[] } }) {
  const merged = data.monthly.map(m => {
    const y = data.yoy.find(r => r.fecha.slice(0, 7) === m.fecha.slice(0, 7))
    return { fecha: m.fecha, mensual: m.valor, interanual: y?.valor ?? null }
  })
  return (
    <div className="flex flex-col gap-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[2px] mb-4" style={{ color: '#4b5563' }}>IPC mensual — últimos 24 meses</p>
        <div style={{ width: '100%' }}>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={merged} margin={{ top: 4, right: 32, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={BORDER} vertical={false} />
              <XAxis dataKey="fecha" tick={{ fill: '#4b5563', fontSize: 10 }}
                tickFormatter={s => fmt.month(s.slice(0, 7))} interval={3} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#4b5563', fontSize: 11 }} tickFormatter={v => `${v}%`} axisLine={false} tickLine={false} width={36} />
              <Tooltip {...ttStyle} labelFormatter={s => fmt.month(String(s).slice(0, 7))}
                formatter={v => [`${Number(v).toFixed(1)}%`, 'Mensual']} />
              <Bar dataKey="mensual" radius={[3, 3, 0, 0]}>
                {merged.map((e, i) => (
                  <Cell key={i} fill={e.mensual > 10 ? DOWN : e.mensual > 5 ? '#fb923c' : UP} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-[2px] mb-4" style={{ color: '#4b5563' }}>Inflación interanual (YoY)</p>
        <div style={{ width: '100%' }}>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={merged} margin={{ top: 4, right: 32, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="yoyGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={DOWN} stopOpacity={0.2} />
                  <stop offset="95%" stopColor={DOWN} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={BORDER} vertical={false} />
              <XAxis dataKey="fecha" tick={{ fill: '#4b5563', fontSize: 10 }}
                tickFormatter={s => fmt.month(s.slice(0, 7))} interval={3} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#4b5563', fontSize: 11 }} tickFormatter={v => `${v}%`} axisLine={false} tickLine={false} width={36} />
              <Tooltip {...ttStyle} labelFormatter={s => fmt.month(String(s).slice(0, 7))}
                formatter={v => [`${Number(v).toFixed(1)}%`, 'Interanual']} />
              <Area type="monotone" dataKey="interanual" stroke={DOWN} strokeWidth={2} fill="url(#yoyGrad)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}

function RiesgoPaisChart({ data }: { data: DataRow[] }) {
  const last = data[data.length - 1]?.valor, first = data[0]?.valor
  const delta = last && first ? last - first : null
  const up = (delta ?? 0) > 0
  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-end gap-4">
        <div>
          <p className="text-5xl font-bold text-white tracking-tight tabnum">{last ? fmt.ars(last) : '—'}</p>
          <p className="text-sm mt-1" style={{ color: '#4b5563' }}>puntos básicos · EMBI+ Argentina</p>
        </div>
        {delta !== null && (
          <div className="flex items-center gap-1.5 text-sm font-semibold pb-1" style={{ color: up ? DOWN : UP }}>
            {up ? <TrendingUp size={16}/> : <TrendingDown size={16}/>}
            {up ? '+' : ''}{fmt.ars(delta)} bps en 90d
          </div>
        )}
      </div>
      <div style={{ width: '100%' }}>
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={data} margin={{ top: 8, right: 32, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="rpGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f97316" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#f97316" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={BORDER} vertical={false} />
            <XAxis dataKey="fecha" tick={{ fill: '#4b5563', fontSize: 10 }}
              tickFormatter={fmt.date} interval={14} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#4b5563', fontSize: 11 }} domain={['auto','auto']} axisLine={false} tickLine={false} width={42} />
            <Tooltip {...ttStyle} labelFormatter={s => fmt.date(String(s))}
              formatter={v => [`${fmt.ars(Number(v))} bps`, 'Riesgo país']} />
            <Area type="monotone" dataKey="valor" stroke="#f97316" strokeWidth={2} fill="url(#rpGrad)" dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

// ── Brecha Histórica ──────────────────────────────────────────────────────────
function BrechaHistorica({ data }: { data: BrechaRow[] }) {
  const last = data[data.length - 1], first = data[0]
  const min  = Math.min(...data.map(d => d.brecha))
  const max  = Math.max(...data.map(d => d.brecha))
  const color = (last?.brecha ?? 0) < 10 ? UP : (last?.brecha ?? 0) < 40 ? '#facc15' : (last?.brecha ?? 0) < 80 ? '#fb923c' : DOWN

  return (
    <div className="rounded-lg p-6" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
      <div className="flex items-start justify-between mb-5">
        <SectionHeader title="Brecha cambiaria histórica" sub="(Blue − Oficial) / Oficial × 100 · últimos 18 meses" />
        <div className="text-right shrink-0 ml-4">
          <p className="text-2xl font-bold tabnum" style={{ color }}>
            {last ? `${last.brecha > 0 ? '+' : ''}${last.brecha.toFixed(1)}%` : '—'}
          </p>
          <p className="text-xs mt-0.5" style={{ color: '#4b5563' }}>hoy</p>
        </div>
      </div>

      <div className="flex gap-3 mb-4">
        {[
          { label: `Mín ${min.toFixed(1)}%`, color: UP, bg: `${UP}15` },
          { label: `Máx ${max.toFixed(1)}%`, color: DOWN, bg: `${DOWN}15` },
          first ? { label: `Hace 18m: ${first.brecha.toFixed(1)}%`, color: '#4b5563', bg: `${BORDER}` } : null,
        ].filter(Boolean).map((b, i) => b && (
          <span key={i} className="text-xs px-3 py-1 rounded-full font-semibold" style={{ background: b.bg, color: b.color }}>
            {b.label}
          </span>
        ))}
      </div>

      <div style={{ width: '100%' }}>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={data} margin={{ top: 8, right: 24, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="brechaGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.2} />
                <stop offset="95%" stopColor={color} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={BORDER} vertical={false} />
            <XAxis dataKey="date" tick={{ fill: '#4b5563', fontSize: 10 }}
              tickFormatter={s => fmt.date(s)} interval={15} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#4b5563', fontSize: 11 }}
              tickFormatter={v => `${v}%`} axisLine={false} tickLine={false} width={36} domain={[0, 'auto']} />
            <Tooltip {...ttStyle} labelFormatter={s => fmt.date(String(s))}
              formatter={(v, name) => {
                if (name === 'brecha') return [`${Number(v).toFixed(1)}%`, 'Brecha']
                return [`$${fmt.ars(Number(v))}`, name === 'blue' ? 'Blue' : 'Oficial']
              }} />
            <Area type="monotone" dataKey="brecha" stroke={color} strokeWidth={2} fill="url(#brechaGrad)" dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="flex gap-3 mt-3 flex-wrap">
        {[
          { label: '0–10% · Unificado', color: UP },
          { label: '10–40% · Moderado', color: '#facc15' },
          { label: '40–80% · Cepo', color: '#fb923c' },
          { label: '+80% · Crisis', color: DOWN },
        ].map(b => (
          <span key={b.label} className="flex items-center gap-1.5 text-[10px]" style={{ color: '#4b5563' }}>
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: b.color }} />
            {b.label}
          </span>
        ))}
      </div>
    </div>
  )
}

// ── Termómetro Económico ──────────────────────────────────────────────────────
function TermometroEconomico({
  dolares, inflacion, riesgo, plazoFijo, brecha,
}: {
  dolares: Dolar[]
  inflacion: { monthly: DataRow[]; yoy: DataRow[] } | null
  riesgo: DataRow[]
  plazoFijo: PlazoFijoData | null
  brecha: number | null
}) {
  const oficial   = dolares.find(d => d.casa === 'oficial')
  const lastInf   = inflacion?.monthly[inflacion.monthly.length - 1]
  const lastRp    = riesgo[riesgo.length - 1]
  const bestTNA   = plazoFijo?.best?.tna ?? null
  const lastYear  = inflacion?.monthly.slice(-12) ?? []
  const acumAnual = lastYear.length ? lastYear.reduce((acc, r) => acc * (1 + r.valor / 100), 1) - 1 : null
  const SALARIO   = 906_000
  const sMinBlue  = oficial && dolares.find(d => d.casa === 'blue')
    ? (SALARIO / dolares.find(d => d.casa === 'blue')!.venta).toFixed(0) : null
  const sMinOfic  = oficial ? (SALARIO / oficial.venta).toFixed(0) : null

  const items = [
    { label: 'Cepo cambiario',     value: 'Vigente',  sub: 'Límite $200 USD/mes', color: DOWN,    icon: '🔒', ok: false },
    { label: 'Brecha blue/oficial', value: brecha !== null ? `${brecha.toFixed(1)}%` : '—',
      sub: brecha !== null ? (brecha < 10 ? 'Muy baja ✓' : brecha < 30 ? 'Moderada' : 'Alta') : '',
      color: brecha === null ? '#4b5563' : brecha < 10 ? UP : brecha < 30 ? '#facc15' : DOWN,
      icon: '💱', ok: brecha !== null && brecha < 20 },
    { label: 'Inflación mensual',  value: lastInf ? `${lastInf.valor.toFixed(1)}%` : '—',
      sub: acumAnual !== null ? `Acum. anual ~${(acumAnual * 100).toFixed(0)}%` : '',
      color: (lastInf?.valor ?? 99) < 3 ? UP : (lastInf?.valor ?? 99) < 6 ? '#facc15' : DOWN,
      icon: '🔥', ok: (lastInf?.valor ?? 99) < 5 },
    { label: 'Riesgo país',        value: lastRp ? `${fmt.ars(lastRp.valor)} bps` : '—',
      sub: (lastRp?.valor ?? 9999) < 400 ? 'Bajo' : (lastRp?.valor ?? 9999) < 800 ? 'Moderado' : 'Alto',
      color: (lastRp?.valor ?? 9999) < 400 ? UP : (lastRp?.valor ?? 9999) < 800 ? '#facc15' : DOWN,
      icon: '⚡', ok: (lastRp?.valor ?? 9999) < 600 },
    { label: 'Mejor plazo fijo',   value: bestTNA !== null ? `${(bestTNA * 100).toFixed(1)}% TNA` : '—',
      sub: bestTNA !== null ? `≈ ${((bestTNA / 12) * 100).toFixed(1)}% mensual` : '',
      color: UP, icon: '🏦', ok: true },
    { label: 'Salario mínimo',     value: `$${fmt.ars(SALARIO)}`,
      sub: sMinBlue ? `≈ U$S ${sMinBlue} blue · U$S ${sMinOfic} oficial` : '',
      color: '#9ca3af', icon: '👷', ok: null },
  ]

  return (
    <div className="rounded-lg p-6" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
      <SectionHeader title="Termómetro económico" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {items.map(item => (
          <div key={item.label} className="flex items-center gap-4 rounded-md px-4 py-3.5"
            style={{ background: SURFACE, border: `1px solid ${BORDER}` }}>
            <span className="text-xl shrink-0">{item.icon}</span>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] mb-0.5" style={{ color: '#4b5563' }}>{item.label}</p>
              <p className="text-base font-bold tabnum" style={{ color: item.color }}>{item.value}</p>
              {item.sub && <p className="text-[11px] mt-0.5 truncate" style={{ color: '#4b5563' }}>{item.sub}</p>}
            </div>
            {item.ok !== null && (
              <div className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ background: item.ok ? UP : DOWN }} />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Plazo Fijo vs Inflación ───────────────────────────────────────────────────
function PlazoFijoPanel({ data, inflacion }: {
  data: PlazoFijoData
  inflacion: { monthly: DataRow[]; yoy: DataRow[] } | null
}) {
  const [capital, setCapital] = useState(1_000_000)
  const lastInf = inflacion?.monthly[inflacion.monthly.length - 1]?.valor ?? null
  const best = data.best
  const ganancia   = best ? capital * (best.tna / 12) : 0
  const perdida    = lastInf !== null ? capital * (lastInf / 100) : null
  const saldo30d   = capital + ganancia
  const realReturn = lastInf !== null && best ? ((best.tna / 12) - lastInf / 100) * 100 : null

  return (
    <div className="rounded-lg p-6" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
      <SectionHeader title="Plazo fijo vs inflación" />

      <div className="flex items-center gap-3 rounded-md px-4 py-3 mb-5" style={{ background: SURFACE, border: `1px solid ${BORDER}` }}>
        <span className="text-sm font-bold shrink-0" style={{ color: '#4b5563' }}>$</span>
        <input type="number" value={capital} onChange={e => setCapital(Math.max(1000, Number(e.target.value)))}
          className="flex-1 bg-transparent text-xl font-bold text-white outline-none tabnum min-w-0" step={10000} />
        <span className="text-xs shrink-0" style={{ color: '#4b5563' }}>ARS</span>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-5">
        {[
          { label: 'Capital inicial', value: `$${fmt.ars(capital)}`, sub: '', color: '#9ca3af', bg: SURFACE },
          { label: 'En 30 días', value: `$${fmt.ars(saldo30d)}`, sub: `+$${fmt.ars(ganancia)}`, color: UP, bg: `${UP}10` },
          { label: 'Pierde inflación', value: perdida ? `-$${fmt.ars(perdida)}` : '—', sub: lastInf ? `${lastInf.toFixed(1)}% mensual` : '', color: DOWN, bg: `${DOWN}10` },
        ].map(item => (
          <div key={item.label} className="rounded-md p-3 text-center" style={{ background: item.bg, border: `1px solid ${BORDER}` }}>
            <p className="text-[10px] uppercase tracking-wider mb-1.5" style={{ color: '#4b5563' }}>{item.label}</p>
            <p className="text-sm font-bold tabnum" style={{ color: item.color }}>{item.value}</p>
            {item.sub && <p className="text-[10px] mt-0.5" style={{ color: item.color + '99' }}>{item.sub}</p>}
          </div>
        ))}
      </div>

      {realReturn !== null && (
        <div className="rounded-md px-4 py-3 mb-5 flex items-center justify-between"
          style={{ background: realReturn >= 0 ? `${UP}10` : `${DOWN}10`, border: `1px solid ${realReturn >= 0 ? UP : DOWN}30` }}>
          <p className="text-sm" style={{ color: '#6b7280' }}>Rendimiento real mensual</p>
          <p className="text-base font-bold tabnum" style={{ color: realReturn >= 0 ? UP : DOWN }}>
            {realReturn >= 0 ? '+' : ''}{realReturn.toFixed(2)}%
          </p>
        </div>
      )}

      <p className="text-[10px] font-bold uppercase tracking-[3px] mb-3" style={{ color: '#4b5563' }}>Mejores tasas disponibles</p>
      <div className="flex flex-col gap-2">
        {data.top5.map((b, i) => (
          <div key={b.entidad} className="flex items-center gap-3 rounded-md px-4 py-2.5"
            style={{ background: SURFACE, border: `1px solid ${BORDER}` }}>
            <span className="text-xs font-bold w-5 shrink-0" style={{ color: '#4b5563' }}>{i + 1}</span>
            <p className="text-sm text-white flex-1 truncate">{b.entidad}</p>
            <div className="text-right shrink-0">
              <span className="text-sm font-bold tabnum" style={{ color: UP }}>{(b.tna * 100).toFixed(1)}% TNA</span>
              <span className="text-xs ml-2 tabnum" style={{ color: '#4b5563' }}>{b.tna30.toFixed(1)}%/mes</span>
            </div>
            {b.enlace && (
              <a href={b.enlace} target="_blank" rel="noreferrer" className="shrink-0 hover:text-white transition-colors" style={{ color: '#374151' }}>
                <ExternalLink size={12} />
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
function Pulse({ h = 'h-32', cols = 1 }: { h?: string; cols?: number }) {
  return (
    <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
      {Array.from({ length: cols }).map((_, i) => (
        <div key={i} className={`${h} rounded-lg animate-pulse`} style={{ background: CARD }} />
      ))}
    </div>
  )
}

// ── Main Dashboard ────────────────────────────────────────────────────────────
export default function Dashboard() {
  const [dolares,         setDolares]         = useState<Dolar[]>([])
  const [evolucion,       setEvolucion]       = useState<EvolucionRow[]>([])
  const [inflacion,       setInflacion]       = useState<{ monthly: DataRow[]; yoy: DataRow[] } | null>(null)
  const [riesgo,          setRiesgo]          = useState<DataRow[]>([])
  const [sparklines,      setSparklines]      = useState<Sparklines | null>(null)
  const [brechaHistorica, setBrechaHistorica] = useState<BrechaRow[]>([])
  const [plazoFijo,       setPlazoFijo]       = useState<PlazoFijoData | null>(null)
  const [tab,             setTab]             = useState<Tab>('evolucion')
  const [loading,         setLoading]         = useState(true)
  const [lastUpdate,      setLastUpdate]      = useState('')
  const [refreshing,      setRefreshing]      = useState(false)

  const loadDolares = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true)
    try {
      const data = await fetch('/api/dolares').then(r => r.json())
      setDolares(data)
      setLastUpdate(new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }))
    } finally {
      if (!silent) setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    Promise.all([
      fetch('/api/dolares').then(r => r.json()),
      fetch('/api/evolucion').then(r => r.json()),
      fetch('/api/inflacion').then(r => r.json()),
      fetch('/api/riesgo-pais').then(r => r.json()),
      fetch('/api/sparklines').then(r => r.json()),
      fetch('/api/brecha-historica').then(r => r.json()),
      fetch('/api/plazo-fijo').then(r => r.json()),
    ]).then(([dol, evo, inf, rp, sp, bh, pf]) => {
      setDolares(dol); setEvolucion(evo); setInflacion(inf); setRiesgo(rp)
      setSparklines(sp); setBrechaHistorica(bh); setPlazoFijo(pf)
      setLastUpdate(new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }))
    }).finally(() => setLoading(false))
    const iv = setInterval(() => loadDolares(true), 60_000)
    return () => clearInterval(iv)
  }, [loadDolares])

  const sorted   = [...dolares].sort((a, b) => ORDER.indexOf(a.casa) - ORDER.indexOf(b.casa))
  const featured = sorted.filter(d => ['oficial','blue','bolsa','contadoconliqui'].includes(d.casa))
  const mini     = sorted.filter(d => !['oficial','blue','bolsa','contadoconliqui'].includes(d.casa))
  const oficial  = dolares.find(d => d.casa === 'oficial')
  const blue     = dolares.find(d => d.casa === 'blue')
  const brecha   = oficial && blue ? ((blue.venta - oficial.venta) / oficial.venta) * 100 : null
  const lastInf  = inflacion?.monthly[inflacion.monthly.length - 1]
  const lastRp   = riesgo[riesgo.length - 1]

  const TABS: { id: Tab; label: string }[] = [
    { id: 'evolucion', label: 'Evolución' },
    { id: 'inflacion', label: 'Inflación' },
    { id: 'riesgo',    label: 'Riesgo país' },
  ]

  const sparkFor: Record<string, number[] | undefined> = {
    oficial: sparklines?.oficial,
    blue:    sparklines?.blue,
  }

  return (
    <div className="min-h-screen text-white relative" style={{ background: BG }}>
      {/* Sol de Mayo watermark — centrado */}
      <div className="pointer-events-none fixed z-0"
        style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}>
        <SolDeMayo size={600} opacity={0.035} />
      </div>

      <div className="relative z-10">

        {/* ── Header ── */}
        <header className="sticky top-0 z-50 backdrop-blur-xl"
          style={{ borderBottom: `1px solid ${BORDER}`, background: `${BG}f0` }}>
          <div className="h-[4px]" style={{
            background: `linear-gradient(90deg, ${CELESTE} 33%, #fff 33%, #fff 67%, ${CELESTE} 67%)`
          }} />
          <div className="w-full px-6 py-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="text-2xl select-none">🇦🇷</span>
              <div>
                <h1 className="text-base font-bold text-white tracking-tight">Argentina Macro</h1>
                <p className="text-xs mt-0.5" style={{ color: '#4b5563' }}>Dólar · Inflación · Riesgo país</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {lastUpdate && <span className="text-xs hidden md:block" style={{ color: '#374151' }}>upd. {lastUpdate}</span>}
              <button onClick={() => loadDolares(false)} disabled={refreshing}
                className="flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium transition-all hover:bg-white/5 disabled:opacity-40"
                style={{ border: `1px solid ${BORDER}`, color: '#6b7280' }}>
                <RefreshCw size={11} className={refreshing ? 'animate-spin' : ''} />
                <span className="hidden sm:inline">Actualizar</span>
              </button>
              <div className="flex items-center gap-1.5 px-3 py-2 rounded-md glow-celeste"
                style={{ background: `${CELESTE}15`, border: `1px solid ${CELESTE}30` }}>
                <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: CELESTE }} />
                <span className="text-xs font-bold" style={{ color: CELESTE }}>LIVE</span>
              </div>
            </div>
          </div>
        </header>

        {/* ── Ticker ── */}
        {!loading && dolares.length > 0 && <TickerTape dolares={dolares} />}

        <main className="w-full px-4 sm:px-8 xl:px-12 2xl:px-16 py-8 flex flex-col gap-10">

          {/* ── Hero KPIs ── */}
          {loading ? <Pulse h="h-32" cols={4} /> : (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <HeroKPI label="Dólar Blue"
                value={`$${fmt.ars(blue?.venta ?? 0)}`}
                sub={`Compra $${fmt.ars(blue?.compra ?? 0)}`}
                trend={blue?.variacion != null ? (blue.variacion > 0 ? 'up' : blue.variacion < 0 ? 'down' : 'neutral') : 'neutral'} />
              <HeroKPI label="Brecha blue / oficial"
                value={brecha !== null ? fmt.pct(brecha) : '—'}
                sub="Spread cambiario"
                trend={brecha === null ? 'neutral' : brecha < 10 ? 'up' : 'down'} />
              <HeroKPI label="Inflación mensual"
                value={lastInf ? `${lastInf.valor.toFixed(1)}%` : '—'}
                sub={lastInf ? `${fmt.month(lastInf.fecha.slice(0,7))} · INDEC` : 'INDEC'}
                trend="down" />
              <HeroKPI label="Riesgo país"
                value={lastRp ? `${fmt.ars(lastRp.valor)} bps` : '—'}
                sub="EMBI+ Argentina"
                trend="down" />
            </div>
          )}

          {/* ── Tipos de cambio ── */}
          <section>
            <SectionHeader title="Tipos de cambio"
              sub={new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })} />
            {loading ? (
              <div className="flex flex-col gap-4">
                <Pulse h="h-44" cols={4} />
                <Pulse h="h-16" cols={3} />
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {/* Featured: Oficial, Blue, MEP, CCL */}
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                  {featured.map(d => (
                    <DollarCard key={d.casa} d={d}
                      oficialVenta={oficial?.venta ?? 0}
                      sparkValues={sparkFor[d.casa]} />
                  ))}
                </div>
                {/* Mini: Cripto, Tarjeta, Mayorista */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {mini.map(d => <MiniCard key={d.casa} d={d} oficialVenta={oficial?.venta ?? 0} />)}
                </div>
              </div>
            )}
          </section>

          {/* ── Comparador + Calculadora ── */}
          {!loading && dolares.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <BrechaComparador dolares={dolares} />
              <Calculadora dolares={dolares} />
            </div>
          )}

          {/* ── Gráficos ── */}
          <section>
            <div className="flex items-center gap-2 mb-5">
              {TABS.map(t => (
                <button key={t.id} onClick={() => setTab(t.id)}
                  className="px-5 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200"
                  style={{
                    background: tab === t.id ? CELESTE : CARD,
                    color: tab === t.id ? BG : '#6b7280',
                    border: `1px solid ${tab === t.id ? CELESTE : BORDER}`,
                  }}>
                  {t.label}
                </button>
              ))}
            </div>

            <div className="rounded-lg p-6" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
              {loading ? <Pulse h="h-72" /> : tab === 'evolucion' ? (
                <>
                  <p className="text-base font-semibold text-white mb-1">Blue vs Oficial</p>
                  <p className="text-xs mb-5" style={{ color: '#4b5563' }}>Precio venta mensual — últimos 14 meses</p>
                  <EvolucionChart data={evolucion} />
                </>
              ) : tab === 'inflacion' ? (
                <>
                  <p className="text-base font-semibold text-white mb-1">Inflación — IPC INDEC</p>
                  <p className="text-xs mb-5" style={{ color: '#4b5563' }}>Verde ≤5% · Naranja &gt;5% · Rojo &gt;10%</p>
                  {inflacion ? <InflacionChart data={inflacion} /> : <Pulse h="h-72" />}
                </>
              ) : (
                <>
                  <p className="text-base font-semibold text-white mb-1">Riesgo País — últimos 90 días</p>
                  <p className="text-xs mb-5" style={{ color: '#4b5563' }}>Spread soberano EMBI+ Argentina · ArgentinaDatos</p>
                  <RiesgoPaisChart data={riesgo} />
                </>
              )}
            </div>
          </section>

          {/* ── Brecha histórica ── */}
          {!loading && brechaHistorica.length > 0 && <BrechaHistorica data={brechaHistorica} />}

          {/* ── Termómetro + Plazo Fijo ── */}
          {!loading && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <TermometroEconomico dolares={dolares} inflacion={inflacion} riesgo={riesgo} plazoFijo={plazoFijo} brecha={brecha} />
              {plazoFijo && <PlazoFijoPanel data={plazoFijo} inflacion={inflacion} />}
            </div>
          )}

          {/* ── Footer ── */}
          <footer className="text-center pt-4 pb-6 border-t" style={{ borderColor: BORDER }}>
            <div className="flex items-center justify-center gap-2 mb-2">
              <SolDeMayo size={18} opacity={0.5} />
              <span className="text-xs font-medium" style={{ color: CELESTE + '70' }}>Argentina Macro Dashboard</span>
            </div>
            <p className="text-xs" style={{ color: '#374151' }}>
              {['dolarapi.com','bluelytics.com.ar','argentinadatos.com','INDEC'].map((s, i) => (
                <span key={s}>{i > 0 && ' · '}
                  <a href={`https://${s}`} target="_blank" rel="noreferrer"
                    className="hover:text-gray-500 transition-colors">{s}</a>
                </span>
              ))}
            </p>
          </footer>

        </main>
      </div>
    </div>
  )
}
