# Implementation Plan — Transcription Progress Bar

## Codebase Findings

- **Backend**: Express + TypeScript at `apps/backend/src`. `uuid` (`v4 as uuidv4`) is already imported in `routes/transcripts.ts`. `tsconfig.json` targets ES2020/commonjs, strict mode on.
- **`transcriptService.ts`**: `createTranscript(userId, params)` is a plain async function — adding an optional third `jobId?: string` param is straightforward with no overloads needed.
- **`transcriptionService.ts`**: `transcribeAudio(audioFilePath)` has a `for` loop over MODELS and inner `for` loop over attempts (1–3). The attempt counter variable is named `attempt`. Adding `jobId?` as a second param and calling `updateJob` inside the attempt loop is clean.
- **`routes/transcripts.ts`**: POST `/upload` handler already wraps `createTranscript` in a try/catch and returns `res.status(201).json(...)`. The `jobId` can be generated before `createTranscript` is called, then included in the response JSON.
- **`record.tsx`**: Has two upload paths — `fetch` (for `blob`, web recording) and `XMLHttpRequest` (for native file picker). The `finally` block currently calls `setUploading(false)`. Both paths need to be updated to extract `jobId` from the response and start polling. `cancelledRef`, `xhrRef`, `abortControllerRef` are already `useRef` — `pollIntervalRef` follows the same pattern.
- **Mobile tsconfig**: `strict: true`, extends `expo/tsconfig.base`. TypeScript is checked via `npx tsc --noEmit` in the mobile root.
- **No new packages needed**: `uuid` is already a backend dependency; polling uses native `setInterval`/`fetch`.

---

## Implementation Plan

- [ ] 1. Create `jobService.ts` — in-memory job store with auto-cleanup.
      Define the `JobStatus` interface and four exported functions: `createJob`, `updateJob`, `getJob`, and an internal `scheduleCleanup` that calls `setTimeout` for 10 minutes after `createJob`.
      Files: `apps/backend/src/services/jobService.ts` (new file)
      Verify: `cd apps/backend && npx tsc --noEmit` — zero TypeScript errors.

- [ ] 2. Add `GET /job/:jobId` route and wire `jobId` into `POST /upload` in `routes/transcripts.ts`.
      - Import `createJob`, `updateJob`, `getJob` from `../services/jobService`.
      - In the `POST /upload` handler: generate `const jobId = uuidv4()` at the top of the try block (before calling `createTranscript`), call `createJob(jobId)`, then `updateJob(jobId, { status: 'received', progress: 10, message: 'File received' })`, pass `jobId` to `createTranscript` as a new third argument, change the final response to `res.status(201).json({ transcript, jobId, message: 'Transcript created successfully' })`.
      - Add the new route **before** the existing `router.get('/:id', ...)` route (to avoid `:id` swallowing "job") — actually place it anywhere since "job" won't match a UUID pattern, but to be safe add it before the parameterised routes:
        ```
        router.get('/job/:jobId', async (req, res, next) => {
          try {
            const job = getJob(req.params.jobId);
            if (!job) return res.status(404).json({ error: 'Job not found' });
            res.json(job);
          } catch (err) { next(err); }
        });
        ```
        No `authenticateUser` middleware — jobIds are unguessable UUIDs.
      Files: `apps/backend/src/routes/transcripts.ts`
      Verify: `cd apps/backend && npx tsc --noEmit` — zero TypeScript errors.

- [ ] 3. Update `transcriptService.ts` — accept `jobId?` and emit progress updates.
      - Add `jobId?: string` as a third parameter to `createTranscript(userId, params, jobId?)`.
      - Import `updateJob` from `./jobService`.
      - Add guarded `updateJob` calls at these five points (each call is wrapped in `if (jobId)`):
        - Before `uploadAudioFile`: `{ status: 'transcribing', progress: 30, message: 'Uploading to storage...' }`
        - Before `transcribeAudio`: `{ status: 'transcribing', progress: 40, message: 'Transcribing with Gemini...' }`
        - After `transcribeAudio` returns (before the DB insert): `{ status: 'saving', progress: 85, message: 'Saving transcript...' }`
        - After the final `return getTranscriptById(...)`: `{ status: 'completed', progress: 100, message: 'Done!' }` — this must be emitted **before** the return, so restructure the final line to: call `updateJob`, then `return getTranscriptById(...)`.
        - In the `catch` block: `{ status: 'failed', progress: 0, message: error.message, error: error.message }` — cast `error` as `any` (already the pattern-free catch, so use `catch (error: any)`).
      Files: `apps/backend/src/services/transcriptService.ts`
      Verify: `cd apps/backend && npx tsc --noEmit` — zero TypeScript errors.

- [ ] 4. Update `transcriptionService.ts` — accept `jobId?` and emit per-attempt messages.
      - Add `jobId?: string` as a second parameter to `transcribeAudio(audioFilePath, jobId?)`.
      - Import `updateJob` from `./jobService`.
      - Inside the inner `for (let attempt = 1; attempt <= 3; attempt++)` loop, at the top of the try block (after the `console.log`), add:
        ```typescript
        if (jobId) updateJob(jobId, { message: `Transcribing... attempt ${attempt}/3` });
        ```
      Files: `apps/backend/src/services/transcriptionService.ts`
      Verify: `cd apps/backend && npx tsc --noEmit` — zero TypeScript errors.

- [ ] 5. Update `record.tsx` — progress bar UI with polling.
      This is the largest change. Work through it in this order to avoid regression:

      **a) New state and refs** — add after the existing `const [uploading, setUploading] = useState(false)` line:
      ```typescript
      const [uploadProgress, setUploadProgress] = useState(0);
      const [uploadStage, setUploadStage] = useState('');
      const [jobId, setJobId] = useState<string | null>(null);
      const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
      ```

      **b) Update `cancelUpload`** — replace the existing body with:
      ```typescript
      const cancelUpload = () => {
        cancelledRef.current = true;
        xhrRef.current?.abort();
        abortControllerRef.current?.abort();
        if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
        setUploading(false);
        setUploadProgress(0);
        setUploadStage('');
        setJobId(null);
        Alert.alert('Cancelled', 'Upload cancelled.');
      };
      ```

      **c) Fetch path (blob / web recording)** — after `if (!response.ok) throw new Error('Upload failed');`, parse the jobId and start polling:
      ```typescript
      const data = await response.json();
      const parsedJobId = data.jobId as string;
      setJobId(parsedJobId);
      const interval = setInterval(async () => {
        try {
          const pollRes = await fetch(`${apiUrl}/api/transcripts/job/${parsedJobId}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const jobData = await pollRes.json();
          setUploadProgress(jobData.progress);
          setUploadStage(jobData.message);
          if (jobData.status === 'completed') {
            clearInterval(interval);
            pollIntervalRef.current = null;
            setUploading(false);
            setJobId(null);
            setUploadProgress(0);
            setUploadStage('');
            Alert.alert('Success', 'Transcript created successfully!');
            setTitle('');
            setProjectTags('');
          } else if (jobData.status === 'failed') {
            clearInterval(interval);
            pollIntervalRef.current = null;
            setUploading(false);
            setJobId(null);
            setUploadProgress(0);
            setUploadStage('');
            Alert.alert('Error', jobData.error || 'Transcription failed');
          }
        } catch { /* ignore network blips */ }
      }, 1500);
      pollIntervalRef.current = interval;
      ```
      Remove the old `Alert.alert('Success', ...)`, `setTitle('')`, `setProjectTags('')` lines that currently follow the `if (cancelledRef.current) return;` check for this path — they now live in the poll completion handler.

      **d) XHR path (native file picker)** — in `xhr.onload`, after `resolve()`, do NOT call `resolve()` and then parse — instead replace the `resolve()` call path with:
      ```typescript
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const data = JSON.parse(xhr.responseText);
            const parsedJobId = data.jobId as string;
            setJobId(parsedJobId);
            const interval = setInterval(async () => {
              try {
                const pollRes = await fetch(`${apiUrl}/api/transcripts/job/${parsedJobId}`, {
                  headers: { Authorization: `Bearer ${token}` },
                });
                const jobData = await pollRes.json();
                setUploadProgress(jobData.progress);
                setUploadStage(jobData.message);
                if (jobData.status === 'completed') {
                  clearInterval(interval);
                  pollIntervalRef.current = null;
                  setUploading(false);
                  setJobId(null);
                  setUploadProgress(0);
                  setUploadStage('');
                  Alert.alert('Success', 'Transcript created successfully!');
                  setTitle('');
                  setProjectTags('');
                } else if (jobData.status === 'failed') {
                  clearInterval(interval);
                  pollIntervalRef.current = null;
                  setUploading(false);
                  setJobId(null);
                  setUploadProgress(0);
                  setUploadStage('');
                  Alert.alert('Error', jobData.error || 'Transcription failed');
                }
              } catch { /* ignore network blips */ }
            }, 1500);
            pollIntervalRef.current = interval;
            resolve();
          } catch {
            reject(new Error('Failed to parse response'));
          }
        } else {
          reject(new Error(`Upload failed: ${xhr.status}`));
        }
      };
      ```

      **e) Fix `finally` block** — change from `setUploading(false)` to only clearing refs (polling keeps `uploading` true until done):
      ```typescript
      } finally {
        xhrRef.current = null;
        abortControllerRef.current = null;
      }
      ```
      Remove the `setUploading(false)` call from this block. The existing `if (cancelledRef.current) return;` check and the error-path `Alert.alert('Error', 'Failed to upload audio')` remain unchanged.

      **f) JSX — add progress section** — replace the existing `{uploading && <TouchableOpacity style={styles.cancelButton}...>}` block entirely with:
      ```tsx
      {uploading && (
        <View style={styles.progressContainer}>
          <Text style={styles.progressStage}>{uploadStage || 'Uploading...'}</Text>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${uploadProgress}%` as any }]} />
          </View>
          <Text style={styles.progressPercent}>{uploadProgress}%</Text>
          <TouchableOpacity style={styles.cancelButton} onPress={cancelUpload}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      )}
      ```
      Note: React Native's `StyleSheet` requires numeric width, but the progress fill uses a percentage string — cast with `as any` to satisfy TypeScript, or use `Animated` values. The simpler approach is to use a fixed-width parent and calculate numeric width: `{ width: (containerWidth * uploadProgress) / 100 }`. However, since the task spec calls for `width: \`${uploadProgress}%\`` and the progressTrack has `width: '100%'`, use the `as any` cast as the path of least resistance since this is React Native Web compatible.

      **g) Add new styles** — append to the `StyleSheet.create({...})` object:
      ```typescript
      progressContainer: { alignItems: 'center', paddingVertical: 20, width: '100%' },
      progressTrack: { height: 8, backgroundColor: '#e2e8f0', borderRadius: 4, width: '100%', marginVertical: 12, overflow: 'hidden' },
      progressFill: { height: 8, backgroundColor: '#007AFF', borderRadius: 4 },
      progressStage: { fontSize: 16, color: '#1e293b', fontWeight: '600', textAlign: 'center', marginBottom: 8 },
      progressPercent: { fontSize: 13, color: '#94a3b8', textAlign: 'center' },
      cancelButton: { marginTop: 16, paddingVertical: 10, paddingHorizontal: 24, borderRadius: 8, borderWidth: 1.5, borderColor: '#FF3B30' },
      cancelText: { color: '#FF3B30', fontWeight: '600', fontSize: 15 },
      ```
      Note: the existing `cancelButton` and `cancelText` styles in the stylesheet are now repurposed for the new layout — their definitions above **replace** the old ones (old cancelButton had `flexDirection: 'row'` and `alignItems: 'center'`; the new one does not need them). The `ActivityIndicator` import in the existing file is no longer used after removing the old cancel block — remove it from the import to avoid a lint warning.

      Files: `apps/mobile/app/(tabs)/record.tsx`
      Verify: `cd apps/mobile && npx tsc --noEmit` — zero TypeScript errors.

---

## Dependency Order

Steps 1 → 2 → 3 → 4 are purely backend and build on each other (2 imports from 1, 3 imports from 1, 4 imports from 1). Step 5 is purely mobile and is independent of the backend steps except by contract (it consumes the `jobId` field in the upload response and the `/job/:jobId` endpoint shape defined in step 2). All backend steps must be done before testing end-to-end.

## Constraints Checklist

- No new npm packages installed (uuid already present, polling uses native APIs).
- No SSE or WebSockets — plain HTTP polling at 1500ms intervals.
- Auth middleware untouched — `/job/:jobId` intentionally has no `authenticateUser`.
- Supabase config untouched.
- TypeScript verification: `npx tsc --noEmit` in both `apps/backend` and `apps/mobile`.
- Cancel upload, document picker, and web recording flows are all preserved.
