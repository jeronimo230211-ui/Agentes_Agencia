import type { Provider } from "./supabase"

type ProviderCfg = Record<string, string>

export async function sendWhatsAppMessage(
  provider: Provider,
  cfg: ProviderCfg,
  to: string,
  body: string
): Promise<void> {
  try {
    if (provider === "360dialog") await send360Dialog(cfg, to, body)
    else if (provider === "meta") await sendMeta(cfg, to, body)
    else if (provider === "twilio") await sendTwilio(cfg, to, body)
  } catch {
    // Log but don't fail — message is saved in DB regardless
  }
}

async function send360Dialog(cfg: ProviderCfg, to: string, body: string) {
  await fetch("https://waba.360dialog.io/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "D360-API-KEY": cfg.api_token,
    },
    body: JSON.stringify({ to, type: "text", text: { body } }),
  })
}

async function sendMeta(cfg: ProviderCfg, to: string, body: string) {
  await fetch(
    `https://graph.facebook.com/v19.0/${cfg.phone_number_id}/messages`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cfg.access_token}`,
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body },
      }),
    }
  )
}

async function sendTwilio(cfg: ProviderCfg, to: string, body: string) {
  const credentials = Buffer.from(`${cfg.account_sid}:${cfg.auth_token}`).toString("base64")
  const params = new URLSearchParams({
    From: cfg.from_number,
    To: `whatsapp:${to}`,
    Body: body,
  })
  await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${cfg.account_sid}/Messages.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${credentials}`,
      },
      body: params.toString(),
    }
  )
}

// ─── Webhook parsing ──────────────────────────────────────────────────────────

export type ParsedMessage = {
  from: string
  body: string
  providerId: string // phone_number_id (Meta) | api_token (360/Twilio lookup key)
}

export function parse360Dialog(payload: Record<string, unknown>): ParsedMessage | null {
  const messages = (payload.messages as { from: string; type: string; text?: { body: string } }[]) || []
  const msg = messages.find((m) => m.type === "text" && m.text?.body)
  if (!msg) return null
  return { from: msg.from, body: msg.text!.body, providerId: "" }
}

export function parseMeta(payload: Record<string, unknown>): ParsedMessage | null {
  try {
    const entry = (payload.entry as { changes: { value: { metadata: { phone_number_id: string }; messages?: { from: string; type: string; text?: { body: string } }[] } }[] }[])?.[0]
    const value = entry?.changes?.[0]?.value
    const msg = value?.messages?.find((m) => m.type === "text" && m.text?.body)
    if (!msg) return null
    return {
      from: msg.from,
      body: msg.text!.body,
      providerId: value.metadata.phone_number_id,
    }
  } catch {
    return null
  }
}

export function parseTwilio(body: string): ParsedMessage | null {
  try {
    const params = new URLSearchParams(body)
    const from = params.get("From")?.replace("whatsapp:", "") || ""
    const text = params.get("Body") || ""
    const to = params.get("To")?.replace("whatsapp:", "") || ""
    if (!from || !text) return null
    return { from, body: text, providerId: to }
  } catch {
    return null
  }
}
