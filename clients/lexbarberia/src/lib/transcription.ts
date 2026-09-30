// Transcripción de audios de WhatsApp con Whisper (OpenAI). Claude no recibe
// audio directamente por su API — este es el paso intermedio que convierte
// la nota de voz del cliente en texto antes de pasársela al agente.

export async function transcribeAudio(buffer: Buffer, mimeType: string): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    console.error("[transcribeAudio] Falta OPENAI_API_KEY")
    return null
  }

  try {
    const extension = mimeType.includes("ogg") ? "ogg" : mimeType.includes("mpeg") ? "mp3" : mimeType.includes("wav") ? "wav" : "m4a"
    const form = new FormData()
    form.append("file", new Blob([new Uint8Array(buffer)], { type: mimeType }), `audio.${extension}`)
    form.append("model", "whisper-1")
    form.append("language", "es") // el negocio atiende en español — mejora la precisión

    const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    })

    if (!res.ok) {
      console.error("[transcribeAudio] Whisper error:", res.status, await res.text().catch(() => ""))
      return null
    }

    const data = (await res.json()) as { text?: string }
    return data.text?.trim() || null
  } catch (err) {
    console.error("[transcribeAudio] Error:", err)
    return null
  }
}
