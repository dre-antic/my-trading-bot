Build it as a **mobile website saved to the home screen**, with a **Google Sheet as the database** and a **daily email reminder**. That covers listings, borrow requests, return reminders, and a rough map, on iPhone and Android, for $0 and with the HTML you already know.

A native iPhone app needs the paid Apple Developer Program. Skip the App Store. Neighbors open a link in the phone browser, then use **Share → Add to Home Screen**. Email is the reminder, because it reaches people who never install an icon.

I’m assuming tools live in people’s garages, the group is one neighborhood (tens to a couple hundred households), and everyone you lend to has an email address. If the tools actually live in one shared shed, use the ready-made option in the next section and skip the build.

## Use something that already exists when it matches

**Tools stay in people’s homes, the group is in the United States, and you expect about 20 members or fewer.** Start with [ToolPool.Garden](https://toolpool.garden/). It is built for exactly this: neighbors list their own tools, someone asks to borrow, the owner stays anonymous until they choose to reveal themselves, and the details happen in a chat. It is free for the first month, and free after that while the pool stays at or under 20 members and 250 listings. Past either limit it is $4.99 a month. Two gaps matter: the map shows where the *pool* is, and item locations stay off the map on purpose, and return chasing is a conversation in chat. Maintenance chores get email reminders; due dates on borrows do not. You can export your data as JSON.

**One shared collection, checked out from a shed or a table.** Use [ToolTrust](https://tooltrust.org/pricing.php). Their pricing page says the whole product is free: inventory, reservations, memberships, barcode checkout, and email reminders, with CSV export. That is a better fit than writing your own checkout desk. It is a single library catalog, so it will not show a pin for each neighbor’s garage.

**Established library platforms such as myTurn** publish community plans that start at $25 a month on [their signup page](https://register.myturn.com/library/createOrganization/index?library=true&organizationType.id=4&planId=FREE). That is outside a zero budget.

If ToolPool’s free cap, the missing per-tool map, or the missing return emails would bother you in month two, build the sheet version below. You will own the data either way.

## What you are building

One Google account holds three things:

1. A **spreadsheet** you can fix by hand when someone returns a drill on the sidewalk.
2. Two **Google Forms** (Offer a tool, Ask to borrow), which already work on phones.
3. A **web page** served by Google Apps Script: a list, a map, and two big buttons. The same script sends the reminder emails.

Neighbors never need an account. The page is public and shows only what you have approved. Google hosts it over HTTPS at a long `script.google.com` URL. Put that URL in a QR code on a flyer. A custom domain is an annual fee, so leave it for later.

Stay on this stack while the library is neighborhood-sized. A free Gmail account can send **100 email recipients per day** through Apps Script, and a daily job can run **90 minutes** total. Both numbers are from [Google’s current quota table](https://developers.google.com/apps-script/guides/services/quotas), and Google can change them. A few due-date emails a day fits. A blast to the whole block does not.

A separate database such as Supabase’s free plan is a poor first home for this. [Free projects pause after a week of low activity](https://supabase.com/docs/guides/platform/free-project-pausing), and a tool library goes quiet every winter. A Sheet does not pause, and you already know how to read it.

## Privacy, before any pin goes on a map

The public page shows the tool, a first name, and a rough place: “near Maple and 4th,” or a pin on that corner. It does not show a street number, a phone number, or an email.

Collect the real address only in the form, and reveal it in the email to the person whose request you approved. Round any coordinates to about a block (three decimal places is roughly 100 meters) if a lender drops a pin on their own house.

Each request is a yes from the owner. The page says, in one sentence, that the borrower will return the tool by the date they picked and will tell the owner if it breaks. You are organizing a favor, and you are not insuring it.

## Build it in this order

### 1. Run it by hand for a week

Make a Google Sheet with two tabs.

**Tools**

| Column | Example | Notes |
| --- | --- | --- |
| `id` | 14 | A number you type. Shown on the card. |
| `tool_name` | Cordless drill | |
| `details` | 18V, two batteries | |
| `owner_name` | Sam | First name only on the public page. |
| `owner_email` | sam@email.com | Hidden on the page. Used for requests and reminders. |
| `landmark` | Maple and 4th | What strangers see. |
| `lat` | 41.826 | Optional. Blank until you have a corner to pin. |
| `lng` | -71.403 | Same. |
| `status` | available | `available`, `out`, or `retired`. |
| `approved` | yes | Only `yes` is public. New rows start as `no`. |

**Loans**

| Column | Example | Notes |
| --- | --- | --- |
| `id` | 3 | |
| `tool_id` | 14 | Matches Tools. |
| `tool_name` | Cordless drill | Copied so reminders stay readable. |
| `borrower_name` | Riley | |
| `borrower_email` | riley@email.com | |
| `owner_email` | sam@email.com | |
| `status` | requested | Then `out`, `returned`, or `declined`. |
| `due` | 2026-11-27 | A real date. The reminder reads this. |
| `last_reminded` | | The script fills this in so it emails once a day. |

Share the sheet with one other organizer as an editor. Leave it private. “Anyone with the link can edit” would let a stranger wipe it out.

**Offer a tool** form fields: name, email, tool, details, nearest intersection. Responses land on a third tab, or you paste them into Tools as `approved = no`. You flip `approved` to `yes` after a quick look.

**Ask to borrow** form fields: name, email, tool id, due date. In the form’s three-dot menu, use **Get pre-filled link** so each card on the website can open the form with the tool id already filled in.

Until the website exists, you and the other organizer watch the sheet and write the emails yourselves. If nobody lists anything, stop here. You will have spent an evening, not a season.

### 2. Add the phone page

In the sheet: **Extensions → Apps Script**. Create `Index.html` and `Code.gs`. Deploy as a **Web app**, execute as **Me**, access **Anyone**. Execute-as-me means visitors do not get a Google permission screen, and every visit spends *your* quota, which is the right trade for a public catalog.

The page is one column:

- Title and a line about returning tools on time.
- Two buttons, full width, at least 48px tall: **Offer a tool** (the offer form) and the list below.
- Each available, approved tool is a card: name, details, first name, landmark, and **Ask to borrow** linking to the pre-filled form.
- A map under the list, only for rows that have `lat` and `lng`.

Put this in the HTML `<head>` so phones lay it out correctly:

```html
<meta name="viewport" content="width=device-width, initial-scale=1">
```

Apps Script can add the same tag from `doGet`:

```javascript
function doGet() {
  const page = HtmlService.createTemplateFromFile('Index');
  page.toolsJson = JSON.stringify(publicTools()).replace(/</g, '\\u003c');
  return page.evaluate()
    .setTitle('Neighborhood tool library')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function publicTools() {
  const sheet = SpreadsheetApp.getActive().getSheetByName('Tools');
  const values = sheet.getDataRange().getValues();
  const header = values.shift().map(String);
  const at = (row, name) => row[header.indexOf(name)];
  return values
    .filter(row => String(at(row, 'approved')).toLowerCase() === 'yes'
                 && String(at(row, 'status')).toLowerCase() === 'available')
    .map(row => ({
      id: at(row, 'id'),
      name: at(row, 'tool_name'),
      details: at(row, 'details'),
      owner: at(row, 'owner_name'),
      landmark: at(row, 'landmark'),
      lat: at(row, 'lat'),
      lng: at(row, 'lng')
    }));
}
```

In the page, `const TOOLS = <?!= toolsJson ?>;` inside a `<script>` tag. The `<` replacement keeps a tool name from breaking out of that script. Cards are a loop over `TOOLS`. The borrow link is your pre-filled form URL with the tool id in the matching `entry.` field.

Style it with ordinary CSS: system font, 16px body text, cards with padding, buttons stacked. Test in Chrome’s phone-sized window, then on a real phone. That is the whole front end.

**Home screen.** On an iPhone: Safari or Chrome → Share → Add to Home Screen. On Android: Chrome menu → Add to Home screen (wording varies). The icon opens the site. Web push on iPhone works only after that install, needs extra server machinery, and still [does not require an Apple Developer account](https://developer.apple.com/documentation/usernotifications/sending-web-push-notifications-in-web-apps-and-browsers). Email is the path that works for the neighbor who only ever taps the link in a group text.

### 3. Turn on return reminders

Set the spreadsheet’s timezone to the neighborhood’s timezone. In Apps Script, add a time-driven trigger: **Triggers → Add trigger → `sendReturnReminders` → Day timer → 8am to 9am**.

```javascript
function sendReturnReminders() {
  const sheet = SpreadsheetApp.getActive().getSheetByName('Loans');
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return;
  const header = values[0].map(String);
  const col = name => header.indexOf(name);
  const today = startOfDay(new Date());

  for (let r = 1; r < values.length; r++) {
    const row = values[r];
    if (String(row[col('status')]).toLowerCase() !== 'out') continue;
    const due = row[col('due')];
    if (!(due instanceof Date)) continue;
    const daysUntil = Math.round((startOfDay(due) - today) / 86400000);
    if (daysUntil > 1) continue; // tomorrow, today, and each overdue day
    const last = row[col('last_reminded')];
    if (last instanceof Date && startOfDay(last).getTime() === today.getTime()) continue;
    if (MailApp.getRemainingDailyQuota() < 2) break;

    const tool = row[col('tool_name')];
    const when = daysUntil < 0 ? 'overdue' : (daysUntil === 0 ? 'due today' : 'due tomorrow');
    const borrower = row[col('borrower_email')];
    const owner = row[col('owner_email')];
    if (borrower) {
      MailApp.sendEmail(
        borrower,
        'Please return the ' + tool,
        'The ' + tool + ' is ' + when + '. Reply to this email to set up the handoff.'
      );
    }
    if (owner && owner !== borrower) {
      MailApp.sendEmail(
        owner,
        tool + ' is ' + when,
        row[col('borrower_name')] + ' has the ' + tool + ', which is ' + when + '.'
      );
    }
    sheet.getRange(r + 1, col('last_reminded') + 1).setValue(new Date());
  }
}

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
```

Your part stays small: when you say yes to a request, set that loan’s `status` to `out` and set `due`. When it comes back, set `status` to `returned` and set the tool’s `status` back to `available`. The emails stop. Run the function once from the editor to approve the Gmail permission before the morning trigger needs it.

Each loan emails two people, so the daily cap covers about 50 reminders. The quota check stops the loop before Google throws, and the next morning continues any leftovers.

### 4. Add the map

When a listing’s landmark is real, open [openstreetmap.org](https://www.openstreetmap.org/), find that corner, and copy the latitude and longitude from the URL into `lat` and `lng`. Doing it by hand means you never send addresses to a paid geocoder.

On the page, [Leaflet](https://leafletjs.com/) plus OpenStreetMap tiles needs no API key and no billing account. Load the current Leaflet CSS and JS from Leaflet’s download page. For a neighborhood, center the map on your area at zoom 14, then add a marker per tool that has coordinates:

```javascript
const map = L.map('map').setView([41.826, -71.403], 14);
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  referrerPolicy: 'strict-origin-when-cross-origin'
}).addTo(map);

TOOLS.forEach(tool => {
  if (tool.lat === '' || tool.lng === '') return;
  L.marker([Number(tool.lat), Number(tool.lng)]).addTo(map)
    .bindPopup(tool.name + '<br>' + tool.landmark);
});
```

Give the map div a height, around `60vh`, and a width of 100%.

Follow the [OpenStreetMap tile usage policy](https://operations.osmfoundation.org/policies/tiles/): use that exact `https://tile.openstreetmap.org/{z}/{x}/{y}.png` URL, keep the attribution visible, let the browser cache tiles, and only load tiles for the map the person is looking at. A neighborhood catalog is the kind of light, interactive use the policy allows. Skip any “download the map for offline” button. If a tile image fails to load, check that the page is not sending `Referrer-Policy: no-referrer`.

If the Apps Script page refuses the Leaflet files from a CDN, paste `leaflet.css` and `leaflet.js` into the Apps Script project as HTML files and include them from there. The map code stays the same.

## How a borrow actually goes

1. Sam submits “cordless drill, near Maple and 4th.” You set `approved` to `yes`. It appears on the list and the map.
2. Riley taps **Ask to borrow**. The form already contains tool 14. Riley picks a due date.
3. You check the new loan row, email Sam if you want a human yes, then set the loan to `out` and the tool to `out`. The card leaves the “available” list.
4. The 8am job emails Riley the day before, the day of, and each day it stays out.
5. Sam gets it back. You set the loan to `returned` and the tool to `available`.

Photos can wait. “18V cordless drill, two batteries” is enough to get a yes. A shared Drive folder of pictures is an easy later addition.

## When the sheet starts to feel small

Move the same HTML to [Cloudflare Pages](https://developers.cloudflare.com/pages/platform/limits/). The free plan serves a static site over HTTPS on a `pages.dev` address, with no credit card. Keep the Sheet and the reminder script where they are until a real limit shows up (the mail cap, or you are tired of tapping `approved`).

At that point the page and the data can separate. Export the sheet first so the move is a copy, not a leap. The product stays a website with email reminders. The App Store still does not belong in this project.

## What I would want to know

If you reply with three facts, the plan gets sharper: whether the tools sit in homes or in one shed, roughly how many households, and whether everyone can receive email. Homes plus email plus a small crowd is the sheet above. One shed is ToolTrust, and you can be lending this weekend without writing a page.
