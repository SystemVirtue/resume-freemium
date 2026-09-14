# Plan: Free-for-all access, AI provider choice, and Cover Letter Crafter

## Scope change
- All features become free for any signed-in user. No payment step anywhere: pricing/upgrade UI and the paywall on templates and PDF export are removed. The payment table stays in the database untouched but unused.
- Users pick which AI assistant powers every AI action, switchable at any time.
- New major feature: Cover Letter Crafter, unlocked once the user has a saved resume with the essentials filled in (name, contact, at least one work or education entry).

## 1. AI assistant selector
A small "AI" control lives in the header of the builder and the cover letter workspace, with three options:

1. **Lovable AI** — default, works immediately, no setup.
2. **OpenRouter free models** — user pastes their own OpenRouter key; the app then lists the free models it can see and lets the user pick one. The key is kept only in that browser, never uploaded.
3. **Puter.com free models** — user signs in to their free Puter account in a popup; requests run through Puter in the browser, so there is no key to manage.

Behaviour:
- Choice, chosen model, and Puter/OpenRouter readiness persist per browser; a provider that isn't ready prompts its short setup step before the first request.
- Every AI call in the app (resume suggestions and all cover letter actions) goes through one shared client so switching providers changes everything at once.
- Failures show a plain message with the reason and leave the user's text untouched.

## 2. First-run onboarding pop-over
On first sign-in, a dialog explains the three assistant options in one screen each (what it costs, what setup is needed), lets the user choose one right there, and can be reopened later from a "?" in the header. Dismissal is remembered per user.

## 3. Cover Letter Crafter
Reached from the dashboard and from a saved resume. Locked with an explanatory note until a complete resume exists.

**Step 1 — Specify the role.** Paste text, drop a file (pdf, docx, txt, html, md), or give a job posting URL. Files and URLs are turned into plain text server-side.

**Step 2 — Context and examples (optional).** Any number of extra files, URLs, or notes: company research, previous cover letters, recruiter emails.

**Step 3 — Style and sentiment.** The assistant proposes a handful of one-tap style chips based on the resume and the role (e.g. formal, warm, direct, technical); the user taps one or more and can add free-text tone instructions.

**Step 4 — Draft and refine.** The assistant writes the letter as separate paragraphs. Per paragraph: lock/unlock (locked text is never changed), move up, move down, rephrase (same meaning), regenerate (free to change content), remove, and insert a new paragraph above.

Global actions on the draft:
- Prompt box for free-form instructions to the assistant.
- Undo/redo across every edit and generation.
- Review: a short, specific assessment of the letter against the role and resume — no numeric score.
- Reset: confirm, then discard the draft and write a fresh one.
- Save (stored against the resume, reopenable) and export as PDF, DOCX-compatible text, or plain text; print also works.

Autosave keeps the working draft so a refresh never loses work.

## Technical notes
- **Database:** new `cover_letters` table (user_id, resume_id, title, job description text + source, context items, style settings, paragraphs JSON, version history JSON, timestamps) with RLS restricting all access to the owner, plus grants for `authenticated` and `service_role`. New nullable `ai_provider`/`ai_model` preference columns on `profiles`; onboarding-seen flag stored there too.
- **AI routing:** one `useAiClient` abstraction. Lovable path → existing/new edge function calling the Lovable AI Gateway (`google/gemini-3.8-flash` for chips and rephrase, `openai/gpt-6-astra` via the Responses API with streaming for full drafts). OpenRouter and Puter paths run in the browser (key in `localStorage`; Puter via its `js.puter.com/v2` script) so no user credentials touch the server.
- **Edge functions:** `extract-text` (fetch URL or accept uploaded file, return plain text; pdf/docx parsing via Deno-compatible libs), `cover-letter` (draft, rephrase, regenerate, insert, review, style suggestions — one action per request, streaming where output is long), reusing the shared gateway helper.
- **Paywall removal:** strip gating from `TemplateGallery`, `ExportSection`, and `LandingPage` pricing; delete `paid_templates_access` reads from the client.
- **Undo/redo:** immutable snapshot stack of the paragraph array held in the crafter's state and persisted with the draft.
- **Files kept small:** `src/components/cover-letter/` holds Steps 1–3, `ParagraphCard`, `DraftToolbar`, and the crafter container; provider code in `src/lib/ai/`.

## Build order
1. Remove payment gating; all features open to signed-in users.
2. Provider abstraction + settings UI + onboarding dialog.
3. `cover_letters` migration and profile preference columns.
4. `extract-text` and `cover-letter` edge functions.
5. Crafter steps 1–3 with resume-completeness gate.
6. Paragraph workspace with per-paragraph and global actions, undo/redo, autosave.
7. Save, export (PDF/DOCX/TXT/print), dashboard entry points, final check.

## Cost control
Short, targeted prompts (only the resume fields that matter plus the role text), the fast model for small edits, no background/automatic AI calls, and per-paragraph actions instead of full redrafts keep credit use low.
