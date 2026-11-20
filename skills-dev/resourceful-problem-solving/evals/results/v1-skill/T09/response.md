Use Invoice Ninja’s hosted service. Send the first real invoice this week.

A 10-person agency needs invoices that go out, a record of what is unpaid, project time that can be billed, and more than one person able to work in the system. Invoice Ninja already does that: projects, billable time, recurring invoices, a client portal, and online payment through Stripe, PayPal, Square, GoCardless, and similar gateways. You know Python, and you are the only developer. A custom app in React, Next, Django, FastAPI, or any of the other stacks you listed would leave you maintaining payments, tax details, email delivery, backups, and the security of the agency’s financial records. That work has already taken weeks before a line of it exists.

Start on **Pro**: $14 per month, or $140 per year. That plan is one user, with unlimited clients and invoices. Buy extra logins only when someone else must send invoices or log time. Extra users are the Enterprise plan. Invoice Ninja’s pricing update (published October 1, 2025, updated May 2026, in effect January 1, 2026) lists Enterprise at $18/month for 2 users ($180/year) and $54/month for 10 users ($540/year). The current pricing page still shows Enterprise starting at $18/month and scaling by user count. The free plan is genuine and includes invoicing plus projects, and it stops at 5 clients. An agency of this size will pass that immediately, so budget for Pro from the start.

You can take the data with you. Invoice Ninja’s data-privacy page documents export of clients, invoices, payments, and related records as CSV, Excel, or JSON from Settings → Import/Export on the hosted app (`https://app.invoiceninja.com/settings/import_export`). Export once in the first week and keep the file.

**Backup.** If the business is in the United States or Canada, and the job is invoices plus bookkeeping (time can stay in a spreadsheet or whatever you already use), use Wave Pro: $190 USD per year for the business, unlimited invoices and clients, and collaborator logins included. Wave’s pricing page puts admin, editor, and viewer access on Pro, and Wave’s help center says the product is for businesses in the United States and Canada only. The free Starter plan does not add those users.

**What would change this.** If the main job is payroll, sales-tax filing, or a full set of books, use an accounting product such as QuickBooks or Xero, and confirm its current price before you subscribe. If financial data has to stay on a server you control, self-host Invoice Ninja for your own business. The source is available under the Elastic License 2.0 for that use, every hosted Pro and Enterprise feature is included, and removing their branding is $40/year. You then own updates, backups, and email delivery. Write code only when a billing rule cannot be expressed in the product. That code should be a small Python script against Invoice Ninja’s API, which Pro includes.

I’m assuming the agency is billing its own clients, that the business may be outside the US and Canada, that one person can send invoices on day one, and that a hosted account plus a regular export is acceptable. If you are in the US or Canada and time tracking can stay where it is, say so and the pick switches to Wave Pro. If the data has to live on your server, say so and the pick switches to self-hosted Invoice Ninja.

**First step.** Create the account at [invoiceninja.com](https://invoiceninja.com/pricing-plans/), add your logo, one real client, and one real invoice, and send it. Connect a payment gateway when you want a Pay button. Until that approval comes through, record payments by hand.

Sources, checked November 20, 2026:

- [Invoice Ninja pricing](https://invoiceninja.com/pricing-plans/)
- [Invoice Ninja pricing update, January 1, 2026](https://invoiceninja.com/pricing-update-january-1-2026/) (page updated May 2026)
- [Invoice Ninja data export](https://invoiceninja.github.io/docs/legal/data-privacy)
- [Invoice Ninja self-hosting terms](https://invoiceninja.com/self-hosting-terms/) (Elastic License 2.0; own-business use; white-label $40/year)
- [Wave pricing](https://www.waveapps.com/pricing) (Pro $190 USD/year; collaborator roles on Pro)
- [Wave account availability](https://support.waveapps.com/hc/en-us/articles/32449161224852-Create-a-Wave-account) (United States and Canada only)
- [Zoho Invoice pricing](https://www.zoho.com/us/invoice/pricing/) (free, and capped at 2 users, 3 projects, and 500 invoices a year, which is too small here)
- [FreshBooks pricing](https://www.freshbooks.com/pricing) (plans from $23 to $70 per month, plus $11 per extra team member)
