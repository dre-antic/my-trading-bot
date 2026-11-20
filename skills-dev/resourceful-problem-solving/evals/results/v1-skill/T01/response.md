Build it as a phone web page on a free Google account. Neighbors open one link, list tools, ask to borrow them, and get email when something is due. The map shows a landmark near each tool. Saving the link to a phone's home screen gives you an icon on the phone, and it does not need an Apple developer account, a hosting bill, or a maps key.

You know a little HTML, so the page is written for you. Your part is clicking through Google's setup once, then filling in your neighborhood's landmarks and a shared password. After that, the page runs on Google's side. There is no server to keep awake.

## Why this path

The thing you actually need is small: a catalog, a request, a return reminder, and a rough map, on phones, for no money, looked after by a neighbor. A native app in the App Store is the part that does not fit. Apple's Developer Program is 99 USD per membership year, which I confirmed on [Apple's enrollment page](https://developer.apple.com/programs/enroll/) on 20 Nov 2026. A link does the daily job. On an iPhone, open it in Safari, tap Share, then Add to Home Screen. On an Android phone, use Chrome's menu and Add to Home screen. The browser page works even if nobody adds the icon.

Text-message reminders would mean a paid messaging service. Email stays inside the free Gmail quota, and each approval includes a link that drops the due date onto the person's calendar so the phone can buzz as well.

I checked the products that already do lending, on 20 Nov 2026:

- [myTurn's signup page](https://register.myturn.com/library/createOrganization/index?library=true&organizationType.id=4&planId=FREE) lists community plans starting at $25 a month or $250 a year. The address says FREE. The plans on the page are paid. myTurn is also built for an organization that owns the inventory.
- [Lend Engine's pricing](https://www.lend-engine.com/pricing) has a free plan for 100 items, 100 people, and one site. Automatic return reminders start on the $12.50 a month plan. It is a lending desk, with one address.
- [ToolPool.Garden](https://toolpool.garden/) is the closest match: people list their own stuff. It is free up to 20 members and 250 listings, then $4.99 a month, and only in the United States. Its map is one pin for the whole group. It says item locations are never shown. Borrowing happens in a chat, without a return date.
- [Glide's free plan](https://help.glideapps.com/en/articles/13417470-what-are-the-publishing-limitations-of-the-glide-free-plan-and-why-were-they-implemented) (their article of 17 Jan 2026) can build an app and cannot publish it for other people. [AppSheet's free use](https://support.google.com/appsheet/answer/10104499) covers a prototype with up to 10 test users, and scheduled emails do not send until you pay. Their [pricing](https://about.appsheet.com/pricing/) is per person after that.
- The open-source lending systems I found, such as Circulate and Leihbase, are server software. That needs a machine that stays on, and someone who can maintain it. That does not fit a free hosting budget or a little HTML.

Google Apps Script is included with a free Gmail account. It is not a paid API. [Google's quotas page](https://developers.google.com/apps-script/guides/services/quotas), updated 3 Sep 2026, allows a consumer account 100 email recipients a day through MailApp, and says quotas can change without notice. A neighborhood will sit far under that unless dozens of loans all fall due on the same morning. The [web app guide](https://developers.google.com/apps-script/guides/web) and the [manifest reference](https://developers.google.com/apps-script/manifest/web-app-api-executable), both updated 3 Sep 2026, let the page run as you, including for people who are not signed in to Google.

The map pictures come from OpenStreetMap, which does not need a key. Their [tile usage policy](https://operations.osmfoundation.org/policies/tiles/) allows normal viewing in a browser when the credit stays visible on the map. It forbids downloading tiles in bulk, and they can block a site that overdoes it. This page only loads the neighborhood someone is looking at, keeps the credit on the map, and will not zoom out to a whole region. The tool list still works if the pictures fail. The picture address sits in the spreadsheet so it can be changed later. I left Leaflet 1.9.4 pinned to the copy that cdnjs was serving on 20 Nov 2026.

## Watch out for

**Home addresses stay off the map.** Each pin is a landmark you choose: a park, a school, a library, or a row of shops. The page then nudges each tool a short walk away from that landmark so two drills near the same park are not on top of each other. A house coordinate would tell the neighborhood where someone lives. Meet in a public place.

**The spreadsheet is private.** It holds email addresses. Share it with one other organizer as an Editor. Leave general link sharing off. Neighbors only get the web link.

**The library has to survive one person moving away.** Create a Gmail account that belongs to the library. Put the other organizer on the account recovery options. Once a month, in the spreadsheet, use File, Download, Microsoft Excel, and keep that file somewhere else. If you change the script later, use Deploy, Manage deployments, the pencil, Version set to New version, Deploy. The public link stays the same. A test link ending in `/dev` only works for editors. Share the link ending in `/exec`.

**The first Google warning looks scary and is expected.** The script is yours, and Google has not reviewed it. You will see an unverified-app screen. Choose Advanced, then Go to your project (unsafe), then Allow. You are allowing that script to edit this spreadsheet and to send mail as the library account. Neighbors never see that screen.

**Email apps sometimes open links automatically.** Approve, decline, and returned links only ask a question. Nothing changes until a person taps the button.

**Damage and injury are between the two people.** The approval email says to agree on pickup, care, and loss before the tool changes hands. The page does not insure anything, and it is not a legal contract.

## Set it up

1. Create the library Gmail, with the second organizer as the recovery contact. Sign in as that account. If a work or school Google account blocks scripts, the personal library Gmail is the one that will run this.
2. Create a blank Google Sheet named Neighborhood tool library.
3. Share that sheet with the other organizer as Editor.
4. In the sheet, open Extensions, then Apps Script.
5. Select everything in `Code.gs` and replace it with the first file below.
6. Click the plus sign, choose HTML, and name the file `Index`. Paste the second file into it. The editor may show the file as `Index.html`. The name you type is `Index` only.
7. Open the gear icon, Project settings, and set Time zone to yours. The reminder runs around 8:00 in that zone.
8. Save. In the function dropdown, choose `setupLibrary` and click Run. Walk through the permission screen described above.
9. Choose `installDailyReminder` and click Run.
10. Back in the spreadsheet, fill in **Config**. The keys are already there. Set `libraryName`, `centerLat`, `centerLng`, `zoom` (14 is a neighborhood; 15 is closer), `passphrase`, and `organizerEmail`. Leave `tileUrl` as it is.
11. On **Areas**, add one row per landmark. `areaId` is a short word such as `park`. `name` is what people see, such as `Near the park`. `lat` and `lng` are that landmark.

To get the two numbers, open [openstreetmap.org](https://www.openstreetmap.org) on a computer, search for the landmark, and look at the address bar. It ends in `#map=17/LATITUDE/LONGITUDE`. The first of those two numbers is latitude. The second is longitude. Do the same for the middle of the neighborhood, and put those in `centerLat` and `centerLng`. Use landmarks only.

12. Click Deploy, New deployment. Next to Select type, click the gear and choose Web app. Execute as **Me**. Who has access: **Anyone**. Google's own name for that choice is anyone, even if they are not logged in. If the menu shows two public choices, pick the one that does not require a Google account. Deploy, allow the permissions, and copy the web app URL. It ends in `/exec`.
13. On your phone, open that URL. List a tool with your own email. Request it with a second email you can open. In the owner inbox, open Approve and tap the button. Check that the borrower got the mail and that the tool's status in the sheet is `out`. Open the return link and tap Mark returned. The status goes back to `available`.
14. In Apps Script, choose `sendDueReminders` and click Run once. It should finish quietly. It only sends mail when a loan is due tomorrow, due today, or was due yesterday and is still out. Then it stops, so it does not nag every morning.
15. Give neighbors the `/exec` link. Tell them mail will come from the library Gmail, and to check junk the first time. Give them the neighborhood password in the group chat. Put the link on a poster if you want. Leave the password off a public poster. Anyone with the link can browse. The password is what lets someone list a tool or request one.

To hide a tool, set its status cell to `retired`. If a loan gets stuck, set that loan's status to `returned` and the tool's status to `available`. Leave formulas out of these sheets. A neighbor who adds junk can be removed by deleting that row.

The colors are the block marked `:root` at the top of `Index`. You can change the words on the buttons there too. Leave the `id` values as they are, or the buttons stop talking to the spreadsheet.

## If the deploy step stops you

Use the spreadsheet by hand until the page is up. `setupLibrary` has already made the columns. Neighbors email the organizer, the organizer adds the tool row, and both people put the return date on their own phone calendars. Deploy the page when you can. The reminders and the single phone link are the part worth the setup.

## What would change this

I am assuming the tools stay in people's homes, which is why the map is a set of landmarks. If the tools actually live in one shared shed and a volunteer checks them out at a desk, say so. Lend Engine's free plan fits that shape for up to 100 items, and you would send the return reminders yourself, because that plan does not. A map of neighbors' homes would be the wrong tool for a shed.

I am also assuming a free Google account works where you live, and that one or two neighbors will be able to get into the library account. If either of those is wrong, tell me which one. Those are the two facts that would change the setup.

## File 1: Code.gs

In Apps Script, replace the contents of `Code.gs` with this.

```javascript
/**
 * Neighborhood tool library.
 * Paste this whole file into Code.gs, replacing what is there.
 * Then add an HTML file named Index and paste Index.html into it.
 * Run setupLibrary once, then installDailyReminder once.
 * Deploy as a web app: execute as you, anyone can open it.
 */

// Lending rules for the neighborhood tool library.
// No Google services in this file, so the rules can be tested on their own.
var ToolLibrary = (function () {
  var DEFAULT_TILE = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  function pad(n) {
    return (n < 10 ? '0' : '') + n;
  }

  function isIsoDate(value) {
    var match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match) return false;
    var year = Number(match[1]);
    var month = Number(match[2]);
    var day = Number(match[3]);
    var date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  }

  function addDays(iso, days) {
    var match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
    if (!match) return '';
    var date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
    date.setUTCDate(date.getUTCDate() + days);
    return date.getUTCFullYear() + '-' + pad(date.getUTCMonth() + 1) + '-' + pad(date.getUTCDate());
  }

  function prettyDate(iso) {
    var match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
    if (!match) return String(iso || '');
    var month = MONTHS[Number(match[2]) - 1];
    if (!month) return String(iso);
    return String(Number(match[3])) + ' ' + month + ' ' + match[1];
  }

  function cleanText(value, max) {
    var text = String(value == null ? '' : value).replace(/[\u0000-\u001F]/g, ' ').replace(/\s+/g, ' ').trim();
    if (text.length > max) text = text.slice(0, max);
    return text;
  }

  function safeCell(value) {
    var text = String(value == null ? '' : value);
    if (/^[=+\-@\t\r]/.test(text)) return "'" + text;
    return text;
  }

  function isEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 120;
  }

  function asNumber(value) {
    if (typeof value === 'number') return value;
    if (value == null) return NaN;
    var text = String(value).trim();
    if (!text) return NaN;
    return parseFloat(text);
  }

  function finite(value) {
    return typeof value === 'number' && value === value && value !== Infinity && value !== -Infinity;
  }

  function validLatLng(lat, lng) {
    return finite(lat) && finite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
  }

  function hashId(id) {
    var hash = 0;
    var text = String(id);
    for (var i = 0; i < text.length; i++) hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
    return hash;
  }

  function jitter(lat, lng, id) {
    var hash = hashId(id);
    var angle = (hash % 360) * Math.PI / 180;
    var meters = 25 + (hash % 40);
    var dLat = (meters * Math.cos(angle)) / 111320;
    var cos = Math.cos(lat * Math.PI / 180);
    if (Math.abs(cos) < 0.01) cos = cos < 0 ? -0.01 : 0.01;
    var dLng = (meters * Math.sin(angle)) / (111320 * cos);
    return { lat: lat + dLat, lng: lng + dLng, meters: meters };
  }

  function haversine(lat1, lng1, lat2, lng2) {
    var radius = 6371000;
    var toRad = Math.PI / 180;
    var dLat = (lat2 - lat1) * toRad;
    var dLng = (lng2 - lng1) * toRad;
    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * toRad) * Math.cos(lat2 * toRad) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * radius * Math.asin(Math.sqrt(a));
  }

  function areaById(state, id) {
    var areas = state.areas || [];
    for (var i = 0; i < areas.length; i++) {
      if (String(areas[i].areaId) === String(id)) return areas[i];
    }
    return null;
  }

  function toolById(state, id) {
    var tools = state.tools || [];
    for (var i = 0; i < tools.length; i++) {
      if (String(tools[i].toolId) === String(id)) return tools[i];
    }
    return null;
  }

  function loanByToken(state, token) {
    var loans = state.loans || [];
    for (var i = 0; i < loans.length; i++) {
      if (String(loans[i].ownerToken) === String(token)) return loans[i];
    }
    return null;
  }

  function toolIsOut(state, toolId, ignoreLoanId) {
    var tool = toolById(state, toolId);
    if (tool && tool.status === 'out') return true;
    var loans = state.loans || [];
    for (var i = 0; i < loans.length; i++) {
      if (ignoreLoanId && String(loans[i].loanId) === String(ignoreLoanId)) continue;
      if (String(loans[i].toolId) === String(toolId) && loans[i].status === 'approved') return true;
    }
    return false;
  }

  function passphraseError(config, given) {
    var expected = cleanText(config && config.passphrase, 200);
    if (!expected) return 'The organizer still needs to set a neighborhood password.';
    if (cleanText(given, 200) !== expected) return 'That neighborhood password is not right.';
    return '';
  }

  function organizerCc(config, exclude) {
    var org = cleanText(config && config.organizerEmail, 120).toLowerCase();
    if (!isEmail(org)) return '';
    var skip = exclude || [];
    for (var i = 0; i < skip.length; i++) {
      if (String(skip[i]).toLowerCase() === org) return '';
    }
    return org;
  }

  function subject(config, text) {
    var name = cleanText(config && config.libraryName, 80) || 'Tool library';
    return name + ': ' + text;
  }

  function chosenTile(config) {
    var url = cleanText(config && config.tileUrl, 300);
    if (url.indexOf('https://') !== 0) return DEFAULT_TILE;
    if (url.indexOf('{z}') === -1 || url.indexOf('{x}') === -1 || url.indexOf('{y}') === -1) return DEFAULT_TILE;
    return url;
  }

  function calendarUrl(title, due, details) {
    if (!isIsoDate(due)) return '';
    var start = due.replace(/-/g, '');
    var end = addDays(due, 1).replace(/-/g, '');
    return 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=' +
      encodeURIComponent(title) + '&dates=' + start + '/' + end + '&details=' + encodeURIComponent(details);
  }

function actionUrl(appUrl, action, token) {
  var base = String(appUrl || '').replace(/[?#].*$/, '');
  if (!base) return '';
  return base + '?a=' + action + '&t=' + encodeURIComponent(token);
}

  function publicView(state, today) {
    var config = state.config || {};
    var centerLat = asNumber(config.centerLat);
    var centerLng = asNumber(config.centerLng);
    var zoom = parseInt(config.zoom, 10);
    if (!finite(zoom) || zoom < 1 || zoom > 18) zoom = 14;
    var areas = [];
    (state.areas || []).forEach(function (area) {
      var name = cleanText(area.name, 80);
      var id = cleanText(area.areaId, 60);
      if (!id || !name) return;
      var lat = asNumber(area.lat);
      var lng = asNumber(area.lng);
      var located = validLatLng(lat, lng);
      areas.push({ id: id, name: name, lat: located ? lat : null, lng: located ? lng : null });
    });
    areas.sort(function (a, b) { return a.name.localeCompare(b.name); });
    var areaMap = {};
    areas.forEach(function (area) { areaMap[area.id] = area; });
    var tools = [];
    (state.tools || []).forEach(function (tool) {
      if (String(tool.status) === 'retired') return;
      var name = cleanText(tool.name, 80);
      var id = cleanText(tool.toolId, 80);
      if (!id || !name) return;
      var area = areaMap[cleanText(tool.areaId, 60)] || null;
      var pin = null;
      if (area && area.lat != null) {
        pin = jitter(area.lat, area.lng, id);
      }
      var due = '';
      var approved = false;
      (state.loans || []).forEach(function (loan) {
        if (String(loan.toolId) !== id || loan.status !== 'approved') return;
        approved = true;
        if (loan.dueDate && (!due || String(loan.dueDate) > due)) due = String(loan.dueDate);
      });
      var out = tool.status === 'out' || approved;
      tools.push({
        id: id,
        name: name,
        category: cleanText(tool.category, 40),
        description: cleanText(tool.description, 500),
        areaId: area ? area.id : '',
        areaName: area ? area.name : '',
        ownerName: cleanText(tool.ownerName, 40),
        status: out ? 'out' : 'available',
        due: due,
        lat: pin ? pin.lat : null,
        lng: pin ? pin.lng : null
      });
    });
    tools.sort(function (a, b) { return a.name.localeCompare(b.name); });
    return {
      libraryName: cleanText(config.libraryName, 80) || 'Neighborhood tool library',
      today: isIsoDate(today) ? today : '',
      center: validLatLng(centerLat, centerLng) ? { lat: centerLat, lng: centerLng } : null,
      zoom: zoom,
      tileUrl: chosenTile(config),
      areas: areas,
      tools: tools
    };
  }

  function validateNewTool(input, state, today, ids) {
    input = input || {};
    var pass = passphraseError(state.config, input.passphrase);
    if (pass) return { error: pass };
    var name = cleanText(input.name, 80);
    var ownerName = cleanText(input.ownerName, 40);
    var email = cleanText(input.ownerEmail, 120).toLowerCase();
    var category = cleanText(input.category, 40);
    var description = cleanText(input.description, 500);
    var area = areaById(state, cleanText(input.areaId, 60));
    if (!name) return { error: 'Add a name for the tool.' };
    if (!ownerName) return { error: 'Add your first name.' };
    if (!isEmail(email)) return { error: 'Add an email address where the borrower can reach you.' };
    if (!area) return { error: 'Choose a rough area.' };
    var areaName = cleanText(area.name, 80);
    return {
      cells: {
        toolId: ids.toolId,
        name: safeCell(name),
        category: safeCell(category),
        description: safeCell(description),
        areaId: cleanText(area.areaId, 60),
        ownerName: safeCell(ownerName),
        ownerEmail: safeCell(email),
        status: 'available',
        created: today
      },
      emails: [{
        to: email,
        cc: organizerCc(state.config, [email]),
        subject: subject(state.config, 'Listed ' + name),
        body: 'You listed "' + name + '" for neighbors to borrow. It shows near ' + areaName + ', not at a home address.\n\nWhen someone asks to borrow it, you will get an email. Open the link and tap the button. Agree on pickup, care, and loss before you hand it over.'
      }],
      message: 'Listed. Neighbors can see it now.'
    };
  }

  function validateNewLoan(input, state, today, ids) {
    input = input || {};
    var pass = passphraseError(state.config, input.passphrase);
    if (pass) return { error: pass };
    if (!ids || !ids.appUrl) return { error: 'The library link is not ready yet. Ask the organizer to deploy the page.' };
    var tool = toolById(state, cleanText(input.toolId, 80));
    if (!tool || tool.status === 'retired') return { error: 'That tool is not available.' };
    var ownerEmail = cleanText(tool.ownerEmail, 120).toLowerCase();
    if (!isEmail(ownerEmail)) return { error: 'That tool has no owner email yet. Ask the organizer to add one in the spreadsheet.' };
    if (toolIsOut(state, tool.toolId)) return { error: 'That tool is already on loan.' };
    var borrowerName = cleanText(input.borrowerName, 40);
    var borrowerEmail = cleanText(input.borrowerEmail, 120).toLowerCase();
    var start = cleanText(input.startDate, 10);
    var due = cleanText(input.dueDate, 10);
    if (!borrowerName) return { error: 'Add your first name.' };
    if (!isEmail(borrowerEmail)) return { error: 'Add your email so the owner can reply.' };
    if (borrowerEmail === ownerEmail) return { error: 'That email is the owner\'s. Someone else needs to borrow it.' };
    if (!isIsoDate(start) || !isIsoDate(due)) return { error: 'Choose a start date and a return date.' };
    if (start < addDays(today, -1)) return { error: 'The start date is too far in the past.' };
    if (start > addDays(today, 365)) return { error: 'Pick a start date within the next year.' };
    if (due < start) return { error: 'The return date has to be on or after the start date.' };
    if (due > addDays(start, 180)) return { error: 'Loans can be up to 180 days. Pick an earlier return date.' };
    var area = areaById(state, tool.areaId);
    var toolName = cleanText(tool.name, 80);
    var lines = [
      borrowerName + ' (' + borrowerEmail + ') wants to borrow "' + toolName + '".',
      'From ' + prettyDate(start) + ' to ' + prettyDate(due) + '.',
      area ? 'Shown near: ' + cleanText(area.name, 80) + '.' : null,
      '',
      'Open a link and tap the button. Tapping is required so an email program cannot approve the loan just by looking at the message.',
      'Approve: ' + actionUrl(ids.appUrl, 'approve', ids.ownerToken),
      'Decline: ' + actionUrl(ids.appUrl, 'decline', ids.ownerToken),
      '',
      'Agree on pickup, care, and what happens if it is lost or damaged before the tool changes hands. The library does not insure tools. Meet at a public place.'
    ];
    return {
      cells: {
        loanId: ids.loanId,
        toolId: cleanText(tool.toolId, 80),
        borrowerName: safeCell(borrowerName),
        borrowerEmail: safeCell(borrowerEmail),
        startDate: start,
        dueDate: due,
        status: 'pending',
        ownerToken: ids.ownerToken,
        requestedAt: today,
        remindedBefore: '',
        remindedDue: '',
        remindedOverdue: ''
      },
      emails: [{
        to: ownerEmail,
        cc: organizerCc(state.config, [ownerEmail]),
        subject: subject(state.config, 'Borrow request for ' + toolName),
        body: lines.filter(function (line) { return line !== null; }).join('\n')
      }],
      message: 'Request sent. The owner will email you if they approve it.'
    };
  }

  function describeAction(state, action, token) {
    var loan = loanByToken(state, token);
    if (!loan || ['approve', 'decline', 'returned'].indexOf(action) === -1) {
      return { page: 'This link is not valid.', canConfirm: false, label: '' };
    }
    var tool = toolById(state, loan.toolId);
    var toolName = tool ? cleanText(tool.name, 80) : 'this tool';
    if (action === 'approve') {
      if (loan.status === 'approved') return { page: 'This loan is already approved.', canConfirm: false, label: '' };
      if (loan.status !== 'pending') return { page: 'This request is no longer waiting for an answer.', canConfirm: false, label: '' };
      if (!tool || tool.status === 'retired') return { page: 'That tool is no longer listed.', canConfirm: false, label: '' };
      if (toolIsOut(state, loan.toolId)) return { page: 'This tool is already on loan, so this request cannot be approved.', canConfirm: false, label: '' };
      return {
        page: 'Approve the loan of "' + toolName + '" to ' + cleanText(loan.borrowerName, 40) + ', from ' + prettyDate(loan.startDate) + ' to ' + prettyDate(loan.dueDate) + '?',
        canConfirm: true,
        label: 'Approve'
      };
    }
    if (action === 'decline') {
      if (loan.status === 'declined') return { page: 'This request is already declined.', canConfirm: false, label: '' };
      if (loan.status !== 'pending') return { page: 'This request is no longer waiting for an answer.', canConfirm: false, label: '' };
      return {
        page: 'Decline the request for "' + toolName + '" from ' + cleanText(loan.borrowerName, 40) + '?',
        canConfirm: true,
        label: 'Decline'
      };
    }
    if (loan.status === 'returned') return { page: 'This is already marked returned.', canConfirm: false, label: '' };
    if (loan.status !== 'approved') return { page: 'This loan is not active.', canConfirm: false, label: '' };
    return { page: 'Mark "' + toolName + '" as returned?', canConfirm: true, label: 'Mark returned' };
  }

  function applyAction(state, action, token, appUrl) {
    var described = describeAction(state, action, token);
    if (!described.canConfirm) return { page: described.page, updates: null, emails: [] };
    var loan = loanByToken(state, token);
    var tool = toolById(state, loan.toolId);
    if (!tool && action === 'approve') return { page: 'That tool is no longer listed.', updates: null, emails: [] };
    var toolName = tool ? cleanText(tool.name, 80) : 'the tool';
    var ownerEmail = tool ? cleanText(tool.ownerEmail, 120).toLowerCase() : '';
    var library = cleanText(state.config && state.config.libraryName, 80) || 'Tool library';
    if (action === 'approve') {
      var cal = calendarUrl('Return ' + toolName, loan.dueDate, 'Borrowed from ' + library + '.');
      var borrowerLines = [
        'Your request to borrow "' + toolName + '" is approved.',
        'From ' + prettyDate(loan.startDate) + ' to ' + prettyDate(loan.dueDate) + '.',
        'The owner is ' + cleanText(tool.ownerName, 40) + ' (' + ownerEmail + '). Write to them to arrange pickup at a public place.',
        cal ? 'Add the return date to your calendar: ' + cal : null,
        '',
        'You will also get an email the day before it is due, the day it is due, and the day after if it is still out.',
        'Agree on care, and on what happens if it is lost or damaged, before the tool changes hands. The library does not insure tools.'
      ];
      var returnUrl = actionUrl(appUrl, 'returned', loan.ownerToken);
      var ownerLines = [
        'You approved the loan of "' + toolName + '" to ' + cleanText(loan.borrowerName, 40) + ' (' + cleanText(loan.borrowerEmail, 120).toLowerCase() + ').',
        'Due ' + prettyDate(loan.dueDate) + '.',
        returnUrl ? 'When it comes back, open this link and tap the button: ' + returnUrl : 'When it comes back, mark it returned from the library page.'
      ];
      return {
        page: 'Approved. ' + cleanText(loan.borrowerName, 40) + ' has been emailed.',
        updates: { loanId: loan.loanId, loan: { status: 'approved' }, toolId: loan.toolId, tool: { status: 'out' } },
        emails: [
          {
            to: cleanText(loan.borrowerEmail, 120).toLowerCase(),
            cc: organizerCc(state.config, [loan.borrowerEmail, ownerEmail]),
            subject: subject(state.config, 'Approved ' + toolName),
            body: borrowerLines.filter(function (line) { return line !== null; }).join('\n')
          },
          {
            to: ownerEmail,
            cc: '',
            subject: subject(state.config, 'You lent ' + toolName),
            body: ownerLines.join('\n')
          }
        ]
      };
    }
    if (action === 'decline') {
      return {
        page: 'Declined. ' + cleanText(loan.borrowerName, 40) + ' has been emailed.',
        updates: { loanId: loan.loanId, loan: { status: 'declined' }, toolId: '', tool: null },
        emails: [{
          to: cleanText(loan.borrowerEmail, 120).toLowerCase(),
          cc: organizerCc(state.config, [loan.borrowerEmail, ownerEmail]),
          subject: subject(state.config, 'Request declined for ' + toolName),
          body: 'Your request to borrow "' + toolName + '" was declined. You can ask about a different tool.'
        }]
      };
    }
    var otherOut = false;
    (state.loans || []).forEach(function (other) {
      if (String(other.loanId) === String(loan.loanId)) return;
      if (String(other.toolId) === String(loan.toolId) && other.status === 'approved') otherOut = true;
    });
    var freeTool = tool && !otherOut;
    return {
      page: 'Marked returned. Thank you.',
      updates: {
        loanId: loan.loanId,
        loan: { status: 'returned' },
        toolId: freeTool ? loan.toolId : '',
        tool: freeTool ? { status: 'available' } : null
      },
      emails: [{
        to: cleanText(loan.borrowerEmail, 120).toLowerCase(),
        cc: organizerCc(state.config, [loan.borrowerEmail]),
        subject: subject(state.config, 'Returned ' + toolName),
        body: 'The owner marked "' + toolName + '" as returned. Thank you.'
      }]
    };
  }

  function reminderPlan(state, today, appUrl) {
    var plans = [];
    if (!isIsoDate(today)) return plans;
    (state.loans || []).forEach(function (loan) {
      if (loan.status !== 'approved' || !isIsoDate(loan.dueDate)) return;
      var kind = '';
      var flag = '';
      if (loan.dueDate === addDays(today, 1) && loan.remindedBefore !== 'yes') {
        kind = 'before';
        flag = 'remindedBefore';
      } else if (loan.dueDate === today && loan.remindedDue !== 'yes') {
        kind = 'due';
        flag = 'remindedDue';
      } else if (loan.dueDate === addDays(today, -1) && loan.remindedOverdue !== 'yes') {
        kind = 'overdue';
        flag = 'remindedOverdue';
      }
      if (!kind) return;
      var tool = toolById(state, loan.toolId);
      var toolName = tool ? cleanText(tool.name, 80) : 'a tool';
      var ownerEmail = tool ? cleanText(tool.ownerEmail, 120).toLowerCase() : '';
      var borrowerEmail = cleanText(loan.borrowerEmail, 120).toLowerCase();
      var lead = kind === 'before' ? 'Due tomorrow.' : (kind === 'due' ? 'Due today.' : 'This was due yesterday and is still marked out.');
      var cal = calendarUrl('Return ' + toolName, loan.dueDate, 'Neighborhood tool library.');
      var returnUrl = actionUrl(appUrl, 'returned', loan.ownerToken);
      var messages = [];
      if (isEmail(borrowerEmail)) {
        messages.push({
          to: borrowerEmail,
          cc: organizerCc(state.config, [borrowerEmail, ownerEmail]),
          subject: subject(state.config, 'Return ' + toolName),
          body: lead + '\n"' + toolName + '" should be back on ' + prettyDate(loan.dueDate) + '.' + (cal ? '\nAdd it to your calendar: ' + cal : '')
        });
      }
      if (isEmail(ownerEmail) && ownerEmail !== borrowerEmail) {
        messages.push({
          to: ownerEmail,
          cc: '',
          subject: subject(state.config, 'Return ' + toolName),
          body: lead + '\n"' + toolName + '" is on loan to ' + cleanText(loan.borrowerName, 40) + ' (' + borrowerEmail + '), due ' + prettyDate(loan.dueDate) + '.' + (returnUrl ? '\nWhen it is back, open this link and tap the button: ' + returnUrl : '')
        });
      }
      if (!messages.length) return;
      plans.push({ loanId: loan.loanId, flag: flag, messages: messages });
    });
    return plans;
  }

  return {
    DEFAULT_TILE: DEFAULT_TILE,
    addDays: addDays,
    prettyDate: prettyDate,
    isIsoDate: isIsoDate,
    safeCell: safeCell,
    jitter: jitter,
    haversine: haversine,
    publicView: publicView,
    validateNewTool: validateNewTool,
    validateNewLoan: validateNewLoan,
    describeAction: describeAction,
    applyAction: applyAction,
    reminderPlan: reminderPlan,
    calendarUrl: calendarUrl
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = ToolLibrary;
}

/**
 * Spreadsheet, email, and web page. The lending rules live above this line.
 * Run setupLibrary once from the editor, then installDailyReminder once.
 * Deploy as a web app that executes as you, open to anyone.
 */

var SHEET_HEADERS = {
  Config: ['key', 'value'],
  Areas: ['areaId', 'name', 'lat', 'lng'],
  Tools: ['toolId', 'name', 'category', 'description', 'areaId', 'ownerName', 'ownerEmail', 'status', 'created'],
  Loans: ['loanId', 'toolId', 'borrowerName', 'borrowerEmail', 'startDate', 'dueDate', 'status', 'ownerToken', 'requestedAt', 'remindedBefore', 'remindedDue', 'remindedOverdue']
};

var CONFIG_DEFAULTS = [
  ['libraryName', 'Neighborhood tool library'],
  ['centerLat', ''],
  ['centerLng', ''],
  ['zoom', '14'],
  ['passphrase', ''],
  ['organizerEmail', ''],
  ['tileUrl', 'https://tile.openstreetmap.org/{z}/{x}/{y}.png']
];

var README_TEXT = [
  'Keep this spreadsheet private. Neighbors use the web link, not this file. The sheet holds email addresses.',
  'Do not turn on "anyone with the link". Share it only with another organizer, as an Editor.',
  'Do not paste formulas into these sheets.',
  '',
  'Config keys: libraryName, centerLat, centerLng, zoom, passphrase, organizerEmail, tileUrl.',
  'Areas: one row per landmark. areaId is a short name such as park. name is what people see. lat and lng are the landmark, never a home.',
  'To hide a tool, set its status to retired. Status values are available, out, and retired.',
  'Loan status values are pending, approved, declined, and returned.',
  'Once a month use File > Download > Microsoft Excel and keep that copy somewhere else.',
  'If you change the script later: Deploy > Manage deployments > Edit > Version New version > Deploy. The link stays the same.'
].join('\n');

function setupLibrary() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var already = !!ss.getSheetByName('Config');
  Object.keys(SHEET_HEADERS).forEach(function (name) {
    ensureSheet_(ss, name, SHEET_HEADERS[name]);
  });
  if (!ss.getSheetByName('README')) {
    var readme = ss.insertSheet('README', 0);
    readme.getRange(1, 1).setValue(README_TEXT);
    readme.setColumnWidth(1, 720);
    readme.getRange(1, 1).setWrap(true);
    readme.setRowHeight(1, 360);
  }
  var leftover = ss.getSheetByName('Sheet1');
  if (leftover && leftover.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(leftover);
  note_(already
    ? 'Setup checked the sheets and left existing rows in place. Fill Config and Areas if you have not yet.'
    : 'Setup finished. Fill Config and Areas, set the script time zone, then run installDailyReminder.');
}

function installDailyReminder() {
  ScriptApp.getProjectTriggers().forEach(function (trigger) {
    if (trigger.getHandlerFunction() === 'sendDueReminders') ScriptApp.deleteTrigger(trigger);
  });
  ScriptApp.newTrigger('sendDueReminders').timeBased().everyDays(1).atHour(8).create();
  note_('Daily reminder installed. It runs around 8:00 in the script time zone. Set that time zone in Project settings before you rely on it.');
}

function sendDueReminders() {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var state = readState_();
    var plans = ToolLibrary.reminderPlan(state, today_(), webUrl_());
    plans.forEach(function (plan) {
      var needed = 0;
      plan.messages.forEach(function (message) { needed += message.cc ? 2 : 1; });
      if (MailApp.getRemainingDailyQuota() < needed) {
        Logger.log('Email quota too low for loan ' + plan.loanId);
        return;
      }
      var sent = true;
      plan.messages.forEach(function (message) {
        try {
          sendMail_(message, state.config);
        } catch (err) {
          sent = false;
          Logger.log(err);
        }
      });
      if (sent) {
        var updates = {};
        updates[plan.flag] = 'yes';
        updateById_('Loans', 'loanId', plan.loanId, updates);
      }
    });
    Logger.log('Reminder plans: ' + plans.length);
  } finally {
    lock.releaseLock();
  }
}

function getCatalog() {
  try {
    return { ok: true, catalog: ToolLibrary.publicView(readState_(), today_()) };
  } catch (err) {
    return { ok: false, error: String(err && err.message ? err.message : err) };
  }
}

function submitTool(input) {
  return withLock_(function () {
    var state = readState_();
    var result = ToolLibrary.validateNewTool(input, state, today_(), { toolId: Utilities.getUuid() });
    if (result.error) return { ok: false, error: result.error };
    appendObject_('Tools', result.cells);
    return finishWrite_(state, result);
  });
}

function submitRequest(input) {
  return withLock_(function () {
    var state = readState_();
    var appUrl = webUrl_();
    if (!appUrl) return { ok: false, error: 'Deploy the web app, then submit this again.' };
    var result = ToolLibrary.validateNewLoan(input, state, today_(), {
      loanId: Utilities.getUuid(),
      ownerToken: Utilities.getUuid(),
      appUrl: appUrl
    });
    if (result.error) return { ok: false, error: result.error };
    appendObject_('Loans', result.cells);
    return finishWrite_(state, result);
  });
}

function confirmAction(action, token) {
  return withLock_(function () {
    var state = readState_();
    var result = ToolLibrary.applyAction(state, String(action || ''), String(token || ''), webUrl_());
    if (result.updates) {
      if (result.updates.loan) updateById_('Loans', 'loanId', result.updates.loanId, result.updates.loan);
      if (result.updates.tool && result.updates.toolId) updateById_('Tools', 'toolId', result.updates.toolId, result.updates.tool);
    }
    var emailNote = deliver_(state, result.emails);
    return { ok: true, page: result.page + emailNote };
  });
}

function doGet(e) {
  var params = e && e.parameter ? e.parameter : {};
  if (params.a || params.t) {
    var action = String(params.a || '');
    var token = String(params.t || '');
    var described = { page: 'This link is not valid.', canConfirm: false, label: '' };
    try {
      if (/^(approve|decline|returned)$/.test(action) && /^[A-Za-z0-9-]{8,80}$/.test(token)) {
        described = ToolLibrary.describeAction(readState_(), action, token);
      }
    } catch (err) {
      described = { page: String(err && err.message ? err.message : err), canConfirm: false, label: '' };
    }
    return HtmlService.createHtmlOutput(confirmPage_(described, action, token))
      .setTitle('Tool library')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
  }
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('Tool library')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function withLock_(fn) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) return { ok: false, error: 'Someone else is saving. Wait a moment and try again.' };
  try {
    return fn();
  } catch (err) {
    return { ok: false, error: String(err && err.message ? err.message : err) };
  } finally {
    lock.releaseLock();
  }
}

function finishWrite_(state, result) {
  var emailNote = deliver_(state, result.emails);
  return { ok: true, message: result.message + emailNote };
}

function deliver_(state, emails) {
  var failed = false;
  (emails || []).forEach(function (message) {
    var needed = message.cc ? 2 : 1;
    if (MailApp.getRemainingDailyQuota() < needed) {
      failed = true;
      return;
    }
    try {
      sendMail_(message, state.config);
    } catch (err) {
      failed = true;
      Logger.log(err);
    }
  });
  return failed ? ' Saved, but an email could not be sent. Check the spreadsheet.' : '';
}

function sendMail_(message, config) {
  var options = { name: ToolLibrary.publicView({ config: config || {}, areas: [], tools: [], loans: [] }, '').libraryName };
  if (message.cc) options.cc = message.cc;
  MailApp.sendEmail(message.to, message.subject, message.body, options);
}

function webUrl_() {
  try {
    return ScriptApp.getService().getUrl() || '';
  } catch (err) {
    return '';
  }
}

function today_() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

function readState_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss || !ss.getSheetByName('Config')) throw new Error('Run setupLibrary once from the script editor.');
  var config = {};
  rows_('Config').forEach(function (row) {
    var key = plain_(row.key);
    if (key) config[key] = row.value;
  });
  return {
    config: config,
    areas: rows_('Areas').map(normalizeArea_).filter(function (area) { return area.areaId; }),
    tools: rows_('Tools').map(normalizeTool_).filter(function (tool) { return tool.toolId; }),
    loans: rows_('Loans').map(normalizeLoan_).filter(function (loan) { return loan.loanId; })
  };
}

function normalizeArea_(row) {
  return {
    areaId: plain_(row.areaId),
    name: plain_(row.name),
    lat: row.lat,
    lng: row.lng
  };
}

function normalizeTool_(row) {
  return {
    toolId: plain_(row.toolId),
    name: plain_(row.name),
    category: plain_(row.category),
    description: plain_(row.description),
    areaId: plain_(row.areaId),
    ownerName: plain_(row.ownerName),
    ownerEmail: plain_(row.ownerEmail).toLowerCase(),
    status: plain_(row.status).toLowerCase()
  };
}

function normalizeLoan_(row) {
  return {
    loanId: plain_(row.loanId),
    toolId: plain_(row.toolId),
    borrowerName: plain_(row.borrowerName),
    borrowerEmail: plain_(row.borrowerEmail).toLowerCase(),
    startDate: cellToIso_(row.startDate),
    dueDate: cellToIso_(row.dueDate),
    status: plain_(row.status).toLowerCase(),
    ownerToken: plain_(row.ownerToken),
    remindedBefore: plain_(row.remindedBefore) === 'yes' ? 'yes' : '',
    remindedDue: plain_(row.remindedDue) === 'yes' ? 'yes' : '',
    remindedOverdue: plain_(row.remindedOverdue) === 'yes' ? 'yes' : ''
  };
}

function cellToIso_(value) {
  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value.getTime())) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  var match = /^(\d{4})-(\d{2})-(\d{2})/.exec(plain_(value));
  return match ? match[1] + '-' + match[2] + '-' + match[3] : '';
}

function plain_(value) {
  var text = String(value == null ? '' : value).trim();
  if (/^'[=+\-@]/.test(text)) text = text.slice(1);
  return text;
}

function rows_(name) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  if (!sheet) return [];
  var values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  var headers = values[0].map(function (header) { return String(header).trim(); });
  var out = [];
  for (var r = 1; r < values.length; r++) {
    var blank = true;
    var obj = {};
    for (var c = 0; c < headers.length; c++) {
      obj[headers[c]] = values[r][c];
      if (String(values[r][c]).trim() !== '') blank = false;
    }
    if (!blank && headers[0]) out.push(obj);
  }
  return out;
}

function ensureSheet_(ss, name, headers) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    if (name === 'Config') {
      sheet.getRange(2, 1, CONFIG_DEFAULTS.length, 2).setValues(CONFIG_DEFAULTS);
    }
  }
  sheet.setFrozenRows(1);
  return sheet;
}

function appendObject_(name, obj) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(function (header) {
    return String(header).trim();
  });
  sheet.appendRow(headers.map(function (header) {
    var value = obj[header];
    return value === undefined || value === null ? '' : value;
  }));
}

function updateById_(name, idKey, id, updates) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  var values = sheet.getDataRange().getValues();
  var headers = values[0].map(function (header) { return String(header).trim(); });
  var idCol = headers.indexOf(idKey);
  if (idCol < 0) throw new Error('Missing column ' + idKey);
  for (var r = 1; r < values.length; r++) {
    if (String(values[r][idCol]) !== String(id)) continue;
    headers.forEach(function (header, c) {
      if (!Object.prototype.hasOwnProperty.call(updates, header)) return;
      var value = updates[header];
      if (typeof value === 'string') value = ToolLibrary.safeCell(value);
      sheet.getRange(r + 1, c + 1).setValue(value);
    });
    return;
  }
  throw new Error('Could not find ' + id);
}

function confirmPage_(described, action, token) {
  var back = webUrl_();
  var button = '';
  if (described.canConfirm) {
    button = '<button id="go" type="button">' + escapeHtml_(described.label) + '</button>' +
      '<script>document.getElementById("go").onclick=function(){var btn=this;btn.disabled=true;' +
      'google.script.run.withSuccessHandler(function(res){var text=(res&&(res.page||res.error))||"Could not save.";document.getElementById("msg").textContent=text;if(res&&res.ok){btn.style.display="none";}else{btn.disabled=false;}})' +
      '.withFailureHandler(function(){btn.disabled=false;document.getElementById("msg").textContent="Could not save. Try the link again.";})' +
      '.confirmAction(' + jsString_(action) + ',' + jsString_(token) + ');};</script>';
  }
  return '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">' +
    '<title>Tool library</title></head><body style="margin:0;font-family:system-ui,sans-serif;background:#f4f1ea;color:#1c1915">' +
    '<main style="max-width:34rem;margin:0 auto;padding:24px 16px;font-size:18px;line-height:1.45">' +
    '<p id="msg">' + escapeHtml_(described.page) + '</p>' + button +
    (back ? '<p><a href="' + escapeHtml_(back) + '">Back to the library</a></p>' : '') +
    '<noscript><p>Turn on JavaScript, then tap the button. The extra tap stops an email app from changing a loan just by opening the message.</p></noscript>' +
    '</main></body></html>';
}

function note_(message) {
  Logger.log(message);
  try {
    SpreadsheetApp.getUi().alert(message);
  } catch (err) {
    // Running from a context with no spreadsheet dialog.
  }
}

function escapeHtml_(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function jsString_(value) {
  return "'" + String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\r|\n/g, '') + "'";
}
```

## File 2: Index

Create an HTML file named `Index` and paste this.

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="theme-color" content="#0d6b45">
  <title>Tool library</title>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.css" integrity="sha384-sHL9NAb7lN7rfvG5lfHpm643Xkcjzp4jFvuavGOndn6pjVqS6ny56CAt3nsEVT4H" crossorigin="anonymous">
  <style>
    /* Change these colors if you want. Leave the map credit alone. */
    :root {
      --ink: #1c1915;
      --paper: #f4f1ea;
      --card: #fffdf8;
      --green: #0d6b45;
      --line: #e4ddd0;
      --out: #8a5a12;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
      color: var(--ink);
      background: var(--paper);
      font-size: 16px;
      line-height: 1.45;
    }
    main { max-width: 40rem; margin: 0 auto; padding: 16px 14px 40px; }
    h1 { font-size: 1.45rem; line-height: 1.2; margin: 0 0 8px; }
    h2 { font-size: 1.05rem; margin: 0 0 4px; }
    p { margin: 0 0 10px; }
    .nav { display: flex; flex-wrap: wrap; gap: 8px; margin: 12px 0; }
    .nav button, form button, .card button, .map-tools button {
      font: inherit;
      min-height: 48px;
      border-radius: 10px;
      border: 1px solid var(--green);
      background: var(--card);
      color: var(--green);
      padding: 10px 12px;
    }
    .nav button.on, form button, .card button {
      background: var(--green);
      color: #fff;
    }
    form button, .card button, .map-tools button { width: 100%; margin-top: 8px; }
    button:disabled { opacity: 0.55; }
    .panel { display: none; }
    .panel.on { display: block; }
    .card {
      background: var(--card);
      border: 1px solid var(--line);
      border-radius: 12px;
      padding: 12px;
      margin: 0 0 10px;
    }
    .meta { color: #4d463c; margin-bottom: 6px; }
    .pill {
      display: inline-block;
      margin: 6px 0;
      border-radius: 999px;
      padding: 2px 8px;
      font-size: 0.85rem;
      background: #e5f4ec;
      color: var(--green);
    }
    .pill.out { background: #f6ead6; color: var(--out); }
    label { display: block; font-weight: 600; margin: 12px 0 4px; }
    input, select, textarea {
      width: 100%;
      font: inherit;
      padding: 12px;
      border-radius: 10px;
      border: 1px solid #cfc6b8;
      background: #fff;
    }
    textarea { min-height: 90px; }
    .hint { color: #4d463c; font-weight: 400; font-size: 0.92rem; }
    #status { min-height: 1.4em; font-weight: 600; }
    #map { height: 68vh; min-height: 320px; border-radius: 12px; border: 1px solid var(--line); }
    .leaflet-control-attribution { font-size: 11px; }
    .map-note { margin-top: 8px; }
    .empty { color: #4d463c; }
  </style>
</head>
<body>
  <main>
    <h1 id="title">Tool library</h1>
    <p id="status" role="status">Loading the library…</p>
    <div class="nav">
      <button type="button" id="tab-tools" class="on">Tools</button>
      <button type="button" id="tab-map">Map</button>
      <button type="button" id="tab-lend">Lend a tool</button>
      <button type="button" id="tab-borrow">Borrow</button>
    </div>

    <section id="tools" class="panel on">
      <label for="search">Search</label>
      <input id="search" type="search" placeholder="Drill, ladder, park…">
      <div id="list"></div>
    </section>

    <section id="map-panel" class="panel">
      <div id="map" role="region" aria-label="Map of rough tool areas"></div>
      <div class="map-tools">
        <button type="button" id="show-all">Show all the pins</button>
      </div>
      <p class="map-note">Pins sit near a landmark, about a short walk from each other, not on a home.</p>
      <p class="map-note"><a href="https://www.openstreetmap.org/fixthemap">Report a map problem</a></p>
    </section>

    <section id="lend" class="panel">
      <form id="lend-form">
        <label for="tool-name">Tool</label>
        <input id="tool-name" maxlength="80" required>
        <label for="category">Category <span class="hint">optional</span></label>
        <input id="category" maxlength="40" placeholder="Garden, ladder, kitchen">
        <label for="description">Description <span class="hint">optional</span></label>
        <textarea id="description" maxlength="500"></textarea>
        <label for="area">Rough area</label>
        <select id="area" required></select>
        <label for="owner-name">Your first name</label>
        <input id="owner-name" maxlength="40" autocomplete="given-name" required>
        <label for="owner-email">Your email</label>
        <input id="owner-email" type="email" maxlength="120" autocapitalize="none" autocorrect="off" autocomplete="email" required>
        <label for="lend-password">Neighborhood password <span class="hint">the shared one, not your email password</span></label>
        <input id="lend-password" type="text" maxlength="200" autocomplete="off" required>
        <button type="submit">List this tool</button>
      </form>
    </section>

    <section id="borrow" class="panel">
      <form id="borrow-form">
        <label for="tool">Tool</label>
        <select id="tool" required></select>
        <label for="borrower-name">Your first name</label>
        <input id="borrower-name" maxlength="40" autocomplete="given-name" required>
        <label for="borrower-email">Your email</label>
        <input id="borrower-email" type="email" maxlength="120" autocapitalize="none" autocorrect="off" autocomplete="email" required>
        <label for="start-date">From</label>
        <input id="start-date" type="date" required>
        <label for="due-date">Back by</label>
        <input id="due-date" type="date" required>
        <label for="borrow-password">Neighborhood password <span class="hint">the shared one, not your email password</span></label>
        <input id="borrow-password" type="text" maxlength="200" autocomplete="off" required>
        <p class="hint">You and the owner agree on pickup, care, and loss before the tool changes hands. The library does not insure tools. Meet at a public place.</p>
        <button type="submit">Request this tool</button>
      </form>
    </section>
  </main>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.js" integrity="sha384-cxOPjt7s7Iz04uaHJceBmS+qpjv2JkIHNVcuOrM+YHwZOmJGBXI00mdUXEq65HTH" crossorigin="anonymous"></script>
  <script>
    var catalog = null;
    var map = null;
    var markers = [];

    var tabs = { tools: 'tools', map: 'map-panel', lend: 'lend', borrow: 'borrow' };
    Object.keys(tabs).forEach(function (name) {
      document.getElementById('tab-' + name).addEventListener('click', function () { showTab(name); });
    });
    document.getElementById('search').addEventListener('input', render);
    document.getElementById('show-all').addEventListener('click', showAllPins);
    document.getElementById('lend-form').addEventListener('submit', function (event) {
      event.preventDefault();
      sendForm(event.target.querySelector('button'), 'tool');
    });
    document.getElementById('borrow-form').addEventListener('submit', function (event) {
      event.preventDefault();
      sendForm(event.target.querySelector('button'), 'loan');
    });

    function show(message) {
      document.getElementById('status').textContent = message || '';
    }

    function showTab(name) {
      Object.keys(tabs).forEach(function (key) {
        document.getElementById(tabs[key]).className = 'panel' + (key === name ? ' on' : '');
        document.getElementById('tab-' + key).className = key === name ? 'on' : '';
      });
      if (name === 'map') {
        ensureMap();
        setTimeout(function () { if (map) map.invalidateSize(); }, 60);
      }
    }

    function prettyDate(iso) {
      var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      var match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
      if (!match) return iso || '';
      return String(Number(match[3])) + ' ' + months[Number(match[2]) - 1] + ' ' + match[1];
    }

    function visibleTools() {
      var query = document.getElementById('search').value.trim().toLowerCase();
      var tools = (catalog && catalog.tools) || [];
      if (!query) return tools;
      return tools.filter(function (tool) {
        return (tool.name + ' ' + tool.category + ' ' + tool.description + ' ' + tool.areaName + ' ' + tool.ownerName).toLowerCase().indexOf(query) !== -1;
      });
    }

    function render() {
      if (!catalog) return;
      document.getElementById('title').textContent = catalog.libraryName;
      document.title = catalog.libraryName;
      renderList(visibleTools());
      fillSelect(document.getElementById('area'), catalog.areas, 'Choose an area', function (area) {
        return { value: area.id, label: area.name };
      });
      fillSelect(document.getElementById('tool'), catalog.tools.filter(function (tool) { return tool.status === 'available'; }), 'Choose a tool', function (tool) {
        return { value: tool.id, label: tool.name + (tool.areaName ? ' — ' + tool.areaName : '') };
      });
      if (catalog.today) {
        document.getElementById('start-date').min = catalog.today;
        document.getElementById('due-date').min = catalog.today;
      }
      renderMarkers(visibleTools());
    }

    function fillSelect(select, rows, placeholder, toOption) {
      var current = select.value;
      select.textContent = '';
      var first = document.createElement('option');
      first.value = '';
      first.textContent = rows.length ? placeholder : 'Nothing here yet';
      select.appendChild(first);
      rows.forEach(function (row) {
        var item = toOption(row);
        var option = document.createElement('option');
        option.value = item.value;
        option.textContent = item.label;
        select.appendChild(option);
      });
      if (current) select.value = current;
    }

    function renderList(tools) {
      var list = document.getElementById('list');
      list.textContent = '';
      if (!tools.length) {
        var empty = document.createElement('p');
        empty.className = 'empty';
        empty.textContent = catalog.tools.length ? 'Nothing matches that search.' : 'No tools yet. Use Lend a tool to add one.';
        list.appendChild(empty);
        return;
      }
      tools.forEach(function (tool) {
        var card = document.createElement('article');
        card.className = 'card';
        var title = document.createElement('h2');
        title.textContent = tool.name;
        var pill = document.createElement('span');
        pill.className = 'pill' + (tool.status === 'available' ? '' : ' out');
        pill.textContent = tool.status === 'available' ? 'Available' : ('On loan' + (tool.due ? ' until ' + prettyDate(tool.due) : ''));
        var meta = document.createElement('p');
        meta.className = 'meta';
        meta.textContent = [tool.areaName ? 'Near ' + tool.areaName : '', tool.ownerName, tool.category].filter(Boolean).join(' · ');
        card.appendChild(title);
        card.appendChild(pill);
        if (tool.description) {
          var description = document.createElement('p');
          description.textContent = tool.description;
          card.appendChild(description);
        }
        card.appendChild(meta);
        var button = document.createElement('button');
        button.type = 'button';
        button.textContent = tool.status === 'available' ? 'Request this' : 'On loan';
        button.disabled = tool.status !== 'available';
        button.addEventListener('click', function () { openBorrow(tool.id); });
        card.appendChild(button);
        list.appendChild(card);
      });
    }

    function openBorrow(id) {
      showTab('borrow');
      document.getElementById('tool').value = id;
    }

    function ensureMap() {
      if (map || typeof L === 'undefined') {
        if (typeof L === 'undefined') show('The map pictures did not load. The tool list still works.');
        return;
      }
      if (!catalog || !catalog.center) {
        document.getElementById('map').textContent = 'The organizer still needs to set a map center in the spreadsheet.';
        return;
      }
      map = L.map('map', { minZoom: 10, maxZoom: 18, zoomControl: true });
      L.tileLayer(catalog.tileUrl, {
        maxZoom: 18,
        minZoom: 10,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        updateWhenIdle: true
      }).addTo(map);
      map.setView([catalog.center.lat, catalog.center.lng], catalog.zoom || 14);
      renderMarkers(visibleTools());
    }

    function renderMarkers(tools) {
      if (!map) return;
      markers.forEach(function (marker) { map.removeLayer(marker); });
      markers = [];
      tools.forEach(function (tool) {
        if (tool.lat == null || tool.lng == null) return;
        var marker = L.circleMarker([tool.lat, tool.lng], {
          radius: 9,
          weight: 2,
          color: '#ffffff',
          fillColor: tool.status === 'available' ? '#0d6b45' : '#8a5a12',
          fillOpacity: 0.95
        });
        var popup = document.createElement('div');
        var strong = document.createElement('strong');
        strong.textContent = tool.name;
        var text = document.createElement('div');
        text.textContent = (tool.areaName ? 'Near ' + tool.areaName : '') + (tool.ownerName ? ' · ' + tool.ownerName : '');
        popup.appendChild(strong);
        popup.appendChild(text);
        if (tool.status === 'available') {
          var button = document.createElement('button');
          button.type = 'button';
          button.textContent = 'Request this';
          button.addEventListener('click', function () { openBorrow(tool.id); });
          popup.appendChild(button);
        }
        marker.bindPopup(popup);
        marker.addTo(map);
        markers.push(marker);
      });
    }

    function showAllPins() {
      ensureMap();
      if (!map || !markers.length) {
        show('There are no pins to show yet.');
        return;
      }
      var bounds = L.latLngBounds(markers.map(function (marker) { return marker.getLatLng(); }));
      map.fitBounds(bounds.pad(0.3), { maxZoom: 16 });
    }

    function sendForm(button, kind) {
      button.disabled = true;
      var call = google.script.run.withSuccessHandler(function (result) {
        button.disabled = false;
        if (!result || !result.ok) {
          show(result && result.error ? result.error : 'Could not save.');
          return;
        }
        if (kind === 'tool') document.getElementById('lend-form').reset();
        if (kind === 'loan') document.getElementById('borrow-form').reset();
        load(result.message);
        window.scrollTo(0, 0);
      }).withFailureHandler(function (err) {
        button.disabled = false;
        show(err && err.message ? err.message : 'Could not save.');
      });
      if (kind === 'tool') {
        call.submitTool({
          name: document.getElementById('tool-name').value,
          category: document.getElementById('category').value,
          description: document.getElementById('description').value,
          areaId: document.getElementById('area').value,
          ownerName: document.getElementById('owner-name').value,
          ownerEmail: document.getElementById('owner-email').value,
          passphrase: document.getElementById('lend-password').value
        });
      } else {
        call.submitRequest({
          toolId: document.getElementById('tool').value,
          borrowerName: document.getElementById('borrower-name').value,
          borrowerEmail: document.getElementById('borrower-email').value,
          startDate: document.getElementById('start-date').value,
          dueDate: document.getElementById('due-date').value,
          passphrase: document.getElementById('borrow-password').value
        });
      }
    }

    function load(message) {
      google.script.run.withSuccessHandler(function (result) {
        if (!result || !result.ok) {
          show(result && result.error ? result.error : 'Could not load the library.');
          return;
        }
        catalog = result.catalog;
        show(message || '');
        render();
      }).withFailureHandler(function (err) {
        show(err && err.message ? err.message : 'Could not load the library.');
      }).getCatalog();
    }

    if (!window.google || !google.script || !google.script.run) {
      show('Open the library link the organizer sent. This file does not run on its own.');
    } else {
      load();
    }
  </script>
</body>
</html>
```
