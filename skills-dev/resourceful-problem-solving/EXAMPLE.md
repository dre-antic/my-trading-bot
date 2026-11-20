# Practical example

Prompt (eval T09, skill enabled):

> I need to pick a tech stack for an internal invoicing tool for my 10-person agency. There's React, Vue, Svelte, Angular, Next, Remix, Nuxt, Django, Rails, Laravel, Express, NestJS, FastAPI, Go, Postgres, MySQL, Mongo, Supabase, Firebase, Vercel, Netlify, Render, Fly, AWS... I'm a solo developer who knows Python decently. I've been going back and forth for weeks. Just tell me what to use.

**Without the skill:** one custom stack — Django, Postgres, HTMX, Render — and a build order. Competent, and it ignores that invoicing is a solved product. Score 47.

**With the skill:** stop evaluating frameworks. Use Invoice Ninja hosted (Pro), send a real invoice this week; Wave Pro as backup in the US/Canada; self-host only if data must stay on your server; write Python against the API only for a rule the product cannot express. Pricing and export were checked on the vendor pages.

That is the intended behavior: outcome (invoices going out) over method (a new web app), one decision, verified costs, a backup, a first step.

A second example is T07. "Design and build a chore system" without the skill produced a Python server, cron, and tests. With the skill it produced a spreadsheet, a four-week rotation, and a Monday reminder `.ics` file — something a household can actually run.
