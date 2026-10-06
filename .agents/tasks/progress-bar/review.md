# Progress bar for async transcription jobs

The upload flow now returns a `jobId` immediately and the mobile client polls `/api/transcripts/job/:jobId` every 1.5 s to drive a progress bar through five stages (received 10% → transcribing 30%/40% → saving 85% → completed 100%). The backend tracks state in a process-level `Map` with a 10-minute auto-cleanup TTL. The job status endpoint is registered before `/:id` so Express routing resolves it correctly.

Watch for: (confirmed) The job-status endpoint has no authentication — any client knowing a UUID can poll any job. (confirmed) The transcribing-stage progress in `transcriptionService.ts` only updates the message text, not the `progress` number, so the bar stays frozen at 40% for the entire Gemini call. (possible) If the server responds 2xx but omits `jobId`, neither upload path shows the user a success or failure alert — the spinner just disappears silently.

**Verdict**: NEEDS_CHANGES

---

## High-level view

`jobService.ts` is a thin in-memory store. `updateJob` is a no-op when the jobId is absent, so callers don't need null-guards. The job endpoint sits ahead of `/:id` in the router, so routing is correct. The `finally` guard in `uploadAudio` correctly skips `setUploading(false)` while polling is active — `pollIntervalRef.current` is assigned synchronously before `resolve()` fires on both code paths.

The five-stage progress sequence is emitted across `transcripts.ts` (10%), `transcriptService.ts` (30%, 40%, 85%, 100%), and `transcriptionService.ts` (message-only updates during retries). During the Gemini call — up to three attempts per model across two models — the `progress` value stays at 40% regardless of retry count. For long audio with fallback retries this means 30+ seconds of a frozen bar.

The job endpoint accepts requests without a bearer token. Job IDs are 128-bit UUIDs so enumeration is impractical, but the structural gap means a leaked ID (URL bar, log, network trace) exposes transcript-creation status to any caller.

---

<details>
<summary>Issues (3)</summary>

1. **Unauthenticated job-status endpoint** — `GET /transcripts/job/:jobId` has no `authenticateUser` middleware. Add it; the mobile client already sends the bearer token in poll requests.

2. **Retry progress frozen at 40%** — `transcriptionService.ts` updates `message` per attempt but leaves `progress` unchanged. The bar freezes at 40% for the entire Gemini call, including multi-model retry loops. Pass a progress increment per attempt (e.g. 40 → 50 → 60 → 70) so the bar moves during transcription.

3. **Silent success on missing jobId** — if the server returns 2xx without a `jobId` field, neither the fetch nor the XHR path triggers an alert. The spinner clears (the `finally` guard fires `setUploading(false)` correctly) but the user receives no confirmation that the upload succeeded or failed. Add a fallback alert for the no-jobId case.

</details>

---

<details>
<summary>Details</summary>

## Unauthenticated job-status endpoint

`GET /transcripts/job/:jobId` is the only route in `transcripts.ts` without `authenticateUser`. All other routes — including the tags endpoints and the `/:id` catch-all — use the middleware. The structural inconsistency means any ambient session in a shared browser, or any token-free script, can poll the endpoint given a job ID. UUID entropy makes brute-forcing impractical, but job IDs do appear in the JSON response body that the mobile client receives and logs.

## Retry progress frozen at 40%

```ts
// transcriptionService.ts — inside the retry loop
if (jobId) updateJob(jobId, { message: `Transcribing... attempt ${attempt}/3` });
```

`progress` is never updated here. The sequence emitted by `transcriptService.ts` jumps from 40% (start of Gemini call) to 85% (saving) with no intermediate values. For a file that triggers a 503 retry and falls through to the backup model, the gap is three attempts × 2 s back-off + second-model latency — easily 20–30 s of a bar that shows no movement. Small per-attempt increments (40 → 50 → 60 → 70) would make the wait feel active rather than broken.

## Silent success on missing jobId

On both the fetch and XHR paths, when `data.jobId` is absent the code falls through to `finally`, which correctly calls `setUploading(false)` (since `pollIntervalRef.current` is null). The UI clears the spinner, but neither path shows an alert. The transcript may have been created — the backend still processes and saves it — but the user has no indication either way. A fallback `Alert.alert('Done', 'Transcript created successfully!')` when jobId is missing would close this gap.

</details>

---

<details>
<summary>File map</summary>

| File | Change |
|------|--------|
| `apps/backend/src/services/jobService.ts` | New file — in-memory job store with create/update/get and 10-min auto-cleanup |
| `apps/backend/src/routes/transcripts.ts` | Added `GET /job/:jobId` endpoint (before `/:id`); import jobService; pass `jobId` to `createTranscript` |
| `apps/backend/src/services/transcriptService.ts` | Pass `jobId` to `transcribeAudio`; emit progress updates at upload (30%), transcribe (40%), save (85%), complete (100%), and failure path |
| `apps/backend/src/services/transcriptionService.ts` | Accept optional `jobId`; update job message on each retry attempt |
| `apps/mobile/app/(tabs)/record.tsx` | New progress bar UI; polling logic for both fetch and XHR upload paths; cancel clears interval; `finally` guard skips `setUploading(false)` when poll is active |

Full diff: `git diff main -- apps/backend/src/services/jobService.ts apps/backend/src/routes/transcripts.ts apps/backend/src/services/transcriptService.ts apps/backend/src/services/transcriptionService.ts apps/mobile/app/\(tabs\)/record.tsx`

</details>
