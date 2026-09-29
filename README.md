# JobPaal - AI job-application copilot

A production-ready browser extension (Chrome, Edge, Brave, Opera, Firefox) that reads your resume or LinkedIn profile, reads any job posting, generates a machine-readable resume / CV / cover letter **tailored to that exact application**, fills the application form for you, and can even apply on your behalf in the background.

Built with **TypeScript + React + SCSS + Vite**, Manifest V3, zero backend.

---

## Features

### Tailoring engine
- **Understands you** - import a PDF/DOCX/JSON Resume, paste text, or scan your LinkedIn profile in-place. A robust local parser extracts structure even without AI.
- **Understands the job** - JSON-LD `JobPosting` parsing plus dedicated adapters for LinkedIn, Indeed, Greenhouse, Lever, Workday, Ashby, SmartRecruiters, BambooHR, iCIMS, Taleo, Workable, Recruitee, Jobvite, Glassdoor, ZipRecruiter and Wellfound, with a generic heuristic fallback.
- **Writes the documents** - tailored resume, cover letter, and answers to screening questions, written by the AI provider you connect. Once documents exist for a page, the primary button becomes **Fill this page** and fills the form with those existing documents (and their answers) - it only runs the AI when there is nothing generated yet.
- **See and edit what was written** - every generated file keeps its source content, and an **Edit** action on any generated document (row button or menu) opens a full-screen editor on top of everything else: structured fields for the resume (headline, summary, skills, experience, education, certifications, languages, projects, awards), a plain text editor for the cover letter, and per-question editors for the answers. **Save & regenerate** re-renders the file locally from your edits with the current design - no extra AI call - **Reset to generated** restores the original, and the edited file keeps its name, format and place in the application with an *edited* badge.
- **Truthful tailoring only** - the resume is reworked to match the posting but never invents or upgrades anything: no new employers, roles, seniority (Senior/Lead/Staff…), dates, education, skills, tools, metrics or achievements, and the headline is built from your real most recent title instead of copying the posting's title. Wording stays close to your own: summarise, reorder, trim and re-emphasise, never rewrite a fact. There is no setting that relaxes this.
- **AI is required, and every AI feature is gated** - resume parsing, tailoring, cover letters, screening answers, match scoring and the agent stay disabled until a provider is connected and active. Autofill and template previews work without AI. If an AI call fails, the action stops and reports the provider error � nothing is generated locally; retry whenever you want.
- **Usage accounting** - every call is counted locally (calls, errors, prompt/completion tokens, per provider, per day) using the token usage the provider reports back, and account-level figures are fetched live from providers whose API exposes them (OpenRouter, DeepSeek balance, OpenAI organisation costs).
- **Machine-readable output** - [JSON Resume](https://jsonresume.org) (`resume.json`), plus PDF, DOCX, HTML, Markdown and plain text. HTML output embeds `schema.org/Person` JSON-LD.
- **Manual field guide** - when a site isn't recognised, point JobPaal at the job title, company, location, salary and description yourself (click-to-pick with live highlight). Every change is saved for the site automatically, so detection works next time too, and application form fields can be mapped to profile fields the same way. Anything detection misses can be added by hand in the overlay's **Answers** panel: type the question and its answer, press **Ask AI** to draft the answer from your profile and the posting, **Send to field** to fill it on the page right now, or **Save for reuse** so matching fields are filled automatically on every form from then on. Page text only counts as a description when it reads like prose - form labels and select options are never mistaken for the posting.
- **Files are always available** - the overlay, popup and side panel always list the documents generated for the current application (with download/attach, including “Download all”), so you can apply entirely on your own whenever you prefer.
- **Persistent match panel** - the match score is a standalone, always-visible panel (overlay, popup, side panel) rather than a transient message: the percentage sits in the immediate view and clicking it expands reasons, matched skills and missing skills in place. Results are stored with the job, so the panel is populated on every visit and can be recalculated on demand.
- **Paste any job field** - every guide row (job title, company, location, salary, description) has its own **Paste** box, and **Paste JD** in the popup/side panel remains for the description; optional role/company overrides included. Pasted text is used exactly like a scraped value for tailoring, queueing and matching. This is the fallback for content that cannot be read at all (images, PDFs) and for fields that live in frames the picker cannot reach.
- **Choose where each answer and file goes** - every generated answer has **Send to field** (click the input on the page and it is filled instantly) and each document has **Choose field** (click the upload input and it is attached). Both destinations are remembered per site as part of the recipe.
- **Manual fallback access** - if autofill cannot place something, the answers stay listed in the overlay, popup, side panel and application record with per-item **Copy** / **Copy all**, and every file remains downloadable (including *Download all*), so a manual application never blocks on the extension.
- **View any document in a new tab** - every surface (overlay, popup, side panel, Documents and Applications) has a **View** action that opens the file in the same browser via a dedicated viewer page: PDFs and HTML render inline, markdown/text/JSON are shown as text with a Copy button, DOCX offers download (browsers cannot render it). Download and raw-open are always one click away.
- **Thrives on multi-tab posting pages** - job sites that switch between a description tab and an application-form tab via client-side routing no longer lose your generated files or your job description: JobPaal keeps its state across SPA route changes, matches the application by URL / path prefix / title hints, survives DOM re-renders, and can be **dragged anywhere on screen** (position remembered).
- **Knows what it read - and says so** - the overlay has a **Job description** panel reporting the source and size of the description it will tailor against (*read from this page*, *reused from a stored job*, *from your manual selection or pasted text*, or *not found · N words*), with a scrollable preview plus **Pick on page**, **Paste**, **Recent jobs** and **Use this page** actions. **Paste** reads the clipboard directly and only accepts text that looks like a real description (prose, not form labels), so it takes one click; the guide's paste box remains for manual pasting. Descriptions are persisted per posting, so opening the application tab later (or an ATS form on a different site) still tailors against the original posting - and if it genuinely cannot read one, you can pick it, paste it or choose a stored job yourself.
- **Deliberately bounded form support** - the autofill covers the common cases: single-page forms, LinkedIn Easy Apply and standard ATS pages (Greenhouse, Lever, Workday, Ashby, SmartRecruiters, BambooHR…). Deliberately weird flows (custom multi-step wizards that reveal fields as you go, forms split across domains, image-only postings) are handled by the manual paths instead: pick or paste the description, map any field yourself, send answers to specific fields, and download/attach your files. Some modern frameworks only register input typed by hand: if a site reports a filled field as empty on submit, click into the field and type (then remove) a character and the whole value registers - the overlay says this too. The extension says when it could not read something rather than guessing.
- **Readable, adjustable overlay** - the hovering box uses a larger default type scale, the field guide is collapsed by default (with a one-line “Guide me” prompt when no job is detected), and **A− / A+** buttons in the header scale the whole panel from 85% to 160%; the chosen size is remembered.
- **Truthfulness guarantees** - the system prompt forbids invented employers, dates, degrees or metrics; custom prompts cannot override this.

### Bring your own AI (40+ pre-programmed providers)
Frontier labs, inference clouds, regional providers and local servers - add only an API key:

| Category | Providers |
| --- | --- |
| Frontier labs | OpenAI, Anthropic Claude, Google Gemini, Google Vertex AI, xAI Grok, Mistral, Cohere |
| Inference clouds | DeepSeek, DeepInfra, Groq, Together, Fireworks, OpenRouter, Perplexity, Cerebras, SambaNova, Nebius, Novita, Hyperbolic, Featherless, Chutes, Hugging Face, GitHub Models, Azure OpenAI, Cloudflare Workers AI, AI21, Upstage |
| Regional | Moonshot (Kimi), Zhipu GLM, Alibaba Qwen, Baidu ERNIE, MiniMax |
| Local / keyless | Ollama, LM Studio, Jan, llama.cpp, LocalAI, vLLM, SGLang, text-generation-webui, KoboldCpp, Pollinations |
| Custom | Any OpenAI-compatible endpoint (with or without auth) and any OAuth 2.0 (PKCE) provider |

- Native request shapes for OpenAI-compatible, Anthropic, Gemini and Cohere APIs.
- Model lists are refreshed **live from the provider** (saved with the connection), and the current model is selectable directly from the provider card, the config dialog and the dashboard. The built-in catalogue is a curated starting point - DeepSeek V4.1, GPT-5.2, Claude 4.5, Gemini 3, Grok 4 and friends.
- OAuth 2.0 **PKCE** sign-in via `chrome.identity` where supported (e.g. Gemini with your own public client ID).
- Connection tester, live model listing, per-connection base URL / headers / model overrides and automatic token refresh. A failed call stops the action with the provider's error and keeps everything for a retry - there is no silent local fallback.

### Autofill
- 40+ field types recognised from labels, `autocomplete`, ARIA, placeholders and layout context, with confidence scores.
- Handles selects, radio/checkbox groups, React-controlled inputs, and file uploads (attaches the generated PDF/DOCX to the form).
- Optional EEO/sensitive-field filling - off by default behind an explicit toggle.
- Filled fields are highlighted so you can verify before submitting.

### Management page (options)
- **Dashboard** - pipeline stats, AI/agent status, live agent log.
- **My profile** - contact info, links, summary, work history, education, skills, certifications, languages, projects, awards, eligibility, EEO. Multiple **variants** with a default.
- **Resume sources** - upload/paste/scan, then parse into structured data with one click.
- **Documents** - every generated file, filterable, previewable in-app, downloadable, deletable.
- **Applications** - full record per application: status tracking (draft → applied → screening → interview → technical → offer / rejected / withdrawn / no response), timeline, generated documents, written answers, private notes, JSON export.
- **Resume designs** - 19 curated layouts (the default *Essential* is a minimal, professional single column) with accent colours, density, page size, section order/visibility, a single **output format** (PDF by default; DOCX/HTML/MD/TXT/JSON optional), file-name pattern, custom Unicode font upload, and a live preview from your real data.
- **One “…” menu per document function** - the overlay lists *Resume / Cover letter / Answers* (not raw files), each with a single ⋯ menu: View in new tab, Download, **Regenerate** (re-renders just that document with your current design), Attach, Choose upload field - plus *Regenerate all*. The same ⋯ pattern (including Regenerate) is used in the popup, side panel, Documents and Applications pages.
- **Job-agnostic files** - documents are named `First-Last-resume.pdf` / `First-Last-cover-letter.pdf` and carry no employer, role, job URL or “generated for this posting” traces anywhere (not in the file name, PDF/DOCX metadata, HTML headers, answers sheet or JSON Resume meta). Status messages don’t report counts or targets either.
- **WYSIWYG documents** - the PDF renderer mirrors the HTML preview one-to-one: same page padding, type scale, line height, accent headings, entry hierarchy, bullet indents, project links and skill **chips** (including the translucent sidebar chips). Links are real clickable PDF annotations - your email (`mailto:`), LinkedIn/GitHub/portfolio URLs in the header (standard, modern-header and sidebar layouts) and project URLs. What you see in *Resume designs → Live preview* is what the file contains.
- **No duplicate applications** - the same posting is recognised across SPA routes, query strings and re-scrapes (canonical URL → URL path prefix → title/company match), so testing on one job never creates two tracked applications.
- **Pick from all your documents** - the overlay’s **All documents** link opens a picker page *inside the hover box* listing every stored file (generated across jobs **and** your own uploads), each with **Attach**, **Field** (choose the upload destination) and **View** - no trip to the management page required. The Documents header keeps just *Regenerate all* and the picker link.
- **Use your own files** - upload your own resume and cover letter under *Resume designs → My own files* and flip the toggle; autofill and the agent then attach your uploads instead of the generated documents (they’re never overwritten by regeneration and are marked “yours” in the Documents list).
- **Overlay that behaves** - the floating button appears automatically on job postings and application forms (anywhere else the popup's **Select fields** action, the side panel or the context menu opens it on demand). It doubles as a detection indicator: **green** when everything JobPaal needs was found, **red** when something could not be read (no job details, no description, unreadable form), with the reason(s) listed in a warning at the top of the panel. Both the button and the panel are independently draggable with remembered positions, the panel has a fixed height (a little taller now, scrolls internally), and a switch at the very top hides the overlay entirely (the same switch lives at the top of the popup). Picking works inside iframes: the picker request is broadcast to every frame (same-origin and cross-origin), the iframe itself is never selected as a whole, and values picked inside frames are usable immediately. It opens *above* the button, clamps itself into the viewport on resize and content changes, uses self-contained inline SVG icons (no dependency on page or system fonts), and has A− / A+ size controls in the header.
- **Stop and progress** - long AI runs report their stage live (*analysing the posting → writing your resume → writing the cover letter → answering screening questions → rendering → saving*) in the overlay, popup and side panel, and every run has a **Stop** button that halts the pipeline at the next checkpoint.
- **Usage in your face** - today's and all-time token counts are shown in the popup footer and the overlay (with a **Usage report** button that jumps to the management page), and you can set a **token budget** that triggers a notification once reached.
- **No pointless cover letters** - a cover letter is only generated when the application form actually has a field for one; request it explicitly (e.g. the overlay’s *Generate now* on the Cover letter row) to override.
- **AI providers** - the catalogue above, key management, test connection, activation.
- **Prompts & style** - global instructions, tone, words to avoid, themes to emphasise, and editable per-task templates with placeholder reference.
- **Automation** - agent controls, queue, rules, limits, working hours, domain allow/block lists, log.
- **Settings** - theme, accent, autofill behaviour, JSON backup/restore, danger-zone data deletion, privacy overview.

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

### Install a release build (no build tools needed)

Every [release](https://github.com/Mehran9675/jobpal/releases/latest) attaches ready-to-install single-file builds:

| File | Browser | How to install |
| --- | --- | --- |
| `jobpaal-chrome-<version>.crx` | Chrome, Edge, Brave, Opera | Open `chrome://extensions`, enable **Developer mode**, drag the `.crx` onto the page and confirm. Chrome refuses self-signed files while Developer mode is off - if your version blocks it, the `.zip` with **Load unpacked** always works. |
| `jobpaal-firefox-<version>.xpi` | Firefox Developer Edition / Nightly / ESR (permanent) | Set `xpinstall.signatures.required` to `false` in `about:config`, then `about:addons` → gear icon → **Install Add-on From File** and pick the `.xpi`. Regular Firefox only installs signed add-ons. |
| the same `.xpi` | Firefox (temporary) | Open `about:debugging#/runtime/this-firefox` and press **Load Temporary Add-on**; the add-on disappears when Firefox restarts. |
| `jobpaal-chrome-<version>.zip` / `jobpaal-firefox-<version>.zip` | any Chromium / Firefox | Fallback for manual installs: unzip, then *Load unpacked* (Chrome) or pick `manifest.json` (Firefox developers). |

`version.txt` in the same release lists the packaged version. To produce the same files yourself: `npm run build && npm run build:firefox && npm run package` (single-file `.crx` and `.xpi` plus the `.zip` archives land in `release/`).

### First run
1. Read and accept the **Terms of Use and Privacy Policy** - every statement has its own checkbox and all of them must be ticked before the extension unlocks (the same gate is in the management page, popup and side panel).
2. The management page opens automatically on install (also available from the popup ⚙ or right-click → *JobPaal: open management page*).
3. Open **AI providers** and connect one - this is required: every AI-powered feature stays disabled until a provider is active.
4. Add your details or upload a resume in **My profile** → press **Parse**.
5. Open any job posting, click the ◈ overlay (or the toolbar popup) and press **Tailor & fill**.

---


## License

Apache License 2.0 - see [LICENSE](LICENSE) for the full text.

