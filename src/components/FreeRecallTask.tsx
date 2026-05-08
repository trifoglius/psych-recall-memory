import { useState, useEffect, useRef, useCallback } from 'react'
import { submitRecallResults } from '@/server/recall-export.functions'

// Four word lists for the four trials
// Four word lists, indexed by rhyme density: 0=0%R, 1=20%R, 2=40%R, 3=60%R
const WORD_LISTS_BY_DENSITY: string[][] = [
  // 0% R
  [
    'palm', 'dog', 'cone', 'tool',
    'vine', 'bank', 'world', 'ant',
    'toast', 'flame', 'bat', 'truck',
    'bloom', 'roof', 'chalk', 'house',
    'bird', 'pie', 'spear', 'bench',
  ],
  // 20% R
  [
    'face', 'cart', 'jail', 'broom', 
    'plate', 'pale', 'doll', 'boy', 
    'sun', 'cup', 'star', 'sail', 
    'gold', 'lake', 'cloth', 'branch', 
    'frog', 'cat', 'ditch', 'tail',
  ],
  // 40% R
  [
    'band', 'pet', 'egg', 'seal', 'set', 'threat', 'moth', 'debt', 'hook', 'kite', 'zoo', 'desk', 'shield', 'clay', 'spark', 'wet', 'jet', 'sweat', 'school', 'net',
  ],
  // 60% R
  [
     'slush', 'goat', 'quote', 'hand', 'boat', 'tape', 'oat', 'queen', 'tote', 'book', 'gloat', 'horn', 'note', 'float', 'wolf', 'moat', 'coat', 'wrote', 'cash', 'throat',
  ],
]

// The four counterbalance templates (each is an ordered list of density indices)
const TEMPLATES: number[][] = [
  [0, 1, 2, 3], // Template 1: 0%R, 20%R, 40%R, 60%R
  [1, 3, 0, 2], // Template 2: 20%R, 60%R, 0%R, 40%R
  [2, 0, 3, 1], // Template 3: 40%R, 0%R, 60%R, 20%R
  [3, 2, 1, 0], // Template 4: 60%R, 40%R, 20%R, 0%R
]

// Pick a random template once per session
const SESSION_TEMPLATE = TEMPLATES[Math.floor(Math.random() * TEMPLATES.length)]

// Build the word lists in the order this participant will see them
const WORD_LISTS: string[][] = SESSION_TEMPLATE.map(i => WORD_LISTS_BY_DENSITY[i])

// YouTube video IDs for each trial
const YOUTUBE_IDS = [
  'HgxEmNMXXdQ',
  '2loxoi2-5BY',
  'GcSZ6xAE6TU',
  'f0Xin0WRbP4',
]

type Phase =
  | 'consent'
  | 'english-check'
  | 'fixation'
  | 'word-display'
  | 'video'
  | 'recall'
  | 'final'

interface TrialData {
  trial: number
  recallText: string
}

type SheetExportState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ok' }
  | { status: 'error' }
  | { status: 'skipped' }

export default function FreeRecallTask() {
  const [phase, setPhase] = useState<Phase>('consent')
  const [trialIndex, setTrialIndex] = useState(0)
  const [wordIndex, setWordIndex] = useState(0)
  const [recallText, setRecallText] = useState('')
  const [recallTimeLeft, setRecallTimeLeft] = useState(120)
  const [results, setResults] = useState<TrialData[]>([])
  const [sheetExport, setSheetExport] = useState<SheetExportState>({ status: 'idle' })
  const [nonNativeBlocked, setNonNativeBlocked] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const playerRef = useRef<HTMLIFrameElement | null>(null)
  const templateRef = useRef(TEMPLATES.indexOf(SESSION_TEMPLATE))
  const sessionIdRef = useRef(
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
  )
  const sheetExportStartedRef = useRef(false)

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }

  // Advance through fixation -> word display
  useEffect(() => {
    if (phase === 'fixation') {
      clearTimer()
      timerRef.current = setTimeout(() => {
        setWordIndex(0)
        setPhase('word-display')
      }, 1000)
    }
    return clearTimer
  }, [phase])

  useEffect(() => {
    if (phase !== 'word-display') return
    const words = WORD_LISTS[trialIndex]
    if (wordIndex < words.length) {
      clearTimer()
      timerRef.current = setTimeout(() => {
        setWordIndex((i) => i + 1)
      }, 2000)
    } else {
      // All words shown, move to video
      setPhase('video')
    }
    return clearTimer
  }, [phase, wordIndex, trialIndex])

  // Reveal the continue button after a fixed distractor interval
  useEffect(() => {
    if (phase !== 'video') return
    const t = setTimeout(() => setPhase('recall'), 50500)
    return () => clearTimeout(t)
  }, [phase])

  useEffect(() => {
    if (phase !== 'final' || results.length !== WORD_LISTS.length) return
    if (sheetExportStartedRef.current) return
    sheetExportStartedRef.current = true
    setSheetExport({ status: 'loading' })
    let cancelled = false
    const sorted = [...results].sort((a, b) => a.trial - b.trial)
    void (async () => {
      try {
        const r = await submitRecallResults({
          data: {
            sessionId: sessionIdRef.current,
            completedAt: new Date().toISOString(),
            template: templateRef.current + 1,
            trials: sorted.map((t) => ({ trial: t.trial, recallText: t.recallText })),
          },
        })
        if (cancelled) return
        if (r.ok) setSheetExport({ status: 'ok' })
        else if (r.reason === 'not_configured') setSheetExport({ status: 'skipped' })
        else setSheetExport({ status: 'error' })
      } catch {
        if (!cancelled) setSheetExport({ status: 'error' })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [phase, results])

  const handleConsent = () => setPhase('english-check')

  const handleEnglishConfirm = (isNative: boolean) => {
    if (!isNative) {
      setNonNativeBlocked(true)
      return
    }
    setPhase('fixation')
  }

  const handleSubmitRecall = useCallback(() => {
    const trialData: TrialData = { trial: trialIndex + 1, recallText }
    const updatedResults = [...results, trialData]
    setResults(updatedResults)
    setRecallText('')

    if (trialIndex + 1 < WORD_LISTS.length) {
      setTrialIndex((i) => i + 1)
      setPhase('fixation')
    } else {
      setPhase('final')
    }
  }, [results, trialIndex, recallText])

  useEffect(() => {
  if (phase !== 'recall') return
  setRecallTimeLeft(120)
  const interval = setInterval(() => {
    setRecallTimeLeft((t) => {
      if (t <= 1) {
        clearInterval(interval)
        handleSubmitRecall()
        return 0
      }
      return t - 1
    })
  }, 1000)
  return () => clearInterval(interval)
}, [phase, trialIndex, handleSubmitRecall])

  const currentWords = WORD_LISTS[trialIndex]
  const currentWord = phase === 'word-display' && wordIndex < currentWords.length
    ? currentWords[wordIndex]
    : null

  // Render

  if (phase === 'consent') {
    return (
      <Screen>
        <Card>
          <h1 className="text-2xl font-bold mb-4 text-center">Memory Study</h1>
          <div className="text-sm text-gray-700 space-y-3 mb-6 max-w-prose">
            <p>
              You have been invited to participate in a research study on human memory. You will be shown a 
              list of words, and afterwards you will be asked to recall as many words as you can remember. The task will be repeated <b>four</b> times with different randomly-generated word lists.
            </p>
            <p>
              Participation is voluntary. Your responses are anonymous. There is minimal risk 
              associated with this study. It will take around
              10 minutes to complete.
            </p>
             <p>
              If, at any point, you decide not to participate, simply exit this tab. Your data will <strong>not</strong> be 
               included in the final dataset.
            </p>
            <p>
              Since this is a task of natural memory, please <strong>do not</strong> write down any words.
            </p>
            <p>
              By clicking <strong>I Agree</strong> below, you confirm that you have read and
              understood this information and consent to participate.
            </p>
          </div>
          <button
            onClick={handleConsent}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-6 rounded-lg transition-colors"
          >
            I Agree, Begin Study
          </button>
        </Card>
      </Screen>
    )
  }

  if (phase === 'english-check') {
    if (nonNativeBlocked) {
      return (
        <Screen>
          <Card>
            <h2 className="text-xl font-semibold mb-4 text-center">Not Eligible</h2>
            <p className="text-gray-700 text-center">
              Thank you for your interest, but you are not eligible to participate.
            </p>
          </Card>
        </Screen>
      )
    }
    return (
      <Screen>
        <Card>
          <h2 className="text-xl font-semibold mb-4 text-center">Selection Criteria</h2>
          <p className="text-gray-700 mb-6 text-center">
            To participate in this study, please confirm you are a <strong>native English speaker</strong>.<br></br>
          </p>
          <div className="flex flex-col gap-3">
            <button
              onClick={() => handleEnglishConfirm(true)}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-6 rounded-lg transition-colors"
            >
              Yes, I <strong>am</strong> a native English speaker.
            </button>
            <button
              onClick={() => handleEnglishConfirm(false)}
              className="w-full bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold py-2 px-6 rounded-lg transition-colors"
            >
              No, I am <strong>not</strong> a native English speaker.
            </button>
          </div>
        </Card>
      </Screen>
    )
  }

  if (phase === 'fixation') {
    return (
      <Screen dark>
        <span className="text-white text-6xl font-light select-none">+</span>
      </Screen>
    )
  }

  if (phase === 'word-display') {
    return (
      <Screen dark>
        {currentWord ? (
          <span
            key={wordIndex}
            className="text-white text-5xl font-semibold tracking-wide select-none"
          >
            {currentWord}
          </span>
        ) : (
          <span className="text-white text-2xl select-none">…</span>
        )}
      </Screen>
    )
  }

  if (phase === 'video') {
    const videoId = YOUTUBE_IDS[trialIndex]
    return (
      <Screen>
        <div className="flex flex-col items-center gap-6 w-full max-w-2xl px-4">
          <p className="text-gray-600 text-sm text-center">
            Please watch the following video clip.
          </p>
          <div className="w-full aspect-video rounded-xl overflow-hidden shadow-lg">
            <iframe
              ref={playerRef}
              src={`https://www.youtube.com/embed/${videoId}?autoplay=1&enablejsapi=1&rel=0`}
              className="w-full h-full"
              allow="autoplay; encrypted-media"
              allowFullScreen
              title="Distractor video"
            />
          </div>
          <p className="text-xs text-gray-400">
            The next task will begin automatically.
          </p>
        </div>
      </Screen>
    )
  }

  if (phase === 'recall') {
    return (
      <Screen>
        <Card>
          <h2 className="text-xl font-semibold mb-2 text-center">
            Word Recall, Trial {trialIndex + 1} of {WORD_LISTS.length}
          </h2>
          <p className="text-gray-600 text-sm mb-4 text-center">
            Type as many words as you can remember from the list you just saw. The order does not matter. Separate
            words with commas.
          </p>
          <p className="text-red-500 text-sm text-center font-semibold mb-2">
            Time remaining: {recallTimeLeft}s
          </p>
          <textarea
            value={recallText}
            onChange={(e) => setRecallText(e.target.value)}
            rows={5}
            placeholder="Type recalled words here…"
            className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
            autoFocus
          />
          <button
            onClick={handleSubmitRecall}
            className="mt-4 w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-6 rounded-lg transition-colors"
          >
            {trialIndex + 1 < WORD_LISTS.length ? 'Submit & Continue' : 'Submit & Finish'}
          </button>
        </Card>
      </Screen>
    )
  }

  if (phase === 'final') {
    return (
      <Screen>
        <Card>
          <h2 className="text-2xl font-bold mb-4 text-center">Thank You!</h2>
          <p className="text-gray-700 text-center mb-4">
            You have completed all four trials of the memory study. Thank you for participation. The true purpose of this 
            study was to investigate memory in words with rhymes. You were not told this in order to prevent any changes in 
            memorization. If you would not like to be included in the dataset, please exit this tab and e-mail the researcher at jpharris131@gmail.com, indicating the 
            timestamp of your participation.
          </p>
          {sheetExport.status === 'loading' && (
            <p className="text-gray-600 text-sm text-center mb-4">Submitting your responses…</p>
          )}
          {sheetExport.status === 'ok' && (
            <p className="text-green-700 text-sm text-center mb-4">
              Your responses were submitted successfully.
            </p>
          )}
          {sheetExport.status === 'error' && (
            <p className="text-amber-800 text-sm text-center mb-4">
              We could not confirm that your responses reached the researcher. If this message
              persists, please contact the researcher before leaving.
            </p>
          )}
          <p className="text-gray-500 text-sm text-center">
            Do not close this window until the upload is confirmed.
          </p>
        </Card>
      </Screen>
    )
  }

  return null
}

// Layout helpers

function Screen({ children, dark }: { children: React.ReactNode; dark?: boolean }) {
  return (
    <div
      className={`min-h-screen flex items-center justify-center ${
        dark ? 'bg-black' : 'bg-gray-50'
      }`}
    >
      {children}
    </div>
  )
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl shadow-md p-8 w-full max-w-lg">
      {children}
    </div>
  )
}
