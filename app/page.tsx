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
const BG      = '#07070f'
const SURFACE = '#0e0e1a'
const CARD    = '#11111e'
const BORDER  = '#1c1c30'
const CELESTE = '#74b9ff'

const META: Record<string, { label: string; color: string; desc: string }> = {
  oficial:         { label: 'Oficial',   color: CELESTE,  desc: 'Banco Nación Argentina' },
  blue:            { label: 'Blue',      color: '#c084fc', desc: 'Mercado informal' },
  bolsa:           { label: 'MEP',       color: '#34d399', desc: 'Mercado Electrónico de Pagos' },
  contadoconliqui: { label: 'CCL',       color: '#f97316', desc: 'Contado con Liquidación' },
  cripto:          { label: 'Cripto',    color: '#fbbf24', desc: 'Vía stablecoins (USDT)' },
  tarjeta:         { label: 'Tarjeta',   color: '#f472b6', desc: 'Oficial + impuestos' },
  mayorista:       { label: 'Mayorista', color: '#2dd4bf', desc: 'Mercado interbancario' },
}
const ORDER     = ['oficial', 'blue', 'bolsa', 'contadoconliqui', 'cripto', 'tarjeta', 'mayorista']
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
  contentStyle: { background: '#09091a', border: `1px solid ${BORDER}`, borderRadius: 10, fontSize: 12, padding: '10px 14px' },
  labelStyle:   { color: '#94a3b8', marginBottom: 4 },
  itemStyle:    { color: '#e2e8f0' },
  cursor:       { stroke: '#ffffff08' },
}

// ── Sol de Mayo ───────────────────────────────────────────────────────────────
function SolDeMayo({ size = 320, opacity = 0.035 }: { size?: number; opacity?: number }) {
  const cx = size / 2, cy = size / 2
  const rInner = size * 0.18, rOuter = size * 0.38
  const rFace  = size * 0.15

  // 8 straight + 8 wavy rays alternating (16 total)
  const rays = Array.from({ length: 16 }, (_, i) => {
    const angle  = (i * 22.5 - 90) * (Math.PI / 180)
    const isStraight = i % 2 === 0
    const x1 = cx + rInner * Math.cos(angle)
    const y1 = cy + rInner * Math.sin(angle)
    const x2 = cx + rOuter * Math.cos(angle)
    const y2 = cy + rOuter * Math.sin(angle)
    if (isStraight) {
      return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={CELESTE} strokeWidth={size * 0.025} strokeLinecap="round" />
    }
    // Wavy ray — use quadratic bezier
    const mid = (rInner + rOuter) / 2
    const perp = (Math.PI / 2)
    const bx = cx + mid * Math.cos(angle) + (size * 0.04) * Math.cos(angle + perp)
    const by = cy + mid * Math.sin(angle) + (size * 0.04) * Math.sin(angle + perp)
    return <path key={i} d={`M${x1},${y1} Q${bx},${by} ${x2},${y2}`} stroke={CELESTE} strokeWidth={size * 0.018} fill="none" strokeLinecap="round" />
  })

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ opacity }} aria-hidden>
      {rays}
      <circle cx={cx} cy={cy} r={rFace} fill={CELESTE} />
      {/* Face */}
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
  const min = Math.min(...values), max = Math.max(...values)
  const range = max - min || 1
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w
    const y = h - ((v - min) / range) * (h - 4) - 2
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
  const last = values[values.length - 1]
  const prev = values[values.length - 2]
  const trend = last >= prev ? color : '#f87171'
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <polyline points={pts} fill="none" stroke={trend} strokeWidth="1.8"
        strokeLinecap="round" strokeLinejoin="round" opacity={0.8} />
      <circle cx={parseFloat(pts.split(' ').pop()!.split(',')[0])} cy={parseFloat(pts.split(' ').pop()!.split(',')[1])}
        r="2.5" fill={trend} />
    </svg>
  )
}

// ── Ticker tape ───────────────────────────────────────────────────────────────
function TickerTape({ dolares }: { dolares: Dolar[] }) {
  const items = [...ORDER.map(c => dolares.find(d => d.casa === c)).filter(Boolean) as Dolar[]]
  const doubled = [...items, ...items] // loop trick

  return (
    <div className="overflow-hidden" style={{ background: '#0a0a18', borderBottom: `1px solid ${BORDER}` }}>
      <div className="ticker-track flex items-center whitespace-nowrap py-2">
        {doubled.map((d, i) => {
          const m = META[d.casa]
          const hasVar = d.variacion !== undefined && d.variacion !== null
          const varColor = (d.variacion ?? 0) > 0 ? '#4ade80' : (d.variacion ?? 0) < 0 ? '#f87171' : '#64748b'
          return (
            <span key={i} className="inline-flex items-center gap-2 px-5 text-xs">
              <span className="font-bold uppercase tracking-wider" style={{ color: m?.color }}>{m?.label}</span>
              <span className="font-bold text-white tabnum">${fmt.ars(d.venta)}</span>
              {hasVar && (
                <span className="font-semibold tabnum" style={{ color: varColor }}>
                  {(d.variacion ?? 0) > 0 ? '▲' : (d.variacion ?? 0) < 0 ? '▼' : '—'} {fmt.pct(d.variacion!)}
                </span>
              )}
              <span className="text-slate-700 ml-3">·</span>
            </span>
          )
        })}
      </div>
    </div>
  )
}

// ── Hero KPI card ─────────────────────────────────────────────────────────────
function HeroKPI({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  return (
    <div className="flex flex-col gap-1.5 p-5 rounded-2xl relative overflow-hidden"
      style={{ background: CARD, border: `1px solid ${color}25` }}>
      <div className="absolute inset-0 rounded-2xl pointer-events-none"
        style={{ background: `radial-gradient(ellipse at top left, ${color}10, transparent 70%)` }} />
      <p className="text-[10px] font-bold uppercase tracking-[3px] relative z-10" style={{ color: color + '99' }}>{label}</p>
      <p className="text-3xl font-bold tracking-tight tabnum relative z-10" style={{ color }}>{value}</p>
      <p className="text-[11px] relative z-10" style={{ color: '#475569' }}>{sub}</p>
    </div>
  )
}

// ── Featured Dollar Card ──────────────────────────────────────────────────────
function FeaturedCard({ d, oficialVenta, sparkValues }: {
  d: Dolar; oficialVenta: number; sparkValues?: number[]
}) {
  const m = META[d.casa] ?? { label: d.nombre, color: '#9ca3af', desc: '' }
  const brecha = oficialVenta > 0 && d.casa !== 'oficial'
    ? ((d.venta - oficialVenta) / oficialVenta) * 100 : null
  const hasVar = d.variacion !== undefined && d.variacion !== null
  const varColor = (d.variacion ?? 0) > 0 ? '#4ade80' : (d.variacion ?? 0) < 0 ? '#f87171' : '#64748b'

  return (
    <div className="rounded-2xl p-6 flex flex-col gap-4 relative overflow-hidden group
                    transition-all duration-300 hover:-translate-y-1"
      style={{ background: CARD, border: `1px solid ${m.color}30` }}>
      <div className="absolute inset-0 rounded-2xl pointer-events-none transition-opacity duration-300 group-hover:opacity-100 opacity-70"
        style={{ background: `radial-gradient(ellipse at top left, ${m.color}0d, transparent 60%)` }} />

      <div className="flex items-start justify-between relative z-10">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full" style={{ background: m.color }} />
            <span className="text-xs font-bold uppercase tracking-[3px]" style={{ color: m.color }}>{m.label}</span>
          </div>
          <p className="text-[10px] text-slate-600 mt-0.5 ml-4">{m.desc}</p>
        </div>
        {sparkValues && sparkValues.length > 1 && (
          <Sparkline values={sparkValues} color={m.color} />
        )}
      </div>

      <div className="relative z-10">
        <p className="text-4xl font-bold text-white tracking-tight tabnum">${fmt.ars(d.venta)}</p>
        <p className="text-xs text-slate-600 mt-1">
          Compra <span className="text-slate-400 tabnum">${fmt.ars(d.compra)}</span>
        </p>
      </div>

      <div className="flex items-center justify-between relative z-10">
        {hasVar ? (
          <div className="flex items-center gap-1.5">
            <div className="flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-md"
              style={{ background: varColor + '18', color: varColor }}>
              {(d.variacion ?? 0) > 0 ? <TrendingUp size={11}/> : (d.variacion ?? 0) < 0 ? <TrendingDown size={11}/> : <Minus size={11}/>}
              {fmt.pct(d.variacion!)}
            </div>
            <span className="text-[10px] text-slate-600">vs ayer</span>
          </div>
        ) : <div />}
        {brecha !== null && (
          <span className="text-xs font-bold px-2.5 py-1 rounded-full"
            style={{ background: `${m.color}15`, color: m.color, border: `1px solid ${m.color}25` }}>
            {fmt.pct(brecha)} brecha
          </span>
        )}
      </div>
    </div>
  )
}

// ── Mini Dollar Card ──────────────────────────────────────────────────────────
function MiniCard({ d, oficialVenta }: { d: Dolar; oficialVenta: number }) {
  const m = META[d.casa] ?? { label: d.nombre, color: '#9ca3af', desc: '' }
  const brecha = oficialVenta > 0 ? ((d.venta - oficialVenta) / oficialVenta) * 100 : null
  return (
    <div className="rounded-xl px-4 py-3.5 flex items-center justify-between gap-4
                    transition-all hover:bg-white/[0.02]"
      style={{ background: CARD, border: `1px solid ${BORDER}` }}>
      <div className="flex items-center gap-3">
        <div className="w-2 h-2 rounded-full shrink-0" style={{ background: m.color }} />
        <div>
          <p className="text-xs font-bold" style={{ color: m.color }}>{m.label}</p>
          <p className="text-[10px] text-slate-600">{m.desc}</p>
        </div>
      </div>
      <div className="text-right">
        <p className="text-sm font-bold text-white tabnum">${fmt.ars(d.venta)}</p>
        {brecha !== null && (
          <p className="text-[10px] tabnum" style={{ color: m.color + '99' }}>{fmt.pct(brecha)}</p>
        )}
      </div>
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
    <div className="rounded-2xl p-6" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
      <p className="text-[10px] font-bold uppercase tracking-[3px] text-slate-500 mb-1">Comparador de tipos de cambio</p>
      <p className="text-[11px] text-slate-600 mb-6">Precio venta · referencia Oficial ${fmt.ars(oficial.venta)}</p>
      <div className="flex flex-col gap-3.5">
        <div className="flex items-center gap-4">
          <span className="text-[11px] w-20 text-right shrink-0 font-medium" style={{ color: CELESTE }}>Oficial</span>
          <div className="flex-1 relative h-7 flex items-center">
            <div className="absolute inset-0 rounded-lg" style={{ background: BORDER + '80' }} />
            <div className="absolute left-0 top-0 h-full rounded-lg transition-all duration-700"
              style={{ width: `${(oficial.venta / max) * 100}%`, background: `${CELESTE}20`, border: `1px solid ${CELESTE}40` }} />
            <span className="relative z-10 text-xs font-bold ml-3 tabnum" style={{ color: CELESTE }}>
              ${fmt.ars(oficial.venta)}
            </span>
          </div>
          <span className="text-xs font-bold w-16 shrink-0 text-slate-600">base</span>
        </div>
        {comparables.map(d => {
          const m = META[d.casa]
          const brecha = ((d.venta - oficial.venta) / oficial.venta) * 100
          const width = (d.venta / max) * 100
          const col = brecha < 5 ? '#4ade80' : brecha < 20 ? '#facc15' : brecha < 60 ? '#fb923c' : '#f87171'
          return (
            <div key={d.casa} className="flex items-center gap-4">
              <span className="text-[11px] w-20 text-right shrink-0 font-medium" style={{ color: m.color }}>{m.label}</span>
              <div className="flex-1 relative h-7 flex items-center">
                <div className="absolute inset-0 rounded-lg" style={{ background: BORDER + '80' }} />
                <div className="absolute left-0 top-0 h-full rounded-lg transition-all duration-700"
                  style={{ width: `${width}%`, background: `${m.color}18`, border: `1px solid ${m.color}35` }} />
                <span className="relative z-10 text-xs font-bold ml-3 tabnum" style={{ color: '#94a3b8' }}>
                  ${fmt.ars(d.venta)}
                </span>
              </div>
              <span className="text-xs font-bold w-16 shrink-0 tabnum" style={{ color: col }}>
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
    <div className="rounded-2xl p-6" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
      <div className="flex items-center gap-2 mb-5">
        <Calculator size={14} style={{ color: CELESTE }} />
        <p className="text-[10px] font-bold uppercase tracking-[3px] text-slate-400">Calculadora de brecha</p>
      </div>

      {/* Input */}
      <div className="flex items-center gap-3 mb-2">
        <div className="flex rounded-lg overflow-hidden text-xs font-bold"
          style={{ border: `1px solid ${BORDER}` }}>
          {(['usd2ars', 'ars2usd'] as const).map(d => (
            <button key={d} onClick={() => setDir(d)}
              className="px-3 py-2 transition-colors"
              style={{ background: dir === d ? CELESTE : 'transparent', color: dir === d ? '#07070f' : '#64748b' }}>
              {d === 'usd2ars' ? 'USD → ARS' : 'ARS → USD'}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3 mb-5 rounded-xl px-4 py-3"
        style={{ background: SURFACE, border: `1px solid ${BORDER}` }}>
        <span className="text-lg font-bold shrink-0" style={{ color: CELESTE }}>
          {dir === 'usd2ars' ? 'USD' : 'ARS'}
        </span>
        <input
          type="number"
          value={usd}
          onChange={e => setUsd(Math.max(1, Number(e.target.value)))}
          className="flex-1 bg-transparent text-2xl font-bold text-white outline-none tabnum min-w-0"
          min={1}
        />
      </div>

      {/* Results */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
        {CALC_ORDER.map(casa => {
          const d = dolares.find(x => x.casa === casa)
          if (!d) return null
          const m = META[casa]
          const rate = d.venta
          const result = dir === 'usd2ars' ? usd * rate : usd / rate
          const label  = dir === 'usd2ars' ? `$${fmt.ars(result)}` : `U$S ${result.toFixed(2)}`
          return (
            <div key={casa} className="rounded-xl p-3.5 transition-all hover:bg-white/[0.02]"
              style={{ background: SURFACE, border: `1px solid ${BORDER}` }}>
              <p className="text-[10px] font-bold uppercase tracking-wider mb-1.5" style={{ color: m.color }}>{m.label}</p>
              <p className="text-base font-bold text-white tabnum leading-tight">{label}</p>
              <p className="text-[10px] text-slate-600 mt-1 tabnum">@ ${fmt.ars(rate)}/USD</p>
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
      <div className="flex gap-5 mb-4">
        {[['Oficial', CELESTE], ['Blue', '#c084fc']].map(([l, c]) => (
          <span key={l} className="flex items-center gap-1.5 text-xs text-slate-500">
            <span className="w-5 h-px rounded inline-block" style={{ background: c }} />{l}
          </span>
        ))}
      </div>
      <div style={{ width: '100%' }}>
      <ResponsiveContainer width="100%" height={340}>
        <LineChart data={data} margin={{ top: 8, right: 32, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1c1c30" vertical={false} />
          <XAxis dataKey="month" tick={{ fill: '#475569', fontSize: 11 }}
            tickFormatter={fmt.month} interval="preserveStartEnd" axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: '#475569', fontSize: 11 }}
            tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} axisLine={false} tickLine={false} width={42} />
          <Tooltip {...ttStyle} labelFormatter={s => fmt.month(String(s))}
            formatter={(v, name) => [`$${fmt.ars(Number(v))}`, name === 'oficial' ? 'Oficial' : 'Blue']} />
          <Line type="monotone" dataKey="oficial" stroke={CELESTE}   strokeWidth={2.5} dot={false} />
          <Line type="monotone" dataKey="blue"    stroke="#c084fc" strokeWidth={2.5} dot={false} strokeDasharray="5 3" />
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
        <p className="text-[10px] font-bold uppercase tracking-[3px] text-slate-500 mb-4">IPC mensual — últimos 24 meses</p>
        <div style={{ width: '100%' }}>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={merged} margin={{ top: 4, right: 32, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1c1c30" vertical={false} />
            <XAxis dataKey="fecha" tick={{ fill: '#475569', fontSize: 10 }}
              tickFormatter={s => fmt.month(s.slice(0, 7))} interval={3} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#475569', fontSize: 11 }} tickFormatter={v => `${v}%`} axisLine={false} tickLine={false} width={36} />
            <Tooltip {...ttStyle} labelFormatter={s => fmt.month(String(s).slice(0, 7))}
              formatter={v => [`${Number(v).toFixed(1)}%`, 'Mensual']} />
            <Bar dataKey="mensual" radius={[4, 4, 0, 0]}>
              {merged.map((e, i) => (
                <Cell key={i} fill={e.mensual > 10 ? '#f87171' : e.mensual > 5 ? '#fb923c' : '#4ade80'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        </div>
      </div>
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[3px] text-slate-500 mb-4">Inflación interanual (YoY)</p>
        <div style={{ width: '100%' }}>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={merged} margin={{ top: 4, right: 32, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="yoyGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#f87171" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#f87171" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1c1c30" vertical={false} />
            <XAxis dataKey="fecha" tick={{ fill: '#475569', fontSize: 10 }}
              tickFormatter={s => fmt.month(s.slice(0, 7))} interval={3} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#475569', fontSize: 11 }} tickFormatter={v => `${v}%`} axisLine={false} tickLine={false} width={36} />
            <Tooltip {...ttStyle} labelFormatter={s => fmt.month(String(s).slice(0, 7))}
              formatter={v => [`${Number(v).toFixed(1)}%`, 'Interanual']} />
            <Area type="monotone" dataKey="interanual" stroke="#f87171" strokeWidth={2.5} fill="url(#yoyGrad)" dot={false} />
          </AreaChart>
        </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}

function RiesgoPaisChart({ data }: { data: DataRow[] }) {
  const last  = data[data.length - 1]?.valor
  const first = data[0]?.valor
  const delta = last && first ? last - first : null
  const up    = (delta ?? 0) > 0
  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-end gap-4">
        <div>
          <p className="text-5xl font-bold text-white tracking-tight tabnum">{last ? fmt.ars(last) : '—'}</p>
          <p className="text-xs text-slate-500 mt-1">puntos básicos · EMBI+ Argentina</p>
        </div>
        {delta !== null && (
          <div className="flex items-center gap-1.5 text-sm font-semibold pb-1"
            style={{ color: up ? '#f87171' : '#4ade80' }}>
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
              <stop offset="5%"  stopColor="#f97316" stopOpacity={0.3}  />
              <stop offset="95%" stopColor="#f97316" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#1c1c30" vertical={false} />
          <XAxis dataKey="fecha" tick={{ fill: '#475569', fontSize: 10 }}
            tickFormatter={fmt.date} interval={14} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: '#475569', fontSize: 11 }} domain={['auto','auto']} axisLine={false} tickLine={false} width={42} />
          <Tooltip {...ttStyle} labelFormatter={s => fmt.date(String(s))}
            formatter={v => [`${fmt.ars(Number(v))} bps`, 'Riesgo país']} />
          <Area type="monotone" dataKey="valor" stroke="#f97316" strokeWidth={2.5} fill="url(#rpGrad)" dot={false} />
        </AreaChart>
      </ResponsiveContainer>
      </div>
    </div>
  )
}

// ── Brecha Histórica ──────────────────────────────────────────────────────────
function BrechaHistorica({ data }: { data: BrechaRow[] }) {
  const last  = data[data.length - 1]
  const first = data[0]
  const min   = Math.min(...data.map(d => d.brecha))
  const max   = Math.max(...data.map(d => d.brecha))
  const color = (last?.brecha ?? 0) < 10 ? '#4ade80' : (last?.brecha ?? 0) < 40 ? '#facc15' : (last?.brecha ?? 0) < 80 ? '#fb923c' : '#f87171'

  return (
    <div className="rounded-2xl p-6" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
      <div className="flex items-start justify-between mb-5">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[3px] text-slate-500 mb-1">Brecha cambiaria histórica</p>
          <p className="text-[11px] text-slate-600">(Blue − Oficial) / Oficial × 100 — últimos 18 meses</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold tabnum" style={{ color }}>
            {last ? `${last.brecha > 0 ? '+' : ''}${last.brecha.toFixed(1)}%` : '—'}
          </p>
          <p className="text-[10px] text-slate-600 mt-0.5">hoy</p>
        </div>
      </div>

      {/* Min / Max pills */}
      <div className="flex gap-3 mb-4">
        <span className="text-[10px] px-2.5 py-1 rounded-full" style={{ background: '#4ade8018', color: '#4ade80', border: '1px solid #4ade8030' }}>
          Mín {min.toFixed(1)}%
        </span>
        <span className="text-[10px] px-2.5 py-1 rounded-full" style={{ background: '#f8717118', color: '#f87171', border: '1px solid #f8717130' }}>
          Máx {max.toFixed(1)}%
        </span>
        {first && (
          <span className="text-[10px] px-2.5 py-1 rounded-full" style={{ background: '#ffffff08', color: '#64748b', border: `1px solid ${BORDER}` }}>
            Hace 18m: {first.brecha.toFixed(1)}%
          </span>
        )}
      </div>

      <div style={{ width: '100%' }}>
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={data} margin={{ top: 8, right: 24, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="brechaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor={color} stopOpacity={0.25} />
              <stop offset="95%" stopColor={color} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#1c1c30" vertical={false} />
          <XAxis dataKey="date" tick={{ fill: '#475569', fontSize: 10 }}
            tickFormatter={s => fmt.date(s)} interval={15} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: '#475569', fontSize: 11 }}
            tickFormatter={v => `${v}%`} axisLine={false} tickLine={false} width={36} domain={[0, 'auto']} />
          <Tooltip
            {...ttStyle}
            labelFormatter={s => fmt.date(String(s))}
            formatter={(v, name) => {
              if (name === 'brecha') return [`${Number(v).toFixed(1)}%`, 'Brecha']
              return [`$${fmt.ars(Number(v))}`, name === 'blue' ? 'Blue' : 'Oficial']
            }}
          />
          <Area type="monotone" dataKey="brecha" stroke={color} strokeWidth={2.5} fill="url(#brechaGrad)" dot={false} />
        </AreaChart>
      </ResponsiveContainer>
      </div>

      {/* Context bands */}
      <div className="flex gap-2 mt-3 flex-wrap">
        {[
          { label: '0–10% · Tipo de cambio unificado', color: '#4ade80' },
          { label: '10–40% · Tensión moderada',        color: '#facc15' },
          { label: '40–80% · Cepo fuerte',             color: '#fb923c' },
          { label: '+80% · Crisis cambiaria',          color: '#f87171' },
        ].map(b => (
          <span key={b.label} className="flex items-center gap-1.5 text-[9px] text-slate-600">
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
  const oficial  = dolares.find(d => d.casa === 'oficial')
  const lastInf  = inflacion?.monthly[inflacion.monthly.length - 1]
  const lastRp   = riesgo[riesgo.length - 1]
  const bestTNA  = plazoFijo?.best?.tna ?? null

  // Acumulado anual inflación
  const lastYear = inflacion?.monthly.slice(-12) ?? []
  const acumAnual = lastYear.length
    ? lastYear.reduce((acc, r) => acc * (1 + r.valor / 100), 1) - 1
    : null

  const SALARIO_MINIMO = 906_000 // Mar 2026 SMVyL
  const salarMinBlue  = oficial && dolares.find(d => d.casa === 'blue')
    ? (SALARIO_MINIMO / dolares.find(d => d.casa === 'blue')!.venta).toFixed(0)
    : null
  const salarMinOfic  = oficial
    ? (SALARIO_MINIMO / oficial.venta).toFixed(0)
    : null

  const items = [
    {
      label: 'Cepo cambiario',
      value: 'Vigente',
      sub: 'Límite $200 USD/mes',
      color: '#f87171',
      icon: '🔒',
      status: 'bad',
    },
    {
      label: 'Brecha blue/oficial',
      value: brecha !== null ? `${brecha.toFixed(1)}%` : '—',
      sub: brecha !== null ? (brecha < 10 ? 'Muy baja' : brecha < 30 ? 'Moderada' : brecha < 60 ? 'Alta' : 'Muy alta') : '',
      color: brecha === null ? '#64748b' : brecha < 10 ? '#4ade80' : brecha < 30 ? '#facc15' : brecha < 60 ? '#fb923c' : '#f87171',
      icon: '💱',
      status: brecha !== null && brecha < 20 ? 'ok' : 'bad',
    },
    {
      label: 'Inflación mensual',
      value: lastInf ? `${lastInf.valor.toFixed(1)}%` : '—',
      sub: lastInf ? `Acum. anual ~${acumAnual !== null ? (acumAnual * 100).toFixed(0) : '?'}%` : 'INDEC',
      color: (lastInf?.valor ?? 99) < 3 ? '#4ade80' : (lastInf?.valor ?? 99) < 6 ? '#facc15' : '#f87171',
      icon: '🔥',
      status: (lastInf?.valor ?? 99) < 5 ? 'ok' : 'bad',
    },
    {
      label: 'Riesgo país',
      value: lastRp ? `${fmt.ars(lastRp.valor)} bps` : '—',
      sub: (lastRp?.valor ?? 9999) < 400 ? 'Bajo' : (lastRp?.valor ?? 9999) < 800 ? 'Moderado' : 'Alto',
      color: (lastRp?.valor ?? 9999) < 400 ? '#4ade80' : (lastRp?.valor ?? 9999) < 800 ? '#facc15' : '#f87171',
      icon: '⚡',
      status: (lastRp?.valor ?? 9999) < 600 ? 'ok' : 'bad',
    },
    {
      label: 'Mejor plazo fijo',
      value: bestTNA !== null ? `${(bestTNA * 100).toFixed(1)}% TNA` : '—',
      sub: bestTNA !== null ? `~${((bestTNA / 12) * 100).toFixed(1)}% mensual` : '',
      color: '#34d399',
      icon: '🏦',
      status: 'neutral',
    },
    {
      label: 'Salario mínimo',
      value: `$${fmt.ars(SALARIO_MINIMO)}`,
      sub: salarMinBlue ? `≈ U$S ${salarMinBlue} (blue) · ${salarMinOfic} (oficial)` : '',
      color: '#94a3b8',
      icon: '👷',
      status: 'neutral',
    },
  ]

  return (
    <div className="rounded-2xl p-6" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
      <div className="flex items-center gap-2 mb-5">
        <Thermometer size={14} style={{ color: CELESTE }} />
        <p className="text-[10px] font-bold uppercase tracking-[3px] text-slate-400">Termómetro económico</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {items.map(item => (
          <div key={item.label}
            className="flex items-center gap-3 rounded-xl px-4 py-3"
            style={{ background: SURFACE, border: `1px solid ${BORDER}` }}>
            <span className="text-lg shrink-0">{item.icon}</span>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] text-slate-500 mb-0.5">{item.label}</p>
              <p className="text-sm font-bold tabnum truncate" style={{ color: item.color }}>{item.value}</p>
              {item.sub && <p className="text-[10px] text-slate-600 truncate">{item.sub}</p>}
            </div>
            <div className="w-2 h-2 rounded-full shrink-0" style={{
              background: item.status === 'ok' ? '#4ade80' : item.status === 'bad' ? '#f87171' : '#475569'
            }} />
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

  const gananciaPlazofijo = best ? capital * (best.tna / 12) : 0
  const perdidaInflacion  = lastInf !== null ? capital * (lastInf / 100) : null
  const saldo30d          = capital + gananciaPlazofijo

  const realReturn = lastInf !== null && best
    ? ((best.tna / 12) - lastInf / 100) * 100
    : null

  return (
    <div className="rounded-2xl p-6" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
      <div className="flex items-center gap-2 mb-5">
        <PiggyBank size={14} style={{ color: '#34d399' }} />
        <p className="text-[10px] font-bold uppercase tracking-[3px] text-slate-400">Plazo fijo vs inflación</p>
      </div>

      {/* Capital input */}
      <div className="flex items-center gap-3 rounded-xl px-4 py-3 mb-5"
        style={{ background: SURFACE, border: `1px solid ${BORDER}` }}>
        <span className="text-sm font-bold text-slate-400 shrink-0">$</span>
        <input
          type="number"
          value={capital}
          onChange={e => setCapital(Math.max(1000, Number(e.target.value)))}
          className="flex-1 bg-transparent text-xl font-bold text-white outline-none tabnum min-w-0"
          step={10000}
        />
        <span className="text-xs text-slate-600 shrink-0">ARS</span>
      </div>

      {/* 30-day projection */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="rounded-xl p-3 text-center" style={{ background: SURFACE, border: `1px solid ${BORDER}` }}>
          <p className="text-[9px] text-slate-600 mb-1 uppercase tracking-wider">Capital inicial</p>
          <p className="text-sm font-bold text-white tabnum">${fmt.ars(capital)}</p>
        </div>
        <div className="rounded-xl p-3 text-center" style={{ background: '#34d39912', border: '1px solid #34d39930' }}>
          <p className="text-[9px] text-slate-500 mb-1 uppercase tracking-wider">En 30 días</p>
          <p className="text-sm font-bold tabnum" style={{ color: '#34d399' }}>${fmt.ars(saldo30d)}</p>
          <p className="text-[9px] text-green-600">+${fmt.ars(gananciaPlazofijo)}</p>
        </div>
        <div className="rounded-xl p-3 text-center"
          style={{ background: perdidaInflacion !== null ? '#f8717112' : SURFACE, border: `1px solid ${perdidaInflacion !== null ? '#f8717130' : BORDER}` }}>
          <p className="text-[9px] text-slate-500 mb-1 uppercase tracking-wider">Pierde inflación</p>
          <p className="text-sm font-bold text-red-400 tabnum">
            {perdidaInflacion !== null ? `-$${fmt.ars(perdidaInflacion)}` : '—'}
          </p>
          <p className="text-[9px] text-red-600">{lastInf !== null ? `${lastInf.toFixed(1)}% mensual` : ''}</p>
        </div>
      </div>

      {/* Real return */}
      {realReturn !== null && (
        <div className="rounded-xl px-4 py-2.5 mb-5 flex items-center justify-between"
          style={{
            background: realReturn >= 0 ? '#4ade8010' : '#f8717110',
            border: `1px solid ${realReturn >= 0 ? '#4ade8025' : '#f8717125'}`,
          }}>
          <p className="text-xs text-slate-400">
            Rendimiento real (plazo fijo − inflación):
          </p>
          <p className="text-sm font-bold tabnum" style={{ color: realReturn >= 0 ? '#4ade80' : '#f87171' }}>
            {realReturn >= 0 ? '+' : ''}{realReturn.toFixed(2)}% mensual
          </p>
        </div>
      )}

      {/* Top 5 table */}
      <p className="text-[9px] font-bold uppercase tracking-[3px] text-slate-600 mb-2">Mejores tasas disponibles</p>
      <div className="flex flex-col gap-1.5">
        {data.top5.map((b, i) => (
          <div key={b.entidad} className="flex items-center gap-3 rounded-lg px-3 py-2"
            style={{ background: SURFACE, border: `1px solid ${BORDER}` }}>
            <span className="text-[10px] font-bold text-slate-600 w-4 shrink-0">{i + 1}</span>
            <p className="text-[11px] text-slate-300 flex-1 truncate">{b.entidad}</p>
            <div className="text-right shrink-0">
              <span className="text-xs font-bold tabnum" style={{ color: '#34d399' }}>
                {(b.tna * 100).toFixed(1)}% TNA
              </span>
              <span className="text-[9px] text-slate-600 ml-2 tabnum">
                {b.tna30.toFixed(1)}%/mes
              </span>
            </div>
            {b.enlace && (
              <a href={b.enlace} target="_blank" rel="noreferrer"
                className="shrink-0 text-slate-700 hover:text-slate-400 transition-colors">
                <ExternalLink size={11} />
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
    <div className={`grid gap-4`} style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
      {Array.from({ length: cols }).map((_, i) => (
        <div key={i} className={`${h} rounded-2xl animate-pulse`} style={{ background: CARD }} />
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
  const featured = sorted.filter(d => ['oficial','blue','bolsa'].includes(d.casa))
  const mini     = sorted.filter(d => !['oficial','blue','bolsa'].includes(d.casa))
  const oficial  = dolares.find(d => d.casa === 'oficial')
  const blue     = dolares.find(d => d.casa === 'blue')
  const brecha   = oficial && blue ? ((blue.venta - oficial.venta) / oficial.venta) * 100 : null
  const lastInf  = inflacion?.monthly[inflacion.monthly.length - 1]
  const lastYoy  = inflacion?.yoy[inflacion.yoy.length - 1]
  const lastRp   = riesgo[riesgo.length - 1]

  const TABS: { id: Tab; label: string }[] = [
    { id: 'evolucion', label: '📈 Evolución' },
    { id: 'inflacion', label: '🔥 Inflación' },
    { id: 'riesgo',    label: '⚡ Riesgo país' },
  ]

  const sparkFor: Record<string, number[] | undefined> = {
    oficial: sparklines?.oficial,
    blue:    sparklines?.blue,
  }

  return (
    <div className="min-h-screen text-white" style={{ background: BG }}>

      {/* ── Header ── */}
      <header className="sticky top-0 z-50 backdrop-blur-xl"
        style={{ borderBottom: `1px solid ${BORDER}`, background: `${SURFACE}d0` }}>
        {/* 🇦🇷 Flag stripe */}
        <div className="h-[3px]" style={{
          background: `linear-gradient(90deg, ${CELESTE} 33%, #fff 33%, #fff 67%, ${CELESTE} 67%)`
        }} />
        <div className="max-w-[1800px] mx-auto px-6 py-3 flex items-center justify-between gap-4 relative">
          {/* Sol de Mayo watermark */}
          <div className="absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none overflow-hidden h-14 w-14">
            <SolDeMayo size={56} opacity={0.12} />
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xl select-none">🇦🇷</span>
            <div>
              <h1 className="text-sm font-bold tracking-tight text-white">Argentina Macro</h1>
              <p className="text-[10px] hidden sm:block" style={{ color: CELESTE + '80' }}>
                Dólar · Inflación · Riesgo país
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {lastUpdate && (
              <span className="text-[10px] text-slate-600 hidden md:block">upd. {lastUpdate}</span>
            )}
            <button onClick={() => loadDolares(false)} disabled={refreshing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
                         transition-all hover:bg-white/5 disabled:opacity-40"
              style={{ border: `1px solid ${BORDER}`, color: '#64748b' }}>
              <RefreshCw size={11} className={refreshing ? 'animate-spin' : ''} />
              <span className="hidden sm:inline">Actualizar</span>
            </button>
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg glow-celeste"
              style={{ background: `${CELESTE}12`, border: `1px solid ${CELESTE}25` }}>
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: CELESTE }} />
              <span className="text-[11px] font-bold" style={{ color: CELESTE }}>LIVE</span>
            </div>
          </div>
        </div>
      </header>

      {/* ── Ticker tape ── */}
      {!loading && dolares.length > 0 && <TickerTape dolares={dolares} />}

      <main className="max-w-[1800px] mx-auto px-4 sm:px-6 xl:px-10 py-8 flex flex-col gap-8">

        {/* ── Hero KPIs ── */}
        {loading ? <Pulse h="h-28" cols={4} /> : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <HeroKPI label="Dólar Blue" value={`$${fmt.ars(blue?.venta ?? 0)}`}
              sub={`Compra $${fmt.ars(blue?.compra ?? 0)}`} color="#c084fc" />
            <HeroKPI label="Brecha blue/oficial"
              value={brecha !== null ? fmt.pct(brecha) : '—'}
              sub="Spread cambiario"
              color={brecha === null ? '#64748b' : brecha < 10 ? '#4ade80' : brecha < 40 ? '#facc15' : '#f87171'} />
            <HeroKPI label="Inflación mensual"
              value={lastInf ? `${lastInf.valor.toFixed(1)}%` : '—'}
              sub={lastInf ? `${fmt.month(lastInf.fecha.slice(0,7))} · INDEC` : 'INDEC'}
              color="#f87171" />
            <HeroKPI label="Riesgo país"
              value={lastRp ? `${fmt.ars(lastRp.valor)} bps` : '—'}
              sub="EMBI+ Argentina" color="#f97316" />
          </div>
        )}

        {/* ── Dollar section ── */}
        <section className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold uppercase tracking-[3px] text-slate-500">Tipos de cambio</p>
            <p className="text-[11px] text-slate-600 capitalize">
              {new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
          </div>

          {loading ? (
            <>
              <Pulse h="h-40" cols={3} />
              <Pulse h="h-14" cols={2} />
            </>
          ) : (
            <>
              {/* En desktop: 3 featured + 4 mini en la misma fila */}
              <div className="grid grid-cols-1 sm:grid-cols-3 xl:grid-cols-7 gap-4">
                {featured.map(d => (
                  <div key={d.casa} className="xl:col-span-2">
                    <FeaturedCard d={d}
                      oficialVenta={oficial?.venta ?? 0}
                      sparkValues={sparkFor[d.casa]} />
                  </div>
                ))}
                {/* Mini cards inline en xl */}
                <div className="xl:col-span-1 flex xl:flex-col gap-2 sm:hidden xl:flex">
                  {mini.slice(0, 2).map(d => <MiniCard key={d.casa} d={d} oficialVenta={oficial?.venta ?? 0} />)}
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-4 gap-2 xl:hidden">
                {mini.map(d => <MiniCard key={d.casa} d={d} oficialVenta={oficial?.venta ?? 0} />)}
              </div>
              <div className="hidden xl:grid grid-cols-4 gap-2">
                {mini.slice(2).map(d => <MiniCard key={d.casa} d={d} oficialVenta={oficial?.venta ?? 0} />)}
              </div>
            </>
          )}
        </section>

        {/* ── 2-col: Comparador + Calculadora ── */}
        {!loading && dolares.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <BrechaComparador dolares={dolares} />
            <Calculadora dolares={dolares} />
          </div>
        )}

        {/* ── Charts ── */}
        <section className="flex flex-col gap-4">
          <div className="flex gap-1 p-1 rounded-xl w-fit"
            style={{ background: CARD, border: `1px solid ${BORDER}` }}>
            {TABS.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200"
                style={{
                  background: tab === t.id ? CELESTE : 'transparent',
                  color:      tab === t.id ? BG      : '#64748b',
                }}>
                {t.label}
              </button>
            ))}
          </div>

          <div className="rounded-2xl p-6" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
            {loading ? <Pulse h="h-72" /> : tab === 'evolucion' ? (
              <>
                <p className="text-sm font-semibold text-slate-300 mb-0.5">Blue vs Oficial</p>
                <p className="text-[11px] text-slate-600 mb-5">Precio de venta promedio mensual — últimos 14 meses</p>
                <EvolucionChart data={evolucion} />
              </>
            ) : tab === 'inflacion' ? (
              <>
                <p className="text-sm font-semibold text-slate-300 mb-0.5">Inflación (IPC — INDEC)</p>
                <p className="text-[11px] text-slate-600 mb-5">Rojo &gt;10% · Naranja &gt;5% · Verde ≤5%</p>
                {inflacion ? <InflacionChart data={inflacion} /> : <Pulse h="h-72" />}
              </>
            ) : (
              <>
                <p className="text-sm font-semibold text-slate-300 mb-0.5">Riesgo País — últimos 90 días</p>
                <p className="text-[11px] text-slate-600 mb-5">Spread soberano EMBI+ Argentina · Fuente: ArgentinaDatos</p>
                <RiesgoPaisChart data={riesgo} />
              </>
            )}
          </div>
        </section>

        {/* ── Brecha histórica ── */}
        {!loading && brechaHistorica.length > 0 && (
          <BrechaHistorica data={brechaHistorica} />
        )}

        {/* ── Termómetro + Plazo Fijo ── */}
        {!loading && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <TermometroEconomico
              dolares={dolares}
              inflacion={inflacion}
              riesgo={riesgo}
              plazoFijo={plazoFijo}
              brecha={brecha}
            />
            {plazoFijo && (
              <PlazoFijoPanel data={plazoFijo} inflacion={inflacion} />
            )}
          </div>
        )}

        {/* ── Footer ── */}
        <footer className="text-center pt-2 pb-6 border-t" style={{ borderColor: BORDER }}>
          <div className="flex items-center justify-center gap-1.5 mb-2">
            <SolDeMayo size={20} opacity={0.4} />
            <span className="text-[11px] font-medium" style={{ color: CELESTE + '60' }}>Argentina Macro Dashboard</span>
          </div>
          <p className="text-[10px] text-slate-700">
            {['dolarapi.com','bluelytics.com.ar','argentinadatos.com','INDEC'].map((s, i) => (
              <span key={s}>{i > 0 && ' · '}
                <a href={`https://${s}`} target="_blank" rel="noreferrer"
                  className="hover:text-slate-500 transition-colors">{s}</a>
              </span>
            ))}
          </p>
        </footer>

      </main>
    </div>
  )
}
