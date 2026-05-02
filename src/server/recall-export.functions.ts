import { createServerFn } from '@tanstack/react-start'

function readEnv(key: string): string | undefined {
  const proc = (globalThis as { process?: { env?: Record<string, string | undefined> } })
    .process
  return proc?.env?.[key]
}

export type TrialExport = { trial: number; recallText: string }

export type RecallExportInput = {
  sessionId: string
  completedAt: string
  trials: TrialExport[]
}

export type RecallExportResult =
  | { ok: true }
  | { ok: false; reason: 'not_configured' | 'upstream_error' | 'bad_response' }

function validateRecallExportInput(data: unknown): RecallExportInput {
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid payload')
  }
  const d = data as Record<string, unknown>
  if (typeof d.sessionId !== 'string' || d.sessionId.length < 8) {
    throw new Error('Invalid sessionId')
  }
  if (typeof d.completedAt !== 'string' || !d.completedAt) {
    throw new Error('Invalid completedAt')
  }
  if (!Array.isArray(d.trials)) {
    throw new Error('Invalid trials')
  }
  const byTrial = new Map<number, string>()
  for (const item of d.trials) {
    if (!item || typeof item !== 'object') continue
    const t = item as Record<string, unknown>
    if (typeof t.trial !== 'number' || t.trial < 1 || t.trial > 4) continue
    if (typeof t.recallText !== 'string') continue
    byTrial.set(t.trial, t.recallText)
  }
  const trials: TrialExport[] = [1, 2, 3, 4].map((n) => {
    if (!byTrial.has(n)) {
      throw new Error('Expected four trials')
    }
    return { trial: n, recallText: byTrial.get(n)! }
  })
  return {
    sessionId: d.sessionId,
    completedAt: d.completedAt,
    trials,
  }
}

/**
 * Sends one completed session to your Google Sheet via a Google Apps Script
 * "Web app" URL. Set env `GOOGLE_SHEETS_WEB_APP_URL` to the deployment URL.
 * Optional `GOOGLE_SHEETS_INGEST_SECRET` is sent as `secret` for verification in the script.
 *
 * Example Apps Script (Tools > Script editor on the spreadsheet), then Deploy > New deployment > Web app:
 *
 * function doPost(e) {
 *   var body = JSON.parse(e.postData.contents);
 *   var expected = PropertiesService.getScriptProperties().getProperty('INGEST_SECRET');
 *   if (expected && body.secret !== expected) {
 *     return ContentService.createTextOutput(JSON.stringify({ ok: false }))
 *       .setMimeType(ContentService.MimeType.JSON);
 *   }
 *   var trials = body.trials || [];
 *   function textFor(n) {
 *     for (var i = 0; i < trials.length; i++) {
 *       if (trials[i].trial === n) return String(trials[i].recallText || '');
 *     }
 *     return '';
 *   }
 *   SpreadsheetApp.getActiveSpreadsheet().getActiveSheet().appendRow([
 *     body.completedAt || new Date().toISOString(),
 *     body.sessionId || '',
 *     textFor(1), textFor(2), textFor(3), textFor(4),
 *   ]);
 *   return ContentService.createTextOutput(JSON.stringify({ ok: true }))
 *     .setMimeType(ContentService.MimeType.JSON);
 * }
 *
 * Script property INGEST_SECRET must match Netlify env GOOGLE_SHEETS_INGEST_SECRET if you use it.
 */
export const submitRecallResults = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => validateRecallExportInput(data))
  .handler(async ({ data }: { data: RecallExportInput }): Promise<RecallExportResult> => {
    const url = readEnv('GOOGLE_SHEETS_WEB_APP_URL')
    if (!url || url.length < 10) {
      return { ok: false, reason: 'not_configured' }
    }
    const secret = readEnv('GOOGLE_SHEETS_INGEST_SECRET')
    let res: Response
    try {
      res = await fetch(url, {
        method: 'POST',
        redirect: 'follow',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(secret ? { secret } : {}),
          sessionId: data.sessionId,
          completedAt: data.completedAt,
          trials: data.trials,
        }),
      })
    } catch {
      return { ok: false, reason: 'upstream_error' }
    }
    if (!res.ok) {
      return { ok: false, reason: 'upstream_error' }
    }
    const text = await res.text()
    try {
      const parsed = JSON.parse(text) as { ok?: boolean }
      if (parsed && parsed.ok === true) {
        return { ok: true }
      }
    } catch {
      return { ok: false, reason: 'bad_response' }
    }
    return { ok: false, reason: 'bad_response' }
  })
