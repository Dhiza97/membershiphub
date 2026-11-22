# MembershipHub --- Agent Guide

## 1. Project overview

**Project name:** MembershipHub

MembershipHub is a multi-branch church membership-class management
platform. It helps a church centrally manage its membership classes
while allowing individual branches to run their own cohorts and manage
their students, instructors, sessions, attendance, assessments, and
results.

The platform is intended to support one organization with multiple
branches. Central administrators can oversee all branches, while
branch-level users should only access records belonging to their own
branch.

### Product goals

-   Centralize membership-class administration across branches.
-   Manage branches, cohorts, students, instructors, and enrollments.
-   Track class sessions and student attendance.
-   Deliver quizzes and exams and record results.
-   Determine graduation eligibility.
-   Generate certificates and support certificate verification.
-   Provide useful reports and dashboards.
-   Preserve historical cohort records when curriculum or class
    requirements change.

## 2. Product decisions and domain concepts

Treat the following as established project decisions unless the project
owner explicitly changes them.

### Organization structure

-   **Organization:** The church or central institution using
    MembershipHub.
-   **Branch:** A location or organizational unit belonging to the
    organization.
-   **Cohort:** A particular membership-class group run by a branch over
    a period.
-   **Session:** An individual class meeting within a cohort.
-   **Enrollment:** The relationship between a student and a cohort.
-   **Attendance:** The record of a student's attendance at a particular
    session.

A branch may run multiple cohorts. A cohort contains multiple students
and multiple sessions.

### Curriculum

The church provides a standardized curriculum. Branches may customize
selected aspects, subject to rules that still need to be defined.

Plan for curriculum versioning or cohort-specific snapshots so that
later curriculum changes do not silently alter the requirements of
ongoing or completed cohorts.

Do not assume which curriculum fields are centrally locked and which are
branch-editable. Confirm those rules with the project owner before
implementing customization.

### Roles

The application roles are:

1.  **Super Admin** --- organization-wide administration and oversight.
2.  **Branch Admin** --- administration limited to the assigned branch.
3.  **Instructor** --- teaching and class-management responsibilities
    within assigned cohorts or branches.
4.  **Student** --- access to their own learning, attendance,
    assessments, and results.

Every newly created user defaults to the **Student** role. Only a Super
Admin can assign or change a user's role to **Branch Admin**, and a
Branch Admin must be assigned to exactly one branch under the current
single-role-per-user model. The role assignment must be enforced in
backend permission checks and must not rely on frontend controls.

The initial Django superuser is a technical administrator account and
may act as the first Super Admin for setup. Django's technical
`is_superuser` flag and MembershipHub's application roles are distinct
concerns; the implementation should not treat any `is_staff` or
`is_superuser` flag alone as a complete role model.

### Multi-branch data isolation

-   Start with one PostgreSQL database.
-   Model branch ownership and relationships explicitly.
-   Enforce access restrictions in backend querysets, services, and
    permission checks.
-   Never rely on frontend hiding or filtering as the security boundary.
-   A Branch Admin must not be able to read or modify another branch's
    records by changing an ID in a request.
-   Super Admin access may span branches, subject to the organization's
    authorization rules.

## 3. Agreed technology stack

  -----------------------------------------------------------------------
  Area                                Technology
  ----------------------------------- -----------------------------------
  Frontend                            React with Vite

  Frontend language                   JavaScript initially

  Styling                             Tailwind CSS

  Backend                             Python with Django

  API                                 Django REST Framework

  Database                            PostgreSQL

  Version control                     Git and GitHub

  Certificate PDFs                    To be selected; ReportLab or
                                      WeasyPrint are candidates

  Testing                             Django testing tools; pytest may be
                                      introduced later
  -----------------------------------------------------------------------

Keep the frontend and backend as separate applications. Do not introduce
Next.js, TypeScript, microservices, or additional infrastructure without
a clear requirement and agreement from the project owner.

## 4. Repository structure

The intended high-level structure is:

``` text
membershiphub/
├── frontend/
│   ├── public/
│   └── src/
│       ├── assets/
│       ├── components/
│       ├── layouts/
│       ├── features/
│       ├── services/
│       ├── hooks/
│       ├── App.jsx
│       └── main.jsx
├── backend/
│   ├── .venv/                 # Never commit
│   ├── apps/
│   │   ├── accounts/
│   │   └── core/
│   ├── config/
│   ├── .env                   # Never commit
│   ├── manage.py
│   └── requirements.txt
├── docs/
├── .gitignore
└── README.md
```

This is a target structure, not a requirement to create every folder
immediately. Add Django apps and frontend feature folders incrementally
when the corresponding feature is ready to be built.

## 5. Current implementation status

The following setup work has been completed according to the project
owner's reported terminal output and screenshots:

-   A Git repository and project directories have been started.
-   A Python virtual environment is being used for the backend.
-   Django and Django REST Framework are installed.
-   PostgreSQL 18.7 is installed and running.
-   The PostgreSQL server connection was confirmed on `localhost`, port
    `5434`.
-   A PostgreSQL database named `membershiphub_db` and database user
    named `membershiphub_user` were intended for the project.
-   Django is configured to load database settings from `backend/.env`
    using `python-dotenv`.
-   Django's database configuration uses PostgreSQL and environment
    variables.
-   `apps.accounts` and `apps.core` are registered in `INSTALLED_APPS`.
-   A custom user model exists at `apps/accounts/models.py`:

``` python
from django.contrib.auth.models import AbstractUser


class User(AbstractUser):
    pass
```

-   `AUTH_USER_MODEL = "accounts.User"` is set in Django settings.
-   Initial migrations were successfully created and applied.
-   The custom User model has been registered in
    `apps/accounts/admin.py` using Django's `UserAdmin`.
-   A superuser account was created and successfully viewed in Django
    Admin.

### Immediate next task

A health-check API endpoint is being created.

Expected `apps/core/views.py`:

``` python
from rest_framework.decorators import api_view
from rest_framework.response import Response


@api_view(["GET"])
def health_check(request):
    return Response({
        "status": "ok",
        "message": "MembershipHub API is running"
    })
```

Expected `apps/core/urls.py`:

``` python
from django.urls import path
from .views import health_check


urlpatterns = [
    path("health/", health_check, name="health-check"),
]
```

Expected `config/urls.py`:

``` python
from django.contrib import admin
from django.urls import path, include


urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", include("apps.core.urls")),
]
```

The intended test URL is:

`http://127.0.0.1:8000/api/health/`

**Known issue to check:** The project owner encountered this error:

``` text
AssertionError: @api_view expected a list of strings, received set
```

It was caused by writing `@api_view({"GET"})`. The decorator must
receive a list or tuple, such as `@api_view(["GET"])`. Do not assume the
fix has been applied or that the server now starts; ask for or inspect
the current code/output before proceeding.

## 6. MVP scope

The first demonstrable MVP is intended to cover:

-   Authentication and basic role-based access.
-   Branch management.
-   Student records.
-   Cohorts and student enrollment.
-   Class sessions and attendance.
-   Multiple-choice quizzes/exams and automatic grading.
-   Results and attendance percentages.
-   Basic graduation eligibility.
-   Certificate generation.
-   A basic dashboard.

Potential later features include spreadsheet import, notifications,
audit logs, advanced analytics, QR attendance, and richer curriculum
customization. Do not let these expand the initial MVP without explicit
prioritization.

## 7. Suggested domain model direction

Build and validate the domain incrementally. Likely entities include:

-   Organization
-   Branch
-   User and role/branch membership
-   Student profile
-   Cohort
-   Enrollment
-   Curriculum and CurriculumVersion
-   Cohort curriculum assignment or snapshot
-   Lesson or learning material
-   Session
-   Attendance
-   Assessment
-   Question and answer options
-   Assessment attempt and response
-   Result
-   Certificate and certificate template
-   Audit log
-   Notification
-   Import job and import row

Important relationship guidance:

-   Students should be associated with cohorts through an Enrollment
    model rather than a single permanent cohort field.
-   Attendance should be an explicit model connecting a student and a
    session, with status and timestamp.
-   Consider a database uniqueness constraint on the student/session
    pair to prevent duplicate attendance records.
-   Assessments should support attempts and recorded responses, not only
    a single score field.
-   Preserve completed cohort records and the curriculum requirements
    that applied to them.

These are design directions, not a mandate to create all models at once.
Confirm detailed requirements before locking down the schema.

## 8. Engineering and collaboration rules for coding agents

### Work incrementally

-   First understand the current repository and existing code.
-   Do not assume the implementation matches this guide; the actual code
    is the source of truth.
-   Ask for relevant files, command output, or error traces when needed.
-   Make one coherent change at a time.
-   Explain the purpose of each file, model, function, and important
    code block.
-   Avoid dumping an entire application or many unrelated files at once.
-   Do not silently overwrite working code or remove existing
    functionality.
-   Before suggesting migrations, inspect model and migration state.
-   Do not run destructive database commands or recommend deleting data
    to solve a routine issue.

### Teach, do not just generate

The project owner is using MembershipHub to learn Python and Django
while applying software-engineering practices.

When guiding the owner:

-   Explain what the code does and why it is needed.
-   Explain unfamiliar Python, Django, and HTTP concepts in accessible
    language.
-   Prefer small exercises and checkpoints.
-   Ask the owner to run commands and report actual output.
-   Help interpret errors instead of simply replacing code.
-   Do not assume prior Django knowledge based on their React/JavaScript
    experience.
-   Keep explanations clear and concise, but do not omit important
    reasoning.

### Code quality

-   Prefer readable, conventional Django and React patterns.
-   Use clear names and keep responsibilities focused.
-   Avoid premature abstraction and unnecessary dependencies.
-   Validate input on the backend.
-   Use database constraints for important integrity rules where
    appropriate.
-   Handle expected errors deliberately.
-   Add tests for important business rules and permissions.
-   Keep API responses and error behavior consistent.
-   Document non-obvious decisions.

### Security and privacy

-   Never commit `.env`, passwords, tokens, secret keys, or personal
    data.
-   Keep secrets in environment variables.
-   Do not expose credentials in logs, examples, screenshots, or
    responses.
-   Do not trust client-supplied branch IDs without authorization
    checks.
-   Enforce role and branch permissions on every relevant backend
    endpoint.
-   Use Django's password handling; never store plaintext passwords.
-   Treat certificate verification and student information as
    security-sensitive.
-   Do not disable security protections merely to make a local test pass
    without explaining the trade-off.

### Dependencies and architecture

-   Do not add packages unless they solve a current requirement.
-   Do not introduce microservices or complex infrastructure for the
    MVP.
-   Keep business rules out of React components.
-   Keep Django views thin as the application grows; introduce
    serializers, services, selectors, and permission classes when their
    responsibilities justify them.
-   Avoid premature generic frameworks or overengineering.

## 9. Development commands

Run backend commands from the `backend/` directory with the virtual
environment activated.

``` bash
# Activate the virtual environment (macOS / zsh)
source .venv/bin/activate

# Check Django configuration
python manage.py check

# Create migrations after model changes
python manage.py makemigrations

# Apply migrations
python manage.py migrate

# Create an administrator
python manage.py createsuperuser

# Start the development server
python manage.py runserver

# Install backend dependencies
python -m pip install <package>

# Update dependency list after intentional dependency changes
python -m pip freeze > requirements.txt
```

The PostgreSQL 18 server was confirmed on port `5434`. Keep
`DB_PORT=5434` in the local environment configuration unless the server
configuration is deliberately changed and verified.

Run frontend commands from `frontend/`:

``` bash
npm install
npm run dev
```

## 10. Definition of done

A feature is not complete merely because its code has been written.

For each feature, aim to:

1.  Confirm the requirement and expected behavior.
2.  Implement the smallest coherent solution.
3.  Validate inputs and permissions on the backend.
4.  Add or update tests for important behavior.
5.  Run relevant checks and tests.
6.  Verify the behavior manually where appropriate.
7.  Update documentation if the feature changes setup, API behavior, or
    architecture.

## 11. Open questions to resolve with the project owner

Do not invent answers to these questions. Raise them when they become
relevant:

-   What are the exact organization and branch administration workflows?
-   Can one user belong to multiple branches or hold different roles in
    different branches?
-   Which student fields are required, optional, or unique?
-   Can a student enroll in multiple cohorts over time?
-   Which curriculum elements are centrally controlled and which may
    branches customize?
-   What are the exact attendance, assessment, grading, and graduation
    rules?
-   Can instructors teach across branches or cohorts?
-   What certificate information must be displayed, and how should
    verification work?
-   What notification channels are required for the MVP?
-   What are the expected import formats and duplicate-resolution rules?

## 12. Agent operating principle

**Build MembershipHub as a secure, understandable, maintainable learning
project.**

Prioritize correctness, clear domain modeling, backend-enforced
permissions, and the project owner's understanding over speed, code
volume, or unnecessary architectural complexity. Treat this guide as
project context; verify the current repository state before taking
action.
