# Startup Idea Validator

A multi-agent AI research crew that validates startup ideas and returns a decision-ready report — market sizing (TAM/SAM/SOM), technical feasibility, SWOT analysis, and an honest 1–10 validation score — in 1–3 minutes, with live progress streaming.

**Stack:** FastAPI · Celery · Redis · CrewAI (Groq) · Supabase · React/Vite

---

## Architecture

```
React frontend ←→ Supabase (Auth + DB + Realtime)
       ↓ POST /validate
FastAPI backend → Redis → Celery worker → CrewAI crew
                                 ↓
                       Supabase (writes run_events)
                                 ↑
             React Realtime subscription (live progress)
```

---

## Local Development Setup

### Prerequisites
- Docker + Docker Compose
- Node.js 18+
- Python 3.11+
- A Supabase project (free tier)
- A Groq API key (free at [console.groq.com](https://console.groq.com))
- A Serper API key (free tier at [serper.dev](https://serper.dev))

### 1. Supabase Setup

1. Create a new project at [supabase.com](https://supabase.com)
2. Run the schema in `supabase/schema.sql` via **SQL Editor**
3. Enable Realtime for `run_events` and `validation_runs` tables:
   - Supabase Dashboard → Database → Replication → Tables → enable both tables
4. Configure OAuth providers (Dashboard → Authentication → Providers):
   - Enable **GitHub** OAuth (create a GitHub OAuth App, set callback URL)
   - Enable **Google** OAuth (create a Google Cloud OAuth client, set callback URL)

### 2. Backend Setup

```bash
cd backend
cp .env.example .env
# Fill in all values in .env

# Start API + worker + Redis with Docker Compose
docker compose up --build
```

The API will be available at `http://localhost:8000`. Docs at `http://localhost:8000/docs`.

### 3. Frontend Setup

```bash
cd frontend
cp .env.example .env
# Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY

npm install
npm run dev
```

The frontend will be available at `http://localhost:5173`.

---

## Deployment

### Railway (API + Worker)

1. Create a Railway project
2. Add a **Redis** add-on
3. Create two services from the same GitHub repo, both pointing to `backend/`:
   - **API service**: Start command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
   - **Worker service**: Start command: `celery -A app.worker.celery_app worker --loglevel=info --concurrency=2`
4. Set all environment variables from `.env.example` in both services
   - Use Railway's shared Redis URL for `REDIS_URL`
   - Set `CORS_ORIGINS` to your Vercel deployment URL

### Vercel (Frontend)

1. Import the repo into Vercel
2. Set Root Directory to `frontend`
3. Add environment variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_API_BASE_URL` → your Railway API service URL

---

## Environment Variables

### Backend (`backend/.env`)

| Variable | Description |
|---|---|
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_ANON_KEY` | Supabase anonymous/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (worker only, never to client) |
| `REDIS_URL` | Redis connection URL |
| `GROQ_API_KEY` | Groq API key for LLM calls |
| `SERPER_API_KEY` | Serper API key for web search |
| `DAILY_RUN_LIMIT` | Max runs per user per day (default: 3) |
| `CORS_ORIGINS` | Comma-separated allowed origins |

### Frontend (`frontend/.env`)

| Variable | Description |
|---|---|
| `VITE_SUPABASE_URL` | Your Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anonymous/public key |
| `VITE_API_BASE_URL` | FastAPI backend URL (empty = use Vite proxy in dev) |

---

## Project Structure

```
├── backend/
│   ├── app/
│   │   ├── agents/       # CrewAI crew, 4 agents, 3 custom tools, callbacks
│   │   ├── api/          # FastAPI routes
│   │   ├── core/         # Config, auth, Supabase clients
│   │   └── worker/       # Celery app + tasks
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   └── src/
│       ├── hooks/        # useAuth, useRunEvents (Realtime)
│       ├── pages/        # Login, Validate, Run, History
│       ├── components/   # AgentProgressFeed, ReportViewer
│       ├── lib/          # Supabase client
│       └── styles/       # CSS per component
├── supabase/
│   └── schema.sql        # Full schema + RLS + helper function
└── docker-compose.yml    # Local dev: api + worker + redis
```
