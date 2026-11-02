Europartners es la mente estratégica que transforma la cadena de suministro de acabados para la construcción en una ventaja competitiva. Este sistema traduce el rebranding 2026 a reglas y piezas para construir la web, la plataforma B2B de pedidos, los documentos y los correos.

> La excelencia no sucede por azar: se diseña con precisión, criterio y anticipación.

## Principios

1. **Precisión antes que adorno.** Cada pantalla responde a una decisión de compra o de logística: qué hay, cuánto, cuándo llega, cuánto cuesta y en qué condiciones.
2. **Flujo continuo.** El símbolo representa el movimiento de valor desde el proveedor en origen hasta la obra. Las interfaces avanzan en un solo sentido claro: buscar → cotizar → aprobar → pagar → rastrear.
3. **Contenedores que resguardan.** Agrupa la información en bloques nítidos (tarjetas, tablas, bloques de total) con jerarquía evidente.
4. **Densidad legible.** El comprador B2B compara decenas de SKU a la vez: prioriza tablas compactas, cifras tabulares y estados visibles sobre imágenes grandes.

## Logotipo

El logotipo tiene tres disposiciones (horizontal, vertical e isotipo) y el descriptor **Global Investors**. Mira la tarjeta *Logo* para cada versión sobre su fondo aprobado.

**Qué versión usar**
- **Con descriptor** (`europartners-horizontal-descriptor-*`, `europartners-vertical-descriptor-*`): piezas institucionales — portada de presentaciones y PDF, papelería, firma de correo comercial, hero y pie del sitio, stands.
- **Sin descriptor** (`europartners-horizontal-*`, `europartners-vertical-*`): interfaz de la plataforma (header, login), correos transaccionales y cualquier uso por debajo del tamaño mínimo del descriptor.
- **Isotipo** (`europartners-isotipo-*`): favicon, avatar, ícono de app, marca de agua y patrones, solo cuando el nombre ya está presente en la pieza.
- No combines el descriptor con otro texto (*International*, nombres de área) en el mismo bloque del logo: el nombre legal va en el texto del documento.

**Qué tinta usar según el fondo**

| Versión | Tintas | Fondos permitidos |
|---|---|---|
| Color | `ultramar-ink` + `indigo` | `neutral-0`, `marmol`, `gris-manual`, `cuarzo-soft` |
| Ultramar (una tinta) | `ultramar-ink` | Claros y `cuarzo`; impresión a una tinta |
| Blanco | blanco | `ultramar`, `ultramar-ink`, `indigo`, fotografía con velo ≥ 70 % |
| Bicolor (solo vertical) | `ultramar-ink` + blanco | Solo `indigo` |
| Negro | #000000 | Impresión en blanco y negro, grabado, sellos; nunca en pantalla |
| Isotipo índigo | `indigo` | Claros (`neutral-0`, `marmol`) |
| Isotipo cuarzo | #CDC9FB | Solo `ultramar` / `ultramar-ink` (marca de agua); nunca sobre claros (1.6:1) |

**Tamaños mínimos**

| Versión | Pantalla | Impresión |
|---|---|---|
| Horizontal con descriptor | 320px de ancho | 70 mm |
| Horizontal sin descriptor | 120px | 30 mm |
| Vertical con descriptor | 180px | 40 mm |
| Vertical sin descriptor | 80px | 20 mm |
| Isotipo | 16px (favicon) / 24px en UI | 8 mm |

Por debajo del mínimo con descriptor, cambia a la versión sin descriptor: no reduzcas el descriptor hasta hacerlo ilegible.

**Reglas**
- Área de protección: la altura de la pieza superior del isotipo en todos los lados.
- No recolorees fuera de estas versiones, no apliques degradados, sombras ni contornos, no separes el isotipo del nombre en la horizontal, no cambies la tipografía del nombre ni el espaciado del descriptor.
- El logotipo usa sus propias tintas (`ultramar-ink` #000E67, `indigo` #5A57D8 y el cuarzo del isotipo #CDC9FB); no lo pintes con `ultramar` #162373 ni con `cuarzo` #D2CFF7 de la interfaz.

## Color

La paleta es sobria y técnica: azules profundos y violetas que sostienen 20 años de trayectoria.

| Rol | Token | HEX | Uso |
|---|---|---|---|
| Primario | `ultramar` | #162373 | Autoridad: navegación, encabezados, bloques de total |
| Primario | `indigo` | #5A57D8 | Innovación: acción primaria, foco, enlaces activos |
| Acento | `cuarzo` | #D2CFF7 | Confianza: chips activos, destacados, fondos de acento |
| Complementario | `marmol` | #F8F8F8 | Claridad: fondo de página |

- Construye siempre con los tokens semánticos (`bg-page`, `bg-surface`, `text`, `text-heading`, `action-primary`…), nunca con HEX directos: así el tema oscuro funciona solo.
- Proporción en interfaces: 70 % superficies neutras (`marmol`, `neutral-0`), 20 % `ultramar` (estructura y títulos), 8 % `indigo` (acción), 2 % `cuarzo` (acento).
- Una sola acción `action-primary` por vista. `indigo` no es color de texto largo: úsalo en botones, foco y enlaces cortos; para enlaces en párrafos usa `text-link` (`indigo-deep`).
- Texto sobre `cuarzo` o `bg-accent`: `text-on-accent`. Texto sobre `bg-brand`: `text-on-brand`.
- Colores de estado (`success`, `warning`, `danger`, `info`) solo para estados reales de stock, pago o validación, siempre con icono y palabra; nunca decorativos.
- Marketing puede usar degradados suaves de `indigo` a `cuarzo` como fondo de foto o panel (como el manual); la interfaz de datos, no.

## Tipografía

- **Quicksand** (`--font-display`) para títulos, cifras destacadas y frases de impacto: `display-xl`, `display-lg`, `heading-1…3`, `figure-lg`. Geométrica con terminaciones redondeadas.
- **Work Sans** (`--font-body`) para cuerpo, interfaces, etiquetas y datos técnicos: `text-body`, `text-label`, `text-code`, `text-caption`, `text-overline`.
- Cuerpo de la aplicación en `text-body` (14/20); tablas densas en `text-body-sm` (13/18); marketing y correo en `text-body-lg` (16/24).
- Activa `font-variant-numeric: tabular-nums` en toda cifra que se compara (precios, m², cantidades). Los códigos de producto van en `text-code`, nunca en monoespaciada.
- `display-xl` admite MAYÚSCULAS para manifiestos (*UN CAMBIO*); el resto de títulos va en oración. Eyebrows en `text-overline` (mayúsculas espaciadas), como *PROFORMA INVOICE*.
- Pesos: Quicksand 400–600; Work Sans 400 (texto), 500 (etiquetas), 600 (énfasis y botones). Evita 700+ salvo en cifras de documento.

## Espaciado y layout

- Escala base de 4px: `space-1` (4) a `space-24` (96). Dentro de tablas y controles usa `space-2`–`space-3`; entre bloques `space-6`–`space-8`; secciones de landing `space-16`.
- Grilla de 12 columnas, `content-max` 1280px, gutter `space-8` en escritorio y `space-6` en móvil.
- Controles: `control-sm` 32px (tablas, filtros), `control-md` 40px (por defecto), `control-lg` 48px (CTA y táctil).
- Filas: `row-compact` 36px para listas de precios y pedidos masivos; `row-default` 48px con miniaturas.

## Formas, radios y sombras

- Controles `radius-sm` (6px); tarjetas de producto y alertas `radius-md`; paneles y modales `radius-lg`; tarjetas de marketing `radius-xl` (como las muestras de color del manual).
- El gesto de marca son los **paneles con una esquina muy redondeada** (`radius-2xl`), como la portada del manual: úsalo en heros y bloques de foto, una vez por pantalla.
- Sombras tintadas de ultramar: `shadow-sm` controles, `shadow-md` tarjetas sobre `bg-page` y menús, `shadow-lg` modales. En interfaces densas prefiere bordes (`border`) a sombras.

## Iconografía

- El manual no define un set de iconos. Usa iconos de **trazo lineal, 1.75px, extremos redondeados** (estilo Lucide, licencia ISC) a 16px en UI y 20px en alertas y navegación, en `currentColor`.
- Iconos funcionales para el sector: búsqueda, filtro, caja, pallet, contenedor/barco (en tránsito), reloj (bajo pedido), descarga de ficha técnica, comprobante.
- No uses emoji ni iconos rellenos de colores. Un icono nunca sustituye a la etiqueta en acciones principales.

## Imagen

- Fotografía real de operación: fábricas en origen, control de calidad, muestrarios, obra terminada. Personas trabajando con el material, no posando.
- Tratamiento de marca: velo de `indigo`/`ultramar` sobre la foto con transición a `cuarzo` (como las portadas del manual) solo en marketing.
- En catálogo, la pieza real fotografiada plana, con luz neutra y sin velo: el color del material debe ser fiel.

## Estados y accesibilidad

- Contraste mínimo 4.5:1 para texto y 3:1 para bordes de control, iconos y foco en ambos temas; todos los pares semánticos del sistema lo cumplen.
- Foco visible en todo control: contorno de 2px `focus-ring` con 2px de separación.
- Estados de stock y pago siempre con icono + palabra; el color refuerza, no informa solo.
- Áreas táctiles de 40px mínimo (`control-md`); 48px en móvil para acciones primarias.
- Respeta `prefers-reduced-motion`: transiciones de 120–200ms solo en color y opacidad.
