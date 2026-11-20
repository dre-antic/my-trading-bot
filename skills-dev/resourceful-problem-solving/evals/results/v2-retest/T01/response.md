Use a shared Google Sheet, a Google Form, Google Calendar, and a private Google My Map. Leave the custom app for later, if you ever need it.

That set already lets neighbors list tools, ask to borrow one, get an email before it is due back, and see a rough map. It runs in a phone browser, costs nothing, and needs no paid hosting, no paid map API, and no Apple developer account.

## Why this fits

You know a little HTML, and you would be the person keeping this running. A real app also needs user accounts, a database, and reminder email, and someone has to keep that stack healthy. A website made of free Google tools passes the test this week, and the data stays in a spreadsheet you can download any time.

You are the steward. Neighbors need a phone browser and an email address. They can submit the request form without a Google account.

## How to set it up

1. **Catalog.** A Google Sheet with a Tools tab: name, category, owner, email, rough location (cross street or block), available yes/no, notes, link to a photo.
2. **Requests.** A Google Form, "Ask to borrow," that writes into a Loans tab: tool, borrower name, borrower email, date needed, due date. Turn on the form's email notice for new responses so you see requests as they arrive.
3. **Reminders.** When you hand a tool over, create a Google Calendar event on the due date, invite the borrower, and turn on the email reminder for the day before. Title it "Return the drill to Sam." Google sends the email. No text-message fees.
4. **Map.** [Google My Maps](https://www.google.com/maps/about/mymaps/), shared by link. One pin per tool, placed on the block or a nearby intersection. Build and edit the map on a computer. Neighbors open the link in the phone browser. Google's product page also says these maps show up in the Google Maps app under Your Places.
5. **Front door.** A Google Site, or one simple HTML page, with three big buttons: See the tools, Ask to borrow, Map. On a phone, use the browser's Add to Home Screen. That is the app, including on iPhones.

## What I checked

Google My Maps is still free with a Google account. Google's own tutorial shows you can import a spreadsheet (up to 2,000 rows). That import is a copy: later edits to the sheet do not move the pins. For a neighborhood, drop a pin when a tool is added. That takes about a minute, on a computer.

Two free products already exist and are close:

- [Borrow'd](https://www.borrowd.org/) is a nonprofit, free, and built for private groups. It has an inventory, borrow requests, messaging, and a "please bring it back" nudge, and the site is mobile-first. Their [roadmap](https://www.borrowd.org/roadmap/), as published when I read it, still lists Location and Calendar as future work. It does not yet give you a map or a reminder tied to a due date.
- [Community Supplies](https://communitysupplies.org/) is a free hosted neighborhood directory (the start-a-community page says no approval is required). People list items and contact the owner. Their public pages describe it as a directory and coordination layer. I could not find a map of where each tool is, or automatic return reminders. The map on the homepage is of communities.

Paid library software is the wrong shape and the wrong price. [Lend Engine's pricing page](https://www.lend-engine.com/pricing) shows a free plan for 100 items and 100 contacts, with loans and a member website, and automated loan reminders starting on the Starter plan at $12.50 per month (USD prices on that page). It is built for one library site. [myTurn's small-community signup](https://register.myturn.com/library/createOrganization/index?library=true&organizationType.id=4&planId=FREE) shows paid plans from $25 per month or $250 per year. [Glide's September 2026 pricing change](https://www.glideapps.com/changelog/2026-09-01-introducing-new-pricing-and-a-new-mid-tier-plan) gives the free plan 0 published apps, so neighbors could not open one.

## Watch out for

- Put the pin on the block or a nearby intersection, and leave the house number off the map. Share with "anyone with the link." Leave "public on the web" off so the map stays out of search.
- The reminder email goes out only if someone creates the calendar event at handoff. Write that into the checkout checklist. If loans pile up, that manual step is the first thing to automate.
- Ladders and saws can hurt people. Add two lines to the form: items are borrowed as-is, and the lender mentions any known problems. This setup does not insure anyone. Suggest that people check their renter's or homeowner's policy.

## First step

Create the Sheet, add the Tools and Loans tabs, share it with one neighbor, and enter five real tools with cross streets. Then make the form and one calendar event, and confirm the reminder email shows up. Add the map after that.

I can build the sheet, the form questions, the phone front door, and a small script that emails the borrower and the lender the day before the due date, so the calendar step can go away. Say if you want that.

I'll assume the tools live at people's homes, a free Google account is fine for you as the organizer, and the group is invite-only. If everything actually lives in one shared shed, or the neighborhood will not use Google, tell me. A one-site lending system, or Borrow'd, would then fit better.
