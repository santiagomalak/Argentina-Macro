'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { RefreshCw, TrendingUp, TrendingDown, Minus, AlertCircle } from 'lucide-react'

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
const BG      = '#080810'
const SURFACE = '#0f0f17'
const BORDER  = '#1e1e32'

const DOLLAR_META: Record<string, { label: string; color: string; desc: string }> = {
  oficial:         { label: 'Oficial',    color: '#60a5fa', desc: 'Banco Nación Argentina' },
  blue:            { label: 'Blue',       color: '#a78bfa', desc: 'Mercado informal' },
  bolsa:           { label: 'MEP',        color: '#34d399', desc: 'Mercado Electrónico de Pagos' },
  contadoconliqui: { label: 'CCL',        color: '#fb923c', desc: 'Contado con Liquidación' },
  cripto:          { label: 'Cripto',     color: '#f59e0b', desc: 'Vía stablecoins (USDT)' },
  tarjeta:         { label: 'Tarjeta',    color: '#ec4899', desc: 'Oficial + impuestos (PAIS + retención)' },
  mayorista:       { label: 'Mayorista',  color: '#6ee7b7', desc: 'Mercado interbancario' },
}

// ── Formatters ────────────────────────────────────────────────────────────────
const fmt = {
  ars: (n: number) =>
    new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(n),
  pct: (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`,
  month: (s: string) => {
    const [y, m] = s.split('-')
    const months = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
    return `${months[parseInt(m) - 1]} '${y.slice(2)}`
  },
  shortDate: (s: string) => {
    const d = new Date(s + 'T00:00:00')
    return d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })
  },
  time: (s: string) => new Date(s).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }),
}

// ── Shared tooltip style ──────────────────────────────────────────────────────
const tooltipStyle = {
  contentStyle: { background: '#0d0d14', border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 12 },
  labelStyle:   { color: '#a1a1aa' },
  itemStyle:    { color: '#e4e4e7' },
}

// ── Dollar Card ───────────────────────────────────────────────────────────────
function DollarCard({ d, oficialVenta }: { d: Dolar; oficialVenta: number }) {
  const meta    = DOLLAR_META[d.casa] ?? { label: d.nombre, color: '#9ca3af', desc: '' }
  const brecha  = oficialVenta > 0 ? ((d.venta - oficialVenta) / oficialVenta) * 100 : null
  const isBlue  = d.casa === 'blue'

  return (
    <div
      className="rounded-xl p-5 flex flex-col gap-3 transition-all hover:-translate-y-0.5"
      style={{ background: SURFACE, border: `1px solid ${isBlue ? meta.color + '40' : BORDER}` }}
    >
      <div className="flex items-center justify-between">
        <div>
          <span className="text-xs font-bold uppercase tracking-widest" style={{ color: meta.color }}>
            {meta.label}
          </span>
          <p className="text-[10px] text-zinc-600 mt-0.5">{meta.desc}</p>
        </div>
        {isBlue && brecha !== null && (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
            style={{ background: '#a78bfa15', color: '#a78bfa', border: '1px solid #a78bfa30' }}>
            Brecha {fmt.pct(brecha)}
          </span>
        )}
      </div>

      <div className="flex items-end justify-between gap-2">
        <div>
          <p className="text-2xl font-bold text-white">${fmt.ars(d.venta)}</p>
          <p className="text-xs text-zinc-600 mt-0.5">Compra ${fmt.ars(d.compra)}</p>
        </div>
        {d.variacion !== undefined && d.variacion !== null && (
          <div className="flex items-center gap-1 text-xs font-medium"
            style={{ color: d.variacion > 0 ? '#22c55e' : d.variacion < 0 ? '#f87171' : '#71717a' }}>
            {d.variacion > 0 ? <TrendingUp size={13} /> : d.variacion < 0 ? <TrendingDown size={13} /> : <Minus size={13} />}
            {fmt.pct(d.variacion)}
          </div>
        )}
      </div>

      {brecha !== null && d.casa !== 'blue' && d.casa !== 'oficial' && (
        <div className="text-[10px] text-zinc-600">
          Brecha vs oficial: <span style={{ color: meta.color }}>{fmt.pct(brecha)}</span>
        </div>
      )}
    </div>
  )
}

// ── Brecha Banner ─────────────────────────────────────────────────────────────
function BrechaBanner({ dolares }: { dolares: Dolar[] }) {
  const oficial = dolares.find(d => d.casa === 'oficial')
  const blue    = dolares.find(d => d.casa === 'blue')
  const mep     = dolares.find(d => d.casa === 'bolsa')
  const ccl     = dolares.find(d => d.casa === 'contadoconliqui')
  if (!oficial) return null

  const brecha = (d: Dolar) => ((d.venta - oficial.venta) / oficial.venta * 100)

  return (
    <div className="rounded-xl p-5 flex flex-wrap gap-6 items-center"
      style={{ background: '#0a0a14', border: `1px solid ${BORDER}` }}>
      <div>
        <p className="text-xs text-zinc-500 uppercase tracking-widest mb-1">Termómetro cambiario</p>
        <p className="text-[11px] text-zinc-600">Spread respecto al dólar oficial BNA</p>
      </div>
      {[blue, mep, ccl].filter(Boolean).map(d => {
        const b = brecha(d!)
        const col = b < 10 ? '#22c55e' : b < 30 ? '#eab308' : b < 60 ? '#fb923c' : '#f87171'
        return (
          <div key={d!.casa} className="flex flex-col gap-1">
            <span className="text-xs text-zinc-500">{DOLLAR_META[d!.casa]?.label}</span>
            <div className="flex items-center gap-2">
              <div className="h-1.5 rounded-full w-20" style={{ background: BORDER }}>
                <div className="h-1.5 rounded-full transition-all" style={{ width: `${Math.min(b, 100)}%`, background: col }} />
              </div>
              <span className="text-sm font-bold" style={{ color: col }}>{fmt.pct(b)}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Chart Section ─────────────────────────────────────────────────────────────
type ChartTab = 'evolucion' | 'inflacion' | 'riesgo'

function EvolucionChart({ data }: { data: EvolucionRow[] }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-4 text-xs text-zinc-500 ml-2">
        <span className="flex items-center gap-1.5"><span className="w-4 h-0.5 rounded inline-block bg-blue-400" />Oficial</span>
        <span className="flex items-center gap-1.5"><span className="w-4 h-0.5 rounded inline-block bg-purple-400" />Blue</span>
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={data} margin={{ top: 4, right: 24, left: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={BORDER} />
          <XAxis dataKey="month" tick={{ fill: '#71717a', fontSize: 11 }}
            tickFormatter={fmt.month} interval="preserveStartEnd" />
          <YAxis tick={{ fill: '#71717a', fontSize: 11 }}
            tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
          <Tooltip
            {...tooltipStyle}
            labelFormatter={(s) => fmt.month(String(s))}
            formatter={(v, name) => [`$${fmt.ars(Number(v))}`, name === 'oficial' ? 'Oficial' : 'Blue']}
          />
          <Line type="monotone" dataKey="oficial" stroke="#60a5fa" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="blue"    stroke="#a78bfa" strokeWidth={2} dot={false} strokeDasharray="4 3" />
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
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-xs text-zinc-500 uppercase tracking-widest mb-3">Inflación mensual IPC — últimos 24 meses</p>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={merged} margin={{ top: 4, right: 24, left: 8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={BORDER} />
            <XAxis dataKey="fecha" tick={{ fill: '#71717a', fontSize: 10 }}
              tickFormatter={s => fmt.month(s.slice(0, 7))} interval={3} />
            <YAxis tick={{ fill: '#71717a', fontSize: 11 }} tickFormatter={v => `${v}%`} />
            <Tooltip
              {...tooltipStyle}
              labelFormatter={s => fmt.month(String(s).slice(0, 7))}
              formatter={(v) => [`${Number(v).toFixed(1)}%`, 'Mensual']}
            />
            <Bar dataKey="mensual" radius={[3, 3, 0, 0]}>
              {merged.map((entry, i) => (
                <Cell key={i} fill={entry.mensual > 10 ? '#f87171' : entry.mensual > 5 ? '#fb923c' : '#22c55e'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div>
        <p className="text-xs text-zinc-500 uppercase tracking-widest mb-3">Inflación interanual (YoY)</p>
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={merged} margin={{ top: 4, right: 24, left: 8, bottom: 0 }}>
            <defs>
              <linearGradient id="yoyGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#f87171" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#f87171" stopOpacity={0}   />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={BORDER} />
            <XAxis dataKey="fecha" tick={{ fill: '#71717a', fontSize: 10 }}
              tickFormatter={s => fmt.month(s.slice(0, 7))} interval={3} />
            <YAxis tick={{ fill: '#71717a', fontSize: 11 }} tickFormatter={v => `${v}%`} />
            <Tooltip
              {...tooltipStyle}
              labelFormatter={s => fmt.month(String(s).slice(0, 7))}
              formatter={(v) => [`${Number(v).toFixed(1)}%`, 'Interanual']}
            />
            <Area type="monotone" dataKey="interanual" stroke="#f87171" strokeWidth={2} fill="url(#yoyGrad)" dot={false} />
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

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-6">
        <div>
          <p className="text-3xl font-bold text-white">{last ? fmt.ars(last) : '—'} <span className="text-sm text-zinc-500">bps</span></p>
          <p className="text-xs text-zinc-500 mt-1">Riesgo país actual (EMBI+)</p>
        </div>
        {delta !== null && (
          <div className="flex items-center gap-1.5 text-sm font-medium"
            style={{ color: delta > 0 ? '#f87171' : '#22c55e' }}>
            {delta > 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
            {delta > 0 ? '+' : ''}{fmt.ars(delta)} bps (90d)
          </div>
        )}
      </div>
      <ResponsiveContainer width="100%" height={240}>
        <AreaChart data={data} margin={{ top: 4, right: 24, left: 8, bottom: 0 }}>
          <defs>
            <linearGradient id="rpGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#fb923c" stopOpacity={0.25} />
              <stop offset="95%" stopColor="#fb923c" stopOpacity={0}    />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={BORDER} />
          <XAxis dataKey="fecha" tick={{ fill: '#71717a', fontSize: 10 }}
            tickFormatter={s => fmt.shortDate(s)} interval={14} />
          <YAxis tick={{ fill: '#71717a', fontSize: 11 }}
            domain={['auto', 'auto']} />
          <Tooltip
            {...tooltipStyle}
            labelFormatter={s => fmt.shortDate(String(s))}
            formatter={(v) => [`${fmt.ars(Number(v))} bps`, 'Riesgo país']}
          />
          <Area type="monotone" dataKey="valor" stroke="#fb923c" strokeWidth={2} fill="url(#rpGrad)" dot={false} />
        </AreaChart>
      </ResponsiveContainer>
      <p className="text-[11px] text-zinc-600">Spread soberano EMBI+ Argentina — últimos 90 días hábiles · Fuente: ArgentinaDatos</p>
    </div>
  )
}

// ── Loading / Error ───────────────────────────────────────────────────────────
function Skeleton() {
  return <div className="h-full w-full rounded-lg animate-pulse" style={{ background: BORDER }} />
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const [dolares,   setDolares]   = useState<Dolar[]>([])
  const [evolucion, setEvolucion] = useState<EvolucionRow[]>([])
  const [inflacion, setInflacion] = useState<{ monthly: DataRow[]; yoy: DataRow[] } | null>(null)
  const [riesgo,    setRiesgo]    = useState<DataRow[]>([])
  const [chartTab,  setChartTab]  = useState<ChartTab>('evolucion')
  const [loading,   setLoading]   = useState(true)
  const [lastUpdate, setLastUpdate] = useState<string>('')
  const [refreshing, setRefreshing] = useState(false)

  const loadDolares = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true)
    try {
      const res  = await fetch('/api/dolares')
      const data = await res.json()
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
      setDolares(dol)
      setEvolucion(evo)
      setInflacion(inf)
      setRiesgo(rp)
      setLastUpdate(new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }))
    }).finally(() => setLoading(false))

    // Poll dollar rates every 60 seconds
    const iv = setInterval(() => loadDolares(true), 60_000)
    return () => clearInterval(iv)
  }, [loadDolares])

  const oficial   = dolares.find(d => d.casa === 'oficial')
  const ORDER     = ['oficial', 'blue', 'bolsa', 'contadoconliqui', 'cripto', 'tarjeta', 'mayorista']
  const sorted    = [...dolares].sort((a, b) => ORDER.indexOf(a.casa) - ORDER.indexOf(b.casa))

  const CHART_TABS: { id: ChartTab; label: string }[] = [
    { id: 'evolucion', label: 'Evolución cambiaria' },
    { id: 'inflacion', label: 'Inflación' },
    { id: 'riesgo',    label: 'Riesgo país' },
  ]

  return (
    <div className="min-h-screen text-white" style={{ background: BG }}>

      {/* ── Header ── */}
      <header style={{ borderBottom: `1px solid ${BORDER}`, background: SURFACE }}>
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🇦🇷</span>
            <div>
              <h1 className="text-lg font-bold tracking-tight">Argentina Macro Dashboard</h1>
              <p className="text-xs text-zinc-500">Tipos de cambio · Inflación · Riesgo país</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {lastUpdate && (
              <span className="text-xs text-zinc-600 hidden sm:block">Actualizado {lastUpdate}</span>
            )}
            <button
              onClick={() => loadDolares(false)}
              disabled={refreshing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:bg-white/5"
              style={{ border: `1px solid ${BORDER}`, color: '#a1a1aa' }}
            >
              <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
              Actualizar
            </button>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span className="text-xs text-zinc-500">Live</span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 flex flex-col gap-8">

        {/* ── Dollar Grid ── */}
        <section>
          <p className="text-xs font-semibold uppercase tracking-[4px] text-zinc-500 mb-4">
            Tipos de cambio — {new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>

          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {Array.from({ length: 7 }).map((_, i) => (
                <div key={i} className="h-28 rounded-xl" style={{ background: SURFACE }}>
                  <Skeleton />
                </div>
              ))}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mb-4">
                {sorted.map(d => (
                  <DollarCard key={d.casa} d={d} oficialVenta={oficial?.venta ?? 0} />
                ))}
              </div>
              {dolares.length > 0 && <BrechaBanner dolares={dolares} />}
            </>
          )}
        </section>

        {/* ── Charts ── */}
        <section>
          {/* Tab selector */}
          <div className="flex gap-1 mb-6 p-1 rounded-lg w-fit" style={{ background: SURFACE, border: `1px solid ${BORDER}` }}>
            {CHART_TABS.map(t => (
              <button
                key={t.id}
                onClick={() => setChartTab(t.id)}
                className="px-4 py-2 rounded-md text-sm font-medium transition-all"
                style={{
                  background: chartTab === t.id ? '#3b82f6' : 'transparent',
                  color:      chartTab === t.id ? '#fff'    : '#71717a',
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="rounded-xl p-6" style={{ background: SURFACE, border: `1px solid ${BORDER}` }}>
            {loading ? (
              <div className="h-64"><Skeleton /></div>
            ) : chartTab === 'evolucion' ? (
              <>
                <h2 className="text-sm text-zinc-400 uppercase tracking-widest mb-4">
                  Blue vs Oficial — últimos 14 meses (precio venta promedio mensual)
                </h2>
                <EvolucionChart data={evolucion} />
              </>
            ) : chartTab === 'inflacion' ? (
              <>
                <h2 className="text-sm text-zinc-400 uppercase tracking-widest mb-4">
                  Índice de Precios al Consumidor (INDEC)
                </h2>
                {inflacion ? <InflacionChart data={inflacion} /> : <div className="h-64"><Skeleton /></div>}
              </>
            ) : (
              <>
                <h2 className="text-sm text-zinc-400 uppercase tracking-widest mb-4">
                  Riesgo País — últimos 90 días
                </h2>
                <RiesgoPaisChart data={riesgo} />
              </>
            )}
          </div>
        </section>

        {/* ── KPI Summary Row ── */}
        {!loading && inflacion && riesgo.length > 0 && (
          <section className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              {
                label: 'Inflación mensual',
                value: `${inflacion.monthly[inflacion.monthly.length - 1]?.valor.toFixed(1)}%`,
                sub: `Feb '26 · INDEC`,
                color: '#f87171',
              },
              {
                label: 'Inflación interanual',
                value: `${inflacion.yoy[inflacion.yoy.length - 1]?.valor.toFixed(1)}%`,
                sub: 'YoY acumulado',
                color: '#fb923c',
              },
              {
                label: 'Riesgo país',
                value: `${fmt.ars(riesgo[riesgo.length - 1]?.valor)} bps`,
                sub: 'EMBI+ Argentina',
                color: '#fb923c',
              },
              {
                label: 'Brecha blue/oficial',
                value: oficial
                  ? fmt.pct(((dolares.find(d => d.casa === 'blue')?.venta ?? 0) - oficial.venta) / oficial.venta * 100)
                  : '—',
                sub: 'Spread cambiario',
                color: '#a78bfa',
              },
            ].map(k => (
              <div key={k.label} className="rounded-xl p-5" style={{ background: SURFACE, border: `1px solid ${BORDER}` }}>
                <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2">{k.label}</p>
                <p className="text-2xl font-bold" style={{ color: k.color }}>{k.value}</p>
                <p className="text-xs text-zinc-600 mt-1">{k.sub}</p>
              </div>
            ))}
          </section>
        )}

        {/* ── Footer ── */}
        <footer className="text-center py-4">
          <p className="text-xs text-zinc-700">
            Fuentes: <a href="https://dolarapi.com" target="_blank" rel="noreferrer" className="hover:text-zinc-500 transition-colors">dolarapi.com</a>
            {' · '}
            <a href="https://bluelytics.com.ar" target="_blank" rel="noreferrer" className="hover:text-zinc-500 transition-colors">bluelytics.com.ar</a>
            {' · '}
            <a href="https://argentinadatos.com" target="_blank" rel="noreferrer" className="hover:text-zinc-500 transition-colors">argentinadatos.com</a>
            {' · '}
            <a href="https://indec.gob.ar" target="_blank" rel="noreferrer" className="hover:text-zinc-500 transition-colors">INDEC</a>
          </p>
        </footer>

      </main>
    </div>
  )
}
