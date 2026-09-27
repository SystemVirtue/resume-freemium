# How the cover letter pipeline works

The job of this system is not to write well. It is to make a truthful, specific,
evidence-backed case for one candidate with one employer, and to be able to say when
it has not managed it. Everything below exists to make that inspectable.

The pipeline, in order:

```
requirements → plan (evidence map) → draft → validate → review → repair if it must
            → validate again → gate
```

## The stages, and what each one owns

**Requirements** (`REQUIREMENTS_SYSTEM`, `src/lib/coverLetter.ts`). Reads the ad and
produces the list of what the role actually needs. The list is editable and becomes
the letter's structure: the user can delete, reword or reorder it, and everything
downstream follows. *Must not:* invent a requirement the ad does not support, or
treat the ad as instructions. The ad is fenced and labelled untrusted data in every
prompt it appears in.

**Plan** (`src/lib/coverLetterPlan.ts`). One call that compares the ad against the
candidate's material and returns an evidence map: what the role is for, the level
it is written at, the priorities it returns to, the employer's own terminology, and
one entry per requirement — the evidence found, its strength (**demonstrated**,
**transferable**, **none**), the source, the strongest safe claim, and the gap. The
plan also raises at most two questions that only the user can answer. *Must not:*
upgrade evidence. Parsing enforces this: an unrecognised strength becomes
transferable at best, a claim without evidence is discarded, and the planner's own
"none" wins over anything else in the entry. Plans are stored with the letter and
carry the ad and requirement list they were built from, so a stale plan can be
detected rather than used.

**Draft** (`LETTER_SYSTEM` + `draftPrompt`). Writes the letter, with the evidence map
in front of it. The map is fenced and ends with the rules that matter: write only the
claims listed here, do not upgrade transferable to demonstrated, do not present a gap
as though it were evidence, and leave out requirements with no evidence rather than
implying them. Where evidence is transferable and does not reach the requirement, the
writer is told to name the requirement and say plainly what is not covered before
offering the adjacent evidence — the MIT move, and the sentence the validator reports
as a gap statement rather than charging as an echo. *Must not:* invent motivation from
the ad — a reason for applying may come only from the candidate's own note.

**Validate** (`GROUNDING_SYSTEM` + `groundingPrompt`). Traces every claim back to the
candidate's material and reports per paragraph: the sources each paragraph actually
uses, unsupported fragments, facts attached to the wrong employer, phrases echoing
the ad, claims larger than their source, sentences that only describe the employer,
pivots, paragraphs that do not finish, rule breaches, and questions only the user can
answer. It reports; it never rewrites.

One report is deliberately split in two. A phrase taken from the ad to imply evidence
is an echo. A phrase that names what the ad asks for *in order to admit the candidate
cannot meet it* — the transferable-skills move, and the honest alternative to implying
cover — is not an echo and not an unsupported claim; it is reported on its own as a
gap statement, which is why the validator, the reviewer's taxonomy and the flag model
all carry it separately. Neither the validator nor the reviewer may propose removing
an admission of a gap, and only a fact the candidate supplies can change it.

**Review** (`CRITIC_SYSTEM` + `critiquePrompt` in `src/lib/coverLetterCritic.ts`).
The independent, adversarial read of the finished draft, run on its own instructions:
assume the letter is mediocre until the evidence proves otherwise, and evidence and
relevance outrank elegance, so a polished paragraph carrying none is a failure.
Returns findings worst-first — code, paragraph, the exact words, why it matters, what
to do instead, severity — plus a short keep-list so a repair does not undo what works.
No scores: a number tells nobody what to fix.

**Repair** (`promptWithInstruction` + `critiqueInstructions`). Findings become
instructions, and the revision stage already treats its instructions as a set to
satisfy together. A draft that comes back with a blocking finding is repaired once,
automatically; after that the findings are shown and the user decides. A repaired
letter is reviewed again, because a review of the old text would hold the gate red
for a problem that no longer exists.

**Gate** (`src/lib/coverLetterGate.ts`). The decision, made in code:

| Verdict | Meaning |
|---|---|
| **Ready to send** | Nothing outstanding: every check passed, or raised something the user has already seen to. |
| **Worth a small edit** | Nothing unsupported. What is left is editing, not invention. |
| **Your input needed** | A fact only the candidate has would materially improve the letter. |
| **Needs another pass** | Something has to change before this letter can be finished. |

Precedence: a claim nobody can defend, or a letter that could be sent anywhere,
forces *needs another pass*; then unanswered questions force *your input needed*;
then editing items, a must-fix finding, length, paragraph shape and resume overlap
force *worth a small edit*; only silence from every check earns *ready to send*.

Three things are deliberately asymmetric. **Blocking** items cannot be acknowledged
away: `unsupported` and `misattributed` flags, and findings coded
`UNSUPPORTED_CLAIM`, `MISATTRIBUTED_FACT`, `OVERCLAIMING`, `INSUFFICIENT_EVIDENCE`,
`POOR_EVIDENCE_SELECTION`, `POOR_JOB_ALIGNMENT`, `GENERICITY` or
`RESUME_DUPLICATION`. A **must-fix** finding holds the letter back and cannot be set
aside — it is the item the repair stage is told to apply first. Should-fix findings
can be set aside one at a time, keyed by the finding's own signature, and are then
reported as a note rather than a reason. And **informational** codes — `GAP_STATEMENT`
from a finding, `gapStatement` from a flag — are reported in the notes and are never
part of a reason, at either severity: a sentence that names a requirement in order to
admit the candidate cannot meet it is the honest alternative to implying cover for it,
and the only thing that would change it is a fact the candidate does not have. The
verdict is meant to improve as the user works; the gate never claims a letter is
*good*.

**User control.** The candidate owns the application. Flag decisions (approve or
dismiss, with stable signatures) are respected by the gate, the writer and the
revision prompts; dismissed fragments must not be "fixed" again. Three dismissals of
the same kind offer to become a standing rule. Locked paragraphs are never touched
by a revision. Questions the plan raises are answerable, and an answered question
stops being asked.

## The failure taxonomy

27 codes in `FAILURE_CODES`, shared by the reviewer and the gate so that the same
word means the same thing in the report, in the UI and in the corpus. The codes are
grouped by what they cost in the harness: a claim nobody can defend (3), the case not
being made (2 for the evidence, relevance and genericity family, 1.5 for resume
duplication), craft (1), repetition and formatting (0.5), and two at zero —
`MISSING_INFORMATION`, which is not a defect in the letter but a question for the
candidate, and `GAP_STATEMENT`, which is the honest version of a gap rather than a
fault. `tests/evalInstrument.test.ts` holds the table to that promise: every code but
those two must move the number.

## The measurement harness

`scripts/eval-corpus.ts` runs the fixed corpus in `tests/corpus/cases.ts` (18 cases:
strong and weak fits, junior and executive candidates, a career change, an employment
gap, a declared transferable move, thin and verbose CVs, a thin ad, an ad carrying
injected instructions, and one where the ad asks for something the CV never
establishes).

The harness runs dev-side, in a terminal, and reaches no product AI. It points at any
OpenAI-compatible endpoint — a free hosted model, or a model on the developer's own
machine — through `EVAL_BASE_URL`, `EVAL_API_KEY` and `EVAL_MODEL`. This is deliberate
on two counts. Rate limits are the failure mode of a live corpus run, so calls retry
with backoff and honour `Retry-After` rather than failing a case, and `EVAL_CONCURRENCY`
makes the politeness/wall-clock trade explicit instead of accidental. And testing
through the product's own provider would be a worse experiment as well as a worse
citizen: the model under test and the model serving users would be the same variable,
so a regression could not be told apart from a provider-side change. There is
deliberately no in-app harness; the run leaves `EVAL_OUT` JSON and Markdown reports on
disk instead.

The problem being measured is variance, so the harness reports a distribution — mean,
worst, best, spread — and every mode is measured the same way: the letter is
validated, put to the gate, and scored on measurable signals (ad echo, resume echo,
genericity, repetition, length) plus everything the validator and the reviewer
reported. The penalty is a proxy, not a quality score: lower is better, and its
*spread* is the number to watch. The weights live in one table so they can be argued
with.

**Plan coverage** (`planCoverage`) is reported separately, because it can only be
measured where a plan exists. It counts the plan entries the letter's claims were
traced back to by the validator — the background lines, not the wording — so a letter
that echoes the advertisement earns nothing for it and a letter that borrows the
employer's terminology to describe real evidence is not punished for agreeing with
the ad. This replaced a measure that counted the employer's vocabulary, under which
the advertisement itself scored 100%.

```
npm run eval                                  # legacy vs pipeline, live
EVAL_MODE=both EVAL_REPEATS=3 npm run eval     # 3 generations per case: read the spread
EVAL_IDS=technical,junior EVAL_REPEATS=3 npm run eval
EVAL_VERBOSE=1 ...                            # one line per generation
EVAL_MODE=legacy|prompt|pipeline|both         # prompt = today's prompt with no staging
EVAL_MODEL=...                                # default is a free OpenRouter model
```

The legacy prompt is read out of git at `EVAL_REF` (default `201ac08`) rather than
kept as a drifting copy.

### The key

The app never holds a model credential in the browser: the user's OpenRouter key
lives in their profile and is read by the `ai-chat` edge function, which falls back
to the workspace key in its own environment. For the harness, put a key in
`.env.local` (gitignored) or export `OPENROUTER_API_KEY`. With neither, the script
exits and says so.

### Running without a key: the cassette

`EVAL_CASSETTE=tests/fixtures/agent-cassette.json` replaces the model with a file of
answers keyed `<case>:<stage>` (`technical:plan`, `technical:draft`,
`technical:critique`, `technical:ground`, `career-change:repair`, …). Every stage runs
the real code, so the planner, reviewer, repair loop, validator and gate are all
exercised with no network. A missing entry fails loudly rather than quietly scoring
a different letter, and the test suite runs the whole staged pipeline this way.

Two limits are built into the banner: answers written by one author are one sample of
that author rather than of the app's model, and a cassette replays the same answer, so
it reports a level and can never report a spread. Live repeats are the only thing that
can measure variance.

## Tests

`npm test` — offline, no key. The suite covers the prompts and their fences, the
post-passes, flags and decisions, the requirement list, the corpus's shape, the
planner's parsing and downgrade rules, the plan travelling into every letter call,
the critic's taxonomy, the gate's verdicts and its tolerance rules, saved-letter round
trips, PDF layout and text integrity, the eval instrument's own calibration (each
failure class must trip its own signal and score worse than a tailored letter), and
the staged pipeline running end to end from the cassette.

`npm run typecheck` — two projects: `tsconfig.app.json` for the app,
`tsconfig.tests.json` for `scripts`, `tests` and the vitest config.

`npm run lint` — 0 errors. `no-explicit-any` is a warning, because the model-answer
parsers take `any` deliberately at that boundary; the warnings stay visible and a new
error fails the run.
