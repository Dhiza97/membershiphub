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

To create a separate Super Admin for the MembershipHub application, run from the project root and enter the password privately when prompted:

```sh
backend/.venv/bin/python backend/manage.py create_app_super_admin admin@example.com
```

Use the chosen email and password on the frontend login page. This account does not grant access to Django Admin.

Announcements and notifications are not available because there are currently no backend endpoints for them.
