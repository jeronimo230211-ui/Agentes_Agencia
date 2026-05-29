// ══════════════════════════════════════════════════════════════════
// cortar-vistas-ia.js
// Detecta y recorta vistas individuales de imágenes de producto
// usando Claude Vision (claude-sonnet-4-6) + sharp.
// ══════════════════════════════════════════════════════════════════

import Anthropic from '@anthropic-ai/sdk';
import sharp     from 'sharp';
import fs        from 'fs';
import path      from 'path';

// ── Configuración ──────────────────────────────────────────────────
const CONFIG = {
  origen:  'C:/Users/Jeronimo/Desktop/Catalogo/ESTUCHES -3-001/Catalogo_Nuevo',
  destino: 'C:/Users/Jeronimo/Desktop/Agentes_Agencia/clients/davinchi/Davinchi_APP/code/assets/vistas',
  modelo:  'claude-sonnet-4-6',
  calidad: 90,
  ext:     ['.png', '.jpg', '.jpeg'],
};

const PROMPT = `Analiza esta imagen de producto con múltiples vistas y devuelve SOLO un JSON sin texto adicional ni backticks con este formato: [{"x":0,"y":0,"width":100,"height":100}] donde cada objeto es una vista individual y x,y es la esquina superior izquierda del recorte en píxeles. Asegúrate de que cada bounding box capture una vista completa del producto sin solapamientos con otras vistas.`;

const client = new Anthropic();

// ── Helpers ────────────────────────────────────────────────────────

function leerBase64(rutaArchivo) {
  const buf = fs.readFileSync(rutaArchivo);
  return buf.toString('base64');
}

function mediaType(ext) {
  if (ext === '.png')                return 'image/png';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  return 'image/png';
}

function parsearJSON(texto) {
  // Limpiar posibles backticks o bloques markdown que Claude pueda añadir
  let limpio = texto.trim();
  limpio = limpio.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();

  const parsed = JSON.parse(limpio);

  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error('Respuesta no es un array válido o está vacía');
  }

  for (const item of parsed) {
    const campos = ['x', 'y', 'width', 'height'];
    for (const c of campos) {
      if (typeof item[c] !== 'number' || item[c] < 0) {
        throw new Error(`Campo "${c}" inválido en: ${JSON.stringify(item)}`);
      }
    }
    if (item.width < 10 || item.height < 10) {
      throw new Error(`Vista demasiado pequeña (< 10px): ${JSON.stringify(item)}`);
    }
  }

  return parsed;
}

// ── Procesamiento de una imagen ────────────────────────────────────

async function procesarImagen(archivo, meta) {
  const rutaOrigen = path.join(CONFIG.origen, archivo);
  const ext        = path.extname(archivo).toLowerCase();
  const base       = path.basename(archivo, ext);

  console.log(`\n→ [${meta.idx}/${meta.total}] ${archivo}`);

  // 1. Leer imagen y obtener dimensiones reales
  const base64  = leerBase64(rutaOrigen);
  const imgMeta = await sharp(rutaOrigen).metadata();
  const { width: imgW, height: imgH } = imgMeta;

  // 2. Llamar a Claude Vision
  let respuestaTexto;
  try {
    const mensaje = await client.messages.create({
      model:      CONFIG.modelo,
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: [
          {
            type:   'image',
            source: { type: 'base64', media_type: mediaType(ext), data: base64 },
          },
          { type: 'text', text: PROMPT },
        ],
      }],
    });
    respuestaTexto = mensaje.content[0].text;
  } catch (err) {
    throw new Error(`Error llamando Claude API: ${err.message}`);
  }

  // 3. Parsear JSON de coordenadas
  let vistas;
  try {
    vistas = parsearJSON(respuestaTexto);
  } catch (err) {
    console.error(`   ⚠️  Respuesta de Claude: ${respuestaTexto.slice(0, 200)}`);
    throw new Error(`JSON inválido: ${err.message}`);
  }

  console.log(`   ✂️  ${vistas.length} vista(s) detectada(s)`);

  // 4. Recortar cada vista con sharp
  const vistasGuardadas = [];

  for (let i = 0; i < vistas.length; i++) {
    let { x, y, width, height } = vistas[i];

    // Ajustar coordenadas para que no excedan los límites reales de la imagen
    x      = Math.max(0, Math.round(x));
    y      = Math.max(0, Math.round(y));
    width  = Math.min(Math.round(width),  imgW - x);
    height = Math.min(Math.round(height), imgH - y);

    if (width <= 0 || height <= 0) {
      console.warn(`   ⚠️  Vista ${i + 1} tiene dimensiones inválidas tras ajuste — omitida`);
      continue;
    }

    const nombreSalida = `${base}_vista${i + 1}.jpg`;
    const rutaSalida   = path.join(CONFIG.destino, nombreSalida);

    await sharp(rutaOrigen)
      .extract({ left: x, top: y, width, height })
      .jpeg({ quality: CONFIG.calidad })
      .toFile(rutaSalida);

    vistasGuardadas.push(nombreSalida);
    console.log(`   ✅ ${nombreSalida} (${x},${y} ${width}×${height}px)`);
  }

  return vistasGuardadas;
}

// ── Main ───────────────────────────────────────────────────────────

async function main() {
  console.log('══════════════════════════════════════════');
  console.log(' cortar-vistas-ia.js — Davinchi Catálogo');
  console.log('══════════════════════════════════════════');

  // Verificar API key
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('❌ ANTHROPIC_API_KEY no está definida en las variables de entorno.');
    console.error('   Corre: set ANTHROPIC_API_KEY=sk-ant-... && node cortar-vistas-ia.js');
    process.exit(1);
  }
  console.log(`🔑 API key detectada: ${process.env.ANTHROPIC_API_KEY.slice(0, 12)}...`);

  // Verificar que la carpeta origen existe y tiene archivos
  if (!fs.existsSync(CONFIG.origen)) {
    console.error(`❌ Carpeta origen no encontrada:\n   ${CONFIG.origen}`);
    process.exit(1);
  }
  console.log(`✅ Carpeta origen accesible`);

  // Test rápido: leer el primer archivo para verificar acceso a disco
  const primerArchivo = fs.readdirSync(CONFIG.origen)
    .find(f => CONFIG.ext.includes(path.extname(f).toLowerCase()));
  if (primerArchivo) {
    try {
      const buf = fs.readFileSync(path.join(CONFIG.origen, primerArchivo));
      console.log(`✅ Lectura de archivos OK (${primerArchivo}, ${(buf.length/1024).toFixed(0)}KB)`);
    } catch (e) {
      console.error(`❌ No se puede leer archivos: ${e.message}`);
      process.exit(1);
    }
  }

  // Test rápido de API: llamada mínima para verificar credenciales
  console.log(`🔌 Verificando conexión con Claude API (modelo: ${CONFIG.modelo})...`);
  try {
    await client.messages.create({
      model: CONFIG.modelo,
      max_tokens: 5,
      messages: [{ role: 'user', content: 'di: ok' }],
    });
    console.log(`✅ Claude API responde correctamente\n`);
  } catch (e) {
    console.error(`❌ Error conectando con Claude API:`);
    console.error(`   ${e.message}`);
    if (e.status) console.error(`   HTTP status: ${e.status}`);
    process.exit(1);
  }

  // Crear carpeta destino si no existe
  fs.mkdirSync(CONFIG.destino, { recursive: true });

  // Listar archivos de imagen en origen
  const todos = fs.readdirSync(CONFIG.origen);
  const archivos = todos.filter(f => CONFIG.ext.includes(path.extname(f).toLowerCase()));

  if (archivos.length === 0) {
    console.log('⚠️  No se encontraron imágenes en la carpeta origen.');
    return;
  }

  console.log(`\n📂 Origen:  ${CONFIG.origen}`);
  console.log(`📁 Destino: ${CONFIG.destino}`);
  console.log(`🖼️  Imágenes encontradas: ${archivos.length}\n`);

  // Métricas
  const resumen = {
    procesadas:   0,
    vistasTotal:  0,
    fallidas:     [],
  };

  // Procesar secuencialmente para no saturar la API
  for (let i = 0; i < archivos.length; i++) {
    const archivo = archivos[i];
    try {
      const vistas = await procesarImagen(archivo, { idx: i + 1, total: archivos.length });
      resumen.procesadas++;
      resumen.vistasTotal += vistas.length;
    } catch (err) {
      console.error(`   ❌ Error en ${archivo}:`);
      console.error(`      ${err.message}`);
      if (err.status) console.error(`      HTTP status: ${err.status}`);
      resumen.fallidas.push({ archivo, error: err.message });
    }
  }

  // Resumen final
  console.log('\n══════════════════════════════════════════');
  console.log(' RESUMEN');
  console.log('══════════════════════════════════════════');
  console.log(`✅  Imágenes procesadas : ${resumen.procesadas} / ${archivos.length}`);
  console.log(`✂️   Vistas generadas    : ${resumen.vistasTotal} archivos`);

  if (resumen.fallidas.length > 0) {
    console.log(`❌  Fallidas            : ${resumen.fallidas.length}`);
    resumen.fallidas.forEach(({ archivo, error }) => {
      console.log(`    • ${archivo} — ${error}`);
    });
  } else {
    console.log('❌  Fallidas            : 0');
  }

  console.log(`📁  Guardadas en        : ${CONFIG.destino}`);
  console.log('══════════════════════════════════════════');
}

main().catch(err => {
  console.error('\n💥 Error fatal:', err.message);
  process.exit(1);
});
