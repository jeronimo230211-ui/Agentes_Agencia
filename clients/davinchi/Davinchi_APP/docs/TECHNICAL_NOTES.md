# TECHNICAL NOTES — Davinchi App

> Para los agentes de Claude Code. Todo lo tecnico en un solo lugar.
> Leer este archivo antes de modificar cualquier cosa del proyecto.

---

## REPOSITORIO Y DEPLOY

| Item | Valor |
|---|---|
| GitHub repo | github.com/jeronimo230211-ui/Davinchi_App |
| URL produccion | https://davinchi-app.vercel.app |
| Hosting | Vercel (free tier) |
| Branch principal | main |
| Deploy | Automatico al hacer push a main |

---

## ESTRUCTURA DE ARCHIVOS

```
Davinchi_App/
├── index.html       # App completa (frontend + logica — single file)
├── api/
│   ├── chat.js      # Proxy seguro para API de Anthropic (Vercel serverless)
│   └── catalog.js   # Proxy seguro para operaciones CRUD del catalogo (Vercel serverless)
├── Foto1            # Imagenes de productos (sin extension)
├── Foto2
├── Foto3
├── Foto4
├── Foto5
└── Foto6
```

---

## VERCEL — CONFIGURACION

**Variables de entorno obligatorias:**
```
ANTHROPIC_API_KEY  = [clave de Anthropic de Jeronimo]
ADMIN_TOKEN        = davinchi-admin-2026
SHEETS_SCRIPT_URL  = https://script.google.com/macros/s/AKfycbzwZl19Kr6dUjP5eG_o8mY0-LqGOAL4Ydq_K_cnMD2_aMQQ0Pu9qVZXDUClJ1x8Z3N0OQ/exec
```

**Como agregar/editar variables:**
1. Ir a vercel.com → proyecto Davinchi_App → Settings → Environment Variables

**Archivo api/chat.js:**
- Recibe peticiones del frontend
- Las reenvía a https://api.anthropic.com/v1/messages con la API key
- Maneja CORS para que el frontend pueda llamarlo
- NUNCA mover la API key al frontend

---

## GOOGLE SHEETS — BASE DE DATOS

**Archivo:** JewelryCase_v2_Formulas  
**ID:** 1ts9mdpRJjRrk-JAttux_Xr6tqaIjH_ZqVo7xPWelTAU

### Hoja: APP_PEDIDOS

| Col | Campo | Tipo | Notas |
|---|---|---|---|
| A | ID | PED-{timestamp} | Generado automaticamente |
| B | Fecha | DD/MM/YYYY | |
| C | Hora | HH:MM | |
| D | Joyeria | Texto | Nombre del cliente |
| E | Contacto | Texto | Nombre de la persona |
| F | Productos | Texto | Formato: "Nx Producto, Nx Producto" |
| G | Total | Texto | Formato: "$X.XXX.XXX" |
| H | Pago | Texto | Contado / Transferencia / Credito 15-30 dias |
| I | Entrega | Fecha | Fecha prometida de entrega |
| J | Estado | Texto | Nuevo / En proceso / Entregado / Parcial |
| K | Notas | Texto | Observaciones del pedido |
| L | Vendedor | Texto | Nombre del vendedor que gestiono |
| M | Telefono | Texto | Recuperado automaticamente de CLIENTES |

### Hoja: CATALOGO

| Col | Campo | Tipo | Notas |
|---|---|---|---|
| A | ID | Texto | Clave primaria del producto (ej: N001) |
| B | Nombre | Texto | Nombre del producto |
| C | Precio | Numero | En COP sin formato (ej: 45000) |
| D | Stock | Numero | Unidades disponibles |
| E | Imagen | Texto | Nombre del archivo (ej: Foto1) — texto plano, no imagen insertada |
| F | Descripcion | Texto | Descripcion corta del producto |
| G | Activo | Booleano | TRUE = visible en catalogo / FALSE = oculto (soft delete) |

### Hoja: CLIENTES

| Col | Campo |
|---|---|
| A | Fecha registro |
| B | Joyeria |
| C | Contacto |
| D | Telefono |
| E | Centro Comercial |

---

## GOOGLE APPS SCRIPT — BACKEND

**URL activa:**
```
https://script.google.com/macros/s/AKfycbzwZl19Kr6dUjP5eG_o8mY0-LqGOAL4Ydq_K_cnMD2_aMQQ0Pu9qVZXDUClJ1x8Z3N0OQ/exec
```

**Endpoints disponibles:**

| Metodo | Parametro | Accion |
|---|---|---|
| GET | / | Retorna todos los pedidos de APP_PEDIDOS como JSON |
| GET | action=getCatalogo | Retorna productos activos de la hoja CATALOGO como JSON |
| POST | tipo: 'cliente' | Registra cliente nuevo en CLIENTES |
| POST | tipo: 'updateStatus' | Actualiza estado y vendedor de un pedido |
| POST | (sin tipo) | Guarda nuevo pedido en APP_PEDIDOS, busca telefono en CLIENTES automaticamente |
| POST | action: 'createProducto' + token | Crea producto nuevo en CATALOGO (requiere ADMIN_TOKEN) |
| POST | action: 'updateProducto' + token | Actualiza producto existente en CATALOGO (requiere ADMIN_TOKEN) |
| POST | action: 'deleteProducto' + token | Soft-delete: setea Activo=FALSE en CATALOGO (requiere ADMIN_TOKEN) |

**Nota:** Las operaciones de escritura al catalogo pasan por `/api/catalog.js` (Vercel serverless) que inyecta el ADMIN_TOKEN. El frontend nunca conoce el token.

**IMPORTANTE:** Si se modifica el Apps Script, hay que redesplegar como Web App con acceso "Cualquier persona" para que siga funcionando.

---

## MAKE.COM — AUTOMATIZACION

| Item | Valor |
|---|---|
| Organizacion ID | 7066630 |
| Team ID | 2066652 |
| Escenario | Davinchi — Notificacion pedido nuevo |
| Escenario ID | 4543122 |
| Cuenta Google conectada | jeronimo.230211@gmail.com (ID: 8065262) |
| Correo notificaciones | davinchidavinchipedidos@gmail.com |

**Flujo del escenario:**
```
Google Sheets "Watch New Rows" (APP_PEDIDOS)
    → Gmail "Send Email" → davinchidavinchipedidos@gmail.com
```

**Frecuencia:** Cada 15 minutos (limite del plan free)

---

## LOCALSTORAGE — CLAVES UTILIZADAS

| Clave | Contenido |
|---|---|
| dav_client | Datos de registro del cliente (shop, contact, phone, cc) |
| dav_orders_{shopName} | Historial de pedidos del cliente |
| dav_apikey | API key de Anthropic (fallback si no hay servidor) |
| dav_entrega_{orderId} | Estado de checkboxes de entrega parcial por pedido |

---

## CATALOGO — ARQUITECTURA ACTUAL (dinamico desde Sheets)

El catalogo ya no esta hardcodeado. Se carga desde la hoja `CATALOGO` de Google Sheets al iniciar sesion.

**Flujo:**
```
doLogin() → loadCatalog() → GET SHEETS_URL?action=getCatalogo → hoja CATALOGO
  → Si falla: usa CATALOG_FALLBACK (hardcodeado en index.html como respaldo offline)
```

**Panel admin (solo CEO):**
- Tab "Catalogo" visible unicamente cuando `currentVendor.role === 'CEO'`
- CRUD completo: crear, editar, desactivar productos
- Las escrituras van por `/api/catalog.js` (Vercel) que inyecta el ADMIN_TOKEN
- Soft-delete: los productos se desactivan (Activo=FALSE), nunca se borran

---

## USUARIOS — CODIGO ACTUAL (hardcodeado en index.html)

```javascript
const VENDORS = [
  {user:'admin', pass:'davinchi2025', name:'Administrador',        role:'CEO'},
  {user:'jero',  pass:'jero2025',     name:'Jeronimo Alvarez',     role:'Vendedor'},
  {user:'yiyo',  pass:'yiyo2025',     name:'Juan Gabriel Alvarez', role:'Vendedor'},
];
```

**Nota de seguridad:** Las contrasenas estan en el frontend — aceptable para MVP pero debe mejorarse si escala.

---

## FLUJO COMPLETO DE UN PEDIDO

```
1. Cliente abre app
2. Registro unico → localStorage + POST CLIENTES en Sheets
3. Catalogo o Chat con IA → arma el pedido
4. Confirma pedido:
   a. Guarda en localStorage
   b. POST a Apps Script → APP_PEDIDOS (con telefono recuperado de CLIENTES)
5. Make detecta nueva fila (cada 15 min)
6. Gmail envia notificacion a davinchidavinchipedidos@gmail.com
7. Panel vendedor polling cada 30 seg → alerta visual
8. Vendedor abre pedido → marca productos entregados
   → POST updateStatus → Sheets (Estado + Vendedor)
9. CEO ve KPIs actualizados
```

---

## PENDIENTES TECNICOS

| Prioridad | Tarea | Notas |
|---|---|---|
| ~~Alta~~ | ~~Panel admin para editar catalogo~~ | ✅ Completado — Marzo 2026 |
| Alta | Dominio propio | pedidos.davinchi.co |
| Media | WhatsApp automatico via Make | Esperando API keys CallMeBot de vendedores |
| Media | Historial pedidos desde Sheets | Actualmente solo localStorage |
| Baja | Version white-label | Abstraer datos del cliente a config file |

---

## NOTAS PARA LOS AGENTES

- **No tocar** la logica de autenticacion sin validar con Jeronimo primero
- **No cambiar** la URL del Apps Script sin redesplegar y actualizar la variable en el codigo
- **Siempre probar** en movil (375px) despues de cualquier cambio de UI
- **El archivo index.html es un single file** — toda la app esta ahi, no crear archivos JS separados sin justificacion
- **Antes de agregar una nueva hoja a Sheets**, verificar que el Apps Script la reconoce y tiene permisos

---

*Ultima actualizacion: Marzo 2026 | Mantenido por Jeronimo Alvarez + Claude Code*
