Use **Django, PostgreSQL, server-rendered pages with HTMX, on Render.**

You are one developer who already knows Python, building an internal invoicing tool for ten people. Invoicing is clients, invoices, line items, tax, payments, and PDFs. That is relational data plus a few documents. This stack matches that job and the skills you already have, so you can ship it and keep it running alone.

## The pieces

**Django.** Accounts, permissions, the admin, the ORM, migrations, forms, and email are already there. The admin is your back office: your coworkers can fix a client record or mark a payment while you are in another tab. You stay in Python the whole way.

**PostgreSQL.** Clients, invoices, line items, and payments are related rows that have to add up, and a payment has to land exactly once. Use `Decimal` for money. Django's ORM talks to Postgres; keep a single database.

**Django templates and HTMX.** The UI is ordinary pages: invoice list, invoice detail, client page. HTMX covers the few spots that should update in place (line-item totals, status, filters). One codebase, one language, one deploy.

**Render.** One web service and a managed Postgres database, deploys from the repo, backups included. Set `SECRET_KEY`, `DATABASE_URL`, and your email credentials as environment variables.

## Shape of the app

One Django project. Four models: `Client`, `Invoice`, `LineItem`, `Payment`. Invoice numbers are sequential and unique. Status moves draft → sent → partially paid → paid, with void as a side door. Generate the PDF with WeasyPrint from the same HTML template you use on screen, and email that PDF when the invoice is sent. Auth is Django sessions, staff accounts only.

## Build order

1. Models, migrations, and the admin, so a real invoice exists on day one.
2. Invoice page and PDF download.
3. Send by email.
4. Record payments and show the balance due.
5. A list with filters for unpaid and overdue.

Add Stripe when the agency actually collects cards through the tool. Add a second currency when a client asks for one.

## Versions

Python 3.12, Django 5.x, PostgreSQL 16. One repo, dependencies in `requirements.txt`. One automated test that matters: an invoice total equals the sum of its line items minus its payments, with tax rounded the way you write down.

Build that. Another framework will not make the invoices more correct.
