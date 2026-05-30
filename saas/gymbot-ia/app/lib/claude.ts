import Anthropic from "@anthropic-ai/sdk"
import type { GymConfig } from "./supabase"

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export function buildSystemPrompt(gymName: string, config: GymConfig): string {
  return `Eres el asistente virtual de WhatsApp de ${gymName}. Respondes de manera amigable, concisa y en español.

INFORMACIÓN DEL GIMNASIO:
- Nombre: ${gymName}
- Horarios: ${config.hours}
- Precios y membresías: ${config.prices}
- Clases disponibles: ${config.classes}
- Ubicación: ${config.location}
- Contacto: ${config.contact_name}

INSTRUCCIONES:
1. Responde únicamente preguntas relacionadas con el gimnasio.
2. Si alguien pregunta por clases, precios o membresías, da información específica del gimnasio.
3. Cuando detectes interés real en inscribirse o en clases específicas, pide su nombre y cómo los podemos contactar (teléfono o email) para que el equipo los llame.
4. Mantén las respuestas cortas (máximo 3 oraciones). WhatsApp no es email.
5. Usa emojis ocasionalmente para mantener un tono amigable. 💪
6. Si preguntan algo que no sabes o que está fuera del alcance del gimnasio, di "Para más información, contáctanos directamente con el equipo."
7. NO inventes información que no esté en el contexto. Si no tienes el dato, dilo.

SALUDO INICIAL CUANDO ALGUIEN ESCRIBE POR PRIMERA VEZ:
"${config.greeting}"

Recuerda: eres el asistente de ${gymName}. Tu trabajo es ayudar a los clientes potenciales y actuales a obtener la información que necesitan, y capturar su interés cuando estén listos para unirse.`
}

export async function getChatResponse(
  gymName: string,
  config: GymConfig,
  history: { role: "user" | "assistant"; content: string }[],
  userMessage: string
): Promise<string> {
  const systemPrompt = buildSystemPrompt(gymName, config)

  const messages = [
    ...history.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
    { role: "user" as const, content: userMessage },
  ]

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 300,
    system: systemPrompt,
    messages,
  })

  const block = response.content[0]
  if (block.type !== "text") return "Lo siento, hubo un error. Intenta de nuevo. 🙏"
  return block.text
}
