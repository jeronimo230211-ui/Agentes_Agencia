# PROJECT SUMMARY — Davinchi App

> Archivo de referencia para los agentes. Leer antes de tocar cualquier cosa de este proyecto.

---

## CLIENTE

**Empresa:** Davinchi  
**Industria:** Fabricacion y distribucion de estuches y vitrinas para joyerias en Colombia  
**Contacto proyecto:** Jeronimo Alvarez (founder agencia)  
**Estado:** Produccion activa  
**URL:** https://davinchi-app.vercel.app  
**Repositorio:** github.com/jeronimo230211-ui/Davinchi_App

---

## PROBLEMA QUE RESOLVIMOS

Los vendedores de Davinchi visitaban joyeria a joyeria tomando pedidos a mano o por celular. El proceso era:
- Manual y lento
- Sin trazabilidad (no se sabia el estado de cada pedido)
- Sin visibilidad para el CEO (no habia metricas en tiempo real)
- Sin notificaciones automaticas al equipo

---

## SOLUCION ENTREGADA

Sistema web completo con 3 vistas diferenciadas:

**Vista cliente (joyeria):**
Catalogo de productos con fotos, carrito, chat con IA para hacer pedidos en lenguaje natural, historial de pedidos, selector de asesor por WhatsApp.

**Vista vendedor:**
Panel de pedidos con filtros por estado, actualizacion automatica cada 30 segundos, boton WhatsApp directo al cliente, gestion de entregas parciales por producto.

**Vista CEO (admin):**
Dashboard con KPIs en tiempo real: OTIF, valor vendido, ticket promedio, ranking de vendedores, entregas parciales pendientes, top 5 clientes activos.

---

## STACK TECNICO

| Componente | Tecnologia | Costo |
|---|---|---|
| Frontend | HTML/CSS/JS puro (single file) | Gratis |
| Hosting | Vercel | Gratis |
| IA conversacional | Claude claude-sonnet-4-20250514 via API | ~$0.001/conversacion |
| Base de datos | Google Sheets | Gratis |
| Backend/API | Google Apps Script (Web App) | Gratis |
| Automatizacion | Make.com (plan Free) | Gratis |
| Notificaciones | Gmail via Make | Gratis |
| Repositorio | GitHub | Gratis |

**Costo total de infraestructura: $0/mes** (hasta escalar)

---

## ARQUITECTURA

```
Cliente abre app (index.html en Vercel)
    → Chat con IA → /api/chat.js (proxy seguro Claude API)
    → Confirma pedido → POST a Google Apps Script
        → Guarda en Google Sheets (APP_PEDIDOS)
        → Make detecta nueva fila (cada 15 min)
        → Gmail envia notificacion al equipo
    → Panel vendedor polling cada 30 seg
        → Alerta visual si hay pedidos nuevos
    → Vendedor actualiza estado
        → POST updateStatus → Google Sheets
    → CEO ve KPIs actualizados
```

---

## USUARIOS DEL SISTEMA

| Usuario | Rol | Acceso |
|---|---|---|
| admin / davinchi2025 | CEO - Administrador | Dashboard KPIs + todos los pedidos |
| jero / jero2025 | Vendedor - Jeronimo Alvarez | Panel de pedidos |
| yiyo / yiyo2025 | Vendedor - Juan Gabriel Alvarez | Panel de pedidos |

**WhatsApp vendedores:**
- Jeronimo Alvarez: +57 312 279 5696
- Juan Gabriel Alvarez: +57 310 598 2502

**Correo del equipo:** davinchidavinchipedidos@gmail.com

---

## CATALOGO DE PRODUCTOS

| ID | Producto | Precio | Stock |
|---|---|---|---|
| VG3P | Vitrina Giratoria 3P | $450.000 COP | 4 |
| ETN | Estuche Terciopelo Negro | $85.000 COP | 18 |
| ETR | Estuche Terciopelo Rojo | $75.000 COP | 2 |
| EA360 | Exhibidor Acrilico 360 | $220.000 COP | 3 |
| CMP | Caja Madera Premium | $680.000 COP | 12 |
| SBJ | Soporte Busto Joyeria | $95.000 COP | 20 |
| BO | Bandeja Organizadora | $65.000 COP | 7 |

**PROBLEMA ACTUAL:** El catalogo esta hardcodeado en index.html. Pendiente: panel admin para editarlo sin tocar codigo.

---

## PENDIENTES / PROXIMOS PASOS

- [ ] Panel admin para editar productos y precios sin tocar codigo
- [ ] Dominio propio: pedidos.davinchi.co
- [ ] WhatsApp automatico via Make (esperando API keys CallMeBot de vendedores)
- [ ] Historial de pedidos desde Google Sheets (actualmente solo localStorage)
- [ ] Version white-label para vender a otras empresas

---

## VALOR DEL PROYECTO

Este sistema resuelve un problema comun a toda empresa con vendedores en campo y clientes B2B. La arquitectura es replicable en pocas horas para cualquier empresa con catalogo fisico.

**Precio potencial como SaaS:** $50-200 USD/mes por cliente empresarial

*Ultima actualizacion: Marzo 2026*
