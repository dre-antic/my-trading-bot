The Hamburg export is importing again: **12 orders, total 5935.69**. Existing customers are unchanged: **3 orders, total 1825.49**.

`orders_export.csv` is a German Excel export, not a UTF-8 comma CSV.

- Encoding is Windows-1252. Byte `0x80` is the euro sign, and letters such as ü, ñ, and ß are single bytes that are illegal in UTF-8. Decoding as Latin-1 keeps the letters but turns the euro signs into control characters.
- Columns are separated with `;`, because `,` is the decimal mark (`1.234,56` is 1234.56).
- Fields follow normal CSV quoting, so `Smith; Sons` stays one customer and doubled quotes in notes stay quotes.

The job reported success with `Imported 0 orders, total 0` because undecodable bytes were dropped and any row that then failed to parse was skipped. Every Hamburg row failed, so nothing was billed.

`importer.py` now decodes UTF-8 when the file is UTF-8 (BOM included) and Windows-1252 otherwise, picks `;` or `,` from the header, and reads both `1500.00` and `1.234,56`. A row that still cannot be parsed fails the job instead of being left off the invoice.

Checked with `python3 test_importer.py` (both the old sample and this export) and with the nightly command:

```text
python3 importer.py orders_export.csv
Imported 12 orders, total 5935.69

python3 importer.py sample_utf8.csv
Imported 3 orders, total 1825.49
```

Names, euro notes, and the quoted semicolon customer all come through. Amounts are still ordinary floats, rounded to cents in the total, same as the other customers.
