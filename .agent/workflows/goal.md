---
description: Execute the complete one-shot Toggle Wars Track 01 ShipCheck build
---

# \goal — Single-Prompt Autonomous Build Trigger

Read `AGENTS.md`, `skills.md`, and `tasks.md` in the repository root in full, then execute every phase of `tasks.md` from start to finish without stopping for design choices.

Follow all rules in `AGENTS.md` and all Flagsmith CLI/SDK patterns in `skills.md`. Only pause if `flagsmith login` or Flagsmith Cloud warehouse setup requires my one-time browser authentication; otherwise build, verify (`npm run build`), provision the Flagsmith experiment, run the verification traffic script, and produce the finished `README.md` and `DEMO_SCRIPT.md`.
