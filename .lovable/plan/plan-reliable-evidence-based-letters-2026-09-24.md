# Plan: Reliable, evidence-based letters — plan, review, gate, and the measurement to prove it

The ask was not to make the prose better. It was to make an excellent letter the
reliable default. A system that is occasionally brilliant and frequently mediocre
has not solved anything, so this iteration was built around three questions: what
does the employer need, what evidence does the candidate actually have, and can
every substantive claim be defended.

Two changes of substance came out of it. The letter is now planned against an
explicit evidence map before a word is written, and it is judged by something
other than the thing that wrote it. Everything else — the planner's shape, the
reviewer's taxonomy, the gate, the corpus, the harness — exists to make those two
things inspectable.

---

## What the audit found

The v2 pipeline already existed and was left in place: role commits, requirements
extraction into an editable list that doubles as the letter's structure, one
drafting call, code-side post-passes (punctuation, banned characters, English
variant, repetition), a grounding call that traces every claim to the candidate's
material and raises per-paragraph flags, approve/dismiss decisions with stable
signatures, revisions treated as a set with locked paragraphs untouched, saved
letters, PDF export, style, rules, a corpus and an eval harness.

Four gaps were structural rather than stylistic:

1. **The plan existed only inside one model call.** The drafting prompt said
   "plan silently first", so the reasoning could not be inspected, checked against
   the candidate's material, or reused by a reviewer.
2. **Nothing independent of the writer ever attacked the draft.** The "Fact check"
   action reported prose advice, but it fed nothing: no repair, no verdict.
3. **Validation covered facts and echoes, not relevance.** Nothing asked whether
   the evidence chosen was the strongest available for that requirement, or whether
   the letter would read the same with another employer's name in it.
4. **Nothing decided whether a letter was finished.** A letter was done when the
   user stopped editing it.

## What was added

- **`src/lib/coverLetterPlan.ts` — the planning stage.** Extracts the role's
  purpose, level, returning priorities and the employer's own terminology, and for
  each requirement records the evidence, its strength (demonstrated / transferable
  / none), its source, the strongest defensible claim, and the gap. Parsing can
  only ever downgrade: an unreadable strength becomes transferable at best, a claim
  without evidence is dropped, and the planner's own "none" wins. It renders a
  fenced evidence map that travels with every later call.
- **`src/lib/coverLetterCritic.ts` — the critic.** Runs on its own instructions,
  assumes the letter is mediocre, and is told that evidence and relevance outrank
  elegance: a polished paragraph carrying no evidence is a failure and must be
  reported as one. Returns worst-first findings (code, paragraph, exact passage,
  why it matters, what to do instead, severity), a short keep-list, and no score.
  A 26-code failure taxonomy is shared with the gate, and a blocking code cannot be
  downgraded by the reviewer's own severity label.
- **`src/lib/coverLetterGate.ts` — the decision, in code.** Four verdicts — ready
  to send, worth a small edit, your input needed, needs another pass — with plain
  reasons, a category count, and never a number. It can say "not yet"; it can never
  claim the letter is good.
- **`src/lib/promptFences.ts`** — fence escaping, so a model answer cannot close the
  block it was quoted inside.
- **Plan persistence** in the saved-letter payload, with staleness measured against
  the ad and the requirement list it was built from.
- **UI**: the plan card, the review card with findings, the gate card with its
  verdict and reasons, and the questions the plan wants the user to answer.
- **The corpus** grew from 10 cases to 18, adding an executive, a junior candidate,
  an employment gap, a declared transferable move, a nonprofit, sales, finance, and
  a case where the ad asks for something the CV never establishes.

## What was deliberately preserved, and why

The brief's warning was that some redundancy is load-bearing. Kept and untouched:
the requirements list as the letter's structure; the drafting prompt and its
post-passes; the grounding validator and every flag kind; flag decisions, the
standing-rule offer after three dismissals, locked paragraphs, the instruction set
that revisions satisfy together; role-labelled context (style-only letters never
become facts); save/reopen; PDF export; style and rules.

## Consolidation in this pass

- **One review instead of two.** The older "Fact check" action (`reviewPrompt` with
  `LETTER_SYSTEM`) covered the same seven concerns as the critic but reported them
  as prose and fed nothing. The critic reports them as findings that drive repair
  and the gate, so `reviewPrompt` and its state, card and button are gone. Fact
  checking as a *capability* is unchanged: the validator still raises unsupported
  and misattributed flags per paragraph, and they still block.
- **The verdict can now improve as the user works.** A should-fix finding the user
  reads and sets aside no longer holds the letter back; it is reported as a note
  rather than a reason. Setting a finding aside is a per-finding decision keyed by
  its own signature, so a later review of different words cannot inherit it.
- **The mirror-image gap, closed at the same time.** A `must-fix` finding whose code
  is not in the blocking list previously affected nothing at the gate at all — the
  label said must-fix and the verdict ignored it. It now holds the letter back, and
  it cannot be set aside. What the control can settle is exactly what holds a letter
  at "worth a small edit", and nothing else.
- **Nothing unsupported can be waved through.** Blocking categories are decided from
  the flags and the codes before any acknowledgement is consulted.
- **Toolchain.** `scripts` and `tests` moved out of the app's compile surface into
  `tsconfig.tests.json`; `npm run typecheck` checks both. `no-explicit-any` is a
  warning rather than an error (65 pre-existing occurrences in the model-answer
  parsers, where `any` is the deliberate boundary type), and `prefer-const` ignores
  variables read before their single later assignment. Lint went from 71 errors to
  0 errors and 75 warnings, so a new real problem fails the run again. Thread
  artifacts (`.freebuff/`, `supabase/.temp/`) are ignored. The Tailwind plugin is a
  normal import rather than `require`, verified by a full build.

## What was measured, and how honestly

The live harness (`scripts/eval-corpus.ts`) compares the pre-v2 prompt, read out of
git at `201ac08`, against the staged pipeline, and reports a distribution — mean,
worst, best, spread — because the problem being fixed is variance, not the best case.
Its penalty is a proxy: a weighted count of everything measurable and wrong.

No model key exists in this checkout, so the run below replays a **cassette** of
answers written by hand for four cases (`tests/fixtures/agent-cassette.json`):
strong fit, career change, junior candidate, and the ad that wants what the CV never
establishes. Every stage runs the real code. Two limits matter: one author is one
sample, and a cassette replays the same answer, so it can report a level and cannot
report variance.

| | Legacy prompt | Staged pipeline |
|---|---|---|
| Penalty (mean / min / max / sd) | 16.12 / 15.46 / 17.24 / 0.68 | 4.31 / 3.07 / 5.12 / 0.83 |
| Unsupported claims per letter | 2.5 | 0 |
| Genericity clichés per letter | 1.5 | 0 |
| Resume echo | 3.5% | 0.6% |
| Gate verdicts | 100% needs another pass | 50% small edit, 50% your input needed |
| Failure categories | `UNSUPPORTED_CLAIM×10 AD_ECHO×5 OVERCLAIMING×1` | `WEAK_ROLE_CONNECTION×2 WEAK_EMPLOYER_CONNECTION×2 MISSING_INFORMATION×2 REPETITION×1 WEAK_CLOSING×1 AD_ECHO×1` |

All letters on both sides were inside the length band, so the gap is not a length
artefact. The behaviour that matters most is the `missing-info` case: the legacy
answer claimed a track record of owning enterprise accounts that the CV never
establishes; the pipeline left it unanswered, said so, and ended asking the
candidate instead of guessing.

Three defects in the measuring instrument were found and fixed while doing this:
the penalty weighted only 5 of the 26 failure codes, so most of the taxonomy was
invisible to the number the whole comparison rests on; legacy letters never faced
the validator or the gate, so they could not be charged for faults the pipeline was
charged for; and the direct-run guard made `npm run eval` exit silently having done
nothing. A consequence to remember: **penalties are not comparable across harness
versions.** Older runs are not a baseline for these numbers.

## Known issues, deliberately not resolved here

1. **The echo rule charges the move MIT recommends.** Naming a requirement in order
   to admit a gap — the transferable-skills pattern the brief asks for — is flagged
   as ad echo. It needs its own code, distinct from borrowed marketing language.
2. **Requirement coverage rewards borrowing the employer's words.** The ad itself
   scores 100%, and a letter written in the candidate's own words scores lower. The
   bias is pinned in a test rather than hidden; the fix is to measure coverage from
   the plan (which requirements the letter's evidence actually draws on) instead of
   from ad vocabulary.
3. **The whole-letter 5-gram ad echo barely moves** (0.2 against 0.0): it only fires
   on wholesale copying. The per-paragraph validator flags are the useful signal.
4. **The repetition heuristic does not discriminate at letter length** (4.0 against
   3.75 flags per letter on both sides).
5. **Variance is still unmeasured.** Only repeated live runs with a key can produce
   a spread, and that is the number the whole exercise is about.
6. **The pass verdict is now reachable, and worth watching.** Whether users set
   aside findings they should have fixed is a question the flag decisions in the
   app can eventually answer.

## Traceability

| Brief | Where it lives | What holds it |
|---|---|---|
| Phase 1 — audit | this record | — |
| Phase 2 — baseline | `scripts/eval-corpus.ts` legacy mode, reading the pre-v2 prompt from git | `EVAL_MODE=legacy` |
| Phase 3 — evidence architecture | `coverLetterPlan.ts` (`EvidenceMap`, strengths that only downgrade) | `tests/coverLetterPipeline.test.ts` |
| Phase 4 — job analysis | `planPrompt`: purpose, seniority, priorities, terminology | same |
| Phase 5 — matching | evidence entries and `mapCoverage` | same |
| Phase 6 — generation | `draftPrompt` carrying the evidence map on every call | `the plan travelling with the letter` |
| Phase 7 — critic | `coverLetterCritic.ts`, `CRITIC_SYSTEM`, the taxonomy | `the critic` |
| Phase 8 — revision | `critiqueInstructions` into `promptWithInstruction`; one automatic repair | crafter `generate()`; harness `repair` |
| Phase 9 — validation | grounding flags → `failureTaxonomy` → `qualityGate` | `tests/coverLetter.test.ts`, `the quality gate` |
| Phase 10 — regression | 18-case corpus, cassette, instrument tests | `the evaluation corpus`, `tests/evalInstrument.test.ts` |
| Phase 11 — compare | `EVAL_MODE=both`, legacy read from `201ac08` | runbook in `docs/ARCHITECTURE.md` |
| §5 zero fabrication | planner cannot upgrade evidence; blocking categories cannot be acknowledged away | plan tests, gate tolerance tests |
| §34 ask, don't guess | `mapQuestions` → open questions → `needs-input` | pipeline tests, `missing-info` case |
| §35 confidence gating | four verdicts, no scores | `the quality gate` |
| §37 formatting | `letterPdf.ts`: one A4 page, real extractable text, valid EOF | `tests/letterPdf.test.ts` |
| §45 failure taxonomy | 26 codes, weighted in the harness | pipeline tests, instrument tests |
| §47 stage separation | five systems: requirements, plan, letter, critic, grounding | `the brief's stage separation holds end to end` |
| §49 user approval | flag decisions, set-aside findings, plan card, questions | `tests/savedLetters.test.ts`, gate tolerance tests |

## How to run it

See `docs/ARCHITECTURE.md`. In short: `npm test` for the offline suite, which
includes the staged pipeline running end to end from the cassette with no key;
`EVAL_MODE=both EVAL_REPEATS=3 npm run eval` for the live comparison, with a key in
`.env.local`.

## Verification

`npm run typecheck` clean across both projects, 101 tests passing, `npm run build`
succeeding, `npm run lint` at 0 errors and 75 warnings, and the cassette run
reproducing the numbers above. No live model run was performed: no key exists in
this checkout, and the script says so rather than pretending otherwise.
