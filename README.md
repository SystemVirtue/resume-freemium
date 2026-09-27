# Job Goblin — Resume & Cover Letter Crafter

An application for writing cover letters that make a truthful, specific,
evidence-backed case for one candidate with one employer — and for saying so when it
has not managed it.

The letter is planned before it is written: the job ad is read for what the role
actually needs, the candidate's own material is read for what they actually have, and
each requirement is matched to evidence or marked as having none. The draft is then
validated against the candidate's material, reviewed by something independent of the
writer, repaired if the review says it must be, and put to a gate that decides whether
it is finished. Motivation is never invented, and neither is a metric.

How the pipeline works stage by stage, what each one owns, and what the verdicts mean:
**[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)**.

## Setup

Node.js and npm.

```sh
npm i
npm run dev
```

The app needs Supabase for auth, saved letters and AI calls (`.env` carries
`VITE_SUPABASE_URL`, `VITE_SUPABASE_PROJECT_ID` and the publishable key), and the
`ai-chat` edge function needs a model provider configured on the server.

## Commands

```sh
npm run dev          # dev server
npm run build        # production build
npm test             # full suite, offline, no key needed
npm run typecheck    # app + tests/scripts projects
npm run lint         # 0 errors expected; warnings are the any-at-the-boundary kind
npm run eval         # corpus: the pre-v2 prompt against the staged pipeline
```

### Running the corpus

The harness in `scripts/eval-corpus.ts` runs a fixed 18-case corpus and reports a
distribution rather than a best case, because the thing being measured is variance.

```sh
EVAL_MODE=both EVAL_REPEATS=3 npm run eval      # legacy vs pipeline, 3 per case
EVAL_IDS=technical,junior EVAL_REPEATS=3 npm run eval
EVAL_VERBOSE=1 npm run eval                     # a line per generation
```

### Pointing the harness at a model

The harness talks to any OpenAI-compatible chat completions endpoint, and it never
uses the Lovable AI the product itself runs on. That separation is the point: testing
cannot spend the product's rate limit, so a corpus run no longer competes with real
users for the same quota.

The default is a free OpenRouter model, which needs a key — put
`OPENROUTER_API_KEY=sk-or-...` in `.env.local` (gitignored) or export it. With no key
at all, run the model on your own machine, which is free and unmetered:

```sh
ollama pull llama3.1:8b
EVAL_BASE_URL=http://localhost:11434/v1 EVAL_MODEL=llama3.1:8b npm run eval
```

Any other OpenAI-compatible provider works the same way: set `EVAL_BASE_URL`,
`EVAL_API_KEY` and `EVAL_MODEL`. Rate limits are expected on a free tier, so calls
retry with backoff (`EVAL_RETRIES`, honouring `Retry-After`) and `EVAL_CONCURRENCY`
trades politeness for wall-clock. `EVAL_OUT=eval-reports` leaves a JSON and a
Markdown report behind for each run.

With no model reachable at all, the whole pipeline still runs offline from a
cassette of answers:

```sh
EVAL_CASSETTE=tests/fixtures/agent-cassette.json EVAL_MODE=both npm run eval
```

`EVAL_LETTERS` decouples who writes a letter from how it is measured. Point it at
a JSON file of letters keyed by corpus id and they go through the same gate and
scoring as a live run, calling no model at all — useful for scoring letters written
by a person, by a local model, or by an agent working in the repository:

```sh
EVAL_LETTERS=eval-reviews/2026-09-27-model-written.json npm run eval
```

`eval-reviews/` holds those letters and the reviews drawn from them, starting with
[`2026-09-27-quality-review.md`](eval-reviews/2026-09-27-quality-review.md).

### The improvement loop

Three variables turn a report into a loop. `EVAL_SPLIT=dev|holdout|all` reserves
a fifth of the corpus, hashed from the case id so it cannot drift; `EVAL_CORPUS`
loads a grown corpus from a file; `EVAL_BASELINE` differences a run against a
previous report per failure code, so "it improved" names a number that moved.

```sh
EVAL_SPLIT=dev EVAL_REPEATS=3 EVAL_BASELINE=eval-reports/baseline/*.json bun run eval
```

[`docs/EVALUATION_LOOP.md`](docs/EVALUATION_LOOP.md) has the full cycle, the exit
criteria an iteration has to pass, and the ways the loop goes wrong if left
unguarded.

The cassette stands in for the model and runs every real stage, planner through gate.
It reports a quality level, not a spread — a cassette replays the same answer, so it
cannot measure variance. `EVAL_*` variables are documented at the top of the script.

Evaluation is dev-side only. There is deliberately no in-app harness: a browser-driven
one would run every stage through the product's own AI provider, which is both a rate
limit risk and a worse experiment, since the product's model and the test model would
be the same variable.

## Where the AI key lives

Nothing in the browser holds a model credential. A user's own OpenRouter key is stored
against their profile and read only by the `ai-chat` edge function; the workspace
provider key lives in that function's environment. Puter is the exception, because its
free tier signs the user into their own account in a popup.

## Using Lovable

**Project**: https://lovable.dev/projects/191753c2-5275-424a-a156-ed2158a66115

You can keep working in Lovable: changes made there are committed to this repo, and
changes pushed here are reflected there. You can also clone the repo and work locally
as above, edit files directly on GitHub, or open a GitHub Codespace.

To deploy, open [Lovable](https://lovable.dev/projects/191753c2-5275-424a-a156-ed2158a66115)
and use Share → Publish. Custom domains: Project → Settings → Domains → Connect Domain.

Built with Vite, TypeScript, React, shadcn-ui and Tailwind CSS.
