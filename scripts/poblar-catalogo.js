#!/usr/bin/env node

/**
 * poblar-catalogo.js
 *
 * Lee archivos JPG de una carpeta, extrae datos del nombre de archivo
 * y crea los productos en Google Sheets via el Apps Script de Davinchi.
 *
 * Formatos soportados:
 *   N001_156K_6Pcs.jpg         → ID=N001,    precio=156000, cantMin=6
 *   N064_2_NAK_NAPcs.jpg       → ID=N064_2,  precio=0,      cantMin=0  (versión 2)
 *   N006_199.5K_3Pcs.jpg       → ID=N006,    precio=200000, cantMin=3  (decimal → redondeo arriba)
 *   N010_155K_CadaUno.jpg      → ID=N010,    precio=155000, cantMin=0  (unidad no estándar)
 *   N020_NAK_NAPcs_Areta.jpg   → ID=N020,    precio=0,      cantMin=0  (sin precio definido)
 *
 * Archivos ignorados (no son referencias de producto):
 *   - IDs sin número (NEco, NJuegoEco, etc.)
 *   - Screenshots, Notes, VIDs
 *
 * Uso:
 *   node poblar-catalogo.js            ← modo preview (no sube nada)
 *   node poblar-catalogo.js --upload   ← sube a Google Sheets
 *
 * Requiere: Node.js 18+ (fetch y fs nativos, sin dependencias externas)
 */

'use strict';
const fs   = require('fs');
const path = require('path');

// ─────────────────────────────────────────────────────────────────────────────
// CONFIGURACIÓN
// ─────────────────────────────────────────────────────────────────────────────

const CARPETA_IMAGENES = 'C:\\Users\\Jeronimo\\Desktop\\Catalogo\\ESTUCHES -3-001\\ESTUCHES';

const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzwZl19Kr6dUjP5eG_o8mY0-LqGOAL4Ydq_K_cnMD2_aMQQ0Pu9qVZXDUClJ1x8Z3N0OQ/exec';

// Token de admin — requerido por el Apps Script para operaciones sobre el catálogo
const ADMIN_TOKEN = 'davinchi-admin-2026';

// Tiempo de espera entre cada POST para no sobrecargar el servidor (ms)
const PAUSA_ENTRE_REQUESTS = 500;

// Timeout por request (ms)
const TIMEOUT_REQUEST = 15000;

// Stock inicial para todos los productos nuevos
const STOCK_INICIAL = 100;

// Un ID válido de producto empieza con letras y tiene al menos un dígito
// Ej: N001, N0034, N064 → válidos | NEco, NJuegoEco, Screenshot, Notes → ignorados
const REGEX_ID_VALIDO = /^[A-Za-z]+\d+/;

// ─────────────────────────────────────────────────────────────────────────────
// PARSEO DE NOMBRE DE ARCHIVO
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parsea el nombre del archivo (sin extensión) y retorna { id, precio, cantMin }
 * o null si el archivo no es una referencia de producto válida.
 *
 * Reglas:
 * - El primer segmento debe ser un ID válido (letras + dígitos, ej: N001)
 * - Si el segundo segmento es un número puro → es versión: ID = base_version
 *   Ej: N064_2_NAK_NAPcs → ID = N064_2
 * - Precio: segmento con sufijo K. Decimal → Math.ceil. "NA" → 0
 * - CantMin: número al inicio del segmento siguiente. Sin número → 0
 */
function parsearArchivo(nombreSinExt) {
  // Eliminar segmentos vacíos (doble guion bajo como en N034_1__30K)
  const partes = nombreSinExt.split('_').filter(p => p !== '');

  // Necesitamos al menos: ID + precio + cantidad
  if (partes.length < 3) return null;

  // El primer segmento debe ser un ID de producto válido
  if (!REGEX_ID_VALIDO.test(partes[0])) return null;

  let idProducto = partes[0];
  let offset = 1;

  // Si el segundo segmento es un número puro → es versión del producto
  // Ej: N064_2_... → ID = N064_2
  if (/^\d+$/.test(partes[1])) {
    idProducto = partes[0] + '_' + partes[1];
    offset = 2;
  }

  // Necesitamos precio y cantidad a partir del offset
  if (offset + 1 > partes.length - 1) return null;

  const precioStr = partes[offset];      // ej: "156K", "199.5K", "NAK", "NA"
  const cantStr   = partes[offset + 1];  // ej: "6Pcs", "NAPcs", "12PCS", "CadaUno"

  // Parsear precio — quitar sufijo K, manejar decimal y "NA"
  let precio = 0;
  const precioNum = precioStr.replace(/K$/i, '');
  if (precioNum !== 'NA' && precioNum !== '' && !isNaN(parseFloat(precioNum))) {
    precio = Math.ceil(parseFloat(precioNum)) * 1000;
  }

  // Parsear cantMin — extraer número inicial del segmento
  // "6Pcs" → 6 | "12PCS" → 12 | "NAPcs" → 0 | "CadaUno" → 0
  let cantMin = 0;
  const cantMatch = cantStr.match(/^(\d+)/);
  if (cantMatch) {
    cantMin = parseInt(cantMatch[1], 10);
  }

  return {
    id:      idProducto.toUpperCase(),
    precio,
    cantMin
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// UTILIDADES
// ─────────────────────────────────────────────────────────────────────────────

function formatearPrecio(valor) {
  if (valor === 0) return '(sin precio)  ';
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0
  }).format(valor);
}

function esperar(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function llamarAppsScript(action, producto) {
  const controller = new AbortController();
  const idTimeout = setTimeout(() => controller.abort(), TIMEOUT_REQUEST);

  try {
    const response = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, token: ADMIN_TOKEN, producto }),
      signal: controller.signal
    });

    clearTimeout(idTimeout);
    const datos = await response.json();

    if (datos.ok === false) {
      return { ok: false, error: datos.error || 'Error desconocido del servidor' };
    }

    return { ok: true };

  } catch (err) {
    clearTimeout(idTimeout);

    if (err.name === 'AbortError') {
      return { ok: false, error: `Timeout después de ${TIMEOUT_REQUEST / 1000}s` };
    }

    return { ok: false, error: err.message };
  }
}

/**
 * Intenta crear el producto. Si ya existe, lo actualiza (upsert).
 * Retorna { ok, accion } donde accion es 'creado' | 'actualizado' | 'error'.
 */
async function upsertProducto(producto) {
  const crear = await llamarAppsScript('createProducto', producto);

  if (crear.ok) return { ok: true, accion: 'creado' };

  // Si el error es por duplicado → intentar actualizar
  if (crear.error && crear.error.toLowerCase().includes('ya existe')) {
    const actualizar = await llamarAppsScript('updateProducto', producto);
    if (actualizar.ok) return { ok: true, accion: 'actualizado' };
    return { ok: false, accion: 'error', error: actualizar.error };
  }

  return { ok: false, accion: 'error', error: crear.error };
}

// ─────────────────────────────────────────────────────────────────────────────
// PROGRAMA PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  const modoUpload = process.argv.includes('--upload');

  console.log('');
  console.log('========================================');
  console.log('  DAVINCHI — POBLAR CATÁLOGO            ');
  console.log(modoUpload ? '  MODO: UPLOAD REAL                     ' : '  MODO: PREVIEW (sin subir nada)        ');
  console.log('========================================');
  console.log('');

  // ── 1. Verificar carpeta ────────────────────────────────────────────────────
  if (!fs.existsSync(CARPETA_IMAGENES)) {
    console.error(`ERROR: La carpeta no existe:\n  ${CARPETA_IMAGENES}`);
    process.exit(1);
  }

  console.log(`Carpeta: ${CARPETA_IMAGENES}`);

  // ── 2. Leer archivos JPG ────────────────────────────────────────────────────
  const todosLosArchivos = fs.readdirSync(CARPETA_IMAGENES);
  const archivosJpg = todosLosArchivos.filter(a => path.extname(a).toLowerCase() === '.jpg');

  console.log(`Archivos JPG encontrados: ${archivosJpg.length}`);
  console.log('');

  // ── 3. Parsear y clasificar ─────────────────────────────────────────────────
  const productosValidos = [];
  const archivosIgnorados = [];

  for (const archivo of archivosJpg) {
    const nombreSinExt = path.basename(archivo, path.extname(archivo));
    const parsed = parsearArchivo(nombreSinExt);

    if (!parsed) {
      archivosIgnorados.push(archivo);
      continue;
    }

    productosValidos.push({
      archivo,
      producto: {
        id:      parsed.id,
        nombre:  parsed.id,
        precio:  parsed.precio,
        stock:   STOCK_INICIAL,
        img:     parsed.id,
        desc:    '',
        activo:  true,
        cantMin: parsed.cantMin
      }
    });
  }

  // ── 4. Preview — mostrar todos los productos que se subirían ────────────────
  console.log(`Referencias a subir: ${productosValidos.length}`);
  console.log('─'.repeat(60));

  for (const { producto, archivo } of productosValidos) {
    const precio  = formatearPrecio(producto.precio);
    const cant    = producto.cantMin > 0 ? `mín ${producto.cantMin} uds` : '(cant. mín pendiente)';
    const flag    = producto.precio === 0 ? ' ← precio pendiente' : '';
    console.log(`  ${producto.id.padEnd(12)} ${precio.padEnd(20)} ${cant}${flag}`);
  }

  console.log('─'.repeat(60));
  console.log('');
  console.log(`Archivos ignorados (no son referencias): ${archivosIgnorados.length}`);

  if (archivosIgnorados.length > 0) {
    for (const a of archivosIgnorados) {
      console.log(`  [ignorado] ${a}`);
    }
  }

  // ── 5. Salir si es solo preview ─────────────────────────────────────────────
  if (!modoUpload) {
    console.log('');
    console.log('Preview completo. Para subir a Google Sheets ejecuta:');
    console.log('  node scripts/poblar-catalogo.js --upload');
    console.log('');
    return;
  }

  // ── 6. Upload real ──────────────────────────────────────────────────────────
  if (productosValidos.length === 0) {
    console.log('No hay productos válidos para procesar.');
    process.exit(0);
  }

  console.log('');
  console.log('Subiendo productos a Google Sheets...');
  console.log('');

  let cantCreados     = 0;
  let cantActualizados = 0;
  let cantErrores     = 0;

  for (const { producto } of productosValidos) {
    const precio = formatearPrecio(producto.precio);
    const cant   = producto.cantMin > 0 ? `mín ${producto.cantMin} uds` : 'cant. pendiente';

    const resultado = await upsertProducto(producto);

    if (resultado.ok && resultado.accion === 'creado') {
      cantCreados++;
      console.log(`  ✓ ${producto.id.padEnd(12)} ${precio.padEnd(20)} ${cant} → CREADO`);
    } else if (resultado.ok && resultado.accion === 'actualizado') {
      cantActualizados++;
      console.log(`  ↺ ${producto.id.padEnd(12)} ${precio.padEnd(20)} ${cant} → ACTUALIZADO`);
    } else {
      cantErrores++;
      console.log(`  ✗ ${producto.id.padEnd(12)} ${precio.padEnd(20)} ${cant} → ERROR: ${resultado.error}`);
    }

    await esperar(PAUSA_ENTRE_REQUESTS);
  }

  // ── 7. Resumen final ────────────────────────────────────────────────────────
  console.log('');
  console.log('========================================');
  console.log('  RESULTADO FINAL');
  console.log(`  Creados              : ${cantCreados}`);
  console.log(`  Actualizados         : ${cantActualizados}`);
  console.log(`  Errores              : ${cantErrores}`);
  console.log(`  Ignorados            : ${archivosIgnorados.length}`);
  console.log('========================================');
  console.log('');
}

main();
