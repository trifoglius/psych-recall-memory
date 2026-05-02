# AGENTS.md

This document describes the project architecture, conventions, and non-obvious decisions for developers and AI agents working on this codebase.

## Project Overview

A browser-based repeated-measures free recall experiment. Four word lists are presented sequentially; each trial consists of a fixation cross, rapid serial visual presentation (RSVP) of 20 words, a YouTube distractor video, and a free-recall text entry. After all four trials a final notice is shown.

## Directory Structure

```
public/
  favicon.ico
src/
  components/
    FreeRecallTask.tsx  # Entire experiment as a single stateful React component
  server/
    recall-export.functions.ts  # Server fn: POST completed session to Google Apps Script URL
  routes/
    __root.tsx          # Root HTML shell, HeadContent, Scripts
    index.tsx           # Mounts FreeRecallTask full-screen
  router.tsx            # TanStack Router setup
  styles.css            # Tailwind import + base font styles
vite.config.ts          # Vite with TanStack Start + Nitro (Vercel) + Tailwind plugins
tsconfig.json           # Strict TS, @/* alias for src/*
```

## Key Architectural Decisions

### Single-component state machine
The entire experiment lives in `FreeRecallTask.tsx` as a `phase` state machine (`consent` → `english-check` → `fixation` → `word-display` → `video` → `recall` → `final`). This keeps all timing logic co-located and avoids route transitions that could interrupt `setTimeout` chains.

### Timing via `useEffect` + `setTimeout`
- Fixation: 500 ms timeout transitions to `word-display`
- Words: a counter (`wordIndex`) increments every 1500 ms; when exhausted, transitions to `video`
- Timers are cleared in the `useEffect` cleanup function to prevent stale callbacks on re-render

### YouTube video completion detection
The YouTube IFrame API emits `postMessage` events to the parent window. A `message` listener looks for `{ event: "onStateChange", info: 0 }` (playerState `0` = ended). When detected, a "Continue" button appears. The iframe `src` includes `?enablejsapi=1` to enable this channel.

### Word lists and video IDs
Both are plain arrays at the top of `FreeRecallTask.tsx` — easy to replace without touching logic:
- `WORD_LISTS`: 4 arrays of 20 words each
- `YOUTUBE_IDS`: 4 YouTube video IDs (one per trial)

### Results export (Google Sheets)
On the `final` phase, `submitRecallResults` (TanStack server function) POSTs JSON to `process.env.GOOGLE_SHEETS_WEB_APP_URL` — deploy a Google Apps Script **Web app** on your spreadsheet that implements `doPost` and appends a row (see the comment block in `src/server/recall-export.functions.ts`). Optional `GOOGLE_SHEETS_INGEST_SECRET` is sent as `secret` for the script to verify against a Script Property `INGEST_SECRET`. If the URL env var is unset, export is skipped and the participant still sees the thank-you screen.

## Configuration Files

| File | Purpose |
|------|---------|
| `vite.config.ts` | Vite plugins: TanStack Start, Nitro (Vercel), Tailwind |
| `tsconfig.json` | TypeScript config with `@/*` path alias for `src/*` |
| `styles.css` | Tailwind imports + base font styles |

## Development Commands

```bash
npm run dev      # Start dev server on :3000
npm run build    # Production build
```

## Coding Conventions

- **TypeScript strict mode** — no `any`, type-only imports with the `type` keyword
- **Tailwind CSS 4** utility classes
- **No comments for obvious code** — non-obvious timing invariants get a brief inline note
- **Path alias** — `@/` maps to `src/`
- Components: PascalCase; hooks/utilities: camelCase; route files: kebab-case
