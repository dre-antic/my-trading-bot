Tools actually used:

- Read `/agent/repos/my-trading-bot/.agents/skills/resourceful-problem-solving/SKILL.md`
- Read `references/discovery.md`, `references/constraints.md`, and `references/decide-and-recover.md` in that skill folder
- Glob of that skill folder (5 files)
- GetDynamicTools for Bright Data `search_engine`
- Bright Data `search_engine` four times (small-agency invoicing, Wave, Zoho Invoice, Invoice Ninja). All four failed: Bright Data rejected the credentials (`Auth method is not supported`)
- GetDynamicTools for Cursor `WebSearch` and `WebFetch`
- WebSearch: Wave invoicing pricing; Zoho Invoice pricing; Invoice Ninja hosted vs self-hosted pricing; FreshBooks team pricing
- WebFetch: `https://www.waveapps.com/pricing`, `https://invoiceninja.com/pricing-plans/`
- WebSearch: Wave Pro user limits; Wave country availability
- WebFetch: `https://invoiceninja.com/pricing-update-january-1-2026/`
- WebSearch for Invoice Ninja export: first call failed because the tool identity fields were omitted; the retried WebSearch succeeded
- Shell: `mkdir -p /tmp/evals/v1/T09`
