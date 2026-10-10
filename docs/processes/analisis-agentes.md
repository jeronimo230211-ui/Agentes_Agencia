# Análisis de agentes — Nexora IA

> Octubre 2026. Qué agentes tiene la agencia, cuáles sobran, cuáles faltan y en qué orden construirlos.
> Los agentes viven en `C:\Users\Jeronimo\.claude\agents\` (nivel usuario: disponibles en todos los proyectos).

---

## 1. Cómo se trabaja realmente hoy

La agencia ya no es lo que dicen `AGENCY_CONTEXT.md` y los prompts de los agentes, que se escribieron en marzo:

| Lo que dicen los prompts | Lo que pasa en el repo |
|---|---|
| Un cliente (Davinchi) | 6 clientes (davinchi, europartners, lexbarberia, bracarli, gloria, redline) + 1 SaaS (GymBot IA) |
| Google Sheets es la base de datos principal | Los proyectos serios (Europartners, LexBarbería, GymBot) usan **Supabase** |
| HTML de un solo archivo | Next.js 16 + TypeScript + shadcn |
| Chat con Claude como proxy | **Agentes de WhatsApp con tool-calling** (LexBarbería: agendar, cancelar, lista de espera) |
| Make.com para notificaciones | Meta Cloud API directo, crons de Vercel, Google Calendar OAuth |
| Modelo `claude-sonnet-4-20250514` | Modelo desactualizado |

**Consecuencia:** los agentes de entrega (developer, data-analyst, qa) recomiendan por defecto un stack que ya no usas. Para que sirvan hay que actualizar sus prompts, no solo moverlos de carpeta.

La agencia vende en la práctica 3 cosas:
1. **Apps operativas a medida** (Europartners: proformas, catálogo, fichas técnicas)
2. **Agentes conversacionales de WhatsApp** (LexBarbería, GymBot): el producto con más potencial de repetirse
3. **Pipelines de contenido y datos** (fichas técnicas de 232 productos, migraciones de Excel)

---

## 2. Agentes actuales, uno por uno

| Agente | Veredicto | Motivo |
|---|---|---|
| `agency-orchestrator` | ✅ Mantener | Discovery y plan por fases al iniciar un proyecto. Bien definido. |
| `project-manager` | ✅ Mantener | Abrir y cerrar sesiones de trabajo, próximas 3 tareas. No se pisa con el orquestador: el orquestador arranca el proyecto, el PM lo mantiene vivo. |
| `agency-ceo` | ✅ Mantener (recién migrado) | Visión de negocio: prioridades, upsell, riesgos. Ya no tiene una línea base fija; lee el estado real del repo. |
| `agency-developer` | ⚠️ Actualizar | El prompt asume Sheets + HTML. Hay que cambiar el default a Next.js + Supabase y dejar Sheets para herramientas simples. |
| `ui-ux-designer` | ✅ Mantener | Es el único con memoria real acumulada (Davinchi). |
| `qa-tester-agencia` | ⚠️ Ampliar | Agregarle una **revisión de seguridad obligatoria** (ver sección 4). |
| `devops-ia-agency` | ✅ Mantener | Ya era global. Tiene memoria de Europartners. |
| `data-analyst` | ⚠️ Actualizar | Solo diseña en Sheets. Debe diseñar también esquemas Supabase (tablas, RLS, multi-tenant). |
| `sales-copywriter` | ✅ Mantener | Propuestas de proyectos a medida (modo A). |
| `marketing-specialist` | ✅ Mantener | Marca Nexora IA, LinkedIn, landing de la agencia. |
| `catalog-image-designer` | 🔁 Generalizar | Hoy solo cubre las fotos de Davinchi. Europartners necesita lo mismo y más (fichas, planos con cotas, contenido ES/EN). Convertirlo en `catalog-content-specialist`. |
| `gymbot-lead-scorer` | ✅ Mantener | Conecta con `prospecting/` (Apify). Es el paso 1 del embudo de GymBot. |
| `gymbot-sdr` | ✅ Mantener | Paso 2: primer contacto y agendar demo. |
| `gymbot-closer` | ✅ Mantener | Paso 3: demo, propuesta y cobro. |
| `gymbot-content` | ✅ Mantener | Inbound en IG/TikTok para GymBot. |

Sobre los 4 de GymBot: hoy tiene sentido que sean específicos, porque lanzar GymBot es prioridad. Si después sacas un segundo SaaS (por ejemplo, el motor de agendamiento de LexBarbería para otros verticales), **no dupliques los 4**. Conviértelos en `product-sdr`, `product-closer`, etc., que lean un archivo `PRODUCT_BRIEF.md` del producto con precios, demo y objeciones.

---

## 3. Agentes que faltan (en orden de prioridad)

### 🥇 1. `conversational-agent-engineer`: el más importante ✅ creado (10-oct-2026, `model: opus`)
**Por qué:** es lo que más vendes y repites (LexBarbería, GymBot y lo que viene), y ningún agente actual lo cubre. El developer sabe hacer APIs, pero no sabe diseñar un agente conversacional.
**Qué hace:**
- Diseña el system prompt del bot del cliente: tono (paisa, neutro, voseo), reglas y lo que nunca debe decir
- Define las herramientas del bot (`agendar_cita`, `ver_disponibilidad`…) con sus esquemas
- Escribe **casos de prueba conversacionales** (cliente que cambia de hora, mensaje duplicado, cliente grosero, pide algo fuera de alcance)
- Conoce los problemas típicos de Meta Cloud API: suscripción del WABA, ventana de 24h, plantillas, botones nativos
- Elige el modelo y controla el costo por conversación

**Memoria que debe acumular:** los bugs reales que ya encontraste (doble agendamiento, duplicados), para no repetirlos en el próximo cliente.

### 🥈 2. `security-reviewer` (o ampliar QA)
**Por qué:** manejas datos reales de clientes (teléfonos, citas, precios de Europartners), tokens permanentes de Meta y claves de Supabase.
**Ejemplo concreto ya en el repo:** `AGENCY_CONTEXT.md` (líneas 191-193) tiene las contraseñas de Davinchi en texto plano, y el patrón original guardaba usuarios en el frontend.
**Qué hace:** revisa RLS en Supabase, secretos en git, autenticación de dashboards, validación de webhooks (firma de Meta) y endpoints sin protección. Puede ser un agente aparte o una sección obligatoria dentro de `qa-tester-agencia`. Recomiendo agregarlo a QA para no multiplicar agentes.

### 🥉 3. `client-success`
**Por qué:** ya tienes clientes en producción que piden cambios (las rondas de correcciones de Alex). Hoy esas peticiones se mezclan con desarrollo nuevo y no hay un dueño del ciclo después de la entrega.
**Qué hace:**
- Convierte el feedback del cliente (WhatsApp, audios transcritos) en una lista clara de cambios
- Separa lo que entra en el alcance de lo que es upsell
- Redacta la guía de 1 página (`CLIENT_GUIDE.md`) y el material de capacitación
- Hace seguimiento del retainer mensual: qué se hizo en el mes y qué valor recibió el cliente

Es el agente que protege tu margen, porque evita que los cambios fuera de alcance se hagan gratis.

### 4. `catalog-content-specialist` (generaliza `catalog-image-designer`)
Fotos, fichas técnicas, extracción de datos de PDFs y Excels de fábrica y contenido bilingüe. Europartners ya pagó por este tipo de trabajo, y cualquier distribuidor lo va a necesitar.

### 5. Opcionales, todavía no
| Agente | Cuándo crearlo |
|---|---|
| `finance-billing` (facturas, cobros, MRR) | Cuando tengas más de 5 clientes con retainer mensual. Antes, el CEO lo cubre. |
| `productization-architect` (proyecto → plantilla white-label) | Cuando arranques en serio `templates/field-sales-os/`. Por ahora lo cubre el orquestador. |
| `english-market-sales` | Cuando salgas a vender fuera de LATAM. |

---

## 4. Problemas que afectan a todos los agentes

1. **El reporte a Agency OS no funciona.** `scripts/report-status.sh` devuelve **HTTP 404** (`agency-os-tau-coral.vercel.app/api/report-status`). Todos los agentes "reportan" y nada llega al panel. Hay que revivir el endpoint o quitar la regla obligatoria del CLAUDE.md.
2. **Stack desactualizado en los prompts** (sección 1). Es la causa más probable de que los agentes propongan soluciones que luego tienes que corregir.
3. **Todos usan `model: sonnet`.** Recomiendo:
   - `opus` para `agency-ceo`, `agency-orchestrator` y el futuro `conversational-agent-engineer` (decisiones caras de corregir)
   - `haiku` para `gymbot-lead-scorer` en lotes grandes (tarea mecánica, más rápida y barata)
   - `sonnet` para el resto
4. **La memoria de los agentes casi no se usa.** Solo `ui-ux-designer` y `devops` tienen recuerdos guardados. Los agentes con más valor si recuerdan son el conversational engineer (bugs de bots), el closer (qué objeciones aparecen) y el CEO (decisiones de precio).
5. **La carpeta `agents/` (legacy) ya no se usa.** Todo quedó en `~/.claude/agents/`. Conviene borrarla o archivarla para que no haya dos versiones de cada prompt.

---

## 5. Roster objetivo

```
DIRECCIÓN          agency-ceo · agency-orchestrator · project-manager
ENTREGA            agency-developer · conversational-agent-engineer (NUEVO)
                   ui-ux-designer · data-analyst (Sheets + Supabase)
                   qa-tester-agencia (+ seguridad) · devops-ia-agency
                   catalog-content-specialist (generalizado)
POST-VENTA         client-success (NUEVO)
CRECIMIENTO        sales-copywriter · marketing-specialist
GYMBOT IA          gymbot-lead-scorer → gymbot-sdr → gymbot-closer · gymbot-content
```

Son 16 agentes, 2 nuevos. Más que eso empieza a estorbar, porque Claude elige peor cuando hay muchos agentes con descripciones parecidas.

**Orden de ejecución sugerido:**
1. ~~Reporte automático~~ ✅ hook `SubagentStart/Stop` + log local `~/.claude/agency-activity.jsonl` (10-oct). Pendiente: redesplegar Agency OS (borrado de Vercel)
1b. ~~Skills de proceso~~ ✅ `/nuevo-cliente` y `/entrega-cliente` en `~/.claude/skills/` (10-oct)
2. ~~Crear `conversational-agent-engineer` con lo aprendido en LexBarbería~~ ✅
3. Actualizar el stack en `agency-developer` y `data-analyst`
4. Agregar la revisión de seguridad a QA y sacar las contraseñas de `AGENCY_CONTEXT.md`
5. Crear `client-success`
6. Generalizar `catalog-image-designer`
