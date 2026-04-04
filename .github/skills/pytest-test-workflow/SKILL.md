---
name: pytest-test-workflow
description: 'Run Python tests with pytest in this repository using a pytest-first workflow. Use for quick default runs, focused reruns, and targeted test selection by path or keyword.'
argument-hint: 'Optional: include test paths or failing keywords to run a focused pytest command.'
user-invocable: true
disable-model-invocation: false
---

# Pytest Test Workflow

## What This Skill Produces
- A pytest run that works immediately from repo root.
- A concise pass/fail report with failing test IDs.
- A quick rerun path for focused debugging when tests fail.

## When to Use
- You want to run Python tests quickly with pytest.
- You want a default command that works without extra setup steps.
- You need to rerun only failing areas with a simple selector.

## Inputs
- Optional test target path(s).
- Optional failing keyword or test name.

## Procedure
1. Verify the working directory is repository root.
2. Verify pytest is available in the project environment:

```bash
./.venv/bin/pytest --version
```

3. Run pytest with the default command:

```bash
PYTHONPATH=. ./.venv/bin/pytest -q
```

4. If you only want a subset of tests by path, run:

```bash
PYTHONPATH=. ./.venv/bin/pytest -q <test_path>
```

5. If all tests pass:
- Report pytest checks as green.

6. If tests fail, branch by failure type:
- Import or environment errors: verify `.venv` exists, dependencies are installed, and command is run from repo root.
- Assertion failures in one area: run a strict reproducibility rerun:

```bash
PYTHONPATH=. ./.venv/bin/pytest -q -k "<failing_test_or_keyword>"
```

Then run a verbose diagnostic rerun for the same selector:

```bash
PYTHONPATH=. ./.venv/bin/pytest -vv -x -k "<failing_test_or_keyword>"
```

Use these reruns to confirm the failure is deterministic and gather richer assertion context.
- Multiple unrelated failures: inspect recent shared changes first and optionally narrow scope by path.

If you need to run a specific test file or folder, use:

```bash
PYTHONPATH=. ./.venv/bin/pytest -q <test_path>
```

7. Summarize results:
- Total passed/failed from pytest output.
- Exact failing test IDs.
- Most likely impacted area.

## Completion Criteria
- Command executed successfully.
- Pytest can be executed on demand with the default command.
- Results are reported with explicit pass/fail status.
- For failures, at least one concrete next debugging step is identified.
