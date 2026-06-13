---
name: sandbox-shell-workflow
description: 'Run shell commands inside the sandbox and persist results to the per-thread /mnt/user-data directory. Use when a task needs to execute commands and keep their output (logs, generated files, reports) across steps in the same thread.'
argument-hint: 'Optional: the command or task to run, e.g. "list installed python packages".'
user-invocable: true
disable-model-invocation: false
license: MIT
---

# Sandbox Shell Workflow

## What This Skill Produces
- The output of one or more shell commands run inside the sandbox.
- A saved artifact under `/mnt/user-data/` so results survive across steps in the
  same thread (this directory is writable and per-thread; `/mnt/skills` is read-only).

## When to Use
- A task requires executing shell commands in the isolated sandbox.
- You need command output (logs, files, a report) to persist for later steps in
  the same conversation thread.

## When *Not* to Use
- Pure reasoning tasks that do not need to run anything.
- Writing durable data outside the thread — `/mnt/user-data` is scoped to this
  thread only.

## Inputs
- Optional: the command or task to run. If none is given, inspect the environment.

## Procedure
1. Confirm the writable workspace exists and use it for all outputs:

   ```bash
   mkdir -p /mnt/user-data/outputs
   cd /mnt/user-data/outputs
   ```

2. Run the requested command. Example — capture the environment:

   ```bash
   { python --version; pip list 2>/dev/null | head -50; } > env-report.txt 2>&1
   ```

3. Verify the command succeeded (non-zero exit ⇒ inspect and retry):

   ```bash
   echo "exit=$?"
   ls -la /mnt/user-data/outputs
   ```

4. To reuse a read-only skill asset, read it from the mounted skills tree:

   ```bash
   ls /mnt/skills/public
   ```

## Completion Criteria
- The requested command ran and its exit status was checked.
- Output was written under `/mnt/user-data/` (report the file path).
- A short summary of what was produced is returned to the user.
