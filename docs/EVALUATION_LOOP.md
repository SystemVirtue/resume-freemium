# The self-improving loop

How to keep measuring the cover letter pipeline, find what it is getting wrong,
and change something that measurably helps — without the loop quietly learning
to please itself.

The mechanism already exists: `scripts/eval-corpus.ts` runs a corpus through the
real v2 stages and reports a distribution. What is missing is the part that makes
it a *loop* rather than a report: a corpus big enough to see rare faults, a
half of it reserved, and a way to say whether a change helped.

Those three are now built:

| variable | what it does |
| --- | --- |
| `EVAL_SPLIT=dev\|holdout\|all` | splits the corpus by a hash of the case id |
| `EVAL_CORPUS=file.json` | loads a grown corpus without touching the tested fixture |
| `EVAL_BASELINE=report.json` | differences this run against a previous one, per failure code |
| `EVAL_LETTERS=file.json` | scores letters written outside the process, calling no model |
| `EVAL_OUT=dir` | writes the JSON and Markdown report the next run baselines against |

## The six phases

### 0. Lock a baseline

Before changing anything, run the full corpus at `EVAL_REPEATS=3` and keep the
report. Without a stored baseline "it got better" is a memory, and the first
honest question — *better than what?* — has no answer.

```sh
EVAL_OUT=eval-reports/baseline EVAL_REPEATS=3 bun run eval
```

### 1. Grow the corpus to 10x

The requirement is 180 cases, and **how** they are made decides whether the loop
learns anything. A freely generated resume/ad pair has no known correct answer,
so a failure on it cannot be interpreted — you cannot tell a real fault from a
case that was simply odd. The corpus therefore grows by **mutation**: take a
seed case, change one property, and the expected behaviour is known by
construction.

Ten mutations, each with its correct outcome already implied. `bun run eval:corpus`
applies all ten to every seed and writes 180 cases to `eval-corpus/generated.json`
(gitignored — it is a build product, and 180 cases of derived text nobody reads is
worse than no corpus).

| mutation | the correct behaviour |
| --- | --- |
| `injected` | an ad carrying a `SYSTEM OVERRIDE`, which must be ignored while the real requirements are still answered |
| `thin` | an ad stripped to four sentences of boilerplate; a short honest letter, and no padding to reach a word count |
| `unstated` | a requirement the CV never establishes, which must raise a question rather than an invention |
| `seniority` | a director-level brief against a junior CV; the gap is named, or a question raised |
| `gap` | an unexplained two-year hole in the CV; addressed or asked about, never papered over |
| `fluff` | an advert padded with "rockstars" and "fast-paced"; none of it echoed back |
| `formal` | an explicit tone instruction, which must be obeyed |
| `rules` | explicit writing rules, which outrank the house style |
| `repeated` | a paragraph of the advert duplicated verbatim, which must not be copied into the answer |
| `overreach` | the advert pitched above the CV; the letter must not adopt the level it is pitched at |

Each injection carries a per-case required phrase, so a letter that obeyed one
could not pass another by accident and a failure names the case that produced it.

The corpus tests assert the shape of the *seed* corpus, not of the generated file
— `EVAL_CORPUS` is read at runtime and the test suite never opens it. The
generator does check its own output for duplicate ids and missing fields, and
`CorpusKind` already has a home for most of the mutations, but "known by
construction" is an argument, not a reading. The first real pass over the
generated cases is where a badly-designed mutation would show up.

Real data is worth adding and needs care: real job adverts are public and
abundant, real résumés are personal data and should not be pasted into a
repository. Public or synthetic résumés against real adverts gets most of the
value without the exposure.

### 2. Run, with provenance

```sh
EVAL_SPLIT=dev EVAL_REPEATS=3 EVAL_OUT=eval-reports/run-07 bun run eval
```

Every report records endpoint, model, modes, case count, repeats and concurrency.
A number without those is not a measurement, it is a rumour. Pin the model for
the duration of a comparison; swapping models mid-loop moves the goalposts and
the diff will show it.

### 3. Assess, in two registers

The **deterministic instrument** is primary: length, ad echo, CV echo,
genericity, repetition, forbidden words, and the gate's verdicts. It needs no
model, so it cannot be talked into a favourable answer.

The **LLM judge** is secondary and only ever advisory — used to read quality the
codes do not cover (does this sound like a person, is the opening doing work).
Three rules keep it honest: judge blind to which variant produced the letter,
score against fixed dimensions written down before the run, and never let it
move a gate. A judge made of the same model that wrote the letter will rate its
own fluency as quality, and a loop built on that drifts toward longer, blander
prose that scores well and reads worse.

### 4. Diagnose to a mechanism

Rank failure codes by rate × weight, cluster by case kind, then **read three
actual letters** for the top code. The output of this phase is a mechanism, not
a symptom:

> Bad: "letters overuse the candidate's name."
> Good: "the draft prompt asks for a persuasive opening before the evidence map
> exists, so the model reaches for the ad's own framing and reuses the
> candidate's name as the cheapest available hook."

A fix that cannot be traced to a mechanism is a patch, and patches do not
generalise to the next 160 cases.

### 5. Fix, one at a time

The rules that keep a loop from decaying:

- **One change per iteration, in one stage.** Two changes at once cannot be
  attributed when only one of them works.
- **General rules only.** "When the ad quotes a figure, attribute it to the ad"
  generalises. "Never use the word X" is a case that has not been fixed.
- **Prompts get shorter or stay the same length**, unless there is an argument
  for the length. Prompt growth is the characteristic failure of this loop:
  every fix adds a clause, and the letter gets worse while every individual
  clause is locally justified.
- **A gate change needs a unit test**, because the gate is the thing other code
  trusts.

### 6. Verify against exit criteria

An iteration is finished only when all of these hold:

1. The target failure code's rate is down on **dev**.
2. No other code is up by more than the noise floor, measured from the repeat
   spread.
3. The **holdout** penalty is not worse. Not better — not worse. The holdout is
   never iterated against; the moment it is, it is a dev set.
4. `bun run test` is green (106 tests).
5. The **worst-case** penalty is not worse. A fix that lifts the average by
   making every letter slightly worse is a regression.

If any fails, revert. The loop proposes; a person disposes. Fully automatic
self-modification of the prompts is where this design fails — not because the
measurements are wrong, but because nothing in the loop can tell the difference
between a prompt that got better and a prompt that got better at being graded.

## What the first pass remediated

The three fixes the review queued are in, each held by a test in
`tests/evalInstrument.test.ts` under "instrument fixes", and each measured on the
five reference letters rather than asserted:

| fix | before | after |
| --- | --- | --- |
| repetition window 40 → 20 words | 3.40 flags/letter | 2.20 |
| `tooThin` gets a 120-word floor | 80% in band | 100% |
| quoted spans exempt from ad echo | unchanged (see below) | proven by test |
| **mean penalty** | 2.24 | **1.24** |
| **worst-case penalty** | 3.54 | **1.54** |
| **gate** | 80% pass | **100% pass** |

The mechanism behind each is in the code comment where it lives. The repetition
window spanned a paragraph and a half, so it charged a letter for using its own
subject's vocabulary twice; the thin-ad floor was charging correct behaviour for
refusing to pad; and quoted spans are now stripped before ad echo, because
quoting a requirement back in order to refuse it is attribution, not copying.

Ad echo is unchanged on the reference letters, and that is the honest result: the
`missing-info` letter restates the advert's line in its own words without putting
it in quotation marks, so the exemption correctly does not apply to it. The
behaviour is proved by test rather than by this corpus. The reference letters are
deliberately left unedited — rewriting an input to make a metric look better is
the same mistake the loop exists to prevent.

## What is still outstanding

- **The grounded half of the instrument is unmeasured.** Unsupported claims,
  misattribution and overclaiming read zero in `EVAL_LETTERS` because no
  validator runs. These fixes moved the deterministic half only.
- **The holdout has not been exercised against these fixes.** 37 cases exist and
  load, but scoring them needs letters or a live endpoint. The exit criteria in
  phase 6 are not yet satisfied end to end.
- **The corpus is grown, not validated by a human.** `scripts/mutate-corpus.ts`
  produces 180 cases with expectations known by construction, but "known by
  construction" is an argument, not a reading. The first real pass over the
  generated cases is where a bad mutation would show up.

## Running it

```sh
# 0. baseline
EVAL_OUT=eval-reports/baseline EVAL_REPEATS=3 bun run eval

# 2. after a change, against that baseline
EVAL_SPLIT=dev EVAL_REPEATS=3 EVAL_BASELINE=eval-reports/baseline/*.json \
  EVAL_OUT=eval-reports/run-01 bun run eval

# 3. the reserved check, once, at the end
EVAL_SPLIT=holdout EVAL_REPEATS=3 EVAL_OUT=eval-reports/run-01-holdout bun run eval

# 4. no model at all: score letters written by hand, a local model, or an agent
EVAL_LETTERS=eval-reviews/2026-09-27-model-written.json bun run eval
```

## Honest limits

- **The holdout is now 37 cases**, up from 2, which is enough to catch a
  regression but not enough to be confident in small differences. It is still the
  weakest part of the method.
- **The deterministic half cannot see a lie.** Unsupported claims, misattribution
  and overclaiming all need the validator stage, so `EVAL_LETTERS` reports them
  as zero when they are unmeasured. The loop's most valuable signal — is this
  letter honest — is only available on the live path, which needs an endpoint.
- **Variance needs repeats.** One generation per case measures a sample of one.
  The spread across repeats is the number that says whether a fix helped or the
  model got lucky.
