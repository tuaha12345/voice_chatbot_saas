# Deploy without Docker (VPS + Nginx)

Hand this file to a developer who will put the app on a Linux server **without Docker**.

Target stack:

| Piece | Role | Port (localhost) |
|-------|------|------------------|
| MySQL 8 | Database | 3306 (do **not** expose publicly) |
| FastAPI (`apps/api`) | REST API + `/widget.js` | 8000 |
| Next.js (`apps/web`) | Dashboard | 3000 |
| Python worker (`apps/agent`) | LiveKit voice agent | none |
| Nginx + Let's Encrypt | HTTPS reverse proxy | 80 / 443 |

Suggested domains:

- `https://app.example.com` → dashboard (web)
- `https://api.example.com` → API + widget script

Replace `example.com` with the real domains.

---

## 0. What you need before starting

- Ubuntu 22.04 / 24.04 VPS (or similar)
- SSH access + sudo
- DNS A records for `app` and `api` pointing at the server IP
- LiveKit Cloud project (`LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`)
- OpenAI API key with Realtime access
- A strong admin password (12+ characters) for first bootstrap

Firewall: allow **22**, **80**, **443** only. Do not open MySQL or app ports to the world.

---

## 1. Install system packages

```bash
sudo apt update
sudo apt install -y nginx mysql-server git curl certbot python3-certbot-nginx \
  python3 python3-venv python3-pip build-essential
```

### Node.js 20+

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node -v   # should be v20+
npm -v
```

### Python version

API works on 3.10+. Agent prefers **3.11+**. Check:

```bash
python3 --version
```

---

## 2. Clone the project

```bash
sudo mkdir -p /var/www
sudo git clone <REPO_URL> /var/www/voice_chat
sudo chown -R "$USER:$USER" /var/www/voice_chat
cd /var/www/voice_chat
```

Never commit secrets. Create env from the example:

```bash
cp .env.example .env
nano .env
```

### Production `.env` checklist

```env
APP_ENV=production

DATABASE_URL=mysql+pymysql://voice_user:STRONG_DB_PASSWORD@127.0.0.1:3306/voice_chat
JWT_SECRET=GENERATE_LONG_RANDOM_STRING
JWT_EXPIRE_MINUTES=1440
INTERNAL_AGENT_SECRET=GENERATE_ANOTHER_LONG_RANDOM_STRING

API_PUBLIC_URL=https://api.example.com
WEB_ORIGIN=https://app.example.com
NEXT_PUBLIC_API_URL=https://api.example.com

LIVEKIT_URL=wss://your-project.livekit.cloud
LIVEKIT_API_KEY=
LIVEKIT_API_SECRET=

OPENAI_API_KEY=
OPENAI_ADMIN_API_KEY=
OPENAI_REALTIME_MODEL=gpt-4o-realtime-preview

# Agent talks to local API
API_BASE_URL=http://127.0.0.1:8000
AGENT_NAME=voice-qa

DEFAULT_PLAN_MINUTES=120

ADMIN_EMAIL=you@example.com
ADMIN_PASSWORD=at-least-12-characters

# Optional email
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASSWORD=
SMTP_FROM=
```

Notes:

- `APP_ENV=production` refuses placeholder `JWT_SECRET` / `INTERNAL_AGENT_SECRET`.
- `WEB_ORIGIN` must match the dashboard origin exactly (dashboard CORS).
- Widget embeds use a separate CORS path: browsers may reach `/v1/widget/*`, but sessions are only minted when the site origin is listed in that agent’s **Allowed origins** (exact `https://…`, no `*` in production).
- `NEXT_PUBLIC_API_URL` is baked into the Next.js **build** — set it before `npm run build`.
- `ADMIN_PASSWORD` is used only when creating the admin user the first time (not overwritten on every restart).

Generate secrets:

```bash
openssl rand -base64 48
```

---

## 3. MySQL database

```bash
sudo mysql
```

```sql
CREATE DATABASE voice_chat CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'voice_user'@'localhost' IDENTIFIED BY 'STRONG_DB_PASSWORD';
GRANT ALL PRIVILEGES ON voice_chat.* TO 'voice_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

Use the same password in `DATABASE_URL`.

---

## 4. Install and test the API

```bash
cd /var/www/voice_chat/apps/api
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# loads /var/www/voice_chat/.env via app config
uvicorn app.main:app --host 127.0.0.1 --port 8000
```

In another SSH session:

```bash
curl http://127.0.0.1:8000/health
# expect: {"ok":true}
```

Tables are created automatically on API startup. Stop the test process with Ctrl+C when OK.

Optional migrations:

```bash
cd /var/www/voice_chat/apps/api
source .venv/bin/activate
alembic upgrade head
```

---

## 5. Install and build the dashboard

```bash
cd /var/www/voice_chat/apps/web
npm install

# REQUIRED before build (browser calls this URL)
export NEXT_PUBLIC_API_URL=https://api.example.com
npm run build

# quick test
npm start
# listens on 3000
```

Ctrl+C when the smoke test is done. Systemd will run it permanently.

If you change the API domain later, rebuild:

```bash
export NEXT_PUBLIC_API_URL=https://api.example.com
npm run build
sudo systemctl restart voice-web
```

---

## 6. Install and test the voice agent

```bash
cd /var/www/voice_chat/apps/agent
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

set -a
source /var/www/voice_chat/.env
set +a

python agent.py
```

You should see the LiveKit worker connect (not idle warnings about missing keys). Ctrl+C after a successful start check.

The agent never opens MySQL. It calls FastAPI `/v1/internal/*` with header `X-Agent-Secret: <INTERNAL_AGENT_SECRET>`.

---

## 7. systemd services (auto-start on reboot)

Create three unit files.

### `/etc/systemd/system/voice-api.service`

```ini
[Unit]
Description=Voice Chat FastAPI
After=network.target mysql.service

[Service]
Type=simple
User=www-data
Group=www-data
WorkingDirectory=/var/www/voice_chat/apps/api
EnvironmentFile=/var/www/voice_chat/.env
ExecStart=/var/www/voice_chat/apps/api/.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```

### `/etc/systemd/system/voice-web.service`

```ini
[Unit]
Description=Voice Chat Next.js dashboard
After=network.target voice-api.service

[Service]
Type=simple
User=www-data
Group=www-data
WorkingDirectory=/var/www/voice_chat/apps/web
Environment=NODE_ENV=production
Environment=NEXT_PUBLIC_API_URL=https://api.example.com
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```

### `/etc/systemd/system/voice-agent.service`

```ini
[Unit]
Description=Voice Chat LiveKit agent worker
After=network.target voice-api.service

[Service]
Type=simple
User=www-data
Group=www-data
WorkingDirectory=/var/www/voice_chat/apps/agent
EnvironmentFile=/var/www/voice_chat/.env
ExecStart=/var/www/voice_chat/apps/agent/.venv/bin/python agent.py
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Permissions for `www-data`:

```bash
sudo chown -R www-data:www-data /var/www/voice_chat
sudo chmod 640 /var/www/voice_chat/.env
sudo chmod 750 /var/www/voice_chat
```

Enable and start:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now voice-api voice-web voice-agent
sudo systemctl status voice-api voice-web voice-agent
```

Logs:

```bash
sudo journalctl -u voice-api -f
sudo journalctl -u voice-web -f
sudo journalctl -u voice-agent -f
```

---

## 8. Nginx reverse proxy + HTTPS

### `/etc/nginx/sites-available/voice-app`

```nginx
server {
    listen 80;
    server_name app.example.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

### `/etc/nginx/sites-available/voice-api`

```nginx
server {
    listen 80;
    server_name api.example.com;

    client_max_body_size 20m;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable sites:

```bash
sudo ln -s /etc/nginx/sites-available/voice-app /etc/nginx/sites-enabled/
sudo ln -s /etc/nginx/sites-available/voice-api /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

TLS certificates:

```bash
sudo certbot --nginx -d app.example.com -d api.example.com
```

---

## 9. Post-deploy checklist

1. `https://api.example.com/health` → `{"ok":true}`
2. `https://api.example.com/widget.js` → JavaScript downloads
3. Open `https://app.example.com` → login with admin
4. Register a test tenant → appears as **pending** until admin approves (Admin → Users → Approve)
5. Create an agent, set **Allowed origins** to the customer site (e.g. `https://customersite.com`)
6. Set **Max call length (minutes)** as needed (1–120)
7. Embed on a page:

```html
<script
  src="https://api.example.com/widget.js"
  data-agent-key="pk_YOUR_PUBLIC_KEY"
  async
></script>
```

8. Customer site must be **HTTPS** for microphone access
9. Confirm `voice-agent` logs show a connected LiveKit worker

---

## 10. Updates / redeploy

```bash
cd /var/www/voice_chat
sudo -u www-data git pull   # or pull as deploy user then chown

# API deps
cd apps/api
sudo -u www-data bash -lc 'source .venv/bin/activate && pip install -r requirements.txt'
sudo systemctl restart voice-api

# Web rebuild
cd ../web
sudo -u www-data bash -lc 'export NEXT_PUBLIC_API_URL=https://api.example.com && npm install && npm run build'
sudo systemctl restart voice-web

# Agent deps
cd ../agent
sudo -u www-data bash -lc 'source .venv/bin/activate && pip install -r requirements.txt'
sudo systemctl restart voice-agent
```

---

## 11. Common problems

| Symptom | Likely fix |
|---------|------------|
| API won't start in production | Placeholder `JWT_SECRET` / `INTERNAL_AGENT_SECRET` — set real values |
| Dashboard API calls fail (CORS) | `WEB_ORIGIN` must equal `https://app.example.com` (no trailing slash mismatch) |
| Widget **Failed to fetch** | Redeploy API with path-aware CORS; confirm embed site uses HTTPS |
| Dashboard still hits localhost | Rebuild web with correct `NEXT_PUBLIC_API_URL` |
| Widget “origin not allowed” | Set agent **Allowed origins** to the embedding site origin exactly, e.g. `https://customer-site.com` (include `www` if needed) |
| Voice offline | Check LiveKit + OpenAI keys; `systemctl status voice-agent` |
| New users can't use agents | Admin must **Approve** the account |
| Permission errors under systemd | `chown -R www-data:www-data /var/www/voice_chat` |

---

## 12. Security reminders for production

- Keep `.env` off Git; mode `640`, owned by root/`www-data`
- MySQL bound to localhost only
- New signups need admin approval before agents/widget work
- Per-agent `max_call_minutes` limits long calls
- Monthly `plan_minutes` caps voice usage per tenant
- `/docs` is disabled when `APP_ENV=production`
- `widget.js` is public by design — it contains no secrets; protect cost with per-agent origin allowlists, rate limits, approval, and call/plan limits
- Widget CORS reflects only well-formed HTTPS origins (no credentials); authorization is still `allowed_origins` on session create
- Production rejects `*` in agent allowed origins and rejects HTTP (non-HTTPS) embed origins

---

## Quick command cheat sheet

```bash
sudo systemctl restart voice-api voice-web voice-agent
sudo systemctl status voice-api voice-web voice-agent
sudo journalctl -u voice-api -n 100 --no-pager
curl -s https://api.example.com/health
```
