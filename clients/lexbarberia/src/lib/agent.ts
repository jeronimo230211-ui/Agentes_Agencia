// Agente de WhatsApp con tool-calling: a diferencia de un chatbot de
// puro texto, Claude puede consultar y escribir citas reales en Supabase
// a través de estas herramientas. Esto es lo que permite que el cliente
// agende, cancele y reciba alternativas sin que Alex intervenga.

import Anthropic from "@anthropic-ai/sdk"
import { addDays } from "date-fns"
import { es } from "date-fns/locale"
import { formatInTimeZone, fromZonedTime } from "date-fns-tz"
import type { createServiceClient } from "./supabase"
import { removeAppointmentFromCalendar, syncAppointmentToCalendar } from "./google-calendar"
import {
  addToWaitlist,
  bookAppointment,
  cancelAppointment,
  checkWaitlistForBarber,
  findAvailableSlots,
  findClientByPhone,
  findOrCreateClient,
  getClientLastService,
  getClientUpcomingAppointments,
  getDayRanges,
  isSlotAvailable,
  updateClientName,
} from "./booking-service"
import type { AgentReply, ReplyOption } from "./whatsapp"
import type { Barber, Business, ChatMessage, Client, Service } from "@/types/scheduling"

type Db = ReturnType<typeof createServiceClient>

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export interface AgentContext {
  db: Db
  business: Business
  barber: Barber
  services: Service[]
  clientPhone: string
  /** Nombre del perfil de WhatsApp, si el proveedor lo envía — solo como pista, puede ser un apodo. */
  profileName?: string | null
}

const MAX_TOOL_ITERATIONS = 6
/** Si el cliente lleva más de este tiempo sin escribir, su próximo mensaje
 *  abre una conversación nueva: saludo por el nombre + turnos disponibles. */
const SESSION_GAP_HOURS = 6
/** Mensajes previos de la conversación en curso que se le pasan al modelo. */
const MAX_HISTORY_MESSAGES = 20
const MAX_OPTIONS = 10
const OTHER_DAY_TITLE = "Otro día"
/** Respuesta fija al tocar "Otro día": instantánea, sin pasar por el modelo,
 *  y pide día + hora juntos para resolver la cita en el menor número de mensajes. */
const OTHER_DAY_PROMPT = "Listo 👌 Indíqueme qué día y a qué hora le gustaría reservar su turno.\n\nPor ejemplo: *viernes 3 pm*"
/** Se agrega al final de toda lista con "Otro día", para que el cliente sepa que
 *  puede escribir directo el día y la hora sin tocar esa opción primero. */
const OTHER_DAY_HINT = "✍️ ¿Otro día? Escríbame directamente el día y la hora que prefiere."

/** WhatsApp usa *un asterisco* para negrita; el modelo a veces escribe **dos**
 *  (Markdown) y el cliente los ve literales. Se corrige en código, no solo en el prompt. */
function whatsappText(text: string): string {
  return text.replace(/\*\*(.+?)\*\*/g, "*$1*").trim()
}

/** El nombre de perfil lo escribe el cliente y va dentro del prompt: se deja solo
 *  letras, espacios y signos de nombre, para que no pueda colar instrucciones. */
function sanitizeProfileName(name: string | null | undefined): string | null {
  const clean = (name || "").replace(/[^\p{L}\p{M} .'-]/gu, "").replace(/\s+/g, " ").trim().slice(0, 40)
  return clean.length >= 2 ? clean : null
}

function isOtherDayChoice(message: string): boolean {
  const normalized = message.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase()
  return /^otro dia\b/.test(normalized)
}
const SLOT_FORMAT = "EEEE d 'de' MMMM, h:mm a"
const LOCAL_DATETIME = "yyyy-MM-dd HH:mm"

function formatSlot(date: Date, timezone: string): string {
  return formatInTimeZone(date, timezone, SLOT_FORMAT, { locale: es })
}

/** Slot tal como se le entrega al modelo: `fecha_hora` ya viene en hora local
 *  y en el mismo formato que espera agendar_cita, para que no tenga que convertir. */
function slotJson(date: Date, timezone: string) {
  return { fecha_hora: formatInTimeZone(date, timezone, LOCAL_DATETIME), texto: formatSlot(date, timezone) }
}

function resolveService(services: Service[], name: string): Service | null {
  const normalized = name.trim().toLowerCase()
  return (
    services.find((s) => s.name.toLowerCase() === normalized) ||
    services.find((s) => s.name.toLowerCase().includes(normalized) || normalized.includes(s.name.toLowerCase())) ||
    null
  )
}

// Sin precio a propósito: Alex maneja el valor de cada turno directamente.
function serviceList(services: Service[]): { nombre: string; duracion_minutos: number }[] {
  return services.map((s) => ({ nombre: s.name, duracion_minutos: s.duration_minutes }))
}

async function nextSlots(ctx: AgentContext, service: Service, fromDate?: Date) {
  const slots = await findAvailableSlots(ctx.db, {
    timezone: ctx.business.timezone,
    barberId: ctx.barber.id,
    service,
    bufferMinutes: ctx.business.buffer_minutes,
    minNoticeHours: ctx.business.cancellation_window_hours,
    fromDate,
    daysAhead: 7,
    maxResultsPerDay: 3,
    maxResults: 5,
  })
  return slots.map((s) => slotJson(s, ctx.business.timezone))
}

// ─── Definición de herramientas ────────────────────────────────────────────

const tools: Anthropic.Tool[] = [
  {
    name: "enviar_opciones",
    description:
      "Envía tu mensaje al cliente con opciones que puede tocar en WhatsApp (botones o lista) en vez de escribir. " +
      "Úsala SIEMPRE que le pidas elegir entre alternativas concretas: turnos, servicio, confirmar sí/no, cuál cita. " +
      "Termina tu turno: pon TODO el texto del mensaje en `mensaje` y úsala sola, como último paso, cuando ya tengas " +
      "los resultados de las demás herramientas. Las letras (A, B, C…) las agrega el sistema — no las escribas.",
    input_schema: {
      type: "object",
      properties: {
        mensaje: { type: "string", description: "Texto completo del mensaje que va encima de las opciones (saludo incluido si aplica)" },
        opciones: {
          type: "array",
          maxItems: MAX_OPTIONS,
          description: "Entre 1 y 10 opciones",
          items: {
            type: "object",
            properties: {
              titulo: { type: "string", description: "Corto, máximo 20 caracteres. Ej: 'Corte', 'Hoy 9:00 AM', 'Jue 2 oct 3:30 PM', 'Otro día'" },
              descripcion: { type: "string", description: "Opcional, detalle extra corto (máx 70 caracteres)" },
            },
            required: ["titulo"],
          },
        },
      },
      required: ["mensaje", "opciones"],
    },
  },
  {
    name: "guardar_nombre",
    description: "Guarda el nombre del cliente para saludarlo por su nombre en las próximas conversaciones. Úsala apenas el cliente te diga cómo se llama (o si corrige su nombre).",
    input_schema: {
      type: "object",
      properties: { nombre: { type: "string", description: "Nombre del cliente, como él lo dijo (ej. 'Miguel')" } },
      required: ["nombre"],
    },
  },
  {
    name: "ver_disponibilidad",
    description:
      "Consulta los horarios realmente disponibles para un servicio, cruzando el horario del negocio, excepciones " +
      "(días cerrados), citas ya tomadas y la anticipación mínima. Úsala siempre antes de ofrecer una hora — nunca " +
      "inventes disponibilidad. Si el cliente pide un día específico, pasa `fecha`; si además pide una hora (o franja), " +
      "pasa `hora` y la herramienta te dice si esa hora está libre y cuáles son las más cercanas, ordenadas por cercanía.",
    input_schema: {
      type: "object",
      properties: {
        servicio: { type: "string", description: "Nombre exacto del servicio, tal como aparece en la lista de servicios" },
        fecha: { type: "string", description: "Opcional. Día específico, formato 'YYYY-MM-DD'. Sin esto, busca los próximos días." },
        hora: { type: "string", description: "Opcional, solo con fecha. Hora pedida en formato 24h 'HH:mm' (ej. '18:00' para 6 pm; para 'tipo 9 o 9:30' de la noche usa '21:00')." },
      },
      required: ["servicio"],
    },
  },
  {
    name: "agendar_cita",
    description:
      "Agenda una cita para el cliente actual en un horario específico. Solo usar con un horario que haya salido de " +
      "ver_disponibilidad o de los turnos del saludo — si el horario ya no está libre, no respeta la anticipación mínima " +
      "o el servicio no cabe, la herramienta lo indica y ofrece alternativas. Si el cliente ya tiene una cita próxima, " +
      "la herramienta lo avisa en vez de agendar — en ese caso pregúntale si quiere CAMBIAR su cita existente (cancela " +
      "la anterior con cancelar_cita y agenda de nuevo) o si de verdad quiere una cita adicional aparte (en ese caso, " +
      "vuelve a llamar a esta herramienta con confirmar_adicional en true).",
    input_schema: {
      type: "object",
      properties: {
        servicio: { type: "string", description: "Nombre exacto del servicio" },
        fecha_hora: { type: "string", description: "Formato 'YYYY-MM-DD HH:mm', en hora local del negocio (usa el campo fecha_hora de los turnos)" },
        nombre_cliente: { type: "string", description: "Nombre del cliente, si lo ha dado o si es la primera vez que agenda" },
        confirmar_adicional: {
          type: "boolean",
          description: "Poner en true SOLO si el cliente ya confirmó explícitamente que quiere una cita adicional aparte de la que ya tiene",
        },
      },
      required: ["servicio", "fecha_hora"],
    },
  },
  {
    name: "buscar_mis_citas",
    description: "Lista las próximas citas confirmadas del cliente que está escribiendo.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "cancelar_cita",
    description:
      "Cancela una cita del cliente. Solo se puede cancelar con la anticipación mínima configurada (revisa la " +
      "política en las instrucciones). Si el cliente tiene más de una cita próxima, especifica fecha_hora para " +
      "indicar cuál — si no la sabes, primero usa buscar_mis_citas para preguntarle cuál.",
    input_schema: {
      type: "object",
      properties: {
        fecha_hora: { type: "string", description: "Formato 'YYYY-MM-DD HH:mm' de la cita a cancelar, si el cliente tiene más de una" },
        motivo: { type: "string", description: "Motivo de la cancelación, si el cliente lo menciona" },
      },
    },
  },
  {
    name: "anotarse_lista_espera",
    description:
      "Anota al cliente en la lista de espera para un día específico que hoy no tiene cupo (o está cerrado). " +
      "Cuando Alex abra ese día o se libere un cupo, se le avisa automáticamente por WhatsApp. Úsala solo después de " +
      "confirmar con ver_disponibilidad que de verdad no hay nada ese día — si ya hay cupo, agenda directo en vez de esto.",
    input_schema: {
      type: "object",
      properties: {
        servicio: { type: "string", description: "Nombre exacto del servicio" },
        fecha: { type: "string", description: "Fecha específica que el cliente quiere, formato 'YYYY-MM-DD'" },
        nombre_cliente: { type: "string", description: "Nombre del cliente, si lo ha dado" },
      },
      required: ["servicio", "fecha"],
    },
  },
]

// ─── Contexto de la conversación ────────────────────────────────────────────

interface GreetingSlots {
  serviceName: string
  today: boolean
  slots: { fecha_hora: string; texto: string }[]
}

export interface ConversationInfo {
  isNewConversation: boolean
  client: Client | null
  profileName?: string | null
  lastServiceName?: string | null
  upcoming?: { texto: string; fecha_hora: string; servicio: string }[]
  greetingSlots?: GreetingSlots | null
}

/** Turnos que el agente ofrece apenas saluda: los de hoy, o si hoy ya no hay,
 *  el más cercano. Se calculan antes de llamar al modelo para que el saludo
 *  salga en un solo paso, sin esperar una llamada extra a ver_disponibilidad. */
async function getGreetingSlots(ctx: AgentContext, lastServiceName: string | null): Promise<GreetingSlots | null> {
  const { business, services } = ctx
  const service =
    (lastServiceName && resolveService(services, lastServiceName)) ||
    [...services].sort((a, b) => a.duration_minutes - b.duration_minutes)[0]
  if (!service) return null

  const slots = await findAvailableSlots(ctx.db, {
    timezone: business.timezone,
    barberId: ctx.barber.id,
    service,
    bufferMinutes: business.buffer_minutes,
    minNoticeHours: business.cancellation_window_hours,
    daysAhead: 14,
    maxResultsPerDay: 5,
    maxResults: 5,
  })

  const todayStr = formatInTimeZone(new Date(), business.timezone, "yyyy-MM-dd")
  const todays = slots.filter((s) => formatInTimeZone(s, business.timezone, "yyyy-MM-dd") === todayStr)
  const chosen = todays.length > 0 ? todays : slots.slice(0, 1)

  return { serviceName: service.name, today: todays.length > 0, slots: chosen.map((s) => slotJson(s, business.timezone)) }
}

/** Separa la conversación en curso del historial viejo. El historial se guarda
 *  completo por teléfono; al modelo solo le llegan los mensajes recientes. */
function currentSession(history: ChatMessage[]): { recent: ChatMessage[]; isNew: boolean } {
  const last = history[history.length - 1]
  const isNew = !last || Date.now() - new Date(last.ts).getTime() > SESSION_GAP_HOURS * 60 * 60 * 1000
  if (isNew) return { recent: [], isNew: true }

  const recent = history.slice(-MAX_HISTORY_MESSAGES)
  // La conversación debe empezar con un mensaje del usuario. Si empieza con uno del
  // asistente (ej. el recordatorio automático), se antepone una nota en vez de
  // descartarlo — si no, el agente no sabría a qué responde el cliente.
  if (recent[0]?.role === "assistant") {
    recent.unshift({ role: "user", content: "[Inicio: el sistema le envió al cliente el siguiente mensaje automático]", ts: recent[0].ts })
  }
  return { recent, isNew: false }
}

// ─── System prompt ──────────────────────────────────────────────────────────

/** Alex saluda según la hora ("Buenos días…", "Buenas tardes…"), aunque el cliente diga "Hola". */
function timeOfDayGreeting(timezone: string): string {
  const hour = Number(formatInTimeZone(new Date(), timezone, "H"))
  if (hour < 12) return "Buenos días"
  if (hour < 18) return "Buenas tardes"
  return "Buenas noches"
}

function greetingSection(ctx: Omit<AgentContext, "db" | "clientPhone">, info: ConversationInfo): string {
  if (!info.isNewConversation) {
    return `CONVERSACIÓN EN CURSO: ya saludaste en esta conversación — no vuelvas a saludar, sigue donde iban.`
  }

  const nombre = info.client?.name
  const saludo = timeOfDayGreeting(ctx.business.timezone)
  const saludoNombre = nombre
    ? `Empieza con "${saludo} ${nombre}..." (así saluda ${ctx.barber.name}: hora del día + nombre + puntos suspensivos, aunque el cliente haya dicho "Hola").`
    : `NO sabes cómo se llama este cliente. Empieza con "${saludo}..." y pregúntale su nombre en ese mismo mensaje${
        info.profileName ? ` — su perfil de WhatsApp dice "${info.profileName}"; si parece un nombre real, puedes preguntar "¿hablo con ${info.profileName}?"` : ""
      }. Apenas te lo diga, guárdalo con guardar_nombre. Si le preguntaste "¿hablo con X?" y siguió la conversación sin corregirte, asume que se llama X y guárdalo con guardar_nombre — NO le vuelvas a preguntar el nombre.`

  const gs = info.greetingSlots
  let turnos: string
  if (!gs || gs.slots.length === 0) {
    turnos = `No hay turnos libres en los próximos 14 días. Después del saludo pregúntale para qué día necesita el turno (y ofrécele la lista de espera si ese día no hay cupo).`
  } else {
    const lista = gs.slots.map((s) => `  - ${s.texto} → fecha_hora "${s.fecha_hora}"`).join("\n")
    turnos = gs.today
      ? `Turnos disponibles para HOY (calculados para "${gs.serviceName}"):\n${lista}\nInmediatamente después del saludo dile algo como "Para hoy tengo estos turnos disponibles:" y ofrécelos como opciones, más una última opción "Otro día".`
      : `Hoy ya no quedan turnos. El más cercano (calculado para "${gs.serviceName}"):\n${lista}\nInmediatamente después del saludo dile algo como "Para hoy ya no me quedan turnos, el más cercano es el …" y ofrécelo como opción, más una opción "Otro día".`
  }

  const citaProxima = info.upcoming?.length ? `\n- Este cliente ya tiene cita (ver CITAS AGENDADAS). Recuérdasela en una línea después del saludo.` : ""

  return `INICIO DE CONVERSACIÓN — este es el primer mensaje de una conversación nueva. Tu respuesta debe:
- ${saludoNombre}
- ${turnos}
- Al final de las opciones de turnos va siempre "${OTHER_DAY_TITLE}" (el sistema le agrega al cliente la nota de que puede escribir directo el día y la hora).${citaProxima}
- Excepción (es lo MÁS común): si el primer mensaje ya dice qué día/hora quiere ("¿tienes cita para hoy a las 6pm?") o es otra cosa (cancelar, una pregunta), salúdalo igual y resuelve eso directo en ese mismo mensaje, sin ofrecerle los turnos de arriba.
- Estilo del saludo configurado por ${ctx.barber.name} (úsalo como referencia de tono, no lo copies literal): "${ctx.business.greeting}"`
}

export function buildSystemPrompt(ctx: Omit<AgentContext, "db" | "clientPhone">, info: ConversationInfo): string {
  const { business, services, barber } = ctx
  const nowLocal = formatInTimeZone(new Date(), business.timezone, "EEEE d 'de' MMMM 'de' yyyy, h:mm a", { locale: es })
  const todayIso = formatInTimeZone(new Date(), business.timezone, "yyyy-MM-dd")
  const serviciosTexto = services.map((s) => `- ${s.name} (${s.duration_minutes} min)`).join("\n")

  // El nombre del perfil va en TODOS los mensajes, no solo en el saludo: si no, en el
  // segundo mensaje el agente olvida que preguntó "¿hablo con X?" y vuelve a pedir el nombre.
  const clienteTexto = info.client?.name
    ? `Se llama ${info.client.name}.`
    : info.profileName
      ? `Todavía no tenemos su nombre guardado. Su perfil de WhatsApp dice "${info.profileName}": si le preguntaste "¿hablo con ${info.profileName}?" y no te corrigió, ES su nombre — guárdalo con guardar_nombre y úsalo, NUNCA le preguntes el nombre.`
      : "Todavía no sabemos su nombre."
  const recurrenteTexto = info.lastServiceName
    ? ` Su servicio de siempre es "${info.lastServiceName}" — úsalo sin preguntar, salvo que pida otra cosa.`
    : ""

  return `Eres el asistente de WhatsApp de ${business.name}. Atiendes a los clientes de forma amigable y cercana, con acento **paisa de Medellín** — no genérico latinoamericano ni de otro país.

CÓMO HABLAR — escribes como ${barber.name}, sacado de sus chats reales con clientes:
- Mensajes de UNA línea, sobrios y amables. Nada de relleno, exclamaciones ni entusiasmo exagerado.
- Su frase central es "Si dale": "Si dale hoy a las 6 👍🏽💈", "Si dale mañana a las 6:30 💈👍🏽".
- Cierra cada cita confirmada con 👍🏽💈 — es su firma. Fuera de eso, casi sin emojis.
- Usa puntos suspensivos para separar ideas o listar horas: "Buenos días [nombre]... ya está ocupado... 6:30 está bien?", "Tengo libre 7:30...8:00".
- Si no hay: "ya está ocupado...", "no me quedan turnos 😔". Si el cliente cancela o cambia: "Si dale tranquilo 👍🏽💈", "dale no hay inconveniente".
- Sin cupo hoy: "Con gusto para mañana, ya ud me dice para qué hora".
- Mezcla tú y usted con naturalidad. NO uses "hágale pues", "de una", "quedamos así entonces", "parce" ni expresiones de otros países.

Ejemplos reales del estilo de ${barber.name} (cliente → respuesta):
- "¿Tienes cita para hoy a las 6pm?" → "Buenos días [nombre]... si dale hoy a las 6 👍🏽💈"
- "¿Tienes cita para hoy a las 6pm?" (ocupado) → "Buenos días [nombre]... ya está ocupado... 6:30 está bien?"
- "¿Tienes para hoy tipo 9 o 9:30?" → "Hola [nombre]... si dale a las 9 👍🏽💈"
- "No voy a poder ir hoy, ¿la movemos para mañana a la misma hora?" → "Si dale tranquilo 👍🏽💈"

FECHA Y HORA ACTUAL: ${nowLocal} (hoy es ${todayIso}, zona horaria ${business.timezone})

INFORMACIÓN DEL NEGOCIO:
- Nombre: ${business.name}
- Dirección: ${business.address || "No especificada"}
- Servicios:
${serviciosTexto}
- Anticipación mínima: solo se puede AGENDAR o CANCELAR una cita con al menos ${business.cancellation_window_hours} horas de anticipación. Los turnos que te dan las herramientas ya respetan esto. Si el cliente pide cancelar con menos tiempo, explícale la política con amabilidad y dile que si es una urgencia real puede escribirle o llamar directamente a ${barber.name}. NUNCA digas que tú le vas a avisar a ${barber.name}: el sistema no le avisa.
- Si la hora pedida no está libre, ver_disponibilidad trae "motivo": si es "fuera_de_horario" di que a esa hora no se atiende (con el horario del día), NO que "está ocupado".

CLIENTE: ${clienteTexto}${recurrenteTexto}

CITAS AGENDADAS DE ESTE CLIENTE (fuente de verdad, sacada de la base de datos en este momento):
${info.upcoming?.length ? info.upcoming.map((u) => `- ${u.servicio}: ${u.texto} (fecha_hora "${u.fecha_hora}") — YA CONFIRMADA`).join("\n") : "- Ninguna."}
Si una cita aparece aquí, ya quedó agendada: no la vuelvas a agendar ni digas que ese turno está "ocupado" — está ocupado por el mismo cliente.

${greetingSection(ctx, info)}

OPCIONES (muy importante — ${barber.name} quiere que el cliente pueda tocar en vez de escribir):
- Cada vez que le pidas al cliente elegir entre alternativas concretas (turnos, servicio, sí/no, cuál cita), usa enviar_opciones en vez de escribir la lista en el texto.
- Servicio: en los chats reales NINGÚN cliente dice el servicio y ${barber.name} nunca lo pregunta. Si el cliente ya vino antes, usa su servicio de siempre SIN preguntar (menciónalo en la confirmación para que pueda corregir). Solo a un cliente nuevo pregúntale "¿Qué servicio deseas para tu turno?" con una opción por servicio, SIN descripción (solo el nombre: así WhatsApp los muestra como botones directos de un toque).
- Turnos: títulos cortos tipo "Hoy 9:00 AM" o "Jue 2 oct 3:30 PM". Máximo 9 turnos + "${OTHER_DAY_TITLE}" (escrito exactamente así, siempre de último).
- En el historial vas a ver las opciones escritas como "A. Corte" — así las vio el cliente. Si responde con una letra ("A", "b"), un número o el texto de la opción, interprétalo según las opciones de tu último mensaje. Tú siempre usa enviar_opciones.

CÓMO TRABAJAR:
1. Usa SIEMPRE las herramientas para consultar disponibilidad, agendar, cancelar o ver citas — nunca inventes horarios ni confirmes una cita sin haber llamado a agendar_cita.
2. Para agendar necesitas: día y hora, servicio y nombre del cliente. Pide TODO lo que falte en UN solo mensaje (ej. "¿Qué servicio desea y a nombre de quién lo agendo?" con las opciones de servicio) y agenda apenas lo tengas todo.
   CIERRE: si el cliente solo agradece, se despide o confirma algo que ya quedó ("gracias", "listo", "ok", "nos vemos"), responde en una línea ("Con gusto [nombre] 👍🏽💈") y NO llames ninguna herramienta.
   MÍNIMOS MENSAJES (${barber.name} lo pidió explícitamente): cada mensaje tuyo debe resolver o pedir lo que falta, nada más. No pidas confirmaciones extra ("¿seguro?", "¿confirmo?"), no repitas información que el cliente ya dio y no hagas preguntas de relleno.
   Cuando el cliente escriba un día y hora (ej. "viernes 3 pm", "hoy tipo 9", "las 5 más o menos"), consulta ver_disponibilidad con esa fecha Y la hora (parámetro hora):
   - Si esa hora está libre (o, si dio dos opciones "9 o 9:30", la primera libre) y ya sabes servicio y nombre → agenda DE UNA y responde: "Si dale hoy a las 6 👍🏽💈" + en una segunda línea corta el recordatorio de la política: "Si no puede venir, avíseme mínimo ${business.cancellation_window_hours} horas antes 🙏". Eso es todo: la cita queda cerrada en 2 mensajes.
   - Si está ocupada → dilo y propone LA hora libre más cercana como pregunta ("ya está ocupado... 6:30 está bien?"), con las demás libres de ese día como opciones (la más cercana primero).
   - Franjas: "en la noche" = desde las 6 pm, "temprano" = lo primero del día, "después de las X" = desde X en adelante.
   - Si pide dos cosas en un mensaje (ej. "hoy 5:30 y el viernes tipo 5"), resuelve las dos.
3. Si el cliente pide un día específico, usa ver_disponibilidad con ese día (fecha 'YYYY-MM-DD'). Escribe las horas en formato natural (ej. "viernes 2 de octubre a las 2:00 PM"), nunca en formato técnico.
4. PRECIOS: NUNCA menciones precios ni valores, ni aunque el cliente pregunte. Si pregunta cuánto cuesta, dile con amabilidad que el valor se lo confirma ${barber.name} directamente en la barbería.
5. Si al cancelar o agendar la herramienta dice que no cumple la anticipación mínima, explica la política con calidez, sin ceder — y ofrece alternativas. Nunca hables de cobros ni multas: la idea es recordar la regla, no castigar.
6. Cuando canceles una cita exitosamente, ofrece de inmediato horarios alternativos para reprogramar (con opciones).
7. Mantén las respuestas cortas (máximo 3-4 líneas). WhatsApp no es email. Usa emojis con moderación 💈. Para negrita usa *un asterisco* (formato de WhatsApp), nunca **dos**.
8. Si la solicitud está fuera de tu alcance (quejas serias, algo que ninguna herramienta resuelve), dile con honestidad que eso no lo puedes resolver por aquí y que lo hable directamente con ${barber.name} — NO prometas que ${barber.name} le va a escribir (nadie le avisa) y no inventes una solución.
9. NO reveles detalles técnicos (IDs, nombres de tablas, errores de sistema) — tradúcelos siempre a lenguaje humano. No narres lo que vas a hacer ("voy a verificar…", "déjame revisar…"): responde directo con el resultado, hablándole al cliente (no "la cita de Juan", sino "su cita").
10. Si el día que pide no tiene cupo, ofrécele los más cercanos o anotarse en la lista de espera con anotarse_lista_espera — le avisamos automáticamente por WhatsApp si se abre un cupo ese día. No lo anotes sin que esté de acuerdo.
11. Si el cliente pide un horario nuevo justo después de ya tener una cita agendada, lo más probable es que quiera CAMBIAR su cita, no tener dos. agendar_cita te va a avisar si ya tiene una próxima — en ese caso pregúntale antes de asumir nada.`
}

// ─── Ejecución de herramientas ──────────────────────────────────────────────

async function executeTool(name: string, input: Record<string, unknown>, ctx: AgentContext): Promise<Record<string, unknown>> {
  const { db, business, barber, services, clientPhone } = ctx
  const noticeHours = business.cancellation_window_hours

  try {
    switch (name) {
      case "guardar_nombre": {
        const nombre = String(input.nombre || "").trim()
        if (!nombre || nombre.length > 60) return { error: "nombre_invalido" }
        await updateClientName(db, business.id, clientPhone, nombre)
        return { guardado: true, nombre }
      }

      case "ver_disponibilidad": {
        const service = resolveService(services, String(input.servicio || ""))
        if (!service) return { error: "servicio_no_encontrado", servicios_disponibles: serviceList(services) }

        const baseParams = {
          timezone: business.timezone,
          barberId: barber.id,
          service,
          bufferMinutes: business.buffer_minutes,
          minNoticeHours: noticeHours,
        }

        if (input.fecha) {
          const fecha = String(input.fecha)
          if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return { error: "formato_fecha_invalido" }
          const fromDate = fromZonedTime(`${fecha}T00:00:00`, business.timezone)
          const fechaTexto = formatInTimeZone(fromDate, business.timezone, "EEEE d 'de' MMMM", { locale: es })

          // Sin tope: un día tiene a lo sumo ~25 turnos de 30 min. Con tope, los turnos de la
          // noche (los que más le piden a Alex) quedaban por fuera y el agente creía que estaban ocupados.
          const slots = await findAvailableSlots(db, { ...baseParams, fromDate, daysAhead: 0 })

          if (slots.length > 0 && input.hora) {
            const hora = String(input.hora)
            if (!/^\d{1,2}:\d{2}$/.test(hora)) return { error: "formato_hora_invalido" }
            const requested = fromZonedTime(`${fecha}T${hora.padStart(5, "0")}:00`, business.timezone).getTime()
            const libre = slots.some((s) => s.getTime() === requested)
            const cercanas = [...slots]
              .filter((s) => s.getTime() !== requested)
              .sort((a, b) => Math.abs(a.getTime() - requested) - Math.abs(b.getTime() - requested))
              .slice(0, 6)
            // Distinguir "ocupada" de "fuera de horario": antes, a quien pedía las 8 am
            // el agente le decía "ya está ocupado" cuando Alex simplemente no trabaja a esa hora.
            const horaNorm = hora.padStart(5, "0")
            const ranges = await getDayRanges(db, barber.id, fecha)
            const enHorario = ranges.some((r) => horaNorm >= r.start && horaNorm < r.end)
            return {
              fecha: fechaTexto,
              hora_pedida_libre: libre,
              ...(libre ? { hora_pedida: slotJson(new Date(requested), business.timezone) } : { motivo: enHorario ? "ocupada" : "fuera_de_horario" }),
              horario_del_dia: ranges.map((r) => `${r.start} a ${r.end}`).join(" y "),
              mas_cercanas: cercanas.map((s) => slotJson(s, business.timezone)),
            }
          }

          if (slots.length > 0) return { fecha: fechaTexto, disponibilidad: slots.map((s) => slotJson(s, business.timezone)) }

          return {
            fecha: fechaTexto,
            disponibilidad: [],
            mensaje: "Ese día no hay turnos libres (lleno, cerrado, ya pasó o no cumple la anticipación mínima). Díselo al cliente y ofrécele los más cercanos (proximos_disponibles) o anotarse en lista de espera para ese día.",
            proximos_disponibles: await nextSlots(ctx, service, addDays(fromDate, 1)),
          }
        }

        const daysAhead = 14
        const slots = await findAvailableSlots(db, {
          ...baseParams,
          daysAhead,
          maxResultsPerDay: 3, // reparte los resultados entre varios días — si no, un solo día con muchos turnos agota el límite
          maxResults: 20,
        })

        const searchLimitTexto = formatInTimeZone(addDays(new Date(), daysAhead), business.timezone, "EEEE d 'de' MMMM", { locale: es })

        if (slots.length === 0) {
          return {
            disponibilidad: [],
            mensaje: `No encontré horarios libres entre hoy y el ${searchLimitTexto} para este servicio — NO es que el negocio esté cerrado, es el límite de cuánto puedo mirar hacia adelante. Dile esto al cliente honestamente y ofrécele la lista de espera si quiere una fecha específica en ese rango, o que pregunte de nuevo más adelante para fechas posteriores.`,
          }
        }
        return { disponibilidad: slots.map((s) => slotJson(s, business.timezone)), busque_hasta: searchLimitTexto }
      }

      case "agendar_cita": {
        const service = resolveService(services, String(input.servicio || ""))
        if (!service) return { error: "servicio_no_encontrado", servicios_disponibles: serviceList(services) }

        const fechaHora = String(input.fecha_hora || "")
        let startsAt: Date
        try {
          startsAt = fromZonedTime(`${fechaHora.replace(" ", "T")}:00`, business.timezone)
        } catch {
          return { error: "formato_fecha_invalido" }
        }
        if (Number.isNaN(startsAt.getTime())) return { error: "formato_fecha_invalido" }

        // Si el cliente ya tiene una cita confirmada a esa misma hora, el turno no está
        // "ocupado": es suyo. Se responde como confirmada en vez de error.
        const existingClient = await findClientByPhone(db, business.id, clientPhone)
        if (existingClient) {
          const own = (await getClientUpcomingAppointments(db, business.id, existingClient.id)).find(
            (a) => new Date(a.starts_at).getTime() === startsAt.getTime()
          )
          if (own) {
            return {
              ya_estaba_agendada: true,
              servicio: own.services?.name,
              fecha_hora_texto: formatSlot(startsAt, business.timezone),
              mensaje: "Esta cita YA estaba agendada para este cliente — no se creó otra. No le digas que está ocupado; si solo estaba agradeciendo, responde corto.",
            }
          }
        }

        // Validar la hora contra el motor de disponibilidad en vez de confiar en
        // lo que escribió el modelo: anticipación mínima, horario, grilla de 30
        // min y que el servicio completo quepa (un servicio de 1 hora necesita dos turnos seguidos).
        if (startsAt.getTime() < Date.now() + noticeHours * 60 * 60 * 1000) {
          return {
            error: "sin_anticipacion_minima",
            horas_minimas: noticeHours,
            mensaje: `NO se agendó: solo se puede agendar con mínimo ${noticeHours} horas de anticipación. Explícaselo al cliente con amabilidad y ofrécele las alternativas.`,
            alternativas: await nextSlots(ctx, service),
          }
        }
        const available = await isSlotAvailable(db, {
          timezone: business.timezone,
          barberId: barber.id,
          service,
          bufferMinutes: business.buffer_minutes,
          minNoticeHours: noticeHours,
          startsAt,
        })
        if (!available) {
          return {
            error: "horario_no_disponible",
            mensaje: `NO se agendó: ese horario no está disponible para ${service.name} (ya está ocupado, está fuera del horario, o el servicio no alcanza a caber). Ofrécele las alternativas.`,
            alternativas: await nextSlots(ctx, service),
          }
        }

        const client = await findOrCreateClient(db, business.id, clientPhone, (input.nombre_cliente as string) || null)

        if (!input.confirmar_adicional) {
          const existing = await getClientUpcomingAppointments(db, business.id, client.id)
          if (existing.length > 0) {
            return {
              requiere_confirmacion: true,
              cita_existente: existing.map((a) => ({ fecha_hora_texto: formatSlot(new Date(a.starts_at), business.timezone), servicio: a.services?.name })),
              mensaje:
                "El cliente ya tiene una cita próxima confirmada (ver cita_existente) — NO se agendó todavía. Pregúntale si quiere cambiar su cita existente a este nuevo horario (si dice que sí, cancela la anterior con cancelar_cita y luego llama de nuevo a agendar_cita) o si de verdad quiere una cita adicional aparte (si confirma que sí, llama de nuevo a agendar_cita con confirmar_adicional en true).",
            }
          }
        }

        const result = await bookAppointment(db, {
          businessId: business.id,
          barberId: barber.id,
          service,
          clientId: client.id,
          startsAt,
          source: "whatsapp",
        })

        if (!result.ok) {
          return { error: "horario_ya_tomado", alternativas: await nextSlots(ctx, service) }
        }

        await syncAppointmentToCalendar(db, business, barber, result.appointment, service, client)

        return {
          confirmado: true,
          servicio: service.name,
          fecha_hora_texto: formatSlot(startsAt, business.timezone),
        }
      }

      case "buscar_mis_citas": {
        const client = await findClientByPhone(db, business.id, clientPhone)
        if (!client) return { citas: [] }
        const appointments = await getClientUpcomingAppointments(db, business.id, client.id)
        return {
          citas: appointments.map((a) => ({
            fecha_hora: formatInTimeZone(new Date(a.starts_at), business.timezone, LOCAL_DATETIME),
            texto: formatSlot(new Date(a.starts_at), business.timezone),
            servicio: a.services?.name || "",
          })),
        }
      }

      case "cancelar_cita": {
        const client = await findClientByPhone(db, business.id, clientPhone)
        if (!client) return { error: "sin_citas" }
        const appointments = await getClientUpcomingAppointments(db, business.id, client.id)
        if (appointments.length === 0) return { error: "sin_citas" }

        const citasJson = () =>
          appointments.map((a) => ({
            fecha_hora: formatInTimeZone(new Date(a.starts_at), business.timezone, LOCAL_DATETIME),
            texto: formatSlot(new Date(a.starts_at), business.timezone),
            servicio: a.services?.name,
          }))

        let target = appointments[0]
        if (input.fecha_hora) {
          const target_ = appointments.find(
            (a) => formatInTimeZone(new Date(a.starts_at), business.timezone, LOCAL_DATETIME) === String(input.fecha_hora)
          )
          if (!target_) return { error: "cita_no_encontrada", citas: citasJson() }
          target = target_
        } else if (appointments.length > 1) {
          return { error: "ambiguo_multiples_citas", citas: citasJson() }
        }

        const result = await cancelAppointment(db, target.id, new Date(), noticeHours, input.motivo as string | undefined)
        if (!result.ok) {
          if (result.reason === "too_late") {
            return { error: "fuera_de_ventana_cancelacion", horas_requeridas: result.windowHours, fecha_hora_cita: formatSlot(new Date(result.startsAt), business.timezone) }
          }
          return { error: "cita_no_encontrada" }
        }

        await removeAppointmentFromCalendar(db, business, barber, result.appointment)
        // Se liberó un cupo — avisar a quien lo esperaba. Se espera (no "fire and forget")
        // porque en una función serverless el proceso puede cortarse apenas se responda al cliente.
        await checkWaitlistForBarber(db, business, barber)

        const service = services.find((s) => s.id === target.service_id)
        return {
          cancelada: true,
          alternativas: service ? await nextSlots(ctx, service) : [],
        }
      }

      case "anotarse_lista_espera": {
        const service = resolveService(services, String(input.servicio || ""))
        if (!service) return { error: "servicio_no_encontrado", servicios_disponibles: serviceList(services) }

        const fecha = String(input.fecha || "")
        if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return { error: "formato_fecha_invalido" }
        const fromDate = fromZonedTime(`${fecha}T00:00:00`, business.timezone)

        // Verificar primero que de verdad no haya cupo — si sí hay, mejor agendar directo.
        const slots = await findAvailableSlots(db, {
          timezone: business.timezone,
          barberId: barber.id,
          service,
          bufferMinutes: business.buffer_minutes,
          minNoticeHours: noticeHours,
          fromDate,
          daysAhead: 0,
          maxResults: 5,
        })

        if (slots.length > 0) {
          return { ya_hay_cupo: true, disponibilidad: slots.map((s) => slotJson(s, business.timezone)) }
        }

        const client = await findOrCreateClient(db, business.id, clientPhone, (input.nombre_cliente as string) || null)
        await addToWaitlist(db, { businessId: business.id, barberId: barber.id, serviceId: service.id, clientId: client.id, requestedDate: fecha })

        return { anotado: true, fecha_texto: formatInTimeZone(fromDate, business.timezone, "EEEE d 'de' MMMM", { locale: es }) }
      }

      default:
        return { error: "herramienta_desconocida" }
    }
  } catch (err) {
    console.error(`[agent] Error ejecutando ${name}:`, err)
    return { error: "error_interno" }
  }
}

/** Convierte la llamada a enviar_opciones en la respuesta final. null si vino mal formada.
 *  Cualquier texto que el modelo haya escrito fuera de la herramienta se descarta:
 *  en la práctica es un borrador del mismo `mensaje` y saldría duplicado. */
function buildOptionsReply(input: Record<string, unknown>): AgentReply | null {
  const mensaje = String(input.mensaje || "").trim()
  const raw = Array.isArray(input.opciones) ? (input.opciones as { titulo?: unknown; descripcion?: unknown }[]) : []
  const options: ReplyOption[] = raw
    .filter((o) => o && String(o.titulo || "").trim())
    .slice(0, MAX_OPTIONS)
    .map((o, i) => ({
      id: String.fromCharCode(65 + i), // A, B, C…
      title: String(o.titulo).trim(),
      description: o.descripcion ? String(o.descripcion).trim() || undefined : undefined,
    }))
  if (!mensaje || options.length === 0) return null

  const hasOtherDay = options.some((o) => isOtherDayChoice(o.title))
  const body = whatsappText(mensaje)
  return { text: hasOtherDay && !body.includes(OTHER_DAY_HINT) ? `${body}\n\n${OTHER_DAY_HINT}` : body, options }
}

// ─── Loop del agente ─────────────────────────────────────────────────────────

export async function runAgent(ctx: AgentContext, history: ChatMessage[], userMessage: string): Promise<AgentReply> {
  const { recent, isNew } = currentSession(history)

  if (!isNew && isOtherDayChoice(userMessage)) return { text: OTHER_DAY_PROMPT }

  const client = await findClientByPhone(ctx.db, ctx.business.id, ctx.clientPhone)
  const info: ConversationInfo = { isNewConversation: isNew, client, profileName: sanitizeProfileName(ctx.profileName) }

  // El servicio de siempre se necesita en todo mensaje: el agente lo usa sin preguntar.
  const last = client ? await getClientLastService(ctx.db, ctx.business.id, ctx.clientPhone) : null
  info.lastServiceName = last?.lastServiceName ?? null

  // Las citas del cliente van en CADA mensaje: el historial solo guarda textos, no
  // las acciones del agente, así que sin esto el modelo no sabe si ya agendó (caso
  // real 2026-10-05: tras "Gracias" intentó agendar otra vez y dijo "ocupado").
  if (client) {
    const upcoming = await getClientUpcomingAppointments(ctx.db, ctx.business.id, client.id)
    info.upcoming = upcoming.map((a) => ({
      texto: formatSlot(new Date(a.starts_at), ctx.business.timezone),
      fecha_hora: formatInTimeZone(new Date(a.starts_at), ctx.business.timezone, LOCAL_DATETIME),
      servicio: a.services?.name || "",
    }))
  }

  // Solo al empezar una conversación: no tiene sentido recalcularlo en cada mensaje.
  if (isNew) {
    info.greetingSlots = await getGreetingSlots(ctx, info.lastServiceName)
  }

  const system = buildSystemPrompt(ctx, info)
  const messages: Anthropic.MessageParam[] = [
    ...recent.map((m) => ({ role: m.role, content: m.content })),
    { role: "user" as const, content: userMessage },
  ]

  for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 800,
      system,
      tools,
      messages,
    })

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim()

    if (response.stop_reason !== "tool_use") {
      return { text: whatsappText(text) || "Disculpa, ¿puedes repetir tu mensaje? 🙏" }
    }

    const toolUses = response.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use")
    const optionsCall = toolUses.find((b) => b.name === "enviar_opciones")

    // enviar_opciones sola = respuesta final, sin otra vuelta al modelo.
    if (optionsCall && toolUses.length === 1) {
      const reply = buildOptionsReply(optionsCall.input as Record<string, unknown>)
      if (reply) return reply
    }

    messages.push({ role: "assistant", content: response.content })

    const toolResults: Anthropic.ToolResultBlockParam[] = []
    for (const block of toolUses) {
      const result =
        block.name === "enviar_opciones"
          ? {
              error: "opciones_no_enviadas",
              mensaje:
                toolUses.length > 1
                  ? "enviar_opciones debe ir sola, como último paso, cuando ya tengas los resultados de las demás herramientas. Llámala de nuevo ahora."
                  : "Faltó el mensaje o las opciones. Llámala de nuevo con ambos.",
            }
          : await executeTool(block.name, block.input as Record<string, unknown>, ctx)
      toolResults.push({ type: "tool_result", tool_use_id: block.id, content: JSON.stringify(result) })
    }
    messages.push({ role: "user", content: toolResults })
  }

  // Sin prometer que el barbero escribirá: nadie le avisa de este fallo.
  return { text: "Disculpe, se me complicó procesar ese mensaje 🙏 ¿Me lo escribe de nuevo, un poquito más corto?" }
}
