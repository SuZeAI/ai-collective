---
# ── Required ──────────────────────────────────────────────────────────────
# `name`: hyphen-case, unique across all skills. Becomes the skill's identifier.
name: skill-template
# `description`: one line — what the skill does AND when to use it. The agent
# reads this to decide whether to invoke the skill, so be specific.
description: 'Template for authoring a new skill. Copy this folder into skills/public/<name>/ (or skills/custom/), rename it, and replace every section below.'
# ── Optional ──────────────────────────────────────────────────────────────
# license: MIT
# argument-hint: 'Describe any free-text argument the skill accepts.'
# user-invocable: true            # show in the slash-command / skill picker
# disable-model-invocation: false # set true to prevent the model auto-invoking
---

# Skill Template

> This file lives under `skills/templates/`, which the loader does **not** scan,
> so it never appears as a live skill. Copy it to `skills/public/<name>/SKILL.md`
> to make a real one.

## What This Skill Produces
- The concrete outcome the agent should deliver (an artifact, a report, a change).

## When to Use
- The trigger conditions — when this skill is the right tool.
- When *not* to use it, if there's a common confusion.

## Inputs
- Any parameters, file paths, or context the skill needs (or "none").

## Procedure
1. First step — keep steps explicit and ordered.
2. Include exact commands in fenced blocks when the skill runs commands:

   ```bash
   echo "replace with the real command"
   ```

3. Note any decision points ("if X fails, do Y").

## Completion Criteria
- An explicit, checkable definition of "done".
- What the agent should report back to the user.
