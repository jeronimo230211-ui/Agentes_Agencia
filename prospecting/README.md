# Prospecting — Nexora IA

Pipeline de generación de leads con Apify Google Maps Scraper.

## Flujo completo

```
Apify (Google Maps) → JSON output → process_leads.py → CSV → Outreach
```

## Paso 1 — Correr el scraper en Apify

1. Ir a [apify.com](https://apify.com) → **Actors** → buscar **"Google Maps Scraper"**
2. Click **"Try for free"** o **"Input"** si ya lo tienes guardado
3. Ir a la pestaña **"Input"** → click **"JSON"**
4. Pegar el contenido de `apify_input.json`
5. Click **"Start"** y esperar (aprox. 5-15 min según volumen)
6. Al terminar: **"Export"** → **"JSON"** → guardar como `apify_output.json` en esta carpeta

## Paso 2 — Procesar el output

```bash
# Básico
python process_leads.py apify_output.json

# Con filtros más estrictos
python process_leads.py apify_output.json --min-rating 4.0 --min-reviews 10
```

Genera: `leads_nexora_YYYYMMDD_HHMM.csv`

## Paso 3 — Criterios de prioridad

| Prioridad | Criterio | Acción |
|-----------|----------|--------|
| 🔴 ALTA | Tiene teléfono, SIN web | Pitch directo: "necesitan presencia digital + automatización" |
| 🟡 MEDIA | Tiene teléfono Y web | Pitch: "automatización de atención al cliente / inventario" |
| ⚪ BAJA | Sin teléfono | Contacto frío más difícil — deprioritizar |

## Configuración del scraper (`apify_input.json`)

| Campo | Valor | Descripción |
|-------|-------|-------------|
| `maxCrawledPlacesPerSearch` | 20 | Lugares por búsqueda (26 búsquedas × 20 = ~520 leads brutos) |
| `includeReviews` | false | Ahorra créditos de Apify |
| `includeContacts` | true | Extrae email y teléfono si está disponible |

## Columnas del CSV de salida

`nombre, categoria, direccion, ciudad, pais, telefono, sitio_web, email, rating, total_reviews, google_maps_url, estado_horario, tiene_web, tiene_telefono, prioridad`
