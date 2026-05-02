# Memory Study — Free Recall Task

A browser-based repeated-measures free recall experiment for cognitive psychology research. Participants view lists of words, watch a short YouTube distractor video, then type as many words as they can remember. The task repeats across four independent trials.

## Key Technologies

| Layer | Technology |
|-------|------------|
| Framework | [TanStack Start](https://tanstack.com/start) (React 19, file-based routing) |
| Build | Vite 7 |
| Styling | Tailwind CSS 4 |
| Language | TypeScript 5.7 (strict mode) |
| Deployment | Vercel |

## Experiment Flow

1. **Consent screen** — participant reads the study description and agrees to participate
2. **Language check** — participant confirms they are a native English speaker (non-native speakers are screened out)
3. **Fixation cross** — displayed for 500 ms before each trial
4. **Word presentation** — 20 words shown sequentially at 1500 ms each
5. **Distractor video** — an embedded YouTube video; the continue button appears only after the video ends
6. **Free recall** — participant types recalled words into a text area and submits
7. Steps 3–6 repeat for **four trials** with four different word lists
8. **Final notice** — thanking the participant and confirming completion

## Running Locally

```bash
npm install
npm run dev          # starts dev server on http://localhost:3000
```

## Customising the Experiment

- **Word lists** — edit the `WORD_LISTS` array in `src/components/FreeRecallTask.tsx`
- **YouTube videos** — edit the `YOUTUBE_IDS` array in the same file (one ID per trial)
- **Timing** — change the `500` (fixation) and `1500` (word) millisecond values in the `useEffect` hooks
