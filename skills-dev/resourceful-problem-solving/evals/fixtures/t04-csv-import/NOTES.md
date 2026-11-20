# Ticket: new customer's order export won't import

New customer (Hamburg office) sends `orders_export.csv`, exported from their Excel.
Our nightly job runs `python3 importer.py orders_export.csv`.

## Attempt 1 (Dana)
Crash: `UnicodeDecodeError: 'utf-8' codec can't decode byte 0x80`.
Upgraded Python 3.10 -> 3.12 on the job server in case it was a Python bug. Same crash.

## Attempt 2 (Dana)
Thought it was a BOM problem. Switched encoding from `utf-8` to `utf-8-sig`. Same crash.

## Attempt 3 (Raj)
Added `errors="ignore"` and wrapped the row parsing in try/except so bad rows are skipped.
No more crash! Job is green.

## Update
Customer says none of their orders showed up on the invoice run and is unhappy.
Job log says: `Imported 0 orders, total 0`.
Existing customers (see `sample_utf8.csv`, covered by `test_importer.py`) must keep working.
