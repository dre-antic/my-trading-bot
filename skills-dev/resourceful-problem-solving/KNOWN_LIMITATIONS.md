# Known limitations

- **The host has to load it.** This is instructions plus references. If the agent never reads `SKILL.md`, nothing changes. Automatic discovery was not measured; evals injected the skill on purpose.
- **Research is only as good as the tools.** Without search, the skill requires labeling memory as unverified. It cannot invent a live price or a GitHub last-commit date.
- **It will not find every obscure option.** Discovery is a prompt to look in the right *categories*, not a complete catalog of the internet.
- **Strong models already do some of this.** On Grok 4.7, baseline scores were high (~87). The skill's measured value is concentrated: overengineering, build-vs-buy, re-planning when the goal changes, and not dumping menus. Weaker models were not tested; they may need more examples than this skill provides.
- **Length vs execution is a tradeoff.** v1.0 over-executed T01 (full app in chat). v1.1 pulls back to a recommendation. An agent that now *under*-builds when the user said "build it" would be the opposite failure; T07 ("design and build") still produced a usable spreadsheet and calendar file.
- **Project memory is a file, not magic.** `PROJECT_STATE.md` only helps if the workspace is writable and later turns read it.
- **Safety is a floor, not a legal opinion.** The skill forbids reckless shortcuts. It is not a substitute for counsel on scraping, medical devices, or employment records.
- **Other hosts unverified.** Claude Code, Codex, and ChatGPT desktop were not run. Compatibility is by format (Agent Skills spec), not by a live session on those products.
- **Eval graders are themselves models.** Scores are a consistent rubric pass, not a human lab study. Hidden checks for T04 and A07 are the hard evidence on those two tasks.
