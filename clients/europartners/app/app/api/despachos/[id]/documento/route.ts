import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { createAdminClient } from '@/lib/supabase-server'
import { cookies } from 'next/headers'

type Params = { params: { id: string } }

const TIPOS: Record<string, string> = {
  bl: 'archivo_bl_url',
  shipping_fee: 'archivo_shipping_fee_url',
  picking: 'archivo_picking_url',
}

export async function POST(req: NextRequest, { params }: Params) {
  const supabase = createRouteHandlerClient({ cookies })
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const formData = await req.formData()
  const tipo = formData.get('tipo') as string | null
  const archivo = formData.get('archivo') as File | null

  if (!tipo || !TIPOS[tipo]) return NextResponse.json({ error: 'Tipo de documento inválido' }, { status: 400 })
  if (!archivo) return NextResponse.json({ error: 'Archivo requerido' }, { status: 400 })

  const adminClient = createAdminClient()
  const ext = archivo.name.split('.').pop() || 'bin'
  const fileName = `despachos/${params.id}-${tipo}-${Date.now()}.${ext}`
  const buffer = Buffer.from(await archivo.arrayBuffer())

  const { error: uploadError } = await adminClient.storage
    .from('documentos')
    .upload(fileName, buffer, { contentType: archivo.type, upsert: true })

  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 })

  const { data: urlData } = adminClient.storage.from('documentos').getPublicUrl(fileName)
  const columna = TIPOS[tipo]

  const { data, error } = await supabase
    .from('despachos')
    .update({ [columna]: urlData.publicUrl, updated_at: new Date().toISOString() })
    .eq('id', params.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}
