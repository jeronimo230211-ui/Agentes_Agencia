// Proxy serverless para todas las llamadas GET/POST a Google Sheets (Apps Script).
// La URL del Apps Script nunca llega al frontend — vive solo en variables de entorno.
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const SHEETS_URL = process.env.SHEETS_SCRIPT_URL;
  if (!SHEETS_URL) {
    return res.status(500).json({ error: 'Configuración del servidor incompleta' });
  }

  try {
    if (req.method === 'GET') {
      // Reenviar query params al Apps Script (ej: ?action=getCatalogo&t=123)
      const params = new URLSearchParams(req.query).toString();
      const url    = params ? `${SHEETS_URL}?${params}` : SHEETS_URL;
      const upstream = await fetch(url);
      const data = await upstream.json();
      return res.status(200).json(data);
    }

    if (req.method === 'POST') {
      const upstream = await fetch(SHEETS_URL, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(req.body || {})
      });
      const data = await upstream.json();
      return res.status(200).json(data);
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (e) {
    console.error('Error en data proxy:', e.message);
    return res.status(500).json({ error: 'Error al conectar con la base de datos' });
  }
}
