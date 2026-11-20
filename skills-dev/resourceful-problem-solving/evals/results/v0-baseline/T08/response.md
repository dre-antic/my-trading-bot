Do not put this on a blockchain. For 30 employees, use the system that already holds the training records (your LMS or HRIS), and make those records tamper-evident with an append-only audit log. That gives you the property you actually want — a clear history of who completed what, and proof if someone later changes it — without a ledger, wallets, or a new platform to operate.

Safety-training records are private personnel data. They also have to be correctable: someone mistypes a date, a certificate is renewed, a name changes. A blockchain is built so that history cannot be edited. That sounds like what you want, and it is the wrong fit. Regulators and auditors want a reliable record of completions and of later corrections, not a chain that makes fixing a data-entry error expensive or impossible. At this scale the operational cost (keys, nodes, upgrades, “who holds the admin key”) is larger than the risk you are trying to close.

What to build instead:

- Keep the source of truth in the LMS or HRIS you already use, with normal access control so only a few people can mark training complete.
- Write every change to an append-only audit log: employee, course, completion date, who entered it, and when. Do not give application users permission to update or delete those rows.
- Back the database up on a schedule, and keep the backups somewhere the people who edit training records cannot reach.
- If you want cryptographic evidence on top of that, hash each log entry together with the hash of the previous entry, and periodically publish the latest hash somewhere you do not control (a timestamping service, or a single low-cost transaction on a public chain). The employee names and certificate details stay in your database. Anyone who later alters a row will break the hash chain, and the published hash shows what the log looked like at that time.

That last step is the only place a public chain is useful here, and it is optional. You are anchoring a fingerprint, not storing the records.

If you still want a named platform after that: a public chain such as Ethereum is the wrong place for the records themselves. Employee names and certification status should not sit in a public ledger. A permissioned ledger such as Hyperledger Fabric is the category that matches “internal company records,” because only your organization runs it and reads it. For 30 people it is still the wrong project. You would be operating a distributed system to reproduce what one database, locked-down permissions, backups, and a hash chain already do.

Start with the audit log in the system you have. Add hash anchoring only if an auditor specifically asks for third-party evidence that the log was not rewritten.
