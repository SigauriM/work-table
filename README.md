# Work Table

[![CI](https://github.com/SigauriM/work-table/actions/workflows/ci.yml/badge.svg)](https://github.com/SigauriM/work-table/actions/workflows/ci.yml)

Work time and payouts. React + Express + PostgreSQL.

## Run

Needs Docker. From this directory:

```bash
cp .env.example .env
```

PowerShell: `Copy-Item .env.example .env`

In `.env` set `ADMIN_LOGIN`, `ADMIN_PASSWORD`, and `JWT_ACCESS_SECRET` (any long random string). Leave `DATABASE_URL` as in the example (the compose service `db`).

```bash
docker compose up
```

Open [http://localhost:5173](http://localhost:5173) and log in with `ADMIN_LOGIN` / `ADMIN_PASSWORD`. Seed creates that admin on startup.
