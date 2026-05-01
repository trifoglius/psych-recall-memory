import { useState, useEffect, useRef, useCallback } from 'react'

// Four word lists for the four trials
const WORD_LISTS: string[][] = [
  [
    'apple', 'river', 'chair', 'thunder', 'purple',
    'bottle', 'freedom', 'ladder', 'orange', 'window',
    'blanket', 'journey', 'pencil', 'ocean', 'cabinet',
    'shadow', 'trumpet', 'needle', 'forest', 'copper',
  ],
  [
    'table', 'lantern', 'bridge', 'silver', 'garden',
    'mirror', 'candle', 'harvest', 'marble', 'feather',
    'balloon', 'crystal', 'avenue', 'shelter', 'falcon',
    'gravel', 'compass', 'anchor', 'velvet', 'glacier',
  ],
  [
    'castle', 'pepper', 'violin', 'puddle', 'helmet',
    'basket', 'lemon', 'cactus', 'pillow', 'magnet',
    'dragon', 'butter', 'tunnel', 'rocket', 'clover',
    'fossil', 'curtain', 'goblin', 'pebble', 'blossom',
  ],
  [
    'banner', 'engine', 'winter', 'socket', 'timber',
    'parrot', 'canopy', 'grotto', 'cobalt', 'fender',
    'turnip', 'bonfire', 'plaster', 'summit', 'mortar',
    'lanyard', 'bracket', 'sparrow', 'thicket', 'chimney',
  ],
]

// YouTube video IDs for each trial (neutral, non-distracting clips)
const YOUTUBE_IDS = [
  'jNQXAC9IVRw', // "Me at the zoo" - first YouTube video ever
  'dQw4w9WgXcQ', // placeholder - replace with desired distractor videos
  'tPEE9ZwTmy0',
  'y6120QOlsfU',
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

export default function FreeRecallTask() {
  const [phase, setPhase] = useState<Phase>('consent')
  const [trialIndex, setTrialIndex] = useState(0)
  const [wordIndex, setWordIndex] = useState(0)
  const [recallText, setRecallText] = useState('')
  const [results, setResults] = useState<TrialData[]>([])
  const [videoEnded, setVideoEnded] = useState(false)
  const [nonNativeBlocked, setNonNativeBlocked] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const playerRef = useRef<HTMLIFrameElement | null>(null)

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
      }, 500)
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
      }, 1500)
    } else {
      // All words shown — move to video
      setVideoEnded(false)
      setPhase('video')
    }
    return clearTimer
  }, [phase, wordIndex, trialIndex])

  // YouTube postMessage listener to detect video end
  const handleMessage = useCallback((event: MessageEvent) => {
    try {
      const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data
      // YouTube iframe API sends info events; playerState 0 = ended
      if (data?.event === 'onStateChange' && data?.info === 0) {
        setVideoEnded(true)
      }
      // Some players send a different structure
      if (data?.info?.playerState === 0) {
        setVideoEnded(true)
      }
    } catch {
      // ignore non-JSON messages
    }
  }, [])

  useEffect(() => {
    if (phase === 'video') {
      window.addEventListener('message', handleMessage)
    }
    return () => window.removeEventListener('message', handleMessage)
  }, [phase, handleMessage])

  const handleConsent = () => setPhase('english-check')

  const handleEnglishConfirm = (isNative: boolean) => {
    if (!isNative) {
      setNonNativeBlocked(true)
      return
    }
    setPhase('fixation')
  }

  const handleSubmitRecall = () => {
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
  }

  const currentWords = WORD_LISTS[trialIndex]
  const currentWord = phase === 'word-display' && wordIndex < currentWords.length
    ? currentWords[wordIndex]
    : null

  // ---- Render ----

  if (phase === 'consent') {
    return (
      <Screen>
        <Card>
          <h1 className="text-2xl font-bold mb-4 text-center">Memory Study</h1>
          <div className="text-sm text-gray-700 space-y-3 mb-6 max-w-prose">
            <p>
              You are being invited to participate in a research study on human memory. You will be shown a 
              list of words, and afterwards you will recall many words as you can remember. The task will be repeated four
              times with different word lists generated at random.
            </p>
            <p>
              Participation is voluntary. Your responses are anonymous. There are no
              known risks associated with this study. It will take around
              10 minutes to complete.
            </p>
             <p>
              If, at any point, you decide not to participate, simply exit this tab. Your data will <strong>not</strong> 
               be included in the final dataset.
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
            I Agree — Begin Study
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
              This study requires native English speakers. Thank you for your interest —
              you are not eligible to participate.
            </p>
          </Card>
        </Screen>
      )
    }
    return (
      <Screen>
        <Card>
          <h2 className="text-xl font-semibold mb-4 text-center">Language Check</h2>
          <p className="text-gray-700 mb-6 text-center">
            Are you a <strong>native English speaker</strong>?
          </p>
          <div className="flex flex-col gap-3">
            <button
              onClick={() => handleEnglishConfirm(true)}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-6 rounded-lg transition-colors"
            >
              Yes, English is my native language
            </button>
            <button
              onClick={() => handleEnglishConfirm(false)}
              className="w-full bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold py-2 px-6 rounded-lg transition-colors"
            >
              No
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
            Please watch the following video clip. The recall task will begin when it ends.
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
          {videoEnded && (
            <button
              onClick={() => setPhase('recall')}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-8 rounded-lg transition-colors"
            >
              Continue to Recall
            </button>
          )}
          {!videoEnded && (
            <p className="text-xs text-gray-400">
              The continue button will appear when the video ends.
            </p>
          )}
        </div>
      </Screen>
    )
  }

  if (phase === 'recall') {
    return (
      <Screen>
        <Card>
          <h2 className="text-xl font-semibold mb-2 text-center">
            Word Recall — Trial {trialIndex + 1} of {WORD_LISTS.length}
          </h2>
          <p className="text-gray-600 text-sm mb-4 text-center">
            Type as many words as you can remember from the list you just saw. Separate
            words with spaces or commas. Spelling does not need to be perfect.
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
            You have completed all four trials of the memory study. Your responses have been
            recorded.
          </p>
          <p className="text-gray-500 text-sm text-center">
            You may now close this window. If you have any questions about this study, please
            contact the researcher.
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
