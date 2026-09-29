# JobPal — AI job-application copilot

A production-ready browser extension (Chrome, Edge, Brave, Opera, Firefox) that reads your resume or LinkedIn profile, reads any job posting, generates a machine-readable resume / CV / cover letter **tailored to that exact application**, fills the application form for you, and can even apply on your behalf in the background.

Built with **TypeScript + React + SCSS + Vite**, Manifest V3, zero backend.

---

## Features

### Tailoring engine
- **Understands you** — import a PDF/DOCX/JSON Resume, paste text, or scan your LinkedIn profile in-place. A robust local parser extracts structure even without AI.
- **Understands the job** — JSON-LD `JobPosting` parsing plus dedicated adapters for LinkedIn, Indeed, Greenhouse, Lever, Workday, Ashby, SmartRecruiters, BambooHR, iCIMS, Taleo, Workable, Recruitee, Jobvite, Glassdoor, ZipRecruiter and Wellfound, with a generic heuristic fallback.
- **Writes the documents** — tailored resume, cover letter, and answers to screening questions, written by the AI provider you connect.
- **AI is required, and every AI feature is gated** — resume parsing, tailoring, cover letters, screening answers, match scoring and the agent stay disabled until a provider is connected and active. Autofill and template previews work without AI. If an AI call fails, the action stops and reports the provider error � nothing is generated locally; retry whenever you want.
- **Usage accounting** — every call is counted locally (calls, errors, prompt/completion tokens, per provider, per day) using the token usage the provider reports back, and account-level figures are fetched live from providers whose API exposes them (OpenRouter, DeepSeek balance, OpenAI organisation costs).
- **Machine-readable output** — [JSON Resume](https://jsonresume.org) (`resume.json`), plus PDF, DOCX, HTML, Markdown and plain text. HTML output embeds `schema.org/Person` JSON-LD.
- **Manual field guide** — when a site isn't recognised, point JobPal at the job title, company, location, salary and description yourself (click-to-pick with live highlight). Selections are saved as a per-site recipe so detection works automatically next time, and application form fields can be mapped to profile fields the same way. Recipes are editable and forgettable from the overlay.
- **Files are always available** — the overlay, popup and side panel always list the documents generated for the current application (with download/attach, including “Download all”), so you can apply entirely on your own whenever you prefer.
- **Persistent match panel** — the match score is a standalone, always-visible panel (overlay, popup, side panel) rather than a transient message: the percentage sits in the immediate view and clicking it expands reasons, matched skills and missing skills in place. Results are stored with the job, so the panel is populated on every visit and can be recalculated on demand.
- **Paste a job description** — when a posting has no readable description (an “email us your resume” page, an image or a PDF), paste the text via **Paste JD** in the popup/side panel or the overlay’s guide; optional role/company overrides included. It is used exactly like a scraped description for tailoring, queueing and matching.
- **Choose where each answer and file goes** — every generated answer has **Send to field** (click the input on the page and it is filled instantly) and each document has **Choose field** (click the upload input and it is attached). Both destinations are remembered per site as part of the recipe.
- **Manual fallback access** — if autofill cannot place something, the answers stay listed in the overlay, popup, side panel and application record with per-item **Copy** / **Copy all**, and every file remains downloadable (including *Download all*), so a manual application never blocks on the extension.
- **View any document in a new tab** — every surface (overlay, popup, side panel, Documents and Applications) has a **View** action that opens the file in the same browser via a dedicated viewer page: PDFs and HTML render inline, markdown/text/JSON are shown as text with a Copy button, DOCX offers download (browsers cannot render it). Download and raw-open are always one click away.
- **Thrives on multi-tab posting pages** — job sites that switch between a description tab and an application-form tab via client-side routing no longer lose your generated files: the overlay keeps its state across SPA route changes, matches the application by URL / path prefix / title hints, survives DOM re-renders, and can be **dragged anywhere on screen** (position remembered).
- **Readable, adjustable overlay** — the hovering box uses a larger default type scale, the field guide is collapsed by default (with a one-line “Guide me” prompt when no job is detected), and **A− / A+** buttons in the header scale the whole panel from 85% to 160%; the chosen size is remembered.
- **Truthfulness guarantees** — the system prompt forbids invented employers, dates, degrees or metrics; custom prompts cannot override this.

### Bring your own AI (40+ pre-programmed providers)
Frontier labs, inference clouds, regional providers and local servers — add only an API key:

| Category | Providers |
| --- | --- |
| Frontier labs | OpenAI, Anthropic Claude, Google Gemini, Google Vertex AI, xAI Grok, Mistral, Cohere |
| Inference clouds | DeepSeek, DeepInfra, Groq, Together, Fireworks, OpenRouter, Perplexity, Cerebras, SambaNova, Nebius, Novita, Hyperbolic, Featherless, Chutes, Hugging Face, GitHub Models, Azure OpenAI, Cloudflare Workers AI, AI21, Upstage |
| Regional | Moonshot (Kimi), Zhipu GLM, Alibaba Qwen, Baidu ERNIE, MiniMax |
| Local / keyless | Ollama, LM Studio, Jan, llama.cpp, LocalAI, vLLM, SGLang, text-generation-webui, KoboldCpp, Pollinations |
| Custom | Any OpenAI-compatible endpoint (with or without auth) and any OAuth 2.0 (PKCE) provider |

- Native request shapes for OpenAI-compatible, Anthropic, Gemini and Cohere APIs.
- Model lists are refreshed **live from the provider** (saved with the connection), and the current model is selectable directly from the provider card, the config dialog and the dashboard. The built-in catalogue is a curated starting point — DeepSeek V4.1, GPT-5.2, Claude 4.5, Gemini 3, Grok 4 and friends.
- OAuth 2.0 **PKCE** sign-in via `chrome.identity` where supported (e.g. Gemini with your own public client ID).
- Connection tester, live model listing, per-connection base URL / headers / model overrides and automatic token refresh. A failed call stops the action with the provider's error and keeps everything for a retry — there is no silent local fallback.

### Autofill
- 40+ field types recognised from labels, `autocomplete`, ARIA, placeholders and layout context, with confidence scores.
- Handles selects, radio/checkbox groups, React-controlled inputs, and file uploads (attaches the generated PDF/DOCX to the form).
- Optional EEO/sensitive-field filling — off by default behind an explicit toggle.
- Filled fields are highlighted so you can verify before submitting.

### Autonomous agent
- Queue jobs from any posting (“Queue” in the popup, overlay, side panel or right-click menu) or scan job-search pages for matches.
- Works through the queue in background tabs: extracts the posting → scores the match → generates documents → fills the form → optionally submits.
- Human-like pacing, daily limits, working-hours windows, and a rolling log.
- **Safety gates:** never submits unless Auto mode + auto-submit are enabled, every enabled rule passes, form-fill confidence exceeds your threshold, and the domain isn’t blocked. Assist mode always hands the final click back to you.

### Curated rules (one-click toggles)
`Only jobs that match my experience` (score threshold), `Apply to jobs with some missing skills`, `Remote only`, `Require salary`, `Minimum salary`, `Skip stale postings`, `Avoid staffing agencies`, `Seniority match`, `Never apply twice to the same company`, `Always include a cover letter`, `Answer screening questions`, `Fill EEO questions`, `Always ask before submitting`, `Human-like pacing`.

### Management page (options)
- **Dashboard** — pipeline stats, AI/agent status, live agent log.
- **My profile** — contact info, links, summary, work history, education, skills, certifications, languages, projects, awards, eligibility, EEO. Multiple **variants** with a default.
- **Resume sources** — upload/paste/scan, then parse into structured data with one click.
- **Documents** — every generated file, filterable, previewable in-app, downloadable, deletable.
- **Applications** — full record per application: status tracking (draft → applied → screening → interview → technical → offer / rejected / withdrawn / no response), timeline, generated documents, written answers, private notes, JSON export.
- **Resume designs** — 19 curated layouts (the default *Essential* is a minimal, professional single column) with accent colours, density, page size, section order/visibility, a single **output format** (PDF by default; DOCX/HTML/MD/TXT/JSON optional), file-name pattern, custom Unicode font upload, and a live preview from your real data.
- **One “…” menu per document function** — the overlay lists *Resume / Cover letter / Answers* (not raw files), each with a single ⋯ menu: View in new tab, Download, **Regenerate** (re-renders just that document with your current design), Attach, Choose upload field — plus *Regenerate all*. The same ⋯ pattern (including Regenerate) is used in the popup, side panel, Documents and Applications pages.
- **Job-agnostic files** — documents are named `First-Last-resume.pdf` / `First-Last-cover-letter.pdf` and carry no employer, role, job URL or “generated for this posting” traces anywhere (not in the file name, PDF/DOCX metadata, HTML headers, answers sheet or JSON Resume meta). Status messages don’t report counts or targets either.
- **WYSIWYG documents** — the PDF renderer mirrors the HTML preview one-to-one: same page padding, type scale, line height, accent headings, entry hierarchy, bullet indents, project links and skill **chips** (including the translucent sidebar chips). Links are real clickable PDF annotations — your email (`mailto:`), LinkedIn/GitHub/portfolio URLs in the header (standard, modern-header and sidebar layouts) and project URLs. What you see in *Resume designs → Live preview* is what the file contains.
- **No duplicate applications** — the same posting is recognised across SPA routes, query strings and re-scrapes (canonical URL → URL path prefix → title/company match), so testing on one job never creates two tracked applications.
- **Pick from all your documents** — the overlay’s **All documents** link opens a picker page *inside the hover box* listing every stored file (generated across jobs **and** your own uploads), each with **Attach**, **Field** (choose the upload destination) and **View** — no trip to the management page required. The Documents header keeps just *Regenerate all* and the picker link.
- **Use your own files** — upload your own resume and cover letter under *Resume designs → My own files* and flip the toggle; autofill and the agent then attach your uploads instead of the generated documents (they’re never overwritten by regeneration and are marked “yours” in the Documents list).
- **Overlay that behaves** — the hover box opens *above* the floating button (which is draggable and always clamps back into view), uses self-contained inline SVG icons (no dependency on page or system fonts), and has A− / A+ size controls in the header.
- **Stop and progress** — long AI runs report their stage live (*analysing the posting → writing your resume → writing the cover letter → answering screening questions → rendering → saving*) in the overlay, popup and side panel, and every run has a **Stop** button that halts the pipeline at the next checkpoint.
- **Usage in your face** — today's and all-time token counts are shown in the popup footer and the overlay (with a **Usage report** button that jumps to the management page), and you can set a **token budget** that triggers a notification once reached.
- **No pointless cover letters** — a cover letter is only generated when the application form actually has a field for one; request it explicitly (e.g. the overlay’s *Generate now* on the Cover letter row) to override.
- **AI providers** — the catalogue above, key management, test connection, activation.
- **Prompts & style** — global instructions, tone, words to avoid, themes to emphasise, and editable per-task templates with placeholder reference.
- **Automation** — agent controls, queue, rules, limits, working hours, domain allow/block lists, log.
- **Settings** — theme, accent, autofill behaviour, JSON backup/restore, danger-zone data deletion, privacy overview.

---

## Quick start

```bash
npm install
npm run build         # Chrome / Edge / Brave / Opera  -> dist/
npm run build:firefox # Firefox (MV3)                   -> dist-firefox/
npm run dev           # watch builds for all three bundles
npm run typecheck     # strict TypeScript check
npm run smoke         # renders all 18 templates × 6 formats outside the browser
```

**Load in Chrome/Edge:** `chrome://extensions` → enable *Developer mode* → *Load unpacked* → select `dist/`.
**Load in Firefox:** `about:debugging#/runtime/this-firefox` → *Load Temporary Add-on* → select `dist-firefox/manifest.json`.

### First run
1. The management page opens automatically on install (also available from the popup ⚙ or right-click → *JobPal: open management page*).
2. Open **AI providers** and connect one — this is required: every AI-powered feature stays disabled until a provider is active.
3. Add your details or upload a resume in **My profile** → press **Parse**.
4. Open any job posting, click the ◈ overlay (or the toolbar popup) and press **Tailor & fill**.

---

## Architecture

```
manifest.config.ts          Manifest V3 generator (chrome / firefox variants)
vite.config.ts              Popup, options, side panel, offscreen pages
vite.content.config.ts      Content script (IIFE)
vite.background.config.ts   Service worker (IIFE, Firefox-safe)
scripts/
  build.mjs                 Multi-bundle build orchestrator
  package.mjs               Packs dist/ and dist-firefox/ into release archives
  lib/crc32.mjs, lib/zip.mjs  Dependency-free ZIP writer used by the packager
  generate-icons.mjs        Dependency-free PNG icon generator
  generate-icon-components.mjs  One React file per icon glyph
  smoke-render.mjs          Document-engine smoke test
.github/workflows/release.yml  Release CI (typecheck → smoke → build → pack → attach)
src/
  types/                    Shared domain model + typed message protocol
  lib/
    browser.ts, storage.ts, db.ts, messaging.ts, utils.ts, defaults.ts
    ai/       providers (40+), unified client, OAuth PKCE, prompts, tasks, usage accounting
    job/      extraction, readability, site adapters, match scoring, recipes
    doc/      JSON Resume schema, template catalogue, PDF/DOCX/HTML/MD/TXT renderers
    autofill/ field dictionary, form scanner, filler engine
  background/                Router, AI bridge, tailoring pipeline, autonomous agent,
                             rules engine, downloads (offscreen), notifications
  content/                   Content-script entry + actions, with the overlay as a
                             React app: overlay/{mount,store,dom,actions}.ts(x),
                             overlay/components/* (one component per file) and
                             overlay/helpers/*
  popup/  sidepanel/         Quick-action surfaces (App + components/)
  options/                   Management page (App, components/, constants/, helpers/,
                             tabs/<tab>/components/ + helpers/)
  offscreen/  viewer/        Offscreen blob host, document viewer page
  ui/
    components/              One component per file + barrels (Primitives.tsx,
                             index.ts); icons/ one glyph per file under icon-set/
    constants/  hooks.ts  styles/
public/_locales, public/icons
```

Coding conventions are enforced repo-wide and documented in [AGENTS.md](AGENTS.md): one component per file, helpers in their own files, folders/subfolders per feature, the `Show` component instead of conditions in JSX, and `renderX` functions instead of inline `.map()` callbacks.

## Releases & CI

Creating (or publishing) a GitHub release runs `.github/workflows/release.yml`, which checks out the release tag, then runs `npm ci → typecheck → smoke → build → build:firefox → package`, verifies that the tag matches the version in `dist/manifest.json`, uploads the archives as workflow artifacts, and attaches them to the release:

| Artifact | Contents |
| --- | --- |
| `jobpal-chrome-<version>.zip` | Load-unpacked / store upload bundle (`dist/`) |
| `jobpal-firefox-<version>.zip` | Temporary add-on / AMO source bundle (`dist-firefox/`) |
| `jobpal-firefox-<version>.xpi` | Same archive with the `.xpi` extension |

The packer is dependency-free and deterministic (`npm run package` locally); it writes to `release/` and works on any OS. The release tag must equal the manifest version (e.g. tag `v1.0.20` for version `1.0.20`) — the workflow fails early with a clear message otherwise. Note that the Firefox `.xpi` is unsigned: install it with *Load Temporary Add-on* or sign it through AMO before permanent distribution.

### Data flow
```
page → content script (extract job / form)
     → background pipeline → AI task layer → document renderers
     → IndexedDB (documents + applications) → UI (popup / side panel / options)
     ← content script fills the form, agent optionally submits
```

### Privacy
- No JobPal servers. Prompts go from your browser straight to the provider you configured.
- API keys and OAuth tokens are stored in `chrome.storage.local` and are **excluded from backups**.
- Resumes, profiles and generated documents live in `chrome.storage` + IndexedDB. Nothing is uploaded unless you generate documents (which requires an AI call).
- The agent never submits without Auto mode, auto-submit, passing rules, sufficient fill confidence, and a non-blocked domain.

---

## Notes & limitations
- LinkedIn’s DOM changes frequently; profile/job scanning uses layered selectors with generic fallbacks, but a redesign can still reduce accuracy. Pasting your resume always works.
- PDF text extraction uses `pdfjs-dist`; DOCX import uses `mammoth`. Both run locally in the options page.
- Colors/fonts: PDFs embed Helvetica/Times by default and support full Unicode via a custom `.ttf`/`.otf` upload.
- The service worker bundle is intentionally self-contained (single IIFE) so the same build works in Chrome and Firefox; browsers cache it after install.
- Firefox uses `sidebar_action` instead of Chrome’s `side_panel`, and no offscreen document (downloads fall back to data URLs).

## License
MIT
