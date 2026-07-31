# CLAUDE.md
Be concise & dev friendly in explanations with full transparency in data structure thought process, architectural decisions, potential and existing conflicts. Always package with uv and .toml, alternately bun; no raw pip install. If a package does not exist mention it by name + ask before installing. Clarify all dependencies with user before beginning work. If you don't have a required dependency and you are on a loop, take a step back and think about what you could do without installing any new packages. Escalate dependency issues with user as soon as possible if it's a hard block and stop work. 

## The session log

`docs/log.md` is the running worklog: findings, dead ends, and why. Keep it updated as work happens,
not at the end.

It is **gitignored and never staged**, despite living in `docs/`. It is a local handoff between
sessions, not a published document. Do not `git add` it.

**Add new entries in reverse chronological order, newest first.** A new entry goes at the top of the
file, directly under the preamble, above every existing entry.

## Plans

`docs/plans/locker-management-system.md` is the implementation breakdown this repo works through: seven
phases of numbered steps, with reviewer checkpoints on every UI surface in Phase 6. A ticket names the
step it carries out.

## Tickets

Work is organized as GitHub issues. One ticket is one commit directly to `main`. No feature branches.

The commit message body ends with `closes #N`, and the commit is pushed immediately so the issue
auto-closes. Verify the fast suite is green first. Write the subject in Conventional Commits form
(`type(scope): imperative subject`) following the `commit-message` skill.

Keep a change scoped to its ticket. When a neighbouring bug or a wrong rule turns up in a file you are
already editing, file it or point at the existing issue and leave a comment in place, rather than
folding an unrelated fix into the diff. Mechanism changes and rule-content changes stay in separate
commits so each is separately reviewable.

Concurrent agents share `main`, so before the closing commit run the coordination close step (`node
.claude/coordination/coord.mjs close <N>`): it records the files touched and checks for a conflict with
what has landed on `origin/main`. A pre-push hook enforces the same check and blocks a conflicting push.
The full protocol, the claims ledger, and worktree isolation are in `.claude/coordination/README.md`.

### Labels

Every issue carries at least one `area:*` label: `area:data`, `area:schema`, `area:backend`,
`area:frontend`, or `area:infra`. An issue with none is a gap, not a signal that none apply.

### Blocking, relating, and closing

The opening line names the plan an issue belongs to and, where one exists, its blocker: `*Blocked by
#N.*`. That line names the actual current blocker, not the historical one. When #N closes and a
different open issue still blocks the work, a later dependency the original blocker's own scope
surfaced, update the line to name it rather than leaving a satisfied blocker in place. #38 citing
`Blocked by #37`, a closed issue, while its own scope depended on the still-open #35, is the case this
rule exists to prevent.

Tickets that independently discuss the same concrete thing (a file, a function, a case barcode) link
each other with a `## Relates to` line or a closing sentence, in both directions. This matters most when
one ticket's answer could change whether the other's work is needed at all, as with a case whose
in-scope status one ticket questions while two others plan work against it.

A citation to an exact line number, or a quoted line of code or prose, is a claim about that file's
state when the ticket was written, not a standing fact. A later commit that moves those lines, or a doc
rewrite that removes the passage entirely, does not update the ticket that cited it.
No automated check reads a ticket's citations, so re-verify one against the current file before acting
on it or closing the issue on the strength of it.

A title that states a count or a specific claim must match what the body itself derives. If the two
disagree, the title is wrong until shown otherwise: it is the summary, and the body is the evidence.

`.claude/agents/ticket-intake.md` owns two jobs against these rules: turning a new feature request into
a well-formed issue, and periodically re-auditing the open backlog against them. Invoke it rather than
filing an issue free-hand.

Fix stale documentation as you encounter it. Paths cited in comments and docs should resolve in a fresh
clone, which means a doc a commit references must be *staged* in that commit, not merely present on
disk.

### Write for the audience, not for yourself

Every document produced for a person to read, published or not, is written for a reader with no session
context: no view of the conversation, no memory of what anyone believed last week, no knowledge of a
proposal that got rejected along the way. This covers `README.md`, the tracked `docs/`, dataset cards,
the API surface, and just as much a plan, a spec, or a PRD. Plain terms. State the destination directly.
Do not explain a misconception, argue against it, narrate a rejected alternative, or recap how the current
approach was reached: a reader who never held the earlier belief cannot parse the rebuttal, and only sees
an odd defensive sentence or a history lesson standing in for a decision.

The test: strike any sentence that only makes sense to someone who knows what was previously wrong, or
what used to be proposed instead.

Internal reasoning goes in `docs/log.md`, at full fidelity, continuously: what was believed, what
turned out to be false, what was measured, what was rejected and why. Nothing there is too detailed.


## Style


### House-style checklist

Run this over every message, doc, comment, and commit before sending.  Read line by line and apply each
item. A keyword grep finds banned words but misses the structural faults (fragments, copulas, comma-tails),
so read the sentences, do not grep them. The full rules and word lists live in the `house-style` skill.

- [ ] No em dash, en dash, or double-hyphen clause separator. 
- [ ] BE CONCISE. DON'T OVER JUSTIFY OR GO AROUND IN CIRCLES. MAKE A POINT, NO EXCUSES, NO METAPHORS, NO STYLIZATION.
- [ ]  No noun-phrase fragments!
- [ ] Banned words: Carries (prefer "has"), holds (prefer "uses"), "honest"/"honestly" (just don't put this qualifier in!!!!!!!!), "gated", "load-bearing". I dislike "blocked"; avoid it in favour of "pending".
- [ ] Every sentence has a finite verb and a named actor. No metaphors unless they are intentionally requested by the developer, discussed for cohesion and approved.
- [ ] No copula ("is/are/was/were") standing in for a mechanism, and no chained "X is Y, and it is Z".
- [ ] No comma-tail: a full clause, a comma, then a short trailing modifier. Fold it into the clause.
- [ ] No antithesis ("not X, but Y"; "X, not Y"), no isocolon, no tricolon.
- [ ] No aphorism or verb for a mechanism ("catches", "stays a draft", "absorbs"). State the mechanism.
- [ ] No personified system, and no causal chain compressed into a metaphor. Name the agent, choice, and consequence.
- [ ] No inflated or filler word: genuinely, honestly, quietly, deeply, leverage, unlock, optimize, streamline,
      seamless, flag, call out, adjudicator, "the whole X", "at the end of the day".
- [ ] No passive that hides who acted, no vague universal noun (thing, way, process, space) carrying the sentence.
- [ ] Every abstract sentence is followed by a concrete number, example, or consequence.
- [ ] A proposal reads as a proposal, not as current behavior.
- [ ] Concision: say it once. No restating a result in a second sentence, no summary
      paragraph that repeats the table above it, no preamble before the number.
- [ ] No dramatization: a negative result is a measurement, not a reversal or a lesson.
      State what was measured and what it implies. Cut "critically", "decisively",
      "strikingly", "the good news", "what this means is", and any sentence whose
      only job is to tell the reader how important the previous sentence was.