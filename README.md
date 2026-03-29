# Capitalism But Make It Hot

> Amazon Vine Review Assistant — generates product reviews using an LLM, guided by your writing style from sample reviews.

## Quick Start

### Prerequisites
- Docker & Docker Compose
- A [Featherless.ai](https://featherless.ai) API key

### Setup

1. **Clone the repo**
   ```bash
   git clone <repo-url>
   cd AmazonReview
   ```

2. **Configure environment**
   ```bash
   cp .env.example .env
   # Edit .env with your API key and credentials
   ```

3. **Run with Docker**
   ```bash
   docker-compose up -d
   ```

4. **Open** [http://localhost](http://localhost)

### Development (without Docker)

**Backend:**
```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

The frontend dev server proxies `/api/*` to `localhost:8000`.

## Usage

1. **Upload** your sample reviews CSV (`star_rating`, `review_text` columns) and product list CSV (`ASIN`, `Product Name` columns)
2. **Navigate** through products — optionally scrape Amazon for product details or enter them manually
3. **Rate** each product (1–5 stars)
4. **Generate** a review that matches your writing style
5. **Edit**, regenerate, copy, or export reviews as CSV/TXT

## Tech Stack

- **Backend:** Python, FastAPI, OpenAI-compatible LLM client
- **Frontend:** React, TypeScript, TailwindCSS, shadcn/ui
- **Infrastructure:** Docker, nginx

## Project Structure

```
backend/           Python FastAPI backend
  app/
    routes/        API endpoints
    services/      LLM, scraper, CSV parser
    models/        Pydantic schemas
frontend/          React SPA
  src/
    components/    UI components
    pages/         Page views
    hooks/         Custom React hooks
    lib/           API client, utilities
docker-compose.yml Container orchestration
```

## License

Private project.
