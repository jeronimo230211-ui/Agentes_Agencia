# Estrategia de Ventas — GymBot IA

**Fecha:** Mayo 2026  
**Objetivo:** 3 clientes pagando en 30 días. MRR inicial $147 USD.

---

## 1. Proceso de venta completo

### Primer contacto (WhatsApp)

Buscar en el pipeline los gimnasios con ALTA prioridad, sin sitio web, con teléfono.

**Mensaje de primer contacto:**
```
Hola [NOMBRE DEL GYM] 👋

Soy Jerónimo, de Nexora IA.

Vi en Google Maps que tienen excelentes reseñas en [CIUDAD]. ¿Cuántos mensajes de WhatsApp responden al día preguntando horarios, precios y clases?

Trabajamos con gimnasios en Medellín y Buenos Aires automatizando esa atención con IA. El resultado: el bot responde solo, captura los datos del cliente potencial y le avisa al dueño.

¿Tienen 15 minutos esta semana para ver cómo funciona en vivo?
```

**Si no responden en 48h — seguimiento:**
```
Hola [NOMBRE] 👋 Solo confirmar que vi su gym en Google Maps — tienen muy buenas reseñas. Les dejo el link de GymBot IA por si les sirve revisar en su tiempo: gymbot-ia.vercel.app

Si quieren una demo rápida esta semana, aquí estoy. Saludos 🙌
```

### Estructura del demo (20 min)

| Tiempo | Qué hacer |
|---|---|
| 0–5 min | Preguntar: "¿Cuánto tiempo al día pasan respondiendo WhatsApp?" Escuchar |
| 5–10 min | Demo en vivo: enviar mensaje al número de demo y mostrar respuesta automática |
| 10–15 min | Mostrar dashboard: leads capturados, conversaciones, tasa de respuesta |
| 15–20 min | Explicar setup: "En 24 h su gymbot está activo" → mostrar precios |

**Número de demo para la venta:** Configurar un número de WhatsApp con gymbot de muestra antes del demo.

### Propuesta post-demo (enviar por WhatsApp/email)

```
[NOMBRE], fue un gusto hablar.

Resumo lo que haríamos para [GYM]:

✅ GymBot IA configurado con sus horarios, precios y clases actuales
✅ Captura automática de leads interesados
✅ Panel de control con métricas en tiempo real
✅ Setup en menos de 24 horas

Inversión:
• Piloto (primeros 5 gyms): $49 USD/mes, setup gratis
• Después: $79/mes + $150 setup (precio normal)

Para empezar: completamos el formulario juntos en 10 min → https://gymbot-ia.vercel.app/setup

¿Arrancamos esta semana?
```

### Seguimiento post-demo (si no cierran en la llamada)

- **Día 1:** Propuesta por escrito (arriba)
- **Día 3:** "¿Pudieron revisar la propuesta? ¿Tienen alguna pregunta?"
- **Día 7:** "Quería avisarles que los cupos del plan Piloto ($49) son limitados a 5 gyms. Actualmente hay [N] disponibles."

---

## 2. Pricing definitivo

| Plan | Setup | Mensual | Para quién |
|---|---|---|---|
| Piloto | **$0** | **$49/mes** | Primeros 5 gimnasios (oferta de lanzamiento) |
| Esencial | $150 | $79/mes | Gyms establecidos que quieren el producto completo |
| Pro | $150 | $149/mes | Gyms con múltiples sucursales o que quieren reportes IA |

**Política de descuento:**
- Los primeros 5 gyms: setup gratis + $49/mes (descuento del 38% vs Esencial)
- Pago trimestral: 10% descuento en el mensual
- Referidos: 1 mes gratis por cada gym que traigan

---

## 3. KPIs de los primeros 90 días

| Métrica | Mes 1 | Mes 2 | Mes 3 |
|---|---|---|---|
| Gyms activos | 3 | 6–7 | 12–15 |
| MRR | $147 | $400 | $900 |
| Tasa de conversión (demo → cliente) | 30% | 35% | 40% |
| Churn máximo aceptable | 0% | < 15% | < 10% |
| Demos realizados | 10 | 15 | 20 |
| Outreach inicial | 30 contactos | 40 | 50 |

---

## 4. Objeciones y respuestas

| Objeción | Respuesta |
|---|---|
| "Ya tenemos personal para eso" | "Perfecto. GymBot no reemplaza a su equipo — lo libera. Esa persona puede enfocarse en cerrar ventas, no en copiar y pegar horarios." |
| "¿Y si el bot responde mal?" | "Usted controla exactamente qué dice el bot. Si en algún punto responde algo incorrecto, lo ajusta en segundos desde el panel. Y siempre puede ver cada conversación." |
| "Es muy caro" | "¿Cuánto vale una membresía en su gym? Con capturar 1 lead extra al mes que de otra manera se pierde, el bot ya se paga." |
| "Lo pensamos" | "Claro, tómense el tiempo. Mientras tanto, ¿me permiten hacer el setup gratis esta semana y ven cómo funciona 7 días antes de comprometerse a pagar?" |
| "No tenemos WhatsApp Business" | "No es obstáculo. Si tienen un número de WhatsApp, podemos trabajar con ese. Y crear WhatsApp Business tarda 10 minutos." |

---

## 5. Checklist de ventas antes del primer outreach

- [ ] Número de demo de GymBot activo (para mostrar en vivo)
- [ ] URL de producción de gymbot-ia.vercel.app funcionando
- [ ] Variables de entorno de Supabase y Claude API configuradas en Vercel
- [ ] Top 10 leads seleccionados (ver top10-leads.md)
- [ ] Cuenta de 360Dialog creada (para el gym de demo)
