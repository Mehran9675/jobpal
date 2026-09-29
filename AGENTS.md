# JobPaal engineering conventions

These rules apply to every React file in this repository. Follow them exactly.

## File structure

- **One component per file.** A file exports a single React component (plus, at most, its own local `renderX` helpers).
- **Helpers live in their own files**, grouped by purpose (`helpers/`, `constants/`, `hooks/`, `lib/`). Never leave a non-component helper in a component file.
- **Everything is organised into folders and subfolders.** A feature gets a folder; components go in `components/`, helpers in `helpers/`, constants in `constants/`, hooks in `hooks/`.
- Barrel files (`index.ts` / `Primitives.tsx`) only re-export; they contain no components.
- Icon sets are collections: one file per glyph under `components/icons/`, re-exported by a barrel.

## JSX rules

- **Never use conditions in JSX.** Use the `Show` component:
  ```tsx
  <Show if={state.busy}>{content}</Show>   // GOOD
  {state.busy && content}                  // FORBIDDEN
  ```
  `Show` checks the condition and returns `null` when false (`condition ? children : null`, never `&&`).
- **Never map lists inline in JSX.** Define a render function in the component file and call it:
  ```tsx
  const renderDocument = (document: DocumentRecord) => <DocumentRow key={document.id} document={document} />;
  ...
  {documents.map(renderDocument)}
  ```
- Render function names describe what they render (`renderDocument`, `renderAnswer`, `renderGuideTarget`).
- Keys belong on the element returned by the render function, not on the `.map` call.

## Imports

- Use the `@/` alias for cross-layer imports.
- Feature-local imports stay relative (`../helpers/...`).

## Verification

Every change must pass:

```bash
npm run typecheck
npm run build
npm run smoke
```
