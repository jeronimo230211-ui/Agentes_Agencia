# Lex Barbería — Agenda + asistente de WhatsApp con IA

**Estado:** Todas las fases núcleo (1-5) completas y probadas en producción (https://lexbarberia.vercel.app). Ver sección "Mejoras post-lanzamiento" abajo para lo agregado después del primer pase completo. Nota: `business_hours` sigue con el horario de prueba (martes-sábado 9am-1pm y 2pm-7pm) — Alex debe ajustarlo a su horario real desde Ajustes → Horarios.
**Fecha inicio:** 2026-09-26
**Founder:** Jerónimo Álvarez — Nexora IA
**Cliente:** Alex — Lex Barbería

---

## Qué resuelve

Alex (barbero, un solo local) hoy agenda y gestiona todo manualmente por WhatsApp. El objetivo es que un agente de IA conectado a su WhatsApp Business maneje **todo el ciclo de la cita** sin que Alex tenga que responder mensajes salvo excepciones reales:

1. Alex agenda él mismo desde el dashboard
2. Configura horarios (plantilla semanal + excepciones día a día o por bloques)
3. Puede crear citas periódicas fijas para un cliente (ej. "todos los viernes 2pm")
4. Cada cita se refleja automáticamente en su Google Calendar (Android)
5. El cliente recibe avisos por WhatsApp (confirmación, recordatorios)
6. Si Alex tiene una novedad (no puede atender), genera un mensaje y el sistema avisa a todos los clientes con cita afectada, ofreciendo reprogramar
7. Si un cliente cancela, el agente le ofrece automáticamente las próximas horas disponibles
8. Al reservar, el agente muestra los turnos realmente libres (cruce de horario, excepciones, citas ya tomadas y buffer)
9. Cancelación solo permitida hasta 24h antes de la cita
10. Alex solo interviene cuando el agente no puede resolver algo por sí solo

## Origen técnico

Este proyecto parte del motor construido para **GymBot IA** (`saas/gymbot-ia/`) — multi-proveedor de WhatsApp (360Dialog/Meta/Twilio), Claude como IA, Supabase multi-tenant — pero es un **proyecto de cliente independiente**, no un módulo de GymBot IA, porque el dominio (turnos, horarios, recurrencia, calendario) es completamente distinto al de captura de leads. Si más adelante se valida que este motor sirve para otros verticales de agendamiento (peluquerías, spas, clínicas), se productiza entonces — no antes.

## Decisiones de scope (confirmadas con Jerónimo — 2026-09-26)

- **Un solo barbero (Alex)** por ahora. El modelo de datos ya soporta N barberos sin cambios de schema.
- **WhatsApp Business API: pendiente de configurar desde cero.** Se recomienda 360Dialog (estándar de la agencia). Requiere: número dedicado que no esté en WhatsApp normal/Business App, cuenta Meta Business Manager verificada, alta en 360dialog.com.
- **Calendario: Google Calendar API vía OAuth** (Alex usa Android). Cada cita crea/actualiza/borra el evento automáticamente.

## Stack técnico

| Capa | Tecnología |
|---|---|
| Frontend/App | Next.js 16 + TypeScript + Tailwind v4 + shadcn/ui |
| Hosting | Vercel |
| DB | Supabase (PostgreSQL) |
| AI | Claude claude-sonnet-4-6, con tool-calling (no solo prompt estático) |
| WhatsApp | 360Dialog (por configurar) |
| Calendario | Google Calendar API (OAuth) |
| Branding | Fondo negro `#0a0a09`, dorado `#c9a24b`/`#e4c077`, texto crema `#f3ead8`, acentos barber pole rojo/azul |

## Roadmap

- [x] **Fase 1** — Schema Supabase (`db/migrations/001_schema.sql`) + motor de disponibilidad puro (`src/lib/scheduling.ts`), validado con pruebas de humo
- [x] **Fase 2** — Agente Claude con tool-calling (`src/lib/agent.ts` + `src/lib/booking-service.ts`):
  - `ver_disponibilidad`, `agendar_cita` (con reintento si el horario se ocupó justo antes), `cancelar_cita` (regla de 24h + ofrece alternativas al cancelar), `buscar_mis_citas`
  - Webhook multi-proveedor (`src/app/api/webhook/route.ts`) — 360Dialog / Meta / Twilio, portado y adaptado de GymBot IA
  - Endpoint de prueba `src/app/api/chat/route.ts` para probar el agente sin WhatsApp conectado
  - **Probado end-to-end contra Supabase real** (2026-09-26): disponibilidad, agendar, consultar, cancelar (bloqueado correctamente por la regla de 24h), anti-doble-reserva a nivel de agente y a nivel de constraint de base de datos (`23P01`). Datos de prueba limpiados después.
  - Pendiente de este alcance, movido a fases posteriores por ser acciones del dashboard/admin, no del cliente por WhatsApp: `crear_cita_recurrente` (punto 3) y el flujo de aviso masivo de novedad (punto 6)
- [x] **Fase 3** — Dashboard (`src/app/dashboard/*` + `src/app/api/dashboard/*`), probado end-to-end contra Supabase real:
  - `/dashboard` (Hoy) — lista de citas del día con navegación, marcar completada/no-show/cancelar, botón "+ Nueva cita" (una vez o recurrente)
  - `/dashboard/servicios` — CRUD de servicios (nombre, duración, precio, activo)
  - `/dashboard/horarios` — plantilla semanal (tramos por día, switch abierto/cerrado) + excepciones puntuales (cerrar uno o varios días seguidos)
  - `/dashboard/avisos` — aviso masivo de novedad (punto 6): marca las citas del rango como `pending_reschedule` y envía alternativas
  - `/dashboard/config` — dirección, saludo, ventana de cancelación, buffer
  - Faltante conocido: no hay autenticación todavía — cualquiera con la URL puede administrar. Antes de compartir el link con Alex hay que agregarle login (Fase 3.5, no bloquea seguir probando localmente)
- [x] **Fase 4** — Google Calendar (2026-09-27), probado end-to-end:
  - OAuth conectado desde Ajustes → Negocio (`/api/auth/google` + `/api/auth/google/callback`), tokens guardados en `business.google_calendar_tokens`
  - `src/lib/google-calendar.ts`: crea el evento al agendar (`syncAppointmentToCalendar`) y lo borra al cancelar (`removeAppointmentFromCalendar`) — wireado en el agente de WhatsApp y en el dashboard, best-effort (nunca tumba el flujo de la cita si Google falla)
  - Verificado contra la API real de Google: evento creado con hora/nombre correctos, evento marcado `cancelled` al cancelar la cita
  - **Nota:** la app de Google está en modo prueba (no verificada) — solo los correos agregados como "Test users" en el Google Cloud Console pueden conectar su calendario. Para producción real habría que pasar por verificación de Google o mantenerla en modo prueba con los test users necesarios (Alex, etc.)
  - Sync de citas recurrentes agregado y probado (2026-09-27): cada ocurrencia generada crea su propio evento en Google Calendar
- [x] **Autenticación del dashboard** (2026-09-27) — usuario de prueba único (env vars `DASHBOARD_USERNAME`/`DASHBOARD_PASSWORD` — valores en `.env.local` y en Vercel, no en el repo), cookie httpOnly vía `src/proxy.ts` (protege `/dashboard/*`, `/api/dashboard/*`, `/api/auth/google/*`), checkbox "Recordar mis datos" en `/login` (cookie de ~400 días + prefill del formulario vía localStorage). Probado end-to-end: redirect sin sesión, 401 en API sin cookie, login incorrecto/correcto.
  - **Nota Next.js 16:** el archivo se llama `proxy.ts`, no `middleware.ts` (convención renombrada en esta versión) — usar `crypto` de Node ahí falla en el Edge Runtime, por eso no se hashea el valor de la cookie.
- [x] **Vista "Hoy" — lista y calendario** (2026-09-27) — switch en la esquina superior derecha (ícono lista / ícono calendario), preferencia guardada en localStorage. La vista de calendario (`src/components/dashboard/day-timeline.tsx`) es una línea de tiempo vertical del día, escalada al horario real de ese día de la semana. **Pendiente de que el usuario confirme visualmente que se ve bien** — no se pudo verificar con captura de pantalla en esta sesión.
- [x] **Fase 5 (modo prueba)** — WhatsApp real funcionando end-to-end (2026-09-27) vía **Meta WhatsApp Cloud API — número de prueba gratuito** (no 360Dialog todavía, eso es para cuando haya número dedicado real de Alex):
  - App de Meta "Lexbarberia" (App ID `2159370564647735`), WABA ID `1659458532555394`, número de prueba `+1 555 182 5939`
  - Webhook conectado a `https://lexbarberia.vercel.app/api/webhook`, campo `messages` suscrito
  - **Gotcha encontrado y resuelto:** el WABA venía suscrito por defecto solo a la app interna de Meta ("WA DevX Webhook Events 1P App"), no a la nuestra — los mensajes reales nunca llegaban aunque todo lo demás estaba bien configurado. Se resolvió con `POST /{waba-id}/subscribed_apps` usando el access token de la app. Sin este paso, cualquier setup nuevo de WhatsApp Cloud API en esta agencia se va a topar con el mismo problema.
  - Probado con el número real de la mamá de Jerónimo (Android) como destinatario verificado — recibe y responde correctamente
  - **Token permanente configurado (2026-09-27).** El token temporal inicial (24h) causó una falla real: el agente respondía y guardaba en Supabase, pero WhatsApp nunca entregaba nada porque el token había vencido — sin error visible para el usuario. Se resolvió creando un **System User** en Meta Business Settings (`business.facebook.com/settings/system-users`, portfolio "Lex Barberia"): usuario `LexBarberia Bot`, rol Admin, con la app **Lexbarberia** y la **cuenta de WhatsApp** asignadas con control total, token generado con scopes `whatsapp_business_messaging` + `whatsapp_business_management`. Verificado con `GET /debug_token`: `expires_at: 0` (no vence). Confirmado con envío y recepción reales.
  - Pendiente para producción real: número dedicado propio de Alex (el actual sigue siendo el número de prueba gratuito) + decidir si se queda en Meta Cloud API o se migra a 360Dialog (estándar de la agencia)

## Mejoras post-lanzamiento (2026-09-27, encontradas probando con la mamá de Jerónimo)

- **Fix: disponibilidad no llegaba a días lejanos.** `ver_disponibilidad` devolvía los primeros N resultados en orden cronológico — con turnos cada 15 min, un solo día agotaba el límite antes de llegar a, por ejemplo, un sábado. Se agregó `maxResultsPerDay` en `scheduling.ts` (`computeAvailableSlots`) para repartir resultados entre varios días en vez de agotarse en el primero.
- **Memoria de cliente recurrente.** Al iniciar una conversación nueva, si el cliente ya tiene historial, el agente sabe su último servicio y le pregunta "¿lo mismo de la última vez?" (`getClientLastService` en `booking-service.ts`, inyectado en el system prompt solo al inicio de la conversación).
- **Tono paisa de Medellín**, no genérico latinoamericano — el system prompt ahora prohíbe explícitamente expresiones de otros países (ej. "te late" es mexicano) y da ejemplos concretos de habla de Medellín.
- **Lista de espera** (tabla nueva `waitlist`, migración `db/migrations/002_waitlist.sql` — el usuario la corrió manualmente en Supabase). Cuando un cliente pide un día sin cupo, el agente ofrece anotarlo (`anotarse_lista_espera`); cuando Alex abre ese horario (edita `business_hours`, borra una excepción) o se libera un cupo por cancelación, `checkWaitlistForBarber` avisa automáticamente por WhatsApp. Probado end-to-end: cerrar día → pedir cupo → anotarse → reabrir día → confirma aviso automático + `notifications_log`.
- **Token de WhatsApp permanente** — el temporal (24h) causó un fallo silencioso real: el agente respondía y guardaba todo bien, pero WhatsApp nunca entregaba nada porque el token había vencido, sin ningún error visible. Se resolvió con un System User en Meta Business Settings (ver detalle en la sección de Fase 5 arriba). Verificado con `debug_token`: `expires_at: 0`.
- **Vista "Hoy" rehecha como calendario semanal tipo Google Calendar** (`src/components/dashboard/week-calendar.tsx`, reemplaza el timeline de un solo día) — columnas = los 7 días de la semana (no personas, ya que solo hay un barbero), bloques de color sólido por servicio, con leyenda. Navegación por semana en esta vista, por día en la de lista.
- **Fix: doble-agendamiento cuando un cliente pedía cambiar de hora.** Encontrado en pruebas reales: un cliente confirmaba una cita y, en el mismo intercambio, pedía otra hora — el agente agendaba la nueva SIN cancelar la anterior, dejando dos citas activas. Ahora `agendar_cita` revisa si el cliente ya tiene una cita próxima antes de crear una nueva; si la tiene, no agenda todavía — le devuelve al agente la cita existente para que le pregunte al cliente si quiere cambiarla (cancelar + reagendar) o si de verdad quiere una cita adicional aparte (parámetro `confirmar_adicional`). Probado end-to-end replicando el caso real.
- **Fix: mensajes duplicados por reintento de WhatsApp.** Encontrado en pruebas reales: Meta reintenta la entrega del webhook si no responde lo bastante rápido, y el sistema procesaba el mismo mensaje dos veces (el agente respondía duplicado, y en el peor caso podía agendar dos veces). Se agregó idempotencia: tabla nueva `processed_webhook_messages` (migración `db/migrations/003_webhook_idempotency.sql`), el webhook descarta cualquier mensaje cuyo ID (`wamid`) ya se procesó. Probado enviando el mismo payload dos veces — el segundo se descarta en silencio.

## Correcciones de Alex (2026-09-29) — probadas en local, **pendiente de deploy**

1. **Saludo por nombre.** Herramienta nueva `guardar_nombre` (sobrescribe, por si el cliente corrige). Si no hay nombre guardado, el agente lo pregunta en el saludo usando el nombre de perfil de WhatsApp como pista ("¿hablo con Miguel?") — el webhook ahora lee `contacts[].profile.name` de Meta. **Conversaciones por sesión:** si el cliente lleva más de 6h sin escribir (`SESSION_GAP_HOURS`), su mensaje abre una conversación nueva (saludo + turnos otra vez) y al modelo solo le llegan los últimos 20 mensajes de la sesión — antes le llegaba TODO el historial del teléfono para siempre y el saludo solo pasaba una vez en la vida.
2. **Turnos en el saludo.** Al iniciar sesión se precalculan (`getGreetingSlots`) los turnos de hoy (hasta 5) o, si hoy ya no hay, el más cercano — calculados para el último servicio del cliente o el más corto. Se ofrecen como opciones + "Otro día". Excepción: si el primer mensaje ya es otra cosa (cancelar, una pregunta), no se le empujan turnos.
3. **Sin precios.** Fuera del prompt, de las respuestas de herramientas y del dashboard (Servicios). Si el cliente pregunta, "el valor se lo confirma Alex en la barbería". Los precios de prueba en la BD se pusieron en null (eran 15.000 / 10.000 / 25.000).
4. **Opciones tocables.** Herramienta `enviar_opciones` (termina el turno del agente). En Meta se envían como mensaje interactivo nativo: **botones** si son ≤3 opciones sin descripción, **lista** hasta 10; si Meta rechaza el interactivo, cae a texto "A. Corte / B. Barba". El historial guarda la versión en texto para que el agente entienda si el cliente responde "A". El webhook parsea `button_reply` / `list_reply`.
5. **Anticipación mínima de 2h para agendar Y cancelar**, editable en Ajustes → Negocio ("Anticipación mínima (horas)"). Reusa la columna `cancellation_window_hours` (sin migración). `agendar_cita` ahora valida la hora contra el motor (`isSlotAvailable`: anticipación, horario, grilla, que el servicio completo quepa) en vez de confiar en la hora que escribe el modelo.
6. **Turnos cada 30 min** (granularidad del motor 15→30). Duraciones en BD: Corte 30, Barba 30 (era 20), Corte + Barba 60 (era 45). En Servicios la duración ahora es un selector 30 min / 1 hora. **Duración por cliente: pendiente de decidir con Alex** (ver propuesta en la conversación del 2026-09-29).

Fixes encontrados de paso:
- El código local **no compilaba** (parser de audio a medio conectar: `ParsedMessage` era unión pero el webhook leía `.body`). Ahora una nota de voz recibe "no puedo escuchar notas de voz, ¿me lo escribe?" en vez de silencio. La transcripción sigue sin conectar.
- Fechas en **inglés** en mensajes a clientes ("Tuesday 30 de September") — faltaba `locale: es` en `formatInTimeZone`.
- El motor tomaba la fecha en UTC (zona del servidor) en vez de la del negocio — de 7pm a medianoche de Colombia "ya era mañana".
- La consulta de citas ocupadas cortaba en la hora exacta de `toDate`, pero el motor evalúa ese último día completo → podía ofrecer como libres horas ya tomadas del último día. La lista de espera además revisaba 2 días en vez de 1.
- Los turnos se le pasaban al modelo en ISO UTC pero `agendar_cita` espera hora local — ahora `fecha_hora` viene ya en hora local.

## Correcciones de Alex — ronda 2 (2026-09-30)

Objetivo de Alex: **el menor número de mensajes posible** por cita/cancelación/consulta.
- Tocar "Otro día" responde al instante con un texto fijo, sin pasar por el modelo (`OTHER_DAY_PROMPT`): "Indíqueme qué día y a qué hora le gustaría reservar su turno. Por ejemplo: *viernes 3 pm*".
- Toda lista que incluye "Otro día" lleva la nota "✍️ ¿Otro día? Escríbame directamente el día y la hora que prefiere" (`OTHER_DAY_HINT`), así el cliente se puede saltar el toque.
- Regla de "mínimos mensajes" en el prompt: sin confirmaciones extra; si el cliente escribe día + hora y está libre (y ya se sabe servicio + nombre), agenda de una. Probado: "A las 4 entonces" → agendada en un mensaje.

## Ronda 3 — tono y flujo sacados de chats reales (2026-09-30)

Análisis completo en `docs/ANALISIS_CHATS_ALEX.md` (3 chats, ~70 citas reales).
- Tono de Alex en el prompt: "Buenos días [nombre]...", "Si dale hoy a las 6 👍🏽💈", una línea, sin muletillas paisas inventadas. Saludo según hora del día (`timeOfDayGreeting`).
- Cliente frecuente: se usa su servicio de siempre sin preguntar (ningún cliente real dice el servicio). Cliente nuevo: sí se pregunta.
- `ver_disponibilidad` acepta `hora`: responde `hora_pedida_libre` + `mas_cercanas` ordenadas por cercanía. **Bug arreglado:** la consulta por día tenía tope de 9 turnos, así que los de la noche (los que más le piden a Alex) quedaban fuera y el agente decía "ocupado" cuando estaban libres.
- Confirmación incluye la política: "Si no puede venir, avíseme mínimo 2 horas antes 🙏". Sin hablar de cobros.
- Decisiones de Jerónimo: se mantienen las 2h para agendar (el "¿puedes llegar ya?" es esporádico) y para cancelar; la regla se refuerza con el aviso al agendar + un recordatorio automático (pendiente de construir).

## Recordatorios automáticos (2026-09-30)

- **Qué hace:** 3h antes de cada cita (editable en Ajustes → Negocio, `business.reminder_hours_before[0]`) le llega al cliente la plantilla `recordatorio_cita`: "Hola {nombre}, le recuerdo su cita hoy a las 6:00 pm en Lex Barbería 💈 Si no puede venir, por favor avíseme antes de las 4:00 pm…" con botones **Ahí estaré** (marca `confirmed_at`) y **No puedo ir** (cancela, borra del Calendar y avisa a la lista de espera). Los botones se resuelven con lógica fija en `src/lib/reminders.ts`, sin el modelo.
- **Por qué 3h y no 2h:** la ventana de cancelación es 2h; un recordatorio justo a las 2h llegaría cuando ya no se puede cancelar.
- **Reloj:** Supabase `pg_cron` + `pg_net` llaman `POST /api/cron/reminders` cada 15 min (Vercel Hobby solo permite crons diarios). Protegido con `CRON_SECRET` (header `Authorization: Bearer …`). Migración `db/migrations/004_reminders.sql` (con placeholder del secreto — nunca commitear el valor real).
- **Idempotente:** cada cita recibe máximo un recordatorio (`notifications_log`, tipo `reminder_2h` reusado porque el check de la BD solo admite esos tipos). Los fallos también se registran para no reintentar contra un error permanente.
- No se envía si la cita se agendó ya dentro de la ventana (acaba de recibir la confirmación).
- **Plantilla en Meta:** creada vía API el 2026-09-30 (id `1419686246191173`, categoría UTILITY, idioma `es`). Meta no acepta emojis en botones.
- **Seguridad (de paso):** `GET /api/dashboard/business` ya no le manda al navegador el token de WhatsApp ni los de Google.

## Variables de entorno requeridas (cuando se despliegue)

```
ANTHROPIC_API_KEY
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_KEY
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
CRON_SECRET
```
