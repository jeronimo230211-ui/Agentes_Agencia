/**
 * Exporta todas las tablas de Supabase a JSON en la carpeta de backup.
 * Uso: node backup-db.js
 */
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import dotenv from 'dotenv'

dotenv.config({ path: path.resolve('../../app/.env.local') })

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)
const BACKUP_DIR = path.join('C:/Users/Jeronimo/Desktop/Europartners_Backup_v1')

const TABLAS = [
  'clientes',
  'categorias_producto',
  'productos',
  'producto_variantes',
  'producto_componentes',
  'parametros_precio',
  'proformas',
  'proforma_lineas',
  'historial_precios',
  'proforma_eventos',
  'tokens_aprobacion',
  'notificaciones',
  'usuarios',
]

async function main() {
  console.log(`Backup → ${BACKUP_DIR}\n`)
  let totalRegistros = 0

  for (const tabla of TABLAS) {
    const { data, error } = await sb.from(tabla).select('*')

    if (error) {
      console.warn(`  SKIP ${tabla}: ${error.message}`)
      continue
    }

    const archivo = path.join(BACKUP_DIR, `${tabla}.json`)
    fs.writeFileSync(archivo, JSON.stringify(data, null, 2), 'utf8')
    console.log(`  ✓ ${tabla.padEnd(25)} ${data.length} registros`)
    totalRegistros += data.length
  }

  // Guardar resumen
  const resumen = {
    fecha: new Date().toISOString(),
    supabase_url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    tablas: TABLAS,
    total_registros: totalRegistros,
  }
  fs.writeFileSync(path.join(BACKUP_DIR, '_resumen.json'), JSON.stringify(resumen, null, 2))

  console.log(`\n✓ Backup completo: ${totalRegistros} registros en ${BACKUP_DIR}`)
}

main().catch(e => { console.error('ERROR:', e); process.exit(1) })
