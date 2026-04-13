# 🇦🇷 Argentina Macro Dashboard

Dashboard macroeconómico de Argentina con datos en tiempo real. Tipos de cambio, inflación, riesgo país y análisis financiero — todo actualizado al minuto desde APIs públicas.

**[→ Ver en vivo](https://argentina-macro.vercel.app)**

---

## ¿Qué muestra?

| Sección | Datos |
|---|---|
| **Tipos de cambio** | Oficial, Blue, MEP, CCL, Cripto, Tarjeta, Mayorista |
| **Brecha cambiaria** | Spread blue/oficial en tiempo real + histórico 18 meses |
| **Inflación** | IPC mensual e interanual (INDEC) — últimos 24 meses |
| **Riesgo País** | EMBI+ Argentina — últimos 90 días |
| **Comparador** | Barras visuales con % de brecha por tipo de cambio |
| **Calculadora** | Convertí USD ↔ ARS en todos los tipos de cambio |
| **Plazo Fijo** | Top 5 tasas TNA + rendimiento real vs inflación |
| **Termómetro** | Semáforo macroeconómico con 6 indicadores clave |

---

## Stack

- **Framework**: Next.js 16 (App Router)
- **UI**: Tailwind CSS v4
- **Gráficos**: Recharts
- **Deploy**: Vercel
- **Lenguaje**: TypeScript

## APIs (todas públicas, sin API key)

| API | Datos |
|---|---|
| [dolarapi.com](https://dolarapi.com) | Tipos de cambio en tiempo real |
| [bluelytics.com.ar](https://bluelytics.com.ar) | Histórico blue/oficial |
| [argentinadatos.com](https://argentinadatos.com) | Inflación INDEC, riesgo país, plazo fijo |

---

## Correr localmente

```bash
git clone https://github.com/santiagomalak/Argentina-Macro.git
cd Argentina-Macro
npm install
npm run dev
```

Abrí [http://localhost:3000](http://localhost:3000). No se necesita ningún `.env` — todas las APIs son públicas.

## Deploy propio

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/santiagomalak/Argentina-Macro)

Un click y listo. Sin variables de entorno requeridas.

---

## Arquitectura

```
app/
├── page.tsx              # Dashboard principal (client component)
├── layout.tsx            # Metadata SEO + layout raíz
├── globals.css           # Animaciones ticker, tabnum, glow
└── api/
    ├── dolares/          # Tipos de cambio (polling 60s)
    ├── evolucion/        # Histórico blue vs oficial
    ├── inflacion/        # IPC mensual e interanual
    ├── riesgo-pais/      # EMBI+ últimos 90 días
    ├── sparklines/       # Minigráficos 10 días
    ├── brecha-historica/ # Brecha % últimos 18 meses
    └── plazo-fijo/       # Top 5 tasas + promedio bancos
```

Todas las rutas de API usan `export const dynamic = 'force-dynamic'` para datos frescos en cada request.

---

*Datos con fines informativos. No constituye asesoramiento financiero.*
