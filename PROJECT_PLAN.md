# Project Plan — "Capitalism But Make It Hot"

> Amazon Vine Review Assistant — Comprehensive build plan from zero to deployment.

---

## Phase 0: Project Scaffolding
- [x] Create `.CLAUDE` context file
- [x] Create `.gitignore`
- [x] Create `.env.example`
- [ ] Create `.env` with real credentials (manual — do NOT commit)
- [x] Initialize project directory structure:
  ```
  Capitalism_But_make_it_hot/
  ├── backend/
  │   ├── app/
  │   │   ├── __init__.py
  │   │   ├── main.py          # FastAPI entrypoint
  │   │   ├── config.py        # Env/settings loader
  │   │   ├── routes/
  │   │   │   ├── reviews.py   # Review generation endpoints
  │   │   │   ├── products.py  # Product lookup/scraping
  │   │   │   └── settings.py  # LLM config endpoints
  │   │   ├── services/
  │   │   │   ├── llm.py       # Featherless.ai LLM client
  │   │   │   ├── scraper.py   # Amazon product page scraper
  │   │   │   └── csv_parser.py# CSV import/export logic
  │   │   └── models/
  │   │       └── schemas.py   # Pydantic models
  │   ├── requirements.txt
  │   └── Dockerfile
  ├── frontend/
  │   ├── src/
  │   │   ├── components/
  │   │   ├── pages/
  │   │   ├── hooks/
  │   │   ├── lib/
  │   │   └── App.tsx
  │   ├── package.json
  │   └── Dockerfile
  ├── docker-compose.yml
  ├── .env.example
  ├── .gitignore
  ├── .CLAUDE
  ├── PROJECT_PLAN.md
  └── README.md
  ```
- [x] Create `README.md` with setup instructions

---

## Phase 1: Backend — Core Infrastructure
**Goal:** Running FastAPI server in Docker that can talk to Featherless.ai.

### 1.1 FastAPI Setup
- [x] `main.py` with CORS, health check, and route mounting
- [x] `config.py` using `pydantic-settings` to load `.env`
- [x] `requirements.txt` with pinned versions (fastapi, uvicorn, httpx, openai, beautifulsoup4, pydantic-settings, python-multipart)

### 1.2 LLM Service
- [x] `services/llm.py` — OpenAI-compatible client pointing at Featherless.ai
- [x] Support configurable: model, temperature, max_tokens, top_p, frequency_penalty, presence_penalty
- [x] Prompt template that injects product context + sample reviews + star rating
- [x] Style-matching logic: select sample reviews matching the user's chosen star tier

### 1.3 Product Scraping Service
- [x] `services/scraper.py` — Fetch Amazon product page by ASIN
- [x] Extract: product title, description, average rating, top positive/negative review themes
- [x] Handle rate limiting and errors gracefully (rotating UAs, 3s rate limit, exponential backoff)
- [ ] Consider using a headless browser (Playwright) if needed for JS-rendered content

### 1.4 CSV Parsing Service
- [x] `services/csv_parser.py` — Parse uploaded CSVs
- [x] Validate required columns (sample reviews: `star_rating`, `review_text`)
- [x] Validate product list columns (`ASIN`, `Product Name`)
- [x] Export functionality: generate CSV or TXT from review data

### 1.5 API Routes
- [x] `POST /api/upload/samples` — Upload sample reviews CSV
- [x] `POST /api/upload/products` — Upload product list CSV
- [x] `GET /api/products/{index}` — Get product at index from uploaded list
- [x] `POST /api/products/{asin}/scrape` — Scrape Amazon product page
- [x] `POST /api/reviews/generate` — Generate review (accepts ASIN, star rating, product context)
- [x] `POST /api/reviews/export` — Export reviews as CSV or TXT download

### 1.6 Docker
- [x] `backend/Dockerfile` — Python 3.12 slim, uvicorn
- [ ] Test backend runs standalone in container

---

## Phase 2: Frontend — UI Shell & Core Pages
**Goal:** Responsive SPA with all major views scaffolded.

### 2.1 Project Setup
- [x] Vite + React + TypeScript
- [x] TailwindCSS v4 + shadcn/ui component library
- [x] Lucide icons
- [x] React Router for page navigation

### 2.2 Layout & Navigation
- [x] App shell with header, sidebar/nav, and main content area
- [x] Responsive: collapsible sidebar on mobile (Sheet), full layout on desktop
- [ ] Dark/light mode toggle (optional, nice-to-have)

### 2.3 Pages
- [x] **Home / Upload Page** — Upload sample reviews CSV + product list CSV
- [x] **Product Review Page** — Main workflow (product info → star select → generated review → editor)
- [x] **Control Panel Page** — All settings, data management, history

### 2.4 Docker
- [x] `frontend/Dockerfile` — Node build + nginx serve
- [ ] Test frontend runs standalone in container

---

## Phase 3: Frontend — Feature Implementation

### 3.1 Upload & Parsing
- [x] CSV file upload components with drag-and-drop
- [x] Client-side CSV parsing (Papa Parse)
- [x] Validation feedback (missing columns, malformed rows)
- [x] Store parsed data in localStorage

### 3.2 Product Review Workflow
- [x] Display current product name + ASIN
- [x] "Open in Amazon" button (opens `https://www.amazon.com/dp/{ASIN}` in new tab)
- [x] Star rating selector (1-5 stars, clickable)
- [x] "Generate Review" button → calls backend → displays result
- [x] Product info panel (scraped details, avg rating, common themes) + manual entry fallback

### 3.3 Review Editor
- [x] Editable textarea with the generated review
- [x] **Copy to clipboard** button
- [x] **Regenerate** button → appends to history
- [x] **History navigation** — left/right arrows through regeneration history
- [x] **Add to samples** button — adds review to sample review dataset
- [x] **Append & download** button — adds to output file (CSV or TXT)
- [x] **Next / Previous product** navigation buttons
- [x] Auto-update page when navigating between products

### 3.4 Control Panel
- [x] LLM settings form (locked by default)
- [x] Unlock toggle with confirmation dialog ("Are you sure you want to edit LLM settings?")
- [x] Save / Load settings to/from localStorage
- [x] Appended reviews manager (view, edit, delete)
- [x] Sample reviews manager:
  - [x] Inline editing
  - [x] Upload replacement CSV
  - [x] Download current samples CSV
  - [x] Dedupe & merge: compare uploaded CSV with existing, preview diff, merge
- [ ] Review history (last 10 reviews, clickable to view/edit)
- [x] Output format toggle (CSV / TXT default)

---

## Phase 4: Integration & Docker Compose
**Goal:** Full stack running in Docker with one command.

- [x] `docker-compose.yml` with backend + frontend services
- [x] Frontend proxies API calls to backend (Vite proxy in dev, nginx in prod)
- [x] Shared network, proper port mapping
- [x] Volume mounts for development hot-reload
- [x] Production build configuration (nginx.conf)
- [ ] Test full flow: upload → navigate → generate → edit → export

---

## Phase 5: Deployment
**Goal:** Live on `https://vine.werewolfhowl.com`.

- [ ] Set up `.env` on VPS with real credentials
- [ ] Configure reverse proxy (nginx or Caddy) for HTTPS + domain routing
- [ ] SSL certificate (Let's Encrypt via Caddy or certbot)
- [ ] Deploy via `docker-compose up -d` on VPS
- [ ] Verify end-to-end on production domain
- [ ] Set up basic monitoring / logs

---

## Phase 6: Polish & Hardening
- [ ] Error handling throughout (network failures, LLM timeouts, scraping blocks)
- [ ] Loading states and skeleton UI
- [ ] Input validation on all forms
- [ ] Rate limiting on API endpoints
- [ ] Accessibility audit (keyboard nav, screen reader support)
- [ ] Performance: lazy loading, code splitting
- [ ] Mobile UX pass
- [ ] README finalization with screenshots

---

## Risk Notes & Considerations

| Risk | Mitigation |
|------|-----------|
| Amazon blocks scraping | Use rotating user-agents, rate limit requests, consider a scraping API service as fallback |
| Featherless.ai rate limits | Implement retry with exponential backoff, queue requests |
| Large CSV files | Client-side parsing with streaming (Papa Parse), paginate product list |
| Browser storage limits (~5-10MB) | Monitor usage, offer export/clear, warn when approaching limit |
| Review quality | Iterative prompt engineering, allow user to refine and re-generate |

---

## Priority Order (Recommended Build Sequence)

1. **Phase 0** — Scaffolding (now)
2. **Phase 1.1–1.2** — Backend + LLM service (core value)
3. **Phase 2.1–2.3** — Frontend shell
4. **Phase 3.2–3.3** — Product workflow + editor (main UX loop)
5. **Phase 1.3–1.5** — Scraping + full API
6. **Phase 3.1, 3.4** — Upload flows + control panel
7. **Phase 4** — Docker compose integration
8. **Phase 5** — Deploy
9. **Phase 6** — Polish
