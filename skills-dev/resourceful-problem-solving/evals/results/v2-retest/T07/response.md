Use one shared spreadsheet as the chore board, and a Monday 8:00am alarm on each person's own phone. Both are ready in `/tmp/evals/v2/T07/`.

The board already knows whose turn it is. Every Monday it moves each chore to the next person. You type the real names once.

Five weekly chores and four people means one person has two chores every week. That double turn rotates too. In each four-week cycle, every person does every chore once and has the two-chore week once. Slots 1 and 5 are that pair. Until you rename them, the pair is Kitchen and Trash and recycling.

I checked the usual chore apps on 20 Nov 2026. [Cozi Chores](https://www.cozi.com/chores/) is free for a whole family, up to 12 people, and it repeats a weekly chore on that person's own list. [Tody](https://todyapp.com/pricing) rotates chores, and its free plan is for one person. Sharing a household is Tody Premium+ Family: up to 6 people, $40 a year. The spreadsheet does the rotation with Google Sheets or Excel.

## What you have

- `household-chores.xlsx`
  - **This week** is the Monday page. Opened on 20 Nov 2026, it shows the week of 16–22 Nov: Kitchen is Person 1, Bathrooms is Person 2, Floors is Person 3, Laundry is Person 4, and Trash and recycling is Person 1 again. Next week each chore moves to the next person, and Person 2 has both Kitchen and Trash.
  - **Setup** is the only place to type. The yellow cells are the four names, the five chores, and the first Monday.
  - **Fridge** is the four-week chart. Print it once. It repeats.
  - **Coming year** lists the next 52 weeks, through 14 Nov 2027, and marks the current week.
  - **Reminders** is the click-by-click setup.
- `reminder-every-monday.ics` is Monday at 8:00am, every week, with an alert at that time. It says "Open the chore board" and stays right after you rename people.
- `START_HERE.md` is the short version of those steps.

## Watch out for

- Share one copy, in Google Sheets or a shared Excel folder. Everyone opens that copy.
- Import the reminder into each person's own calendar. Open the event afterward and confirm the alert is at the time of the event. Once the sheet is shared, paste its link into the event notes.
- Change the First Monday only before you start. After that, changing it reshuffles weeks you have already lived. It has to be a Monday, and the board says so if it is some other day. The first week is 16 Nov 2026.
- Leave all four names and all five chores filled in. This board is built for that size. A sixth chore or a fifth person needs a different rotation.
- The alarm sends people to the board, and the board names the chore. If a week passes and the board stays unopened, Tody's Family plan is the backup, because its notification can name the chore.

## First step

Open `household-chores.xlsx`, go to **Setup**, and replace Person 1–4 and the example chores with yours. Then share that file and have each person import the reminder.

I'll keep these unless you say otherwise:

1. Weeks run Monday to Sunday, starting Monday 16 Nov 2026.
2. The reminder stays at Monday 8:00am. Sunday evening is the usual other time.
3. Kitchen and Trash and recycling stay the two chores one person does in the same week, until you reorder the yellow chore cells.
