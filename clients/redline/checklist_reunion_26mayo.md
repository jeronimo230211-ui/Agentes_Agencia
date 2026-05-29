# Reunión RedLine — Martes 26 Mayo 2026
## Checklist de verificación CRMinbox + infraestructura

---

## 🎯 Objetivo de la reunión
Verificar que CRMinbox tiene todo lo necesario para conectar el flujo:
**CRMinbox → Make.com → Claude IA → CRMinbox (respuesta al cliente)**

---

## ✅ PARTE 1 — Credenciales que RedLine debe tener listas

Pedir estos datos antes de arrancar cualquier prueba:

| # | Dato | Dónde encontrarlo en CRMinbox | Estado |
|---|------|-------------------------------|--------|
| 1 | **API Key** de CRMinbox | Configuración → API Keys o Integraciones | ⬜ |
| 2 | **Device ID** del número WhatsApp conectado | Configuración → Dispositivos / Canales | ⬜ |
| 3 | **Dominio/URL base** de su instancia CRMinbox | URL del panel (ej: app.crminbox.com o subdominio propio) | ⬜ |
| 4 | **Número WhatsApp** conectado al CRMinbox | Panel → Dispositivos | ⬜ |

> ⚠️ Sin estos 4 datos no se puede completar el escenario de Make.com

---

## ✅ PARTE 2 — La pregunta crítica de arquitectura

**Esta es la pregunta más importante de toda la reunión:**

> ¿CRMinbox puede enviar un webhook automáticamente cuando llega un mensaje nuevo de un cliente?

**Cómo verificarlo en CRMinbox:**
1. Ir a Configuración → Automatizaciones / Triggers / Peticiones HTTP
2. Buscar triggers del tipo: "Mensaje recibido", "Nueva conversación", "Mensaje entrante"
3. Ver si permite configurar una URL destino (webhook URL) para disparar cuando llega un mensaje

**Lo que significa cada respuesta:**

| Resultado | Arquitectura | Impacto |
|-----------|-------------|---------|
| ✅ SÍ tiene webhook inbound | CRMinbox maneja todo — entrada Y salida. Make.com se conecta directo. | Fase 1 arranca inmediatamente |
| ❌ NO tiene webhook inbound | CRMinbox solo para outbound. Necesitamos Chatwoot para recibir mensajes. | Fase 1 tarda 1-2 semanas más |

---

## ✅ PARTE 3 — Verificar la conexión WhatsApp

| Verificación | Pregunta a hacerle a RedLine | Estado |
|---|---|---|
| Tipo de conexión WA | ¿El número está conectado por QR code o por WhatsApp Business API oficial? | ⬜ |
| Estado del número | ¿El número está activo y sin ban? ¿Hace cuánto está conectado? | ⬜ |
| Volumen de mensajes | ¿Cuántos mensajes envían/reciben por día actualmente? | ⬜ |
| Multi-agente | ¿Varios agentes pueden ver y responder desde el mismo número? | ⬜ |

> 💡 Si usan QR code: hay riesgo de ban por WhatsApp. Ideal migrar a API oficial (360Dialog ~$5-10 USD/mes) pero no bloquea la Fase 1.

---

## ✅ PARTE 4 — Prueba en vivo (hacer en la reunión)

Si tienen los datos del Parte 1, hacer esta prueba en la reunión:

1. **Ir al escenario en Make.com** → ID: `5104244`
2. **Completar los 4 valores pendientes** en los módulos:
   - Módulo 2 (Claude API): reemplazar `REEMPLAZA_CLAUDE_API_KEY`
   - Módulo 4 (CRMinbox API): reemplazar `REEMPLAZA_DOMINIO`, `REEMPLAZA_DEVICE_ID`, `REEMPLAZA_CRMINBOX_API_KEY`
3. **Activar el escenario**
4. **Enviar un mensaje de prueba** al WhatsApp de RedLine desde otro número
5. Verificar que:
   - ⬜ Make.com recibe el webhook
   - ⬜ Claude responde con triage
   - ⬜ CRMinbox envía la respuesta al cliente

---

## ✅ PARTE 5 — Checklist técnico final antes de activar en producción

| Item | Descripción | Estado |
|---|---|---|
| Prompt de Claude | Definir instrucciones de triage para los técnicos de RedLine | ⬜ |
| Categorías de triage | Confirmar las 10 categorías ISP con RedLine (avería, visita, pago, etc.) | ⬜ |
| Mensaje de bienvenida | Texto del primer mensaje automático al cliente | ⬜ |
| Horario de atención | ¿El bot responde 24/7 o solo en horario laboral? | ⬜ |
| Escalamiento | ¿A qué número/agente se escala si el bot no puede resolver? | ⬜ |

---

## 📋 Resumen — Qué llevar a la reunión

- [ ] Acceso a Make.com (escenario ID `5104244` ya está construido)
- [ ] Webhook URL de Make.com: `https://hook.us2.make.com/2roc6wq8cxkuzw4ekqfblwyxwf438xwz`
- [ ] Claude API key de Nexora IA (para el Módulo 2)
- [ ] Este checklist impreso o en pantalla
- [ ] Un número de prueba para enviar el mensaje de verificación

---

## 🚦 Semáforo post-reunión

**Verde** → CRMinbox tiene webhook inbound + credenciales completas → activar en producción el mismo martes

**Amarillo** → CRMinbox solo outbound → instalar Chatwoot en servidor de RedLine (1-2 días adicionales)

**Rojo** → El número de WA está en riesgo de ban (QR code) → migrar a 360Dialog antes de activar
