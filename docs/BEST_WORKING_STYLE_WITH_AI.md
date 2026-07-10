# Best Working Style With AI for GoodSharing

This file contains reusable prompts and habits for working with AI on this project while saving tokens.

## Goal

Avoid asking AI to relearn all repos every time. Keep stable project knowledge in short Markdown files and ask AI to read those first.

Important files:

- `PROJECT_CONTEXT.md`: stable architecture and project memory.
- `CURRENT_STATE.md`: latest known working state.
- `GOODSHARING_VPS_KIND_TELEPRESENCE_GUIDE.md`: detailed rebuild/runbook.

## Prompt 1: Start a New Chat Efficiently

Use this when opening a new chat:

```text
Read PROJECT_CONTEXT.md and CURRENT_STATE.md first.
Then read only files relevant to my request.
Do not scan all repos unless needed.

My task is:
<write task here>
```

Why this helps:

- Saves tokens.
- Gives AI the project map immediately.
- Avoids re-explaining the whole system.
- Keeps the AI focused on the relevant service.

## Prompt 2: Standard Coding Workflow

Use this when asking AI to make a code change:

```text
Follow this workflow:

1. Read PROJECT_CONTEXT.md.
2. Read only the relevant service files.
3. Do not scan all repos unless needed.
4. Make the change.
5. Run the smallest useful verification.
6. Update PROJECT_CONTEXT.md or CURRENT_STATE.md if architecture or deployment state changed.

Task:
<write task here>
```

Why this helps:

- Prevents unnecessary repo-wide scanning.
- Keeps changes scoped.
- Makes sure important learnings are saved.

## Prompt 3: Update Project Memory After Debugging

Use this after a big fix or debugging session:

```text
Update PROJECT_CONTEXT.md and CURRENT_STATE.md with what changed today.
Keep PROJECT_CONTEXT.md short and stable.
Put temporary/latest status in CURRENT_STATE.md.
Do not include secrets, passwords, tokens, or private credentials.
```

Why this helps:

- Your learning becomes permanent project documentation.
- Future chats become cheaper and faster.
- Trainees can understand the project faster.

## Prompt 4: Ask AI to Explain Before Changing

Use this when you are learning and do not want edits immediately:

```text
Read PROJECT_CONTEXT.md first.
Do not change files yet.
Explain what is happening, why it is failing, and what options I have.
After that, wait for me to confirm before making changes.
```

Why this helps:

- Good for learning.
- Avoids accidental changes.
- Helps you build your own mental model.

## Prompt 5: Deployment Help

Use this when deploying backend services:

```text
Read PROJECT_CONTEXT.md and GOODSHARING_VPS_KIND_TELEPRESENCE_GUIDE.md.
Check current git branch/status for main-service, user-service, and posts-service.
Ignore goodSharing-external-apis-service.
Then help me deploy only the service I mention.

Service to deploy:
<service name>
```

Why this helps:

- Avoids touching unrelated services.
- Prevents accidentally deploying ignored repos.
- Keeps deployment focused.

## Prompt 6: Local Service Debugging

Use this when running only one backend service locally:

```text
Read PROJECT_CONTEXT.md and CURRENT_STATE.md.
I want to run only <service-name> locally.
Use deployed cluster dependencies where possible.
Tell me which port-forwards, env vars, Telepresence commands, and headers I need.
Then verify with a curl command.
```

Why this helps:

- Keeps local setup clear.
- Avoids running all services locally.
- Makes testing repeatable.

## Prompt 7: Ask for a Minimal File Read

Use this when token saving is important:

```text
Be token-conscious.
Read PROJECT_CONTEXT.md first.
Then use rg to find only files relevant to this issue.
Do not open large files or scan all repos unless the first search is not enough.
```

Why this helps:

- Avoids huge context usage.
- Still lets AI investigate properly.

## Prompt 8: Keep Secrets Out

Use this whenever logs or docs are involved:

```text
Do not print or write secrets.
If a command output includes tokens, passwords, DB URLs, or private keys, summarize it without exposing values.
```

Why this helps:

- Makes docs safe to share.
- Prevents accidental credential leaks.

## Prompt 9: Review Current Setup

Use this when you want a health check:

```text
Read PROJECT_CONTEXT.md and CURRENT_STATE.md.
Check the current Kubernetes context, pods in services namespace, ingress, certificate, and Telepresence status.
Summarize only problems and next actions.
Do not redeploy anything unless I ask.
```

Why this helps:

- Good for status checks.
- Avoids unnecessary changes.

## Prompt 10: Rebuild From Scratch

Use this when rebuilding the VPS:

```text
Read GOODSHARING_VPS_KIND_TELEPRESENCE_GUIDE.md.
Guide me section by section.
After each section, tell me exactly what command proves it worked.
Do not move to the next section until the checkpoint passes.
```

Why this helps:

- Perfect for learning.
- Prevents skipping hidden prerequisites.
- Makes rebuilds repeatable.

## What to Update Over Time

Update `PROJECT_CONTEXT.md` when:

- A new service is added.
- Architecture changes.
- Public URL changes.
- Kubernetes namespace/context changes.
- Auth flow changes.
- Deployment strategy changes.

Update `CURRENT_STATE.md` when:

- Something gets deployed.
- A bug is fixed.
- A temporary workaround is added.
- A known issue is discovered.
- Telepresence/local dev state changes.

Update `GOODSHARING_VPS_KIND_TELEPRESENCE_GUIDE.md` when:

- Rebuild steps change.
- A command becomes outdated.
- A new infrastructure component is added.
- Trainees get stuck on a repeated issue.

## Golden Rule

Keep project memory in the repo, not only in chat.

Chat memory can disappear or become expensive to rebuild. Repo memory is version-controlled, shareable, and cheap for AI to read.
