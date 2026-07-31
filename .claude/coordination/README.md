# Coordination

Several agents work tickets at the same time and every commit lands on `main`. This directory holds
the ledger that keeps two agents off the same file and the check that stops a conflicting push.

## Setup, once per clone

```sh
sh .claude/coordination/install-hooks.sh
```

That copies `hooks/pre-push` into the clone's git hooks directory. Run it again in any worktree
created with a separate git directory.

## The protocol

1. **Claim before editing.** `node .claude/coordination/coord.mjs claim <N> path/one path/two`
   writes `claims/<N>.json` and prints a warning for every path another open claim already holds.
   Calling `claim` with no paths records whatever the working copy has touched so far.
2. **Work the ticket.** One ticket is one commit. Keep the change inside the files you claimed.
3. **Close before committing.** `node .claude/coordination/coord.mjs close <N>` records the files the
   ticket actually touched and checks them against `origin/main`. Exit code 1 means a conflict.
4. **Push.** The pre-push hook runs the same check and blocks the push on exit code 1.

Other commands: `check` runs the conflict check alone, and `list` prints every claim with its state.

## What counts as a conflict

`coord.mjs` fetches `origin/main`, finds the merge base between it and `HEAD`, then compares two
lists: the files this working copy touched since that base (committed, staged, unstaged, and
untracked), and the files that landed on `origin/main` since the same base. A path in both lists is a
conflict. Rebase on `origin/main` and re-run.

A second, softer signal comes from the ledger: `close` also names any open claim from another issue
that lists a file this ticket touched. That prints a warning and does not block, since the other agent
may not have committed yet.

## The claims ledger

One JSON file per issue, at `claims/<N>.json`:

```json
{
  "issue": 12,
  "agent": "lockers-12",
  "files": ["app/(admin)/requests/page.tsx"],
  "opened": "2026-07-31T18:04:11.902Z",
  "closed": null
}
```

Claim files are tracked in git so every agent sees the same ledger after a pull. One file per issue is
what makes that safe: a single shared ledger file would conflict on every concurrent claim, while
separate files never overlap textually.

`agent` reads `CLAUDE_AGENT_ID` when it is set, and falls back to the working copy's directory name.
Set it when running several agents so the warnings name something a person recognizes.

## Worktree isolation

Give each concurrently running agent its own worktree so uncommitted work never mixes:

```sh
git worktree add ../lockers-12 -b ticket-12 origin/main
cd ../lockers-12
sh .claude/coordination/install-hooks.sh
CLAUDE_AGENT_ID=lockers-12 node .claude/coordination/coord.mjs claim 12
```

The ticket still lands on `main`: fast-forward or cherry-pick the single commit onto `main` and push,
then `git worktree remove ../lockers-12`. Node modules do not carry across worktrees, so each one
needs its own `bun install`.
