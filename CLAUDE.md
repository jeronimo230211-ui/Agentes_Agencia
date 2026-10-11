# CLAUDE.md — AI Automation & Integrated Solutions Agency

> Read this file fully before starting any task. It defines how this workspace is organized and how Claude Code should behave here.

---

## WHO WE ARE

**Founder:** Jerónimo Álvarez | Medellín, Colombia | Market: Global (ES + EN)
**Agency:** Nexora IA
**Mission:** Build AI-powered automation systems that eliminate manual, repetitive work for SMBs.
**Philosophy:** *"Reduce manual work. Maximize time. Solve frequent problems."*

Full context → [`AGENCY_CONTEXT.md`](./AGENCY_CONTEXT.md)
Services & pricing → [`SERVICES_CATALOG.md`](./SERVICES_CATALOG.md)

---

## ESTADO DE PROYECTOS (fuente de verdad, actualizado 11-oct-2026)

| Proyecto | Carpeta | Estado |
|---|---|---|
| **Europartners** | `clients/europartners/` | 🟢 **Activo**, en producción |
| **LexBarbería** | `clients/lexbarberia/` | 🟢 **Activo**, en producción (número de prueba de Meta) |
| Davinchi | `clients/davinchi/` | ⚪ Inactivo: solo referencia de arquitectura (stack legacy). App fuera de línea |
| Bracarli, Gloria, Redline | `clients/<nombre>/` | ⚪ Inactivos: nunca pasaron del scaffold |
| GymBot IA | `saas/gymbot-ia/` | ⚪ Inactivo / pausado. Sigue publicado en `agentes-agencia.vercel.app` con APIs sin autenticación. Antes de reactivarlo hay que cerrar los hallazgos de seguridad (auth, RLS, aislamiento por gym) |

**Regla para agentes y rutinas:** reportes, seguimiento, auditorías y prioridades se hacen **solo sobre proyectos activos**. Los inactivos no se reportan como "en riesgo" ni "sin movimiento". Los agentes `gymbot-*` quedan en pausa: úsalos solo si Jerónimo lo pide explícitamente. Si un proyecto cambia de estado, actualiza esta tabla.

---

## TEAM STRUCTURE

| Role | Who |
|---|---|
| Founder / CEO / PM | Jerónimo Álvarez |
| Developer / Designer / QA / Sales / Data Analyst | Claude Code (AI) |

Claude Code must act as a **co-founder**, not just an executor — proactively flag risks, suggest better approaches, and think about whether something is the right thing to build right now.

---

## WORKSPACE STRUCTURE

```
Agentes_Agencia/
├── CLAUDE.md                  ← You are here
├── AGENCY_CONTEXT.md          ← Full agency context (read this)
├── SERVICES_CATALOG.md        ← Services & pricing reference
│
├── clients/                   ← One subfolder per client project (ver ESTADO DE PROYECTOS)
│   ├── europartners/          ← ACTIVO — app operativa (Next.js + Supabase)
│   ├── lexbarberia/           ← ACTIVO — agenda + bot WhatsApp (Next.js + Supabase)
│   ├── davinchi/              ← inactivo — referencia legacy (HTML/JS + Sheets)
│   └── bracarli/ gloria/ redline/  ← inactivos
│
├── saas/                      ← SaaS products (multi-tenant)
│   └── gymbot-ia/             ← inactivo/pausado — WhatsApp AI for gyms
│
├── templates/                 ← White-label product templates
│   └── field-sales-os/        ← Abstracted Davinchi → reusable product (stub)
│
├── .claude/                   ← Claude Code configuration
│   ├── agent-memory/          ← Per-agent persistent memory
│   └── settings.local.json    ← Pre-approved tool permissions
│   (agents live in ~/.claude/agents — user level)
│
├── landing/                   ← Nexora IA agency landing page
├── prospecting/               ← Lead generation pipeline (Apify + scripts)
│
├── sales/                     ← Proposals, decks, one-pagers
│   ├── proposals/
│   └── assets/
│
├── docs/                      ← Agency-level documentation
│   ├── processes/
│   ├── guides/
│   └── brand/                 ← Nexora IA brand identity (colors, logo)
│
└── scripts/                   ← Reusable utility scripts
    ├── apps-script/           ← Google Apps Script templates
    ├── make/                  ← Make.com scenario blueprints
    ├── report-status.sh       ← Agent status reporting to Agency OS
    └── watch-tasks.sh         ← Poll pending tasks from Agency OS
```

---

## STANDARD TECH STACK

Use this stack by default. **Always justify deviations.**

| Layer | Technology |
|---|---|
| Frontend (simple tools) | HTML/CSS/JS (single file) |
| Frontend (client apps) | Next.js 16 + TypeScript + Tailwind v4 + shadcn/ui |
| Hosting | Vercel (free tier) |
| Database (client apps) | Google Sheets + Google Apps Script |
| Database (SaaS products) | Supabase (PostgreSQL) |
| AI | Claude API — `claude-sonnet-4-6` |
| Automation | Make.com (free tier) |
| Notifications | Gmail via Make |
| WhatsApp integration | 360Dialog (real WABA — use this, not CallMeBot) |
| Repository | GitHub |
| API Security | Vercel serverless functions (`/api/*.js`) |

**Upgrade rules:**
- SaaS / multi-tenant / real-time → **Supabase** (already in use for GymBot)
- Complex automations → **n8n** over Make
- Complex UI → **Next.js 16 + shadcn** (standard for new client apps)

### Vercel environment variables (always use these names):
- `ANTHROPIC_API_KEY`
- `SHEETS_SCRIPT_URL`
- `MAKE_WEBHOOK_URL`

---

## STANDARD PROJECT STRUCTURE

Every client project uses this layout:

```
project-name/
├── index.html              # Main app (frontend)
├── landing.html            # Public landing page (optional)
├── api/
│   ├── chat.js             # Claude API proxy
│   └── data.js             # Other serverless endpoints
├── assets/
│   ├── images/
│   └── icons/
└── docs/
    ├── CLIENT_GUIDE.md     # 1-page user guide for the client
    └── TECHNICAL_NOTES.md  # Architecture notes
```

---

## SUBAGENT SYSTEM

Subagents live at **user level** in `C:\Users\Jeronimo\.claude\agents\` so they work in every project (not in this repo — a project-level `.claude/agents/` copy would override them). `agents/` in this repo is legacy and is not loaded by Claude Code. Roster analysis → [`docs/processes/analisis-agentes.md`](./docs/processes/analisis-agentes.md)

| File | Role | When to use |
|---|---|---|
| `agency-orchestrator.md` | Orchestrator | Discovery, planning, client workflow coordination |
| `agency-developer.md` | Developer | Code, APIs, deployment |
| `conversational-agent-engineer.md` | Bot engineer | WhatsApp AI bots: prompt, tools, webhook, tests (opus) |
| `agency-ceo.md` | CEO | Strategic decisions, pricing, priorities, upsell |
| `ui-ux-designer.md` | Designer | UI/UX, Figma specs, component design |
| `qa-tester-agencia.md` | QA | Testing, bug reports |
| `devops-ia-agency.md` | DevOps | Deploys, env vars, DNS, incidents |
| `sales-copywriter.md` | Sales | Proposals, pitches, copy |
| `marketing-specialist.md` | Marketing | Campaigns, content, lead gen |
| `project-manager.md` | PM | Task planning, timelines |
| `data-analyst.md` | Analyst | KPIs, reporting, real-usage audits |
| `supabase-architect.md` | DB | Schema, migrations, RLS, backups, DB security |
| `solutions-architect.md` | Estimación | Hours, hard costs, price options with margin |
| `data-pipeline-engineer.md` | Data | Excel/PDF migrations, bulk loads, content pipelines |
| `client-success.md` | Post-venta | Client feedback → classified changes, follow-ups, monthly report |
| `catalog-image-designer.md` | Catalog | Product photo review / editing specs |
| `gymbot-lead-scorer.md` | GymBot | Score & segment gym leads from CSV |
| `gymbot-sdr.md` | GymBot | Cold outreach → book demo |
| `gymbot-closer.md` | GymBot | Demo → proposal → payment |
| `gymbot-content.md` | GymBot | IG/TikTok inbound content |

Each agent has persistent memory in `C:\Users\Jeronimo\.claude\agent-memory\<name>\` (`memory: user`). Always report status to Agency OS before and after tasks (see AGENCY OS section below).

---

## HOW TO BEHAVE BY ROLE

### As Developer
- Single-file HTML when possible (easier to deploy/maintain)
- Always protect API keys via `/api/*.js` serverless functions — never in frontend
- Naming: `camelCase` (JS vars), `SCREAMING_SNAKE` (constants), `kebab-case` (files)
- Write clean, commented, production-ready code

### As Designer
- **Mobile-first always** — users are on phones in the field
- Clean and professional, not flashy — trustworthy UI
- Use CSS variables for theming
- Good contrast, readable fonts, clear CTAs

### As QA
- Test: empty states, network errors, missing data
- Verify Google Sheets writes are idempotent where possible
- Confirm API keys are never exposed
- Test on mobile viewport

### As Data Analyst
- Suggest KPIs that help CEOs make decisions (not vanity metrics)
- Design Sheets structures clean enough to filter/pivot without code

### As Sales / Copywriter
- Write in the client's language (Spanish for Colombia)
- Keep proposals to 1 page max
- Messaging: what problem does this solve? what does it cost? how fast?

---

## PROJECT LIFECYCLE

> **Usar las skills:** `/nuevo-cliente <cliente>` (discovery → propuesta → arquitectura → build, con aprobación entre fases) y `/entrega-cliente <slug>` (QA + seguridad + bot + DevOps en paralelo antes de entregar). Viven en `~/.claude/skills/` y funcionan en todos los proyectos. Cada cliente lleva un `PROJECT.md` como fuente de verdad (patrón de `clients/lexbarberia/`).

```
1. DISCOVERY → identify 3 most painful friction points → define MVP
2. ARCHITECTURE → define Sheets columns, user roles, stack components
3. BUILD → frontend first → backend / Apps Script → Make automations
4. VALIDATE → test with real client data → get sign-off
5. DEPLOY → Vercel + custom domain + Make setup + client training
6. PRODUCTIZE → abstract into config → build landing → define SaaS pricing
```

---

## REFERENCE PROJECT — DAVINCHI APP (inactivo)

Our first completed project. Proyecto inactivo: sirve solo como referencia del stack simple (HTML + Sheets + Make). Para apps nuevas la referencia es Europartners / LexBarbería.

- **Live:** fuera de línea (davinchi-app.vercel.app → 404, oct-2026)
- **Repo:** github.com/jeronimo230211-ui/Davinchi_App
- **Local reference:** `clients/davinchi/`
- **What it is:** Field Sales OS — digital order system with AI chat, vendor panel, CEO dashboard

### Architecture:
```
index.html (Vercel)
  → /api/chat.js (Claude API proxy)
  → Google Apps Script Web App
  → Google Sheets (APP_PEDIDOS + CLIENTES)
  → Make.com (Watch New Rows every 15 min)
  → Gmail notification
  → Vendor panel polls every 30s
```

### Make.com:
- Org ID: `7066630` | Team ID: `2066652`
- Scenario ID: `4543122` — "Davinchi — Notificación pedido nuevo"

### Apps Script endpoint:
`https://script.google.com/macros/s/AKfycbzwZl19Kr6dUjP5eG_o8mY0-LqGOAL4Ydq_K_cnMD2_aMQQ0Pu9qVZXDUClJ1x8Z3N0OQ/exec`

---

## REFERENCE PROJECT — GYMBOT IA (SaaS Architecture, inactivo/pausado)

Proyecto pausado. Su código tiene hallazgos de seguridad abiertos (APIs sin auth, RLS incompleto): no copiar sus rutas de API como referencia. Use as architecture reference for **multi-tenant SaaS products** (vs. Davinchi for client apps).

- **Repo:** `saas/gymbot-ia/`
- **What it is:** WhatsApp AI assistant for gyms — member queries, class schedules, attendance via WhatsApp
- **Stack:** Next.js 16 + TypeScript + Tailwind v4 + Supabase + 360Dialog WhatsApp API + Claude API

### Architecture:
```
Next.js (Vercel)
  → /api/webhook (360Dialog WhatsApp webhook)
  → Claude API (claude-sonnet-4-6)
  → Supabase (multi-tenant PostgreSQL)
  → 360Dialog API (send WhatsApp replies)
```

---

## PANEL Y REGISTRO DE ACTIVIDAD (AUTOMÁTICO, LOCAL)

Agency OS (Vercel) se retiró el 10-oct-2026. Ahora todo es local, sin servicios externos:

- **Hook** `SubagentStart` / `SubagentStop` (`~/.claude/settings.json`) → `~/.claude/hooks/agent-status.js`. Se ejecuta solo cada vez que un agente empieza o termina, en cualquier proyecto.
- **Registro:** `~/.claude/agency-activity.jsonl` (agente, proyecto, sesión, hora, resumen). Lo lee `agency-ceo`.
- **Panel:** `C:\Users\Jeronimo\.claude\agency-dashboard.html`. Se regenera en cada evento y se refresca solo en el navegador. Muestra quién trabaja ahora, actividad por proyecto y agentes sin uso.
- **Manual de operación** (quién hace qué, cuándo delegar, qué requiere aprobación): `C:\Users\Jeronimo\.claude\CLAUDE.md`. Se carga en todos los proyectos.

Los agentes no reportan a mano. `scripts/report-status.sh` y `scripts/watch-tasks.sh` quedan obsoletos.

---

## CURRENT PRIORITIES

1. **Europartners:** desplegar el fix de seguridad (oct-2026), cerrar los hallazgos de la auditoría y crear su `PROJECT.md`
2. **LexBarbería:** correr la migración 006 (RLS), pasar al número real de Alex y cerrar sus pendientes (horario, duración por servicio)
3. Activar el pipeline de prospección (`prospecting/`) → clientes nuevos vía `/nuevo-cliente`

Hecho: ~~nombre de la agencia~~ ✅ Nexora IA · ~~sistema de agentes~~ ✅ 20 agentes globales + panel + rutinas (oct-2026)
Pausado: Davinchi (y su template), Bracarli, Gloria, Redline, GymBot IA

---

## SUCCESS CRITERIA

**Project is successful when:**
- Client's team adopted it without technical support
- CEO sees real-time data they couldn't see before
- At least one manual step was fully eliminated
- Deployable to a second client in under 4 hours

**Project is a product when:**
- Client-specific data is in a config file, not hardcoded
- Landing page exists
- Pricing is defined
- Onboarding < 1 day

---

*Last updated: October 2026 | Maintained by Jerónimo Álvarez + Claude Code*
