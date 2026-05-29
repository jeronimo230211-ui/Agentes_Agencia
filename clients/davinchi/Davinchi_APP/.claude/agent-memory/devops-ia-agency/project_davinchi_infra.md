---
name: Davinchi App - Infraestructura y estado de producción
description: URLs, repositorio, endpoint, proxy Vercel, estructura de datos de productos y problemas conocidos de la Davinchi App
type: project
---

App: Davinchi App
URL producción: https://davinchi-app.vercel.app
Repositorio: github.com/jeronimo230211-ui/Davinchi_App
Tecnología: Single-page app (index.html sin framework), Vercel hosting, Google Apps Script como backend

Proxy serverless: /api/data.js en Vercel — reenvía GET/POST a Apps Script via variable de entorno SHEETS_SCRIPT_URL (nunca expuesta al frontend).

Llamada para catálogo: GET /api/data?action=getCatalogo — devuelve { productos: [...] } con 56 productos.

**Why:** El campo `categoria` no existe en el response de Apps Script (getCatalogo). Los productos solo tienen: id, name, price, stock, img, desc, activo. La función buildCategoriasMenu() en el frontend extrae categorías de CATALOG.map(p => p.categoria) pero el campo no llega desde la fuente de datos.

**How to apply:** Para que las categorías funcionen, hay que agregar la columna "Categoria" en el Google Sheet de productos Y actualizar el Apps Script (doGet con action=getCatalogo) para que la incluya en el JSON de respuesta. Hasta que eso no esté hecho, buildCategoriasMenu() siempre verá cats=[] y ocultará #cat-chips-row.

Variables de entorno requeridas en Vercel:
- SHEETS_SCRIPT_URL (server-side, nunca NEXT_PUBLIC_)
