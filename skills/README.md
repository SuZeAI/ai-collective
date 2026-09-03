# Skills

A **skill** is a reusable, model-invocable procedure: a folder containing a
`SKILL.md` file (plus optional support files). Agents discover skills at runtime
and follow the instructions inside them.

## Layout

The loader (`context/deerflow/skills/loader.py`) scans exactly two directories:

```
skills/
├── public/      # built-in / shared skills (this repo)
│   └── <skill-name>/
│       └── SKILL.md
├── custom/      # user-created skills (created at runtime)
│   └── <skill-name>/
│       └── SKILL.md
└── templates/   # NOT loaded — reference templates to copy from
    └── skill-template/
        └── SKILL.md
```

> Anything **outside** `public/` and `custom/` is ignored by the loader, so
> `templates/` is a safe place for copy-me examples that should not appear as
> live skills. Hidden directories (`.foo`) are skipped during the scan.

## SKILL.md format

A `SKILL.md` is Markdown with a YAML frontmatter block. Only `name` and
`description` are **required** (`context/deerflow/skills/parser.py`):

```markdown
---
name: my-skill            # required — hyphen-case, must be unique
description: One line describing what the skill does and when to use it.  # required
license: MIT              # optional
---

# My Skill

...instructions the agent will follow...
```

To create a new skill, copy `templates/skill-template/` into `public/<name>/`
(or `custom/<name>/`), rename it, and edit the frontmatter + body.

## How skills reach the sandbox (k8s mode)

In `SANDBOX_MODE=k8s`, the provisioner (`docker/provisioner/app.py`) mounts this
directory into every sandbox Pod **read-only** at `/mnt/skills`, sourced from the
host path `SKILLS_HOST_PATH`. Point `SKILLS_HOST_PATH` at this `skills/` directory
(absolute path) so `/mnt/skills/public/...` is visible inside the sandbox.

See [`docs/k3s.md`](../docs/k3s.md) and [`docs/sandbox.md`](../docs/sandbox.md) for
the full sandbox setup.
