Skip a blockchain. For 30 employees, keep a training register and store a copy of every completion where the person who edits the register cannot erase it.

That is the setup that actually makes a later change show up. A chain does not.

## Why a blockchain misses the goal

You want a record an inspector, insurer, or lawyer can rely on: who finished which safety certification, and on what date. A blockchain only makes a log hard to edit after the fact, and only if you do not control the computers that store it.

- A public chain (Ethereum and similar) writes employee names, job roles, and training dates into a permanent public database. That is personal data you cannot take back. You would also be running wallets, keys, and fees for a list of 30 people.
- A private chain (Hyperledger Fabric and similar) is run by you. Whoever holds the admin keys can write a false “completed” entry, or stand up a new history. The people who could edit a spreadsheet are the same people who would run the chain. You would also be maintaining servers for a problem a spreadsheet handles.

A chain also cannot tell whether the training really happened. It only preserves whatever someone typed in. A false entry on the day of training stays false forever.

## What to do instead

Use one spreadsheet (Google Sheets or Excel). One person edits it. Everyone else has view access.

Columns:

| Employee | Course | Date completed | Trainer | How the trainer signed | Expires / refresher due | Certificate file | Copy emailed to employee |
| --- | --- | --- | --- | --- | --- | --- | --- |
| | | | | signed PDF, or email confirmation | | | date sent |

When someone finishes a course:

1. Add one row. Do not rewrite old rows. If something was wrong, add a new row that says it corrects the earlier one, and keep both.
2. Save the certificate (PDF or scan) in a folder named by employee.
3. The same day, email that certificate to the employee. Put their name, the course, and the date in the subject. Their inbox is a copy you cannot quietly change.
4. On the first business day of each month, export the sheet to PDF and email it to a second place the editor cannot delete: the owner’s inbox, a second manager, or your outside safety person. Keep those emails.

That monthly PDF, plus the employee’s copy, is the tamper-evidence. If the live sheet later disagrees with them, the change is visible.

## What the rules actually ask for

I am assuming a US workplace. OSHA does not require a blockchain, and it does not require paper. A 22 September 2014 OSHA letter of interpretation says training records may be kept in any form the employer chooses, as long as they are readily accessible to the employer, employees and their representatives, and OSHA. Electronic records are acceptable when they contain what the particular standard requires. Source: [Electronic Certification of Training](https://www.osha.gov/laws-regs/standardinterpretations/2014-09-22).

What goes in the record depends on the hazard. For construction fall protection, 29 CFR 1926.503 requires a written certification with the employee’s name or other identity, the date(s) of training, and the signature of the trainer or the employer, and the employer must keep the latest certification. Source: [1926.503](https://www.osha.gov/laws-regs/regulations/standardnumber/1926/1926.503). Other standards differ. There is no single OSHA retention period for all training. Check each standard that applies to your work, and keep records at least for the person’s employment. This is recordkeeping practice, not legal advice; if you are in a heavily regulated trade, have your safety contact confirm the list of standards.

## When to change this

Stay with the sheet while you have one site, a handful of courses, and someone who will send the monthly PDF.

Move to an ordinary training system when expirations, reminders, or several courses per person get hard to track by hand. As of the pricing page on 20 November 2026, TalentLMS Core is listed at $119 per month when billed yearly ([talentlms.com/prices](https://www.talentlms.com/prices)). Confirm the included user count on that page before you pay. Use whatever HR or payroll system you already pay for if it can store a certificate and show who changed a record.

The case that would call for something stronger than a register is different from this one: many outside organizations must verify the same certificates without calling you, and the proof has to outlive your company. Even then, use a registry those verifiers already accept. Building your own chain would still be the wrong project.

If your workplace is outside the United States, the “no blockchain” choice stays the same; only the fields and retention periods change. Tell me the country and I will match the record to that regulator. I will assume US OSHA, no existing HR system, and that these records are for your own inspections and incidents, unless you say otherwise.
