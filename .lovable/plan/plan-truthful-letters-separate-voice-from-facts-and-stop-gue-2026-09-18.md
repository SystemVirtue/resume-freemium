# Plan: Truthful letters — separate voice from facts, and stop guessing

Test feedback shows four real faults. Each is confirmed in the current build:

- Everything the user uploads is merged into one pile. Resume, job ad and extra notes are sent to the assistant as three plain blobs, with the extras labelled only "Notes and references" — so old cover letters are read as facts about the person, not as examples of their writing.
- Nothing tells the assistant to only use what the resume supports, so it works backwards from the ad and invents links.
- There is no place to say what you will *not* claim.
- Uploaded documents are flattened: headings, line breaks and blank lines are stripped on the way in, and a scraped job page keeps its navigation, country lists, footer and terms.

## 1. Sources get roles

The "Extra context" box is replaced by a list of context items, each added with an explicit role chosen by the user:

- **My past cover letters — style only.** Never used as a source of facts, dates, numbers or claims. Used only for voice, rhythm and phrasing.
- **Company or role research.** Facts about the employer, never about the candidate.
- **My own extra background.** Treated like the resume: a valid source of claims about the candidate.

Uploading into the past-letters slot shows a one-line note: "Used for how you write, never for what you claim."

The assistant is instructed that the candidate's resume plus "extra background" are the only sources of claims about the candidate, that facts may not be recombined across employers, and that a grouped or compressed sentence from a past letter must never be split, merged or re-attributed. Career length, totals and any number not present in the resume are forbidden.

## 2. Don't-claim constraints

A dedicated "Won't claim" step, separate from background, role and tone, with:

- A free-text list (one per line) of things not to claim or mention — e.g. years of experience, tools the user considers basic.
- Suggested chips generated from the ad's requirements that the resume does not support, so the user can confirm each as "don't claim" in one tap rather than discovering it in the draft.

These constraints are sent with every request, including per-paragraph rephrase, regenerate and insert, and are stated as absolute.

## 3. Where each claim came from

After a draft or a paragraph edit, each paragraph shows a short "Sources" line naming the resume lines or entries the claim rests on. Any statement the assistant could not ground gets an "unsupported" marker on the paragraph with the sentence named, so it can be removed or reworded before sending.

The drafting instructions also ban mirroring the ad's wording: requirements may be answered in the candidate's own words and evidence, and phrases lifted from the ad are flagged in the same check.

## 4. Cleaner, structured input

Extraction keeps document structure instead of flattening it:

- Blank lines, paragraph breaks and likely headings survive PDF, Word and HTML extraction; headings are marked so a job title never merges into the paragraph beneath it.
- Consecutive sentences stay separate, which is what caused two employers to be squashed together.
- A pasted or imported job page is trimmed to the actual advertisement: navigation, country and location lists, footers, terms, "report this job" and similar boilerplate are dropped, and the user sees the trimmed ad with a note of roughly how much was removed and the option to restore the full text.

## 5. Review becomes a fact check

The Review action reports, in this order: statements not supported by the resume, facts attached to the wrong employer or period, phrases echoing the ad, and breaches of the "won't claim" list — then the usual short assessment. No score.

## Technical notes

- `src/lib/coverLetter.ts`: `Ctx` gains `contextItems` with a `role` field (`style_only` | `research` | `background`) and a `constraints` string list. `contextBlock` emits separately fenced sections per role, with per-section rules. New `SYSTEM` rules: claims only from resume/background; no cross-employer recombination; no numbers absent from the resume; past letters for voice only; do not reuse the ad's phrasing. New `groundingPrompt` (paragraph → supporting resume lines + unsupported sentences) and a rewritten `reviewPrompt`.
- Draft/insert/rephrase responses return paragraphs plus a `sources` array per paragraph; grounding runs as one extra JSON call per draft, kept small by sending only the resume and the draft.
- `src/lib/extract.ts` + `supabase/functions/extract-text/index.ts`: preserve `\n\n`, keep short all-caps/title-case lines as `## heading` markers, stop collapsing newlines; add ad-trimming (boilerplate line and block heuristics) returning `{ text, trimmed, removedChars }`.
- `src/components/cover-letter/`: new `ContextItemList.tsx` (role-tagged sources) and `ConstraintsCard.tsx`; `SourceInput` gains an optional trim summary with restore; `ParagraphCard` gains the sources line and unsupported markers; `CoverLetterCrafter` state extends to `contextItems[]` and `constraints[]`, both persisted to `cover_letters.context_items` / `style_settings` (existing JSON columns — no migration).
- Cost: grounding and constraint-suggestion calls use the fast model and send only what they need; per-paragraph actions stay single-paragraph.

## Build order

1. Prompt and source-role rules in `coverLetter.ts`.
2. Structure-preserving extraction and job-ad trimming.
3. Role-tagged context list and "Won't claim" step, wired into every request.
4. Sources line, unsupported markers, and the fact-checking Review.
