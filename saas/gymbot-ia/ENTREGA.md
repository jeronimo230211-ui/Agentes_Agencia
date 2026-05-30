# ENTREGA — GymBot IA SaaS

**Fecha de construcción:** Mayo 2026  
**Construido por:** Nexora IA — Jerónimo Álvarez  
**Estado:** Código completo. Pendiente deploy en Vercel.

---

## 1. Producto construido

**GymBot IA** es un SaaS multi-tenant que permite a gimnasios en LATAM configurar un bot de WhatsApp con IA (Claude) en menos de 24 horas, sin conocimientos técnicos.

**Funcionalidades:**
- Landing page de ventas (`/`) con pricing, demo visual y CTA
- Wizard de onboarding en 3 pasos (`/setup`) — configura el gym y crea la cuenta
- Dashboard del dueño del gym (`/dashboard`) con estadísticas en tiempo real
- Panel de leads capturados (`/dashboard/leads`) con búsqueda y link directo a WhatsApp
- Configuración del bot (`/dashboard/config`) — editar horarios, precios, clases, saludo
- API webhook (`/api/webhook`) — recibe mensajes de 360Dialog, procesa con Claude, responde
- API chat (`/api/chat`) — proxy seguro de Claude para demos internos
- API gyms (`/api/gyms`) — CRUD completo de gimnasios

---

## 2. URLs del producto

| Recurso | URL |
|---|---|
| **App en producción** | https://gymbot-ia.vercel.app (pendiente deploy) |
| **Landing** | https://gymbot-ia.vercel.app/ |
| **Setup** | https://gymbot-ia.vercel.app/setup |
| **Dashboard** | https://gymbot-ia.vercel.app/dashboard |
| **Webhook URL (para 360Dialog)** | https://gymbot-ia.vercel.app/api/webhook |

---

## 3. Repositorio GitHub

**Repo a crear:** `github.com/jeronimo230211-ui/gymbot-ia`

El código está en: `Agentes_Agencia/saas/gymbot-ia/app/`

---

## 4. Variables de entorno (configurar en Vercel)

| Variable | Descripción | Dónde obtener |
|---|---|---|
| `ANTHROPIC_API_KEY` | Claude API key | console.anthropic.com |
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto Supabase | Supabase dashboard → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Anon key de Supabase | Supabase dashboard → Settings → API |
| `SUPABASE_SERVICE_KEY` | Service role key (privada) | Supabase dashboard → Settings → API |
| `MAKE_WEBHOOK_URL` | Webhook de Make.com para notificaciones | Crear escenario en Make.com |

---

## 5. Pasos de deploy (hacer desde la máquina local)

### 5.1 Supabase — crear la base de datos

1. Ir a [supabase.com](https://supabase.com) → crear proyecto nuevo "gymbot-ia"
2. Ir a **SQL Editor**
3. Copiar y pegar el contenido de `docs/supabase-schema.sql`
4. Ejecutar → las 3 tablas quedan creadas (`gyms`, `conversations`, `leads`)
5. Copiar `Project URL`, `anon key` y `service_role key` de **Settings → API**

### 5.2 GitHub — subir el código

```bash
cd Agentes_Agencia/saas/gymbot-ia/app
git init
git add -A
git commit -m "Initial commit: GymBot IA SaaS"
# Crear repo en GitHub: gymbot-ia
git remote add origin https://github.com/jeronimo230211-ui/gymbot-ia.git
git push -u origin main
```

### 5.3 Vercel — deploy automático

1. Ir a [vercel.com/new](https://vercel.com/new)
2. Importar el repo `gymbot-ia`
3. Framework: Next.js (auto-detectado)
4. Agregar las 5 variables de entorno (ver tabla arriba)
5. Click **Deploy**
6. La URL queda en formato `gymbot-ia.vercel.app` o similar

### 5.4 Make.com — notificaciones de nuevos leads (opcional)

1. Crear escenario nuevo en Make.com
2. Trigger: **Webhooks → Custom Webhook**
3. Copiar la URL del webhook → pegar en `MAKE_WEBHOOK_URL` en Vercel
4. Acción: **Gmail → Send Email** con los datos del lead (name, phone, gym, interest)
5. Activar el escenario

### 5.5 Verificación final

```
✓ gymbot-ia.vercel.app carga sin errores
✓ /setup completa el wizard y crea un gym en Supabase
✓ /dashboard muestra el gym recién creado
✓ /api/webhook responde 200 con payload de prueba
✓ /api/chat devuelve respuesta de Claude con prompt de test
```

---

## 6. Resumen de estrategia de ventas

Ver documentación completa en `docs/sales-strategy.md`

**Pasos inmediatos:**
1. Contactar los 10 leads (ver `docs/top10-leads.md`)
2. Ofrecer plan Piloto: **$0 setup + $49/mes** (primeros 5 gyms)
3. Demo de 20 minutos con número de demo activo
4. Meta mes 1: 3 gyms pagando → MRR $147 USD

**Mensajes listos** en `docs/top10-leads.md` para cada lead con su nombre, ciudad y contexto específico.

---

## 7. Top 10 leads a contactar ESTA semana

| # | Gym | Ciudad | Teléfono | Día |
|---|---|---|---|---|
| 1 | Total Fit Gym | Medellín 🇨🇴 | +57 604 5017736 | Lunes |
| 2 | Gimnasio Sport Club | Medellín 🇨🇴 | +57 44183626 | Lunes |
| 3 | Hakuna CrossFit | Envigado 🇨🇴 | +57 2764249 | Lunes |
| 4 | AnimalX Centro | Medellín 🇨🇴 | +57 324 5993911 | Martes |
| 5 | MAC-GYM | Bogotá 🇨🇴 | +57 601 2877462 | Martes |
| 6 | Titanium Center GYM | Bogotá 🇨🇴 | +57 302 8326872 | Martes |
| 7 | Gimnasio Megafit1 | Medellín 🇨🇴 | +57 301 4851203 | Miércoles |
| 8 | STARK GYM | Córdoba 🇦🇷 | +54 9 351 815-0220 | Miércoles |
| 9 | Escuadrón CrossFit Reforma | CDMX 🇲🇽 | +52 55 6167 0508 | Jueves |
| 10 | 424 GYM | CDMX 🇲🇽 | +52 55 6305 2390 | Jueves |

---

## 8. Checklist de las próximas 48 horas

### HOY (bloque de 2 horas)
- [ ] Crear proyecto en Supabase → ejecutar schema SQL
- [ ] Crear repo en GitHub → push del código
- [ ] Deploy en Vercel → configurar variables de entorno
- [ ] Verificar que gymbot-ia.vercel.app funciona end-to-end
- [ ] Configurar un número de WhatsApp de demo con 360Dialog

### MAÑANA (bloque de 2 horas)
- [ ] Contactar leads #1, #2, #3 por WhatsApp con mensajes de top10-leads.md
- [ ] Publicar post de lanzamiento en LinkedIn (texto en marketing-30days.md)
- [ ] Contactar leads #4, #5, #6

### DÍA 3
- [ ] Seguimiento a los que no respondieron
- [ ] Contactar leads #7, #8, #9, #10
- [ ] Agendar primeras demos de los interesados

---

## 9. Arquitectura del sistema

```
Dueño del gym → gymbot-ia.vercel.app/setup (configura su gymbot)
                       ↓
              Supabase (guarda gym + config)
                       ↓
    Cliente del gym → WhatsApp (número del gym)
                       ↓
         360Dialog API (enruta al webhook)
                       ↓
    gymbot-ia.vercel.app/api/webhook (serverless)
                       ↓
         Claude API (responde con contexto del gym)
                       ↓
         360Dialog → WhatsApp (respuesta al cliente)
                       ↓ (paralelo)
         Supabase (guarda conversación + leads)
                       ↓
         Make.com → Gmail (notificación al dueño)
```

---

## 10. Stack técnico completo

| Capa | Tecnología | Justificación |
|---|---|---|
| Frontend | Next.js 16 + TypeScript + Tailwind v4 | Velocidad de desarrollo + SSR |
| Hosting | Vercel | Free tier, deploy automático desde GitHub |
| DB | Supabase (PostgreSQL) | Multi-tenant, real-time, free tier generoso |
| IA | Claude claude-sonnet-4-6 | Mejor reasoning, respuestas naturales en español |
| WhatsApp | 360Dialog webhook | Solución más económica para WABA en LATAM |
| Automatización | Make.com | Para notificaciones Gmail sin código adicional |
| Branding | #0D0F0E / #A8FF3E / #F2F0EB / Inter | Identidad Nexora IA |

---

*Documento generado por el sistema de agentes de Nexora IA — Mayo 2026*
