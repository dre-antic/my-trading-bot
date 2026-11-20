# Discovery and research

## Contents
- Solution categories to scan
- Where to look
- Vetting a repository or tool
- Hidden-cost and "free" traps
- Source reliability
- Reporting research

## Solution categories to scan

Pick the categories that could plausibly win for this problem. Don't force all of them.

| Category | Prompt to yourself |
|----------|--------------------|
| Conventional | What would a competent professional do by default? Why might it not fit here? |
| Alternative commercial | Who else sells this? Lesser-known competitors, free tiers, nonprofit, student or education pricing, pay-as-you-go instead of a subscription? |
| Open source | Is there a maintained project that already does 80% of this? Can it be self-hosted *somewhere the user really has*? |
| Programs and communities | Is there a government, library, university, nonprofit or community program that provides this outcome for free? |
| Simplification | Can the outcome be met without the proposed technology? What if we drop the hardest requirement: does anyone actually need it? |
| Unconventional | Repurpose a tool built for something else; change the workflow; let another platform do the heavy part; approach from the opposite end. |
| Hybrid | Free or local for most of the work, paid or cloud only for the bottleneck; manual now, automated later. |
| Workaround | When a limitation blocks you: an alternative integration, export/import, API or webhook, plugin, a different file format, or a different platform with the feature. Workarounds must be legitimate. |

A useful forcing question: "If I couldn't use the first tool that came to mind, what would I do?"

## Where to look

Match the source to the question:
- **Does it exist, and what are the options?** Web search, "awesome-*" lists, GitHub topic search, alternative-finder sites, the subreddit or forum for the field.
- **Does it really work and fit?** The project's README, docs, open issues (search the exact feature or error), recent releases, discussions.
- **What does it cost or what are the limits?** The official pricing page and free-tier docs; check the date. Third-party price lists go stale.
- **Is it still current?** Changelogs, deprecation notices, the maintainer's blog, the date of the last release.
- **Is it any good?** Independent comparisons, benchmarks with methodology, practitioners' experience reports. Be wary of vendor benchmarks and SEO listicles.

## Vetting a repository or tool

Check these before recommending (only the ones relevant to the decision):
- **Function**: does it do the *specific* thing needed? Find it in the docs or code, not only the tagline.
- **Activity**: last commit or release date, maintainer responsiveness, open critical issues. No release in roughly two years, or "archived" or "unmaintained" status, means abandoned unless proven otherwise; look for an active fork.
- **Install reality**: supported OS, a working install path, prebuilt binaries versus building from source.
- **Requirements**: RAM, GPU or VRAM, disk, CPU features (for example AVX2), always-on server, accounts, API keys, paid external services.
- **License**: compatible with the intended use (commercial use, copyleft obligations, model licenses with use restrictions).
- **Security and privacy**: where data goes, the permissions it needs, supply-chain risk for obscure packages.
- **Exit**: can data be exported if it dies or changes pricing?

## Hidden-cost and "free" traps

Check for these before calling something free or cheap:
- A card is required, or the free tier converts to paid automatically.
- Free projects or servers sleep, pause after inactivity, or expire.
- Quotas that real usage will exceed (count the user's actual volume).
- "Free and open source" software that needs hardware the user doesn't have (large models, GPUs, 24/7 hosting).
- App-store fees and review times; required developer accounts.
- Per-seat or per-transaction fees that grow with usage.
- Maintenance burden: updates, backups, security patches, and who will do them.
- Terms that forbid the intended use (commercial use, scraping, automation).

## Source reliability (highest first)

1. Primary: official docs, pricing pages, the repository and its releases, standards, laws.
2. Recent first-hand reports: issue threads, maintainer statements, practitioners' writeups with details.
3. Reputable secondary sources: established tech press, independent benchmarks with methodology.
4. Generic blogs, listicles, AI-generated summaries, and search-tool summaries. Use them for leads, never as proof.

If search summaries and their sources disagree, trust the sources. If sources conflict, say so and prefer the most recent primary one.

## Reporting research

- Report the findings that changed or confirmed the decision, not a list of everything you read.
- Link the key sources. Date time-sensitive facts ("as listed on the pricing page, Nov 2026").
- Mark anything unverified as such. "I couldn't find X" is a valid, useful result. Never fill the gap with a plausible guess.
