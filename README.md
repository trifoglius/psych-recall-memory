# Free Recall Task

A browser-based repeated-measures free recall experiment for an AICE Psychology assignment. Participants view lists of words, watch a short YouTube distractor video, then type as many words as they can remember. The task repeats across four independent trials.

## Key Technologies

| Layer | Technology |
|-------|------------|
| Framework | [TanStack Start](https://tanstack.com/start) (React 19, file-based routing) |
| Build | Vite 7 |
| Styling | Tailwind CSS 4 |
| Language | TypeScript 5.7 (strict mode) |
| Deployment | Vercel |

## Experiment Flow

1. **Consent screen**; participant reads the study description and agrees to participate
2. **Language check**; participant confirms they are a native English speaker (non-native speakers are screened out)
3. **Fixation cross**; displayed for 1500 ms before each trial
4. **Word presentation**; 20 words shown sequentially at 2500 ms each
5. **Distractor video**; an embedded YouTube video; the continue button appears only after the video ends
6. **Free recall**; participant types recalled words into a text area for 2 minutes.
7. Steps 3–6 repeat for **four trials** with four different word lists
8. **Final notice**; debriefing and confirming completion
