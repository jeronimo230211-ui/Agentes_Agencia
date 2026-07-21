import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

const FROM = process.env.EMAIL_FROM || 'Europartners <onboarding@resend.dev>'

// GET /api/test-email?to=deisy@... — si no se pasa `to`, envía al admin (Marta)
export async function GET(req: NextRequest) {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'RESEND_API_KEY no configurada' }, { status: 500 })

  const { searchParams } = new URL(req.url)
  let to = searchParams.get('to')

  if (!to) {
    const supabase = createRouteHandlerClient({ cookies })
    const { data: marta } = await supabase.from('usuarios').select('email').eq('rol', 'admin').eq('activo', true).limit(1).single()
    to = marta?.email || null
  }
  if (!to) return NextResponse.json({ error: 'No hay destinatario: pasa ?to=... o configura el email del usuario admin' }, { status: 400 })

  try {
    const resend = new Resend(apiKey)
    const { data, error } = await resend.emails.send({
      from: FROM,
      to,
      subject: 'Test Europartners — Resend',
      html: '<p>Si recibes este email, el sistema de correo (Resend) funciona correctamente.</p>',
    })
    if (error) return NextResponse.json({ error: error.message, from: FROM, to }, { status: 500 })
    return NextResponse.json({ ok: true, id: data?.id, from: FROM, to })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
