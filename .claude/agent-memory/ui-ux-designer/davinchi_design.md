---
name: Davinchi App — Design Decisions
description: Color palette, component patterns, UX conventions, and onboarding decisions for the Davinchi App project
type: project
---

## Color Palette (Davinchi overrides agency standard)

- `--ink: #1C1A14` — background principal (reemplaza --color-bg)
- `--gold: #C8A45A` — acento principal (reemplaza --color-primary)
- `--gold-light: #D4B06A` — hover state del dorado
- `--gold-dim: rgba(200,164,90,0.7)` — texto secundario activo
- `--surface: #FFFFFF` — superficies de cards
- `--text: #2A2618` — texto oscuro sobre fondo claro
- `--text-muted: #8A8070` — texto secundario
- Tipografía: Playfair Display (títulos), Outfit (body)

## Modal / Bottom-Sheet Pattern

Los modales suben desde abajo: `translateY(100%) → translateY(0)`, `transition: 0.35s ease-out`.
Overlay: `rgba(28,26,20,0.65)`.
Border-radius: `20px 20px 0 0`.
Este patrón ya existe en el detalle de pedidos — mantener consistencia.

## Onboarding — Decisiones Aprobadas (pendiente validación Jerónimo)

- 3 onboardings distintos: Cliente, Vendedor, CEO
- Formato: bottom-sheet modal, máximo 4 slides
- Disparador Cliente: después de submitRegistro() exitoso, primera vez
- Disparador Vendedor/CEO: después de doLogin() exitoso, primera vez por rol
- localStorage keys: `dav_ob_client`, `dav_ob_vendor`, `dav_ob_ceo`
- CTA final unificado para los 3 roles: "¡Empezar!" (Jerónimo confirmó este criterio en brief)
- Slide 1 de Cliente usa client.name disponible en dav_client para personalizar: "Bienvenida, [nombre]" (tomar solo primer nombre con .split(' ')[0])
- Transición entre slides: solo fade del contenido interno, no del sheet completo

## Usuarios Confirmados

- Clientes: joyerías colombianas, típicamente atendidas por mujeres, usan celular
- Vendedores: equipo interno Davinchi, usan celular en campo
- CEO: accede desde cualquier dispositivo, necesita KPIs y control de catálogo

## Arquitectura de Roles (del código)

- Cliente: flujo catálogo → carrito → chat IA → mis pedidos
- Vendedor: tabs Pedidos + Resumen
- CEO: tabs Pedidos + Resumen + Catálogo (tab exclusivo, se muestra en doLogin según role === 'CEO')
