// Proxy serverless para operaciones de escritura en el catálogo de Sheets.
// El ADMIN_TOKEN nunca llega al frontend — se inyecta aquí desde variables de entorno.
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const SHEETS_URL  = process.env.SHEETS_SCRIPT_URL;
  const ADMIN_TOKEN = process.env.ADMIN_TOKEN;

  // Fallar rápido si la configuración en Vercel está incompleta
  if (!SHEETS_URL || !ADMIN_TOKEN) {
    return res.status(500).json({ error: 'Configuración del servidor incompleta' });
  }

  const { action, producto } = req.body || {};

  // Validar que la acción sea una de las permitidas
  const ACCIONES_VALIDAS = ['createProducto', 'updateProducto', 'deleteProducto'];
  if (!action || !ACCIONES_VALIDAS.includes(action)) {
    return res.status(400).json({ error: 'Acción inválida' });
  }

  // Validación mínima del objeto producto
  if (!producto || typeof producto !== 'object') {
    return res.status(400).json({ error: 'Datos de producto inválidos' });
  }

  try {
    const sheetsRes = await fetch(SHEETS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // El token se inyecta aquí — el frontend nunca lo conoce
      body: JSON.stringify({ action, producto, token: ADMIN_TOKEN })
    });

    if (!sheetsRes.ok) {
      throw new Error(`Apps Script respondió con status ${sheetsRes.status}`);
    }

    const data = await sheetsRes.json();
    return res.status(200).json(data);

  } catch(e) {
    console.error('Error en catalog proxy:', e.message);
    return res.status(500).json({ error: 'Error al conectar con la base de datos' });
  }
}
