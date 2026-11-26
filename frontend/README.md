# MembershipHub frontend

Start PostgreSQL and configure the backend database in `backend/.env`, then run migrations and start Django:

```sh
cd backend
.venv/bin/python manage.py migrate
.venv/bin/python manage.py runserver 127.0.0.1:8000
```

In another terminal, start the frontend:

```sh
cd frontend
npm install
npm run dev
```

Sign in using a Django account. Vite proxies `/api/` to `http://127.0.0.1:8000`; set `VITE_API_PROXY_TARGET` when Django uses a different address. The frontend uses session cookies and CSRF protection. In production, serve the frontend and Django API under the same origin, with `/api/` routed to Django.

Announcements and notifications are not available because there are currently no backend endpoints for them.
