The household board is in `/tmp/evals/v0/T07/chore-rotation`. Four people share five weekly chores. Each week the list shifts forward by one person, and the app can remind whoever is up.

With the stand-in names, this week (Nov 16–22, 2026) looks like this:

| Chore | Who |
| --- | --- |
| Kitchen | Alex |
| Bathrooms | Blake |
| Floors and trash | Casey |
| Laundry | Drew |
| Living areas | Alex |

Alex has the extra chore this week. The heavier week then moves to Blake, Casey, and Drew, and after that the cycle repeats.

| Week | Kitchen | Bathrooms | Floors and trash | Laundry | Living areas |
| --- | --- | --- | --- | --- | --- |
| Nov 16–22 | Alex | Blake | Casey | Drew | Alex |
| Nov 23–29 | Blake | Casey | Drew | Alex | Blake |
| Nov 30 – Dec 6 | Casey | Drew | Alex | Blake | Casey |
| Dec 7–13 | Drew | Alex | Blake | Casey | Drew |

From Nov 16 through Dec 13, every person does every chore once. That stays true for any number of people and chores: a cycle lasts one week per person, and each chore visits each person once. Five chores and four people means one person has two chores each week, and that extra turn rotates.

## Use it

```bash
cd /tmp/evals/v0/T07/chore-rotation
python3 app.py serve
```

Open http://127.0.0.1:8765. The page is only on this computer, and it has no login, so leave it off the public internet. If that port is busy, add `--port 8766`.

On the board:

- Check a chore off when it is done. The line under the date shows the count.
- Use the name menu on a card to cover for someone. Choosing the original person puts that chore back on the rotation.
- Previous, This week, and Next move through the calendar. Coming up lists the next three weeks, and This cycle shows whether everyone still has one turn at each chore.
- Copy reminder copies the group note. Each person has a separate copy button under that.
- The Household section is where you replace the stand-in names, chore text, week start, timezone, and Sunday 6:00pm reminder. Renaming keeps the rotation. Reordering the lists, or moving the anchor date, recalculates every week, including past ones.

The same things work from the terminal:

```bash
python3 app.py week
python3 app.py cycle
python3 app.py remind
python3 app.py mark kitchen done
python3 app.py assign "Living areas" Drew
python3 app.py assign "Living areas" auto
python3 app.py calendar -o chores.ics
```

Checkmarks and one-week swaps are stored in `state.json` in that folder.

## Reminders

`python3 app.py remind` prints the group note and one note per person. A phone or email filled in on the Household form is used as the `To:` line.

A daily job sends it on the reminder day only, at or after the reminder time, once:

```cron
CRON_TZ=America/New_York
0 18 * * * cd /tmp/evals/v0/T07/chore-rotation && python3 app.py remind --if-due
```

That matches the current setting: Sunday at 6:00pm, America/New_York. Change `CRON_TZ` if you change the household timezone. Add `--write` to save a text file per person under `reminders/`.

Paste a Slack or Discord incoming-webhook URL into Group webhook, save, and add `--send`. The post includes both the Slack `text` field and the Discord `content` field. The group note is what gets sent.

The calendar link on the page, and `python3 app.py calendar -o chores.ics`, export the next 16 weeks as one all-day event per person. Download a fresh copy after a swap so the phones pick it up.

## What I assumed

Alex, Blake, Casey, and Drew stand in for the four of you, in that rotation order. The chores are kitchen, bathrooms, floors and trash, laundry, and living areas, with a short definition of done on each card. The week starts Monday. The week of Nov 16, 2026 is week 1, so Alex holds the extra chore right now. Reminders are set for Sunday at 6:00pm, America/New_York.

A few things only you know:

- What are the four names, and what order should the rotation use?
- Are these the five chores, or do you want different ones?
- Where should the reminder go: the copied group-chat note, a Slack or Discord webhook, or a phone/email on each person?
- What timezone are you in, which day should the week start, and when should the reminder arrive?
- Should this week be the start shown above, or should someone else be holding the extra chore now?
