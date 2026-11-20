# Constraint playbook

Treat limitations as design inputs. For each one, the question is: what is the strongest way to reach the same outcome *given* this? Verify current limits and prices before relying on any specific service; they change often.

## No money
- Look for an existing free product or program first: free tiers, open-source apps, library, university or government services, nonprofit programs, education and nonprofit discounts.
- Use what the user already has: Google or Microsoft accounts (docs, sheets, forms, calendar), their phone, platform built-ins.
- Avoid fees by changing the delivery method: an installable web app (PWA) instead of app-store apps, static hosting instead of servers, email or calendar invites instead of SMS.
- Pay only for the bottleneck if anything: one month of a tool to finish a batch job, then cancel.
- Free tiers carry risks (pausing, quotas, cards on file, shutdowns). State them and design around them (keep-alive, exports, backups, an exit plan).
- Don't confuse cheap with free-to-operate: self-hosting needs a machine that's always on and someone to maintain it.

## Weak or old hardware
- Estimate before recommending: model or tool requirements compared with the user's RAM, VRAM, CPU features and disk. Measure on a small sample if possible.
- Move heavy work off the device: free cloud notebooks or GPU tiers, web services that process the files, a friend's or school's machine. Mind privacy.
- Shrink the work: smaller or quantized models, lower resolution, batching overnight, processing only what's needed.
- Split the pipeline: light steps local, heavy steps remote.
- Prefer browser-based tools when installs are the problem.

## Little or no technical experience
- Prefer managed, no-code or hosted options with few moving parts and good documentation.
- You do the technical work; give the user click-level steps only for what they must do themselves (accounts, payments, approvals).
- Avoid anything that needs a terminal, server upkeep, or debugging to keep running, unless you'll be there to run it.
- Teach only what they need to operate it. One clear path beats a menu.

## Little time or a hard deadline
- Ship the core outcome first with existing tools; build custom parts later if they're still needed.
- Cut scope, not quality or safety. Decide explicitly what is out for v1.
- Find the blocking lead times early: account verification, app review, domain or DNS propagation, shipping, approvals.

## Region, platform or policy restrictions
- Check availability in the user's country (payment providers, APIs, stores).
- Look for regional alternatives or providers that operate there legally.
- Never advise evading law, sanctions or terms of service (for example, using a VPN to break a service's terms).

## The tool lacks a needed feature
- Look for a plugin, extension, integration, API or webhook, or automation glue (self-hosted or free-tier automation tools).
- Try export, transform and re-import, or a different file format.
- Look for an adjacent tool that has the feature.
- Fork or contribute when the gap is small and the project is healthy.

## A failed install or environment problem
- Search the exact error in the project's issue tracker first.
- Try prebuilt binaries or official installers, a container, an older or newer supported version, or a cloud development environment.
- Check prerequisites the docs assume (CPU instructions, OS version, compiler, drivers).
- After two failed fixes with the same theory, re-diagnose (see decide-and-recover.md).

## When constraints truly conflict
Write the conflict down concretely, for example "Apple charges $99 a year and review takes days; budget is $0 and the deadline is Friday." Ask which outcome matters most by Friday, deliver that with tools that fit, and stage the rest. Offer the cheapest relaxation that unlocks the most (for example "$25 one-time unlocks Android").
