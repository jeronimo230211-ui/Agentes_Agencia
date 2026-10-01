# Análisis de chats reales de Alex con clientes

Fuente para ajustar el tono y el flujo del agente. Se guardan solo patrones y frases genéricas — nunca los chats crudos (esos van en `docs/chats/`, fuera de git).

| # | Chat | Periodo | Citas pedidas |
|---|---|---|---|
| A | Cliente frecuente (vecino) | may–sep 2026 | 12 |
| B | Cliente frecuente | jun 2021 – sep 2026 | ~45 |
| C | Cliente frecuente | may–sep 2026 | ~15 |

## 1. Tono de Alex (consistente en los 3 chats y en 5 años)

- **Saludo por la hora del día + nombre + puntos suspensivos**, aunque el cliente diga "Hola": "Buenos días [nombre]…", "Buenas tardes…", "Buenas noches [nombre]…". A veces "Hola [nombre]…".
- **"Si dale"** es su frase central: "Si dale hoy a las 6 👍🏽💈", "Si dale mañana a las 6:30 💈👍🏽", "Si dale tranquilo".
- **Confirma en el mismo mensaje en que responde** — nunca pregunta "¿confirmo?". El cierre es siempre `👍🏽💈` (o `💈👍🏽`). "R 👍🏽💈" = recibido.
- **Una línea.** Cuando lista horas usa puntos suspensivos: "Tengo libre 7:30…8:00", "solo 3:00 & 3:30", "5:30 ó 6:30 a 9:00".
- Ocupado: "ya está ocupado…", "ese turno ya lo tengo ocupado…", "no me quedan turnos 😔".
- Sin cupo hoy: "Con gusto para mañana, ya ud me dice para qué hora".
- Cancelación/cambio del cliente: "dale no hay inconveniente 👍🏽💈", "Si dale tranquilo 💈👍🏽", "Ok tranquilo".
- Tú/usted/vos mezclados sin regla ("ya ud me dice", "bien y vos", "te queda fácil?").
- **No usa** "hágale pues", "de una", "quedamos así entonces", "parce" (1 vez en ~70 citas), ni exclamaciones.
- Mensajes masivos con formato fijo: aviso en mayúsculas + "NO ES NECESARIO RESPONDER ESTE MENSAJE 💈👍🏽".

## 2. Cómo se agenda

- **Ningún cliente menciona el servicio** en ~70 citas ("cita para motilarme", "cita", "turno"). Alex nunca pregunta "¿corte o barba?".
- La petición típica es **día + hora concreta en un solo mensaje**: "¿Tienes cita para hoy a las 6pm?" — o una franja: "tipo 9", "9 o 9:30", "las 5 más o menos", "temprano", "en la noche, después de las 6", "o alguna hora cercana".
- Respuesta de Alex:
  - Hora libre → "Si dale hoy a las 6 👍🏽💈" (**cita cerrada en 2 mensajes**).
  - Hora ocupada → propone **la más cercana** como pregunta ("ya está ocupado… 6:30 está bien?") o lista las libres de ese día.
  - Nada hoy → ofrece mañana / otro día.
- **Alex ya le pide a sus clientes lo mismo que pidió para el bot**: "Por favor déjeme un solo mensaje con el horario que desea" (ene 2026).
- Clientes piden dos cosas en un mensaje ("hoy 5:30 y sepárame el viernes tipo 5").

## 3. Datos del negocio

- **Horario real** (aviso de Alex, 2022): **lunes a viernes 2:00–10:00 PM, sábado 12:00–10:00 PM**, domingo cerrado. En 2026: "estaré hasta las 9 trabajando"; turnos reales a las 3, 3:30, 5:30, 6, 6:30, 7, 7:30, 8, 8:30, 9, 9:30 PM. Por la mañana no trabaja ("no tengo disponible temprano").
  → El horario de prueba cargado (9–1 y 2–7) es casi lo contrario del real.
- Grilla de 30 min confirmada (una excepción: 9:15 PM).
- **Cierra días por enfermedad, cirugía, festivos y viajes** y avisa a todos por difusión → coincide con la función "Avisos".
- **Vende productos** (cera para el cabello).
- Cobra por **transferencia** (Bancolombia) y lleva él mismo quién le debe.
- Tarda en responder hasta 2–3 horas.

## 4. Choques con las reglas actuales del bot (validar con Alex)

1. **Cancelación tardía** — 3 casos (cancela el mismo día, cambia para mañana, "no voy a alcanzar a llegar"): Alex **siempre** respondió "tranquilo, no hay inconveniente". El bot hoy diría "no puede cancelar con menos de 2h" y dejaría una cita fantasma.
2. **"¿Puedes llegar ya?"** — Alex ofrece turnos inmediatos; la anticipación de 2h para agendar lo impide.
3. **Pregunta de servicio** — Alex la pidió como ejemplo de opciones, pero en la práctica nunca la hace. Es un mensaje extra en cada cita.
4. **Recordatorios** — un cliente olvidó su cita ("qué pena la hora, se me había olvidado") y otro pidió "si se me olvida mañana me acordás". Un recordatorio automático evitaría huecos (requiere plantilla aprobada por Meta).
5. **Notas de voz** — clientes y Alex las usan en 2 de los 3 chats. Refuerza la propuesta de transcripción.
