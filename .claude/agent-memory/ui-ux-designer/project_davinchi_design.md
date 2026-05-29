---
name: Davinchi App — Design Audit & Context
description: Paleta, identidad visual, componentes y decisiones de diseño documentadas para la Davinchi App (cliente de joyería colombiana)
type: project
---

# Davinchi App — Identidad Visual y Auditoría de Diseño

**Fecha auditoría:** 2026-03-28

## Paleta de colores

```css
--gold: #C8A45A         /* Acción principal, logo, CTAs */
--gold-light: #E2C07E   /* Texto sobre fondo oscuro */
--gold-pale: #F7EDD5    /* Fondo suave, avatares */
--gold-dim: #7A6030     /* Texto secundario premium, precios */
--ink: #1C1A14          /* Fondo de headers, landing, modales oscuros */
--surface: #F9F5EE      /* Fondo general de pantallas */
--surface2: #F0EAD8     /* Fondos de cards, inputs */
--surface3: #E8DFC8     /* Bordes suaves */
--text: #2A2618         /* Texto principal */
--text-muted: #7A7060   /* Texto secundario */
--text-dim: #AEA898     /* Texto terciario, placeholders */
--green: #3D8A5A        /* Éxito, stock disponible, entregado */
--red: #C0442A          /* Error, stock bajo, crítico */
--blue: #2563EB         /* Estado "En proceso" */
```

## Tipografías

- **Playfair Display** (serif): Títulos, nombres de productos, números KPI grandes → tono premium/joyería
- **Outfit** (sans-serif): Todo el cuerpo de texto, labels, botones → legibilidad

## Estructura de pantallas

- **Landing:** 2 tarjetas (cliente / vendedor), fondo `--ink` con panel blanco inferior
- **Registro cliente:** Formulario 4 campos, primera vez / cliente recurrente
- **Catálogo:** Lista vertical de product cards con imagen 160px, precio, qty control
- **Chat IA:** Burbujas conversacionales + chips de acceso rápido + FAB de carrito
- **Carrito:** Lista con thumbnails + total fijo en footer
- **Mis pedidos:** Historial con badges de estado
- **Panel vendedor (Pedidos):** Lista con filtros pill + modal de detalle con checkboxes por producto
- **Panel CEO (Resumen):** KPIs: OTIF, valor vendido, top clientes, ranking vendedores
- **Admin Catálogo:** Lista de productos + modal bottom-sheet para crear/editar

## Decisiones de diseño confirmadas

- FAB dorado de carrito aparece en catálogo cuando hay items (bottom-right, 58px)
- Modal de detalle de pedido es bottom-sheet (slideup animation) — NO navegación de pantalla
- Panel CEO vs Vendedor se diferencia por rol en login (admin = CEO, otros = Vendedor)
- Tab "Catálogo" en panel vendedor solo visible para CEO
- Productos con stock ≤3 muestran badge rojo "Solo X uds"

## Problemas de UX identificados (auditoría 2026-03-28)

1. CSS duplicado: ~30% de estilos en clases, ~70% en inline styles — inconsistencia grave
2. Imagen de producto solo 160px de altura — insuficiente para joyería premium
3. Botones de acción en panel vendedor (pills) son 30px de altura — por debajo del mínimo 44px
4. "Confirmar pedido" en carrito lleva al chat sin confirmación visual clara
5. Estado de carga del catálogo no tiene skeleton — pantalla en blanco mientras carga
6. Pantalla de registro usa 4 campos en scroll — candidata a mejora progresiva
7. Nav inferior del cliente tiene 4 tabs con etiquetas de 10px — muy pequeñas en móvil
8. El campo de imagen en admin acepta texto libre ("Foto1 o URL") — confuso para no técnicos

## Why:
La app fue construida rápido (MVP) priorizando funcionalidad. Los inline styles se acumularon en iteraciones del Developer sin pasar por revisión de diseño.

## How to apply:
Cualquier mejora debe mantener el tono premium (oro + negro + serif) y no romper funcionalidad. Proponer cambios CSS-only o HTML mínimo antes de tocar JS.
