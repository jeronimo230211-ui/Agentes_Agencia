# Project Lifecycle — Standard Process

Every client project follows this 6-stage flow.

---

## 1. DISCOVERY
- [ ] Interview the client: walk through their current manual process step by step
- [ ] Identify the 3 most painful friction points
- [ ] Define MVP scope — minimum to deliver real value in < 2 weeks
- [ ] Confirm budget range and timeline

**Output:** Scope document (1 page)

---

## 2. ARCHITECTURE
- [ ] Define data structure (Sheets columns, relationships, enums)
- [ ] Define user roles and permissions
- [ ] Choose stack components (use standard stack unless justified)
- [ ] Create blank Google Sheet with column headers

**Output:** Architecture note in `docs/TECHNICAL_NOTES.md`

---

## 3. BUILD
Order: **frontend first → backend → automations**
- [ ] Frontend (HTML/CSS/JS) — client can see and validate early
- [ ] Google Apps Script Web App
- [ ] Vercel serverless functions (`/api/*.js`)
- [ ] Make.com scenario

---

## 4. VALIDATE
- [ ] Test with real data from the client
- [ ] Test on mobile (375px)
- [ ] Fix friction points from client feedback
- [ ] Get client sign-off

---

## 5. DEPLOY & HAND OFF
- [ ] Deploy to Vercel
- [ ] Set up custom domain (if included)
- [ ] Activate Make.com scenario
- [ ] Write `CLIENT_GUIDE.md` (1-page user guide)
- [ ] Train users (video or in-person, max 2h)

---

## 6. PRODUCTIZE (when applicable)
- [ ] Abstract client-specific data into config files
- [ ] Document setup steps (target: < 4h to deploy for a new client)
- [ ] Build product landing page
- [ ] Define SaaS pricing
- [ ] Add to `templates/`
