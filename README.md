# MembershipHub

MembershipHub is a multi-branch church membership-class management platform. It provides tools to manage branches, cohorts, students, instructors, curriculum, sessions, attendance, assessments, graduation results, and certificates.

The project is split into a React/Vite frontend and a Django REST Framework backend, backed by PostgreSQL.

## Requirements

- Python 3
- Node.js and npm
- PostgreSQL

## Backend

Create and activate a virtual environment, then install the Python dependencies:

```sh
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Create `backend/.env` with the PostgreSQL connection settings for your local database:

```dotenv
DB_NAME=membershiphub_db
DB_USER=membershiphub_user
DB_PASSWORD=your-local-database-password
DB_HOST=127.0.0.1
DB_PORT=5432
```

Apply migrations and start Django:

```sh
python manage.py migrate
python manage.py runserver 127.0.0.1:8000
```

Run the backend tests with:

```sh
python manage.py test
```

To create a MembershipHub application Super Admin, run this from the repository root and enter the password when prompted:

```sh
backend/.venv/bin/python backend/manage.py create_app_super_admin admin@example.com
```

This application account is separate from Django Admin access.

## Frontend

In a separate terminal, install the JavaScript dependencies and start Vite:

```sh
cd frontend
npm install
npm run dev
```

Build the frontend for production or run its linter with:

```sh
npm run build
npm run lint
```

Vite proxies `/api/` requests to `http://127.0.0.1:8000`. Set `VITE_API_PROXY_TARGET` if Django is listening at a different address. The frontend uses session cookies and CSRF protection. For production, serve the frontend and Django API under the same origin, routing `/api/` to Django.

Sign in on the frontend using a Django account or a MembershipHub application account.

## Current limitations

Announcements and notifications are not available because there are currently no backend endpoints for them.