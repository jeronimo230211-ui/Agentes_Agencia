# Field Sales OS — White-Label Template

**Based on:** Davinchi App (first deployment)
**Purpose:** Reusable template for any company with field sales teams taking orders manually

## What This Template Provides

- Mobile-first order system (catalog + cart + AI chat)
- Vendor panel with order status management
- CEO dashboard with KPIs (OTIF, revenue, vendor rankings)
- Google Sheets database
- Email notifications via Make.com
- Vercel deployment-ready

## Configuration Points (to abstract per client)

- [ ] `config.js` — client name, branding, currency
- [ ] `catalog.js` — product list and prices
- [ ] `users.js` — vendor/admin credentials
- [ ] `sheets.js` — Google Apps Script endpoint URL
- [ ] CSS variables — brand colors

## Pricing Reference

| Market | Project | Monthly SaaS |
|---|---|---|
| Colombia | $8.000.000 COP | $600.000 COP/mes |
| Global | $1,900 USD | $150 USD/mo |

## Status

- [ ] Extract config from Davinchi App
- [ ] Create template scaffold
- [ ] Document setup steps (< 4h to deploy for a new client)
- [ ] Build product landing page
