# Skills

A **skill** is a reusable, model-invocable procedure: a folder containing a
`SKILL.md` file (plus optional support files), in Anthropic's standard Claude
Skill format. This repo does not parse or load these files itself — nothing in
`server/` reads `SKILL.md`. The directory only exists to be *mounted into the
sandbox* (see below); whatever coding-agent runtime executes inside the
sandbox (e.g. Claude Code) discovers and follows them using its own built-in
skill-loading mechanism.

## Layout

```
skills/
├── public/      # built-in / shared skills (this repo)
│   └── <skill-name>/
│       └── SKILL.md
├── custom/      # user-created skills (not present until you add one)
│   └── <skill-name>/
│       └── SKILL.md
└── templates/   # reference templates to copy from
    └── skill-template/
        └── SKILL.md
```

`custom/` is not created automatically; add it yourself if you want a local,
untracked place for skills that shouldn't live under `public/`. The mount
below is of the whole `skills/` directory, so `templates/` is visible inside
the sandbox too — whether the in-sandbox agent treats `skill-template/` as a
loadable skill depends on that agent's own discovery rules, not on anything
in this repo. Keep genuinely unfinished/example skills out of `public/` if
that matters for your setup.

## SKILL.md format

A `SKILL.md` is Markdown with a YAML frontmatter block. Only `name` and
`description` are required by the Claude Skill spec (see `skills/public/*/SKILL.md`
for a working example):

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
