---
name: do-work
description: "Execute a unit of work end-to-end: plan, implement, validate with typecheck and tests, then commit locally. Use when user wants to do work, build a feature, fix a bug, or implement a phase from a plan."
---

# Do Work

Execute a complete unit of work: plan it, build it, validate it, commit it.

## Workflow

### 1. Understand the task

Read any referenced plan or PRD. Explore the codebase to understand the relevant files, patterns, and conventions. If the task is ambiguous, ask the user to clarify scope before proceeding.

### 2. Plan the implementation (optional)

If the task has not already been planned, then create a plan for it:

Break the work into concrete steps before writing code. List what files will be created or modified, what functions are needed, and what the expected behavior is. Present the plan to the user for confirmation if the task is non-trivial.

### 3. Implement

Work through the plan step by step. Follow existing patterns in the codebase.

### 4. Validate

Run the feedback loops and fix any issues. Repeat until both pass cleanly:

```bash
pnpm typecheck
pnpm run test
```

### 5. Commit locally

Once typecheck and tests pass, create a local commit with a clear message describing the work. Do NOT push to the remote — keep the commit local only.
