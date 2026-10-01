# Security

Implemented:

- HttpOnly session cookies (`iron-session`)
- `scrypt` password hashes
- CSRF-friendly same-site cookies (state-changing APIs require the session cookie; no secrets in URLs)
- Security headers (CSP, nosniff, frame deny, referrer)
- Audit log with secret redaction
- Prompt-injection detector on the AI desk
- Allowlisted agent tools (research agents are read/propose only)
- Broker credentials never returned by APIs; metadata only
- LIVE and autonomous paths refused without environment + user flags
- Tenant-scoped queries

Not yet production-hardened:

- No WAF, no SSO, no hardware key support
- CSP still allows `'unsafe-inline'` / `'unsafe-eval'` because of Next.js
- SQLite file must be protected by the host
- Dependency audit is run in CI but not a gate that fails the build on moderate findings

Never:

- Log API keys
- Put broker secrets in prompts
- Store secrets in source
- Treat a timed-out submit as a confirmed failure without reconciliation
