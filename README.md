# Voice Chatbot SaaS

Embeddable voice agent: FastAPI + MySQL, Next.js dashboard, `widget.js` for WordPress/HTML, Python LiveKit worker.

## What is included

- Tenant register/login
- Agent + Q&A knowledge (FAQ)
- Meeting booking (internal time slots, no Google Calendar)
- Order collection (name, phone, address, items)
- Support tickets (voice files a ticket; tenant gets email/webhook)
- Product catalog for orders
- Outbound webhooks + optional SMTP
- Monthly voice minute cap (no Stripe)
- Embed snippet + conversation transcripts
- Voice call when LiveKit + OpenAI keys are set

Turn modules on per agent under Settings. The voice worker only succeeds on tools whose module is on.

SMTP is optional (`.env`). Webhooks are per agent under Integrations. Google Calendar, Stripe, WooCommerce, and Twilio are not included.

## Requirements

- Python 3.9+ for the API (3.11+ recommended). The LiveKit agent needs 3.11+.
- Node.js 18+
- MySQL 8 (XAMPP MySQL is fine)

Optional for live voice:

- [LiveKit Cloud](https://cloud.livekit.io) URL, API key, secret
- OpenAI API key (Realtime)

Without those keys, dashboard and FAQ still work. The widget shows that voice is offline.

## 1. Database

Create an empty database:

```sql
CREATE DATABASE voice_chat CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

XAMPP: phpMyAdmin or MySQL shell. Default URL assumes user `root` and empty password on port `3306`.

Or Docker MySQL only (port **3307**):

```bash
docker compose up mysql -d
```

Then set `DATABASE_URL=mysql+pymysql://root:voicechat@localhost:3307/voice_chat`

## 2. Environment

```bash
copy .env.example .env
```

Edit `.env`:

- `DATABASE_URL`
- `JWT_SECRET` and `INTERNAL_AGENT_SECRET` (any long random strings)
- `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`
- `OPENAI_API_KEY`
- optional `SMTP_*` for booking/order/ticket email

## 3. Run locally (three terminals)

**API** (from repo root):

```bash
cd apps/api
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Tables are created on API startup. Optional migrations:

```bash
cd apps/api
alembic upgrade head
```

**Dashboard:**

```bash
cd apps/web
npm install
npm run dev
```

Open http://localhost:3000 — register, create an agent, add FAQ, copy the embed snippet.

**Voice worker** (only with LiveKit + OpenAI keys):

```bash
cd apps/agent
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python agent.py
```

## 4. Try the widget

1. Dashboard → agent → Embed, copy the public key.
2. Open http://localhost:8000/demo and paste the key.
3. Click the mic button (browser must allow microphone). `localhost` works over HTTP; production sites need HTTPS.

WordPress: Appearance → Theme File Editor → `footer.php`, or a header/footer plugin. Paste:

```html
<script src="http://localhost:8000/widget.js" data-agent-key="pk_YOUR_KEY" async></script>
```

In production replace the host with your public API URL (`API_PUBLIC_URL`).

## Docker (all services)

Copy `.env`, then:

```bash
docker compose up --build
```

- API: http://localhost:8000
- Dashboard: http://localhost:3000
- MySQL: localhost:3307

## Layout

```
apps/api      FastAPI + SQLAlchemy + Alembic
apps/web      Next.js dashboard
apps/widget   widget.js (also served at /widget.js)
apps/agent    LiveKit worker
```

The voice agent never talks to MySQL. It calls FastAPI `/v1/internal/*` with `X-Agent-Secret`.
