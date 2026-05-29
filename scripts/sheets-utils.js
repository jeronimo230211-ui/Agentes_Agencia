/**
 * sheets-utils.js
 * Utilidad Node.js para leer y escribir en Google Sheets de Davinchi
 * directamente desde la terminal, sin OAuth ni Google Cloud SDK.
 *
 * Usa el Apps Script Web App existente como único punto de acceso.
 *
 * Uso como módulo:
 *   const { getPedidos, resumenVentas } = require('./scripts/sheets-utils');
 *
 * Uso directo en terminal:
 *   node scripts/sheets-utils.js
 *
 * Variables de entorno opcionales:
 *   SHEETS_URL    → URL del Apps Script (usa fallback si no está definida)
 *   ADMIN_TOKEN   → Token para operaciones de escritura en catálogo
 *
 * Requiere Node.js 18+ (fetch nativo disponible)
 */

'use strict';

// ─── CONFIGURACIÓN ────────────────────────────────────────────────────────────

// URL del Apps Script Web App de Davinchi — tomada de TECHNICAL_NOTES.md
const SHEETS_URL_FALLBACK =
  'https://script.google.com/macros/s/AKfycbzwZl19Kr6dUjP5eG_o8mY0-LqGOAL4Ydq_K_cnMD2_aMQQ0Pu9qVZXDUClJ1x8Z3N0OQ/exec';

// Se prefiere la variable de entorno para que funcione en distintos entornos
const SHEETS_URL = process.env.SHEETS_URL || SHEETS_URL_FALLBACK;

// Token de administrador — obligatorio para cualquier escritura al catálogo
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || null;

// Tiempo máximo de espera por request (ms) — evita colgar el proceso indefinidamente
const TIMEOUT_MS = 15000;

// ─── HELPERS INTERNOS ─────────────────────────────────────────────────────────

/**
 * Realiza un GET al Apps Script con los parámetros indicados.
 * Centraliza manejo de errores y timeout para todas las lecturas.
 */
async function _get(params = {}) {
  const url = new URL(SHEETS_URL);
  for (const [clave, valor] of Object.entries(params)) {
    url.searchParams.set(clave, valor);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const respuesta = await fetch(url.toString(), {
      method: 'GET',
      signal: controller.signal,
    });

    if (!respuesta.ok) {
      throw new Error(`HTTP ${respuesta.status}: ${respuesta.statusText}`);
    }

    return await respuesta.json();
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error(`Timeout: el Apps Script no respondió en ${TIMEOUT_MS}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Realiza un POST al Apps Script con un cuerpo JSON.
 * Se usa para todas las operaciones de escritura.
 */
async function _post(body = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const respuesta = await fetch(SHEETS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!respuesta.ok) {
      throw new Error(`HTTP ${respuesta.status}: ${respuesta.statusText}`);
    }

    return await respuesta.json();
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error(`Timeout: el Apps Script no respondió en ${TIMEOUT_MS}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Verifica que ADMIN_TOKEN esté disponible antes de cualquier escritura.
 * Imprime un warning claro si falta y lanza un error para detener la operación.
 */
function _requerirAdminToken() {
  if (!ADMIN_TOKEN) {
    console.warn(
      '\n[ADVERTENCIA] Esta operación requiere ADMIN_TOKEN.\n' +
      'Define la variable de entorno antes de ejecutar:\n' +
      '  export ADMIN_TOKEN=davinchi-admin-2026\n' +
      'O en Windows PowerShell:\n' +
      '  $env:ADMIN_TOKEN="davinchi-admin-2026"\n'
    );
    throw new Error('ADMIN_TOKEN no definido — operación de escritura cancelada');
  }
}

// ─── LECTURA ──────────────────────────────────────────────────────────────────

/**
 * Devuelve todos los pedidos de la hoja APP_PEDIDOS.
 * El endpoint GET sin parámetros retorna los pedidos directamente.
 *
 * @returns {Promise<Array>} Lista de objetos con los campos de cada pedido
 */
async function getPedidos() {
  try {
    const datos = await _get();
    // El Apps Script puede devolver el array directamente o en una propiedad
    const pedidos = Array.isArray(datos) ? datos : (datos.pedidos || datos.data || []);
    return pedidos;
  } catch (error) {
    throw new Error(`getPedidos() falló: ${error.message}`);
  }
}

/**
 * Devuelve todos los productos de la hoja CATALOGO, incluyendo los inactivos.
 * Útil para el panel admin que necesita ver también los productos ocultos.
 *
 * Nota: el endpoint getCatalogo devuelve solo activos según TECHNICAL_NOTES.
 * Para incluir inactivos se usa el mismo endpoint — si el Apps Script filtra,
 * esto solo traerá activos. Para ver inactivos habría que ajustar el script.
 *
 * @returns {Promise<Array>} Lista de productos con todos sus campos
 */
async function getCatalogo() {
  try {
    const datos = await _get({ action: 'getCatalogo' });
    const productos = Array.isArray(datos) ? datos : (datos.productos || datos.data || []);
    return productos;
  } catch (error) {
    throw new Error(`getCatalogo() falló: ${error.message}`);
  }
}

/**
 * Devuelve todos los clientes de la hoja CLIENTES.
 * El endpoint actual no tiene una acción específica para clientes,
 * pero se intenta con action=getClientes por si está implementado.
 *
 * @returns {Promise<Array>} Lista de clientes, o array vacío si el endpoint no lo soporta
 */
async function getClientes() {
  try {
    const datos = await _get({ action: 'getClientes' });
    const clientes = Array.isArray(datos) ? datos : (datos.clientes || datos.data || []);
    return clientes;
  } catch (error) {
    // El endpoint puede no existir — advertimos pero no lanzamos error fatal
    console.warn(`getClientes() no disponible en este endpoint: ${error.message}`);
    return [];
  }
}

// ─── ESCRITURA (requieren ADMIN_TOKEN) ────────────────────────────────────────

/**
 * Actualiza el estado de un pedido existente en APP_PEDIDOS.
 * También permite actualizar el vendedor asignado.
 *
 * @param {string} id      - ID del pedido (ej: "PED-1711234567890")
 * @param {string} estado  - Nuevo estado: 'Nuevo' | 'En proceso' | 'Entregado' | 'Parcial'
 * @param {string} [vendedor] - Nombre del vendedor (opcional)
 * @returns {Promise<Object>} Respuesta del Apps Script
 */
async function updateEstadoPedido(id, estado, vendedor = '') {
  if (!id || !estado) {
    throw new Error('updateEstadoPedido() requiere id y estado');
  }

  const estadosValidos = ['Nuevo', 'En proceso', 'Entregado', 'Parcial'];
  if (!estadosValidos.includes(estado)) {
    throw new Error(
      `Estado inválido: "${estado}". Valores permitidos: ${estadosValidos.join(', ')}`
    );
  }

  try {
    const resultado = await _post({
      tipo: 'updateStatus',
      id,
      estado,
      vendedor,
    });
    return resultado;
  } catch (error) {
    throw new Error(`updateEstadoPedido() falló: ${error.message}`);
  }
}

/**
 * Actualiza un producto existente en la hoja CATALOGO.
 * Requiere ADMIN_TOKEN.
 *
 * @param {Object} producto - Datos del producto a actualizar
 * @param {string} producto.id          - ID del producto (ej: "N001")
 * @param {string} [producto.nombre]    - Nombre del producto
 * @param {number} [producto.precio]    - Precio en COP sin formato
 * @param {number} [producto.stock]     - Unidades disponibles
 * @param {string} [producto.imagen]    - Nombre del archivo de imagen
 * @param {string} [producto.descripcion] - Descripción corta
 * @param {boolean} [producto.activo]   - TRUE visible / FALSE oculto
 * @returns {Promise<Object>} Respuesta del Apps Script
 */
async function updateProducto(producto) {
  _requerirAdminToken();

  if (!producto || !producto.id) {
    throw new Error('updateProducto() requiere un objeto producto con campo id');
  }

  try {
    const resultado = await _post({
      action: 'updateProducto',
      token: ADMIN_TOKEN,
      ...producto,
    });
    return resultado;
  } catch (error) {
    throw new Error(`updateProducto() falló: ${error.message}`);
  }
}

/**
 * Crea un producto nuevo en la hoja CATALOGO.
 * Requiere ADMIN_TOKEN.
 *
 * @param {Object} producto - Datos del nuevo producto
 * @param {string} producto.id           - ID único (ej: "N007")
 * @param {string} producto.nombre       - Nombre del producto
 * @param {number} producto.precio       - Precio en COP sin formato
 * @param {number} [producto.stock]      - Unidades disponibles (default 0)
 * @param {string} [producto.imagen]     - Nombre del archivo de imagen
 * @param {string} [producto.descripcion] - Descripción corta
 * @param {boolean} [producto.activo]    - TRUE por defecto
 * @returns {Promise<Object>} Respuesta del Apps Script
 */
async function createProducto(producto) {
  _requerirAdminToken();

  if (!producto || !producto.id || !producto.nombre || producto.precio === undefined) {
    throw new Error('createProducto() requiere id, nombre y precio');
  }

  // Valores por defecto para campos opcionales
  const productoCompleto = {
    stock: 0,
    imagen: '',
    descripcion: '',
    activo: true,
    ...producto,
  };

  try {
    const resultado = await _post({
      action: 'createProducto',
      token: ADMIN_TOKEN,
      ...productoCompleto,
    });
    return resultado;
  } catch (error) {
    throw new Error(`createProducto() falló: ${error.message}`);
  }
}

/**
 * Desactiva un producto del catálogo (soft-delete: Activo = FALSE).
 * El producto no se elimina, solo deja de ser visible en el catálogo.
 * Requiere ADMIN_TOKEN.
 *
 * @param {string} id - ID del producto (ej: "N001")
 * @returns {Promise<Object>} Respuesta del Apps Script
 */
async function deleteProducto(id) {
  _requerirAdminToken();

  if (!id) {
    throw new Error('deleteProducto() requiere el id del producto');
  }

  try {
    const resultado = await _post({
      action: 'deleteProducto',
      token: ADMIN_TOKEN,
      id,
    });
    return resultado;
  } catch (error) {
    throw new Error(`deleteProducto() falló: ${error.message}`);
  }
}

// ─── UTILIDADES ───────────────────────────────────────────────────────────────

/**
 * Filtra pedidos por estado específico.
 *
 * @param {string} estado - 'Nuevo' | 'En proceso' | 'Entregado' | 'Parcial'
 * @returns {Promise<Array>} Lista de pedidos con ese estado
 */
async function listPedidosPorEstado(estado) {
  const pedidos = await getPedidos();
  return pedidos.filter(
    (p) => (p.Estado || p.estado || '').toLowerCase() === estado.toLowerCase()
  );
}

/**
 * Devuelve solo los productos con Activo = true.
 * Útil para verificar qué ve el cliente en el catálogo.
 *
 * @returns {Promise<Array>} Lista de productos activos
 */
async function listProductosActivos() {
  const productos = await getCatalogo();
  return productos.filter((p) => {
    const activo = p.Activo !== undefined ? p.Activo : p.activo;
    // El Apps Script puede devolver booleano o el string "TRUE"
    return activo === true || activo === 'TRUE';
  });
}

/**
 * Genera un resumen de ventas a partir de los pedidos en Sheets.
 * Métricas útiles para el CEO sin necesidad de abrir la app.
 *
 * @returns {Promise<Object>} Objeto con:
 *   - totalPedidos: número total de pedidos
 *   - montoTotal: suma de todos los pedidos en COP
 *   - porEstado: conteo de pedidos agrupado por estado
 *   - porVendedor: conteo y monto por vendedor
 *   - pedidosPendientes: pedidos en estado 'Nuevo' o 'En proceso'
 */
async function resumenVentas() {
  const pedidos = await getPedidos();

  if (!pedidos || pedidos.length === 0) {
    return {
      totalPedidos: 0,
      montoTotal: 0,
      porEstado: {},
      porVendedor: {},
      pedidosPendientes: 0,
    };
  }

  // Convierte el campo Total de formato "$1.234.567" a número entero
  function parsearMonto(texto) {
    if (!texto) return 0;
    const limpio = String(texto).replace(/[$.,\s]/g, '').replace(',', '');
    const numero = parseInt(limpio, 10);
    return isNaN(numero) ? 0 : numero;
  }

  const porEstado = {};
  const porVendedor = {};
  let montoTotal = 0;
  let pedidosPendientes = 0;

  for (const pedido of pedidos) {
    // Normalizar nombres de campos (el Apps Script puede usar mayúsculas o minúsculas)
    const estado = pedido.Estado || pedido.estado || 'Sin estado';
    const vendedor = pedido.Vendedor || pedido.vendedor || 'Sin asignar';
    const totalTexto = pedido.Total || pedido.total || '0';
    const monto = parsearMonto(totalTexto);

    // Acumulados globales
    montoTotal += monto;

    // Conteo por estado
    porEstado[estado] = (porEstado[estado] || 0) + 1;

    // Pendientes = sin gestionar aún
    if (estado === 'Nuevo' || estado === 'En proceso') {
      pedidosPendientes++;
    }

    // Conteo y monto por vendedor
    if (!porVendedor[vendedor]) {
      porVendedor[vendedor] = { pedidos: 0, monto: 0 };
    }
    porVendedor[vendedor].pedidos++;
    porVendedor[vendedor].monto += monto;
  }

  return {
    totalPedidos: pedidos.length,
    montoTotal,
    porEstado,
    porVendedor,
    pedidosPendientes,
  };
}

// ─── EXPORTACIÓN ──────────────────────────────────────────────────────────────

module.exports = {
  // Lectura
  getPedidos,
  getCatalogo,
  getClientes,
  // Escritura (requieren ADMIN_TOKEN)
  updateEstadoPedido,
  updateProducto,
  createProducto,
  deleteProducto,
  // Utilidades
  listPedidosPorEstado,
  listProductosActivos,
  resumenVentas,
};

// ─── MODO DEMO (ejecución directa) ────────────────────────────────────────────

if (require.main === module) {
  // Formateador de pesos colombianos para el output en consola
  function formatearCOP(numero) {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
    }).format(numero);
  }

  async function main() {
    console.log('\n========================================');
    console.log('  DAVINCHI — RESUMEN ACTUAL DE VENTAS   ');
    console.log('========================================\n');

    console.log(`Endpoint: ${SHEETS_URL === SHEETS_URL_FALLBACK ? '(fallback)' : '(env var)'}`);
    console.log(`ADMIN_TOKEN: ${ADMIN_TOKEN ? 'configurado' : 'NO definido (solo lectura)'}\n`);

    try {
      console.log('Consultando Sheets...\n');
      const resumen = await resumenVentas();

      console.log(`Total de pedidos registrados : ${resumen.totalPedidos}`);
      console.log(`Monto total acumulado        : ${formatearCOP(resumen.montoTotal)}`);
      console.log(`Pedidos pendientes           : ${resumen.pedidosPendientes}`);

      console.log('\n--- Por estado ---');
      if (Object.keys(resumen.porEstado).length === 0) {
        console.log('  (sin datos)');
      } else {
        for (const [estado, cantidad] of Object.entries(resumen.porEstado)) {
          console.log(`  ${estado.padEnd(15)} ${cantidad} pedido(s)`);
        }
      }

      console.log('\n--- Por vendedor ---');
      if (Object.keys(resumen.porVendedor).length === 0) {
        console.log('  (sin datos)');
      } else {
        for (const [vendedor, datos] of Object.entries(resumen.porVendedor)) {
          console.log(
            `  ${vendedor.padEnd(25)} ${String(datos.pedidos).padStart(3)} pedido(s)` +
            `  |  ${formatearCOP(datos.monto)}`
          );
        }
      }

      // Muestra también cuántos productos hay activos en catálogo
      console.log('\n--- Catálogo ---');
      const productosActivos = await listProductosActivos();
      console.log(`  Productos activos en catálogo: ${productosActivos.length}`);

    } catch (error) {
      console.error('\n[ERROR] No se pudo obtener el resumen:');
      console.error(' ', error.message);
      console.error('\nVerifica que el Apps Script esté desplegado y accesible.');
      process.exit(1);
    }

    console.log('\n========================================\n');
  }

  main();
}
