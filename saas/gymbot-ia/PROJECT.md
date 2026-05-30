# GymBot IA — SaaS de automatización WhatsApp para gimnasios LATAM

**Estado:** En construcción  
**Fecha inicio:** 2026-05-29  
**Founder:** Jerónimo Álvarez — Nexora IA  
**URL producción:** https://gymbot-ia.vercel.app (pendiente deploy)  
**Repo:** github.com/jeronimo230211-ui/gymbot-ia

---

## Problema que resuelve

Los dueños y staff de gimnasios independientes en LATAM gastan 2–4 horas diarias respondiendo las mismas preguntas en WhatsApp: horarios, precios, clases, membresías. Cada mensaje sin respuesta en menos de 5 minutos es un lead perdido.

## Propuesta de valor

Bot de WhatsApp configurado en 24 horas, entrenado con el contexto del propio gimnasio (horarios, precios, clases), que:
- Responde automáticamente 24/7 en el tono del gimnasio
- Captura nombre y teléfono de leads interesados
- Notifica al dueño con resumen diario de conversaciones

## Segmento objetivo

Gimnasios independientes y estudios fitness en Colombia, Argentina y México. 5–50 empleados. Sin sistema de atención automatizado. Con WhatsApp Business activo.

---

## Stack técnico

| Capa | Tecnología |
|---|---|
| Frontend/App | Next.js 15 + TypeScript + Tailwind v4 + shadcn/ui |
| Hosting | Vercel |
| DB | Supabase (PostgreSQL, multi-tenant) |
| AI | Claude claude-sonnet-4-6 via Anthropic SDK |
| WhatsApp | 360Dialog webhook (credenciales propias del gym) |
| Notificaciones | Make.com + Gmail |
| Branding | #0D0F0E fondo, #A8FF3E acento, #F2F0EB texto, Inter 700/800 |

---

## Arquitectura

```
WhatsApp (cliente del gym)
    │ mensaje
    ▼
360Dialog API (proveedor del gym)
    │ POST webhook a /api/webhook
    ▼
Vercel serverless — route.ts
    │ valida firma, busca gym por número
    ▼
Claude claude-sonnet-4-6
    │ contexto: horarios/precios/clases del gym
    ▼
360Dialog API → respuesta al cliente
    │ (paralelo)
    ▼
Supabase → guarda conversación + lead si se captura info
    │
Make.com → Gmail: resumen diario al dueño
```

---

## Modelo de precios

| Plan | Setup | Mensual (USD) |
|---|---|---|
| Esencial | $150 | $79/mes |
| Pro | $150 | $149/mes |
| Piloto (primeros 5) | $0 | $49/mes |

---

## Supabase schema

```sql
gyms (id, name, slug, plan, whatsapp_number, webhook_url, api_token, config jsonb, active, created_at)
conversations (id, gym_id, from_number, messages jsonb, lead_captured, created_at)
leads (id, gym_id, name, phone, email, interest, created_at)
```

---

## Variables de entorno requeridas

```
ANTHROPIC_API_KEY
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_KEY
MAKE_WEBHOOK_URL
```

---

## Roadmap

- [x] Estructura del proyecto
- [ ] Schema Supabase
- [ ] Landing page
- [ ] Onboarding wizard
- [ ] Dashboard + leads + config
- [ ] API webhook + Claude proxy
- [ ] Deploy Vercel
- [ ] Top 10 leads contactados
