# Implementación web

Requisitos mínimos para llevar el sistema a cualquier proyecto (sitio corporativo, plataforma B2B, landing).

## 1. Carga de fuentes

Ambas familias son de Google Fonts. En el `<head>`, antes de cualquier CSS:

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Quicksand:wght@400..600&family=Work+Sans:wght@400..600&display=swap" rel="stylesheet">
```

Para producción con alto tráfico, auto-hospeda los `.woff2` (subset latin) y usa `font-display: swap`.

## 2. Tokens

- Importa `tokens.css` (generado desde `tokens.json`) una sola vez en la raíz. Expone variables CSS: colores `--bg-page`, `--text`, `--action-primary`…; espaciado `--space-4`; radios `--radius-md`; sombras `--shadow-md`; tamaños `--control-md`; familias `--font-display` y `--font-body`.
- Tema oscuro: `<html data-theme="dark">`. Para seguir al sistema operativo, asigna el atributo con `matchMedia('(prefers-color-scheme: dark)')` y guarda la elección del usuario.
- Nunca escribas HEX en componentes: siempre `var(--token)`.
- Tailwind: usa el preset de la carpeta *Desarrollo* de Assets (`tailwind.preset.js`), que mapea los mismos tokens a clases (`bg-surface`, `text-heading`, `rounded-md`, `font-display`).
- Figma: los mismos nombres deben existir como Variables (colección *Color* con modos Claro/Oscuro; colecciones *Spacing* y *Radius*) para que diseño y código hablen el mismo idioma.

## 3. Componentes

`components/bundle.css` contiene los componentes con prefijo `ep-` (Button, TextField, SearchField, Checkbox, StockBadge, QuantityStepper, DataTable, ProductCard, Alert, Tabs, StatCard, OrderSummary, AppHeader). Son CSS puro: funcionan en HTML, React, Vue o cualquier framework. Envuelve la app en `.ep-root`.

## 4. Head mínimo

```html
<html lang="es" data-theme="light">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="#162373">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">   <!-- europartners-isotipo-color.svg -->
<link rel="icon" href="/favicon-32.png" sizes="32x32">
<link rel="apple-touch-icon" href="/apple-touch-icon-180.png">
<link rel="manifest" href="/site.webmanifest">                 <!-- íconos 192 y 512 -->
```

`site.webmanifest`: `name` *Europartners*, `theme_color` #162373, `background_color` #F8F8F8, íconos `favicon-192.png` y `favicon-512.png`.

## 5. Breakpoints (mobile-first)

| Token | min-width | Cambio |
|---|---|---|
| `bp-sm` | 640px | Formularios a 2 columnas |
| `bp-md` | 768px | Tablas como filas (debajo: tarjetas) |
| `bp-lg` | 1024px | Barra lateral de filtros fija; navegación completa |
| `bp-xl` | 1280px | Contenido al ancho `content-max` |

## 6. Accesibilidad (WCAG 2.2 AA)

- Contrastes del sistema verificados ≥ 4.5:1 en texto y ≥ 3:1 en bordes, iconos y foco, en ambos temas.
- Foco visible con `--focus-ring`; nunca `outline: none` sin reemplazo.
- Tablas con `<th scope>`, `aria-sort` en columnas ordenables, `aria-selected` en filas seleccionadas.
- Errores ligados con `aria-describedby`; `role="alert"` solo para errores bloqueantes.
- Idioma `lang="es"`; formatos numéricos con `Intl.NumberFormat('es-CO')`.

## 7. Rendimiento

- Logos en SVG inline o `<img>` con `width`/`height` declarados.
- Fotografía de catálogo en AVIF/WebP, `loading="lazy"`, relación 4:3 fija para evitar saltos de layout.
- Presupuesto: LCP < 2,5 s, CLS < 0,1 en la página de catálogo.

## 8. Documentos PDF y correos

- PDF (proformas, facturas, fichas técnicas, manifiestos): HTML + CSS Paged Media, `@page { size: A4; margin: 16mm 14mm 18mm; }`, cabecera con logo horizontal color (con descriptor a 70 mm o más de ancho; si no, sin descriptor), tabla `ep-table--brand`, bloque de total en `ultramar`, pie con datos legales y `counter(page)`. Fuentes embebidas.
- Correo: tablas de 600px, estilos en línea, `font-family: 'Work Sans', Arial, sans-serif`, cabecera `ultramar-ink` con `europartners-horizontal-blanco@2x.png` a 180px (transaccional) o `europartners-horizontal-descriptor-blanco@2x.png` a 320px (comercial) — los clientes de correo no garantizan SVG, botón *bulletproof* en `indigo` con texto blanco, `bgcolor` duplicado para Outlook.
