The Hamburg export was being read as a US-style UTF-8 CSV, so every row was dropped and the job reported `Imported 0 orders, total 0`. It now imports all 12 orders, total **5935.69**. Existing customers are unchanged: `sample_utf8.csv` still imports 3 orders, total **1825.49**.

`orders_export.csv` is an Excel “ANSI” export from a German locale, not a UTF-8 file with a BOM:

- Encoding is Windows-1252. Byte `0x80` is the euro sign, which is why `utf-8` and `utf-8-sig` both raised `UnicodeDecodeError`. `errors="ignore"` hid that crash by deleting those bytes, and then the row parser skipped every line.
- Columns are separated with semicolons (`order_id;customer;amount;note`), including a quoted customer name that itself contains a semicolon (`Smith; Sons`).
- Amounts use a decimal comma and a thousands dot (`1.234,56` is 1234.56, `0,99` is 0.99).

`load_orders` now decodes as UTF-8 (BOM allowed) and falls back to cp1252 only when those bytes are not UTF-8. It picks `;` or `,` from the header, and parses either decimal style. Quoted fields and doubled quotes are left to the CSV reader, so notes such as `Rabatt 5 €` and `note with "quotes"` come through intact.

```
Imported 12 orders, total 5935.69
```

`python3 -m unittest test_importer.py` passes, including the existing UTF-8 case and the Hamburg file.
