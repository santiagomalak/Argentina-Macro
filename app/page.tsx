'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { RefreshCw, TrendingUp, TrendingDown, Minus } from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────────────────────
interface Dolar {
  casa: string; nombre: string
  compra: number; venta: number
  fechaActualizacion: string
  variacion?: number
}
interface EvolucionRow { month: string; oficial: number | null; blue: number | null }
interface DataRow      { fecha: string; valor: number }

// ── Constants ─────────────────────────────────────────────────────────────────
const BG      = '#07070f'
const SURFACE = '#0e0e1a'
const CARD    = '#12121f'
const BORDER  = '#1c1c30'

const META: Record<string, { label: string; color: string; desc: string }> = {
  oficial:         { label: 'Oficial',   color: '#60a5fa', desc: 'Banco Nación Argentina' },
  blue:            { label: 'Blue',      color: '#c084fc', desc: 'Mercado informal' },
  bolsa:           { label: 'MEP',       color: '#34d399', desc: 'Mercado Electrónico de Pagos' },
  contadoconliqui: { label: 'CCL',       color: '#f97316', desc: 'Contado con Liquidación' },
  cripto:          { label: 'Cripto',    color: '#fbbf24', desc: 'Vía stablecoins (USDT)' },
  tarjeta:         { label: 'Tarjeta',   color: '#f472b6', desc: 'Oficial + impuestos' },
  mayorista:       { label: 'Mayorista', color: '#2dd4bf', desc: 'Mercado interbancario' },
}

const ORDER = ['oficial', 'blue', 'bolsa', 'contadoconliqui', 'cripto', 'tarjeta', 'mayorista']

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
  contentStyle: { background: '#0a0a18', border: `1px solid ${BORDER}`, borderRadius: 10, fontSize: 12, padding: '10px 14px' },
  labelStyle:   { color: '#94a3b8', marginBottom: 4 },
  itemStyle:    { color: '#e2e8f0' },
  cursor:       { stroke: '#ffffff10' },
}

// ── Hero KPI ──────────────────────────────────────────────────────────────────
function HeroKPI({ label, value, sub, color, icon: Icon }:
  { label: string; value: string; sub: string; color: string; icon?: React.ElementType }) {
  return (
    <div className="flex flex-col gap-1.5 p-5 rounded-2xl relative overflow-hidden"
      style={{ background: CARD, border: `1px solid ${color}25` }}>
      <div className="absolute inset-0 opacity-5 rounded-2xl"
        style={{ background: `radial-gradient(ellipse at top left, ${color}, transparent 70%)` }} />
      <p className="text-xs font-medium uppercase tracking-widest relative z-10"
        style={{ color: color + 'aa' }}>{label}</p>
      <p className="text-3xl font-bold tracking-tight relative z-10"
        style={{ color, fontFeatureSettings: '"tnum"' }}>{value}</p>
      <p className="text-xs relative z-10" style={{ color: '#64748b' }}>{sub}</p>
    </div>
  )
}

// ── Featured Dollar Card (Oficial · Blue · MEP) ───────────────────────────────
function FeaturedCard({ d, oficialVenta }: { d: Dolar; oficialVenta: number }) {
  const m = META[d.casa] ?? { label: d.nombre, color: '#9ca3af', desc: '' }
  const brecha = oficialVenta > 0 && d.casa !== 'oficial'
    ? ((d.venta - oficialVenta) / oficialVenta) * 100 : null
  const hasVar = d.variacion !== undefined && d.variacion !== null
  const varColor = (d.variacion ?? 0) > 0 ? '#4ade80' : (d.variacion ?? 0) < 0 ? '#f87171' : '#64748b'

  return (
    <div className="rounded-2xl p-6 flex flex-col gap-4 relative overflow-hidden group
                    transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl"
      style={{
        background: CARD,
        border: `1px solid ${m.color}35`,
        boxShadow: `0 0 0 0 ${m.color}00`,
      }}>
      <div className="absolute inset-0 opacity-[0.07] rounded-2xl transition-opacity group-hover:opacity-[0.12]"
        style={{ background: `radial-gradient(ellipse at top left, ${m.color}, transparent 65%)` }} />

      <div className="flex items-start justify-between relative z-10">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <span className="w-2 h-2 rounded-full" style={{ background: m.color }} />
            <span className="text-xs font-bold uppercase tracking-widest" style={{ color: m.color }}>
              {m.label}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 ml-4">{m.desc}</p>
        </div>
        {brecha !== null && (
          <span className="text-xs font-bold px-2.5 py-1 rounded-full shrink-0"
            style={{
              background: `${m.color}15`,
              color: m.color,
              border: `1px solid ${m.color}30`,
            }}>
            {fmt.pct(brecha)}
          </span>
        )}
      </div>

      <div className="relative z-10">
        <p className="text-4xl font-bold text-white tracking-tight"
          style={{ fontFeatureSettings: '"tnum"' }}>
          ${fmt.ars(d.venta)}
        </p>
        <p className="text-sm text-slate-500 mt-1">Compra <span className="text-slate-400">${fmt.ars(d.compra)}</span></p>
      </div>

      {hasVar && (
        <div className="flex items-center gap-1.5 relative z-10">
          <div className="flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-md"
            style={{ background: varColor + '18', color: varColor }}>
            {(d.variacion ?? 0) > 0 ? <TrendingUp size={11} /> : (d.variacion ?? 0) < 0 ? <TrendingDown size={11} /> : <Minus size={11} />}
            {fmt.pct(d.variacion!)}
          </div>
          <span className="text-[10px] text-slate-600">vs ayer</span>
        </div>
      )}
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
        <p className="text-sm font-bold text-white" style={{ fontFeatureSettings: '"tnum"' }}>
          ${fmt.ars(d.venta)}
        </p>
        {brecha !== null && (
          <p className="text-[10px]" style={{ color: m.color + 'aa' }}>{fmt.pct(brecha)}</p>
        )}
      </div>
    </div>
  )
}

// ── Brecha Visual ─────────────────────────────────────────────────────────────
function BrechaVisual({ dolares }: { dolares: Dolar[] }) {
  const oficial = dolares.find(d => d.casa === 'oficial')
  if (!oficial) return null

  const comparables = dolares
    .filter(d => d.casa !== 'oficial' && d.casa !== 'mayorista')
    .sort((a, b) => a.venta - b.venta)

  const max = Math.max(...comparables.map(d => d.venta))

  return (
    <div className="rounded-2xl p-6" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-1">Comparador de tipos de cambio</p>
          <p className="text-[11px] text-slate-600">Precio de venta · Referencia: Oficial ${fmt.ars(oficial.venta)}</p>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {/* Oficial reference line */}
        <div className="flex items-center gap-4">
          <span className="text-xs w-20 text-right shrink-0 font-medium" style={{ color: '#60a5fa' }}>Oficial</span>
          <div className="flex-1 relative h-6 flex items-center">
            <div className="h-0.5 w-full absolute" style={{ background: BORDER }} />
            <div className="h-4 rounded absolute left-0" style={{ width: `${(oficial.venta / max) * 100}%`, background: '#60a5fa25', border: '1px solid #60a5fa50' }} />
            <span className="absolute left-0 text-xs font-bold ml-2" style={{ color: '#60a5fa', fontFeatureSettings: '"tnum"' }}>
              ${fmt.ars(oficial.venta)}
            </span>
          </div>
        </div>

        {comparables.map(d => {
          const m = META[d.casa]
          const brecha = ((d.venta - oficial.venta) / oficial.venta) * 100
          const width = (d.venta / max) * 100
          const col = brecha < 5 ? '#4ade80' : brecha < 20 ? '#facc15' : brecha < 50 ? '#fb923c' : '#f87171'

          return (
            <div key={d.casa} className="flex items-center gap-4">
              <span className="text-xs w-20 text-right shrink-0 font-medium" style={{ color: m.color }}>
                {m.label}
              </span>
              <div className="flex-1 relative h-6 flex items-center">
                <div className="h-0.5 w-full absolute" style={{ background: BORDER }} />
                <div className="h-4 rounded absolute left-0 transition-all duration-700"
                  style={{ width: `${width}%`, background: m.color + '20', border: `1px solid ${m.color}50` }} />
                <span className="absolute text-xs font-bold" style={{ left: `${width}%`, transform: 'translateX(-100%)', paddingRight: 8, color: '#94a3b8', fontFeatureSettings: '"tnum"' }}>
                  ${fmt.ars(d.venta)}
                </span>
              </div>
              <span className="text-xs font-bold w-14 shrink-0" style={{ color: col }}>
                {fmt.pct(brecha)}
              </span>
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
      <div className="flex gap-5 mb-4 text-xs text-slate-500">
        <span className="flex items-center gap-1.5">
          <span className="w-5 h-0.5 rounded inline-block bg-blue-400" />Oficial
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-5 h-0.5 rounded inline-block bg-purple-400 border-t border-dashed border-purple-400" />Blue
        </span>
      </div>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data} margin={{ top: 8, right: 32, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="oficialGlow" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="#60a5fa" stopOpacity={0.15} />
              <stop offset="100%" stopColor="#60a5fa" stopOpacity={0}    />
            </linearGradient>
            <linearGradient id="blueGlow" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="#c084fc" stopOpacity={0.15} />
              <stop offset="100%" stopColor="#c084fc" stopOpacity={0}    />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#1c1c30" vertical={false} />
          <XAxis dataKey="month" tick={{ fill: '#475569', fontSize: 11 }}
            tickFormatter={fmt.month} interval="preserveStartEnd" axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: '#475569', fontSize: 11 }}
            tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} axisLine={false} tickLine={false} width={42} />
          <Tooltip
            {...ttStyle}
            labelFormatter={s => fmt.month(String(s))}
            formatter={(v, name) => [`$${fmt.ars(Number(v))}`, name === 'oficial' ? 'Oficial' : 'Blue']}
          />
          <Line type="monotone" dataKey="oficial" stroke="#60a5fa" strokeWidth={2.5} dot={false} />
          <Line type="monotone" dataKey="blue"    stroke="#c084fc" strokeWidth={2.5} dot={false} strokeDasharray="5 3" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

function InflacionChart({ data }: { data: { monthly: DataRow[]; yoy: DataRow[] } }) {
  const merged = data.monthly.map(m => {
    const yoyRow = data.yoy.find(y => y.fecha.slice(0, 7) === m.fecha.slice(0, 7))
    return { fecha: m.fecha, mensual: m.valor, interanual: yoyRow?.valor ?? null }
  })

  return (
    <div className="flex flex-col gap-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-4">
          IPC mensual — últimos 24 meses
        </p>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={merged} margin={{ top: 4, right: 32, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1c1c30" vertical={false} />
            <XAxis dataKey="fecha" tick={{ fill: '#475569', fontSize: 10 }}
              tickFormatter={s => fmt.month(s.slice(0, 7))} interval={3} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#475569', fontSize: 11 }} tickFormatter={v => `${v}%`} axisLine={false} tickLine={false} width={36} />
            <Tooltip
              {...ttStyle}
              labelFormatter={s => fmt.month(String(s).slice(0, 7))}
              formatter={v => [`${Number(v).toFixed(1)}%`, 'Mensual']}
            />
            <Bar dataKey="mensual" radius={[4, 4, 0, 0]}>
              {merged.map((e, i) => (
                <Cell key={i} fill={e.mensual > 10 ? '#f87171' : e.mensual > 5 ? '#fb923c' : '#4ade80'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-4">
          Inflación interanual (YoY)
        </p>
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={merged} margin={{ top: 4, right: 32, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="yoyGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#f87171" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#f87171" stopOpacity={0}    />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1c1c30" vertical={false} />
            <XAxis dataKey="fecha" tick={{ fill: '#475569', fontSize: 10 }}
              tickFormatter={s => fmt.month(s.slice(0, 7))} interval={3} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#475569', fontSize: 11 }} tickFormatter={v => `${v}%`} axisLine={false} tickLine={false} width={36} />
            <Tooltip
              {...ttStyle}
              labelFormatter={s => fmt.month(String(s).slice(0, 7))}
              formatter={v => [`${Number(v).toFixed(1)}%`, 'Interanual']}
            />
            <Area type="monotone" dataKey="interanual" stroke="#f87171" strokeWidth={2.5} fill="url(#yoyGrad)" dot={false} />
          </AreaChart>
        </ResponsiveContainer>
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
          <p className="text-5xl font-bold text-white tracking-tight" style={{ fontFeatureSettings: '"tnum"' }}>
            {last ? fmt.ars(last) : '—'}
          </p>
          <p className="text-xs text-slate-500 mt-1">puntos básicos · EMBI+ Argentina</p>
        </div>
        {delta !== null && (
          <div className="flex items-center gap-1.5 text-sm font-semibold pb-1"
            style={{ color: up ? '#f87171' : '#4ade80' }}>
            {up ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
            {up ? '+' : ''}{fmt.ars(delta)} bps en 90d
          </div>
        )}
      </div>
      <ResponsiveContainer width="100%" height={240}>
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
          <YAxis tick={{ fill: '#475569', fontSize: 11 }} domain={['auto', 'auto']}
            axisLine={false} tickLine={false} width={42} />
          <Tooltip
            {...ttStyle}
            labelFormatter={s => fmt.date(String(s))}
            formatter={v => [`${fmt.ars(Number(v))} bps`, 'Riesgo país']}
          />
          <Area type="monotone" dataKey="valor" stroke="#f97316" strokeWidth={2.5} fill="url(#rpGrad)" dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
function Pulse({ h = 'h-32' }: { h?: string }) {
  return (
    <div className={`${h} rounded-2xl animate-pulse`} style={{ background: CARD }} />
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const [dolares,    setDolares]    = useState<Dolar[]>([])
  const [evolucion,  setEvolucion]  = useState<EvolucionRow[]>([])
  const [inflacion,  setInflacion]  = useState<{ monthly: DataRow[]; yoy: DataRow[] } | null>(null)
  const [riesgo,     setRiesgo]     = useState<DataRow[]>([])
  const [tab,        setTab]        = useState<Tab>('evolucion')
  const [loading,    setLoading]    = useState(true)
  const [lastUpdate, setLastUpdate] = useState('')
  const [refreshing, setRefreshing] = useState(false)

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
    ]).then(([dol, evo, inf, rp]) => {
      setDolares(dol); setEvolucion(evo); setInflacion(inf); setRiesgo(rp)
      setLastUpdate(new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }))
    }).finally(() => setLoading(false))

    const iv = setInterval(() => loadDolares(true), 60_000)
    return () => clearInterval(iv)
  }, [loadDolares])

  const oficial  = dolares.find(d => d.casa === 'oficial')
  const blue     = dolares.find(d => d.casa === 'blue')
  const mep      = dolares.find(d => d.casa === 'bolsa')
  const sorted   = [...dolares].sort((a, b) => ORDER.indexOf(a.casa) - ORDER.indexOf(b.casa))
  const featured = sorted.filter(d => ['oficial','blue','bolsa'].includes(d.casa))
  const mini     = sorted.filter(d => !['oficial','blue','bolsa'].includes(d.casa))

  const brecha = oficial && blue
    ? ((blue.venta - oficial.venta) / oficial.venta) * 100 : null

  const lastInflacion = inflacion?.monthly[inflacion.monthly.length - 1]
  const lastYoy       = inflacion?.yoy[inflacion.yoy.length - 1]
  const lastRiesgo    = riesgo[riesgo.length - 1]

  const TABS: { id: Tab; label: string }[] = [
    { id: 'evolucion', label: '📈 Evolución cambiaria' },
    { id: 'inflacion', label: '🔥 Inflación' },
    { id: 'riesgo',    label: '⚡ Riesgo país' },
  ]

  return (
    <div className="min-h-screen text-white" style={{ background: BG }}>

      {/* ── Header ── */}
      <header className="sticky top-0 z-50 backdrop-blur-md"
        style={{ borderBottom: `1px solid ${BORDER}`, background: `${SURFACE}e0` }}>
        {/* Argentine flag accent line */}
        <div className="h-0.5 w-full" style={{
          background: 'linear-gradient(90deg, #74b9ff 0%, #74b9ff 33%, #ffffff 33%, #ffffff 67%, #74b9ff 67%, #74b9ff 100%)'
        }} />
        <div className="max-w-7xl mx-auto px-6 py-3.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-xl">🇦🇷</span>
            <div>
              <h1 className="text-base font-bold tracking-tight text-white">Argentina Macro</h1>
              <p className="text-[10px] text-slate-500 hidden sm:block">Dólar · Inflación · Riesgo país</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {lastUpdate && (
              <span className="text-[11px] text-slate-600 hidden md:block">
                Actualizado {lastUpdate}
              </span>
            )}
            <button onClick={() => loadDolares(false)} disabled={refreshing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
                         transition-all hover:bg-white/5 disabled:opacity-50"
              style={{ border: `1px solid ${BORDER}`, color: '#64748b' }}>
              <RefreshCw size={11} className={refreshing ? 'animate-spin' : ''} />
              <span className="hidden sm:inline">Actualizar</span>
            </button>
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg"
              style={{ background: '#22c55e12', border: '1px solid #22c55e25' }}>
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              <span className="text-[11px] font-medium text-green-400">LIVE</span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 flex flex-col gap-8">

        {/* ── Hero KPIs ── */}
        {loading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => <Pulse key={i} h="h-28" />)}
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <HeroKPI
              label="Dólar Blue"
              value={`$${fmt.ars(blue?.venta ?? 0)}`}
              sub={`Compra $${fmt.ars(blue?.compra ?? 0)}`}
              color="#c084fc"
            />
            <HeroKPI
              label="Brecha blue/oficial"
              value={brecha !== null ? fmt.pct(brecha) : '—'}
              sub="Spread cambiario"
              color={brecha !== null && brecha < 10 ? '#4ade80' : brecha !== null && brecha < 40 ? '#facc15' : '#f87171'}
            />
            <HeroKPI
              label="Inflación mensual"
              value={lastInflacion ? `${lastInflacion.valor.toFixed(1)}%` : '—'}
              sub={lastInflacion ? `${fmt.month(lastInflacion.fecha.slice(0, 7))} · INDEC` : 'INDEC'}
              color="#f87171"
            />
            <HeroKPI
              label="Riesgo país"
              value={lastRiesgo ? `${fmt.ars(lastRiesgo.valor)} bps` : '—'}
              sub="EMBI+ Argentina"
              color="#f97316"
            />
          </div>
        )}

        {/* ── Dollar Cards ── */}
        <section className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-[3px] text-slate-500">
              Tipos de cambio
            </p>
            <p className="text-[11px] text-slate-600 capitalize">
              {new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {Array.from({ length: 3 }).map((_, i) => <Pulse key={i} h="h-40" />)}
            </div>
          ) : (
            <>
              {/* Featured: Oficial · Blue · MEP */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {featured.map(d => (
                  <FeaturedCard key={d.casa} d={d} oficialVenta={oficial?.venta ?? 0} />
                ))}
              </div>

              {/* Mini: CCL · Cripto · Tarjeta · Mayorista */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {mini.map(d => (
                  <MiniCard key={d.casa} d={d} oficialVenta={oficial?.venta ?? 0} />
                ))}
              </div>
            </>
          )}
        </section>

        {/* ── Brecha Comparador ── */}
        {!loading && dolares.length > 0 && (
          <BrechaVisual dolares={dolares} />
        )}

        {/* ── Charts ── */}
        <section className="flex flex-col gap-4">
          {/* Tabs */}
          <div className="flex gap-1 p-1 rounded-xl w-fit"
            style={{ background: CARD, border: `1px solid ${BORDER}` }}>
            {TABS.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200"
                style={{
                  background: tab === t.id ? '#3b82f6' : 'transparent',
                  color:      tab === t.id ? '#fff'    : '#64748b',
                }}>
                {t.label}
              </button>
            ))}
          </div>

          <div className="rounded-2xl p-6" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
            {loading ? <Pulse h="h-72" /> : tab === 'evolucion' ? (
              <>
                <p className="text-sm font-semibold text-slate-300 mb-1">Blue vs Oficial</p>
                <p className="text-xs text-slate-600 mb-5">Precio de venta promedio mensual — últimos 14 meses</p>
                <EvolucionChart data={evolucion} />
              </>
            ) : tab === 'inflacion' ? (
              <>
                <p className="text-sm font-semibold text-slate-300 mb-1">Índice de Precios al Consumidor</p>
                <p className="text-xs text-slate-600 mb-5">Datos INDEC · rojo &gt;10% · naranja &gt;5% · verde ≤5%</p>
                {inflacion ? <InflacionChart data={inflacion} /> : <Pulse h="h-72" />}
              </>
            ) : (
              <>
                <p className="text-sm font-semibold text-slate-300 mb-1">Riesgo País</p>
                <p className="text-xs text-slate-600 mb-5">Últimos 90 días hábiles · Fuente: ArgentinaDatos</p>
                <RiesgoPaisChart data={riesgo} />
              </>
            )}
          </div>
        </section>

        {/* ── Footer ── */}
        <footer className="text-center pt-2 pb-6">
          <p className="text-[11px] text-slate-700">
            Fuentes:{' '}
            {['dolarapi.com', 'bluelytics.com.ar', 'argentinadatos.com', 'INDEC'].map((s, i) => (
              <span key={s}>
                {i > 0 && ' · '}
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
