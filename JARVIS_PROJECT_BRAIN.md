# JARVIS Project Brain

Each project JARVIS touches gets a lasting notebook so it does not start from
zero every time.

## What is stored

- Purpose
- Goals
- How it is built
- Important files
- How to start it
- How to test it
- Known issues and past fixes
- Decisions and a short changelog
- Current state

Nothing in this notebook should be a password or API key.

## Questions this answers

- “What is this project?”
- “How does it work?”
- “What changed?”
- “What’s broken?”
- “What’s left?”
- “Why did we build it this way?”

## Where it lives

On disk under your Projects folder, plus rows in the local JARVIS database
(`~/.jarvis/jarvis.sqlite` unless you set `JARVIS_HOME`).

## This repository

The older **AI Video Studio** and trading-bot history in this git repo are
separate projects. JARVIS should manage them from the outside — launch, test,
explain — not swallow them into its own window.
