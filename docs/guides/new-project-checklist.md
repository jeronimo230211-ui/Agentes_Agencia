# New Project Checklist

Use this when starting any new client project.

## Setup
- [ ] Create folder: `clients/client-name/`
- [ ] Copy project structure from `AGENCY_CONTEXT.md` section 9
- [ ] Create GitHub repo: `client-name-app`
- [ ] Create Vercel project linked to GitHub repo
- [ ] Create Google Sheet with required tabs
- [ ] Set Vercel env vars: `ANTHROPIC_API_KEY`, `SHEETS_SCRIPT_URL`

## Development
- [ ] `index.html` — main app
- [ ] `api/chat.js` — Claude proxy (if AI chat needed)
- [ ] Google Apps Script — deploy as Web App
- [ ] Test: empty states, errors, mobile viewport
- [ ] Confirm no secrets in frontend code

## Delivery
- [ ] `docs/CLIENT_GUIDE.md` — 1-page user guide in Spanish
- [ ] `docs/TECHNICAL_NOTES.md` — architecture summary
- [ ] Make.com scenario active and tested
- [ ] Custom domain configured (if included)
- [ ] Client trained

## White-label potential
- [ ] Client-specific data in config (not hardcoded)?
- [ ] Could this be deployed for another client in < 4h?
- [ ] Add to `templates/` if yes
