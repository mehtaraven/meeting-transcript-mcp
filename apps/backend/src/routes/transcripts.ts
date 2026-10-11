import express from 'express';
import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import {
  createTranscript,
  getTranscripts,
  getTranscriptById,
  updateTranscript,
  deleteTranscript,
  searchTranscripts,
  getUserTags,
  createTag,
  deleteTag,
} from '../services/transcriptService';
import { createJob, updateJob, getJob } from '../services/jobService';
import { authenticateUser } from '../middleware/auth';
import { MAX_FILE_SIZE, ALLOWED_AUDIO_MIMES } from '@meeting-transcript/shared';

const router = express.Router();

// ─── Multer setup ─────────────────────────────────────────────────────────────

const storage = multer.diskStorage({
  destination: process.env.UPLOAD_DIR || './uploads',
  filename: (_req, file, cb) => cb(null, `${uuidv4()}${path.extname(file.originalname)}`),
});

const upload = multer({
  storage,
  limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE ?? String(MAX_FILE_SIZE)) },
  fileFilter: (_req, file, cb) => {
    if ((ALLOWED_AUDIO_MIMES as readonly string[]).includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only audio files are allowed.'));
    }
  },
});

// ─── Static-path routes first (must come before /:id to avoid shadowing) ─────

/** GET /transcripts/search  — full-text + date filter */
router.post('/search', authenticateUser, async (req, res, next) => {
  try {
    const result = await searchTranscripts(req.user!.id, req.body);
    res.json(result);
  } catch (err) { next(err); }
});

/** GET /transcripts/job/:jobId — poll transcription job status */
router.get('/job/:jobId', authenticateUser, async (req, res) => {
  const job = getJob(req.params.jobId);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  res.json(job);
});

/** GET /transcripts/tags/all  — list user tags */
router.get('/tags/all', authenticateUser, async (req, res, next) => {
  try {
    const tags = await getUserTags(req.user!.id);
    res.json({ tags });
  } catch (err) { next(err); }
});

/** POST /transcripts/tags  — create a tag */
router.post('/tags', authenticateUser, async (req, res, next) => {
  try {
    const { name, color } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });
    const tag = await createTag(req.user!.id, name, color);
    res.status(201).json({ tag });
  } catch (err) { next(err); }
});

/** DELETE /transcripts/tags/:id */
router.delete('/tags/:id', authenticateUser, async (req, res, next) => {
  try {
    await deleteTag(req.params.id, req.user!.id);
    res.json({ message: 'Tag deleted' });
  } catch (err) { next(err); }
});

/** POST /transcripts/upload — multipart audio upload → async transcribe */
router.post('/upload', authenticateUser, upload.single('audio_file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'audio_file is required' });
  }

  const jobId = uuidv4();
  createJob(jobId);
  updateJob(jobId, { status: 'received', progress: 10, message: 'File received, starting transcription...' });

  const userId = req.user!.id;
  const tagIds = req.body.tag_ids ? JSON.parse(req.body.tag_ids) : [];
  const source: 'recording' | 'upload' = req.body.source === 'recording' ? 'recording' : 'upload';
  const title = req.body.title || `Transcript ${new Date().toLocaleDateString()}`;
  const filePath = req.file.path;
  const fileName = req.file.filename;

  // Respond immediately with jobId so the client can start polling
  res.status(202).json({ jobId, message: 'Transcription started' });

  // Process asynchronously — client polls /job/:jobId for progress
  createTranscript(userId, { title, audioFilePath: filePath, audioFileName: fileName, tagIds, source }, jobId)
    .catch((err) => {
      console.error('[upload] Transcription failed:', err.message);
      updateJob(jobId, { status: 'failed', progress: 0, message: err.message, error: err.message });
    });
});

// ─── Dynamic-param routes (must come after static paths) ─────────────────────

/** GET /transcripts  — list all */
router.get('/', authenticateUser, async (req, res, next) => {
  try {
    const result = await getTranscripts(
      req.user!.id,
      parseInt(req.query.page as string) || 1,
      parseInt(req.query.page_size as string) || 20
    );
    res.json(result);
  } catch (err) { next(err); }
});

/** GET /transcripts/:id */
router.get('/:id', authenticateUser, async (req, res, next) => {
  try {
    const transcript = await getTranscriptById(req.params.id, req.user!.id);
    res.json({ transcript });
  } catch (err) { next(err); }
});

/** PUT /transcripts/:id  — update title, summary, tags */
router.put('/:id', authenticateUser, async (req, res, next) => {
  try {
    const { title, summary, tag_ids } = req.body;
    const transcript = await updateTranscript(req.params.id, req.user!.id, {
      title,
      summary,
      tagIds: tag_ids,
    });
    res.json({ transcript, message: 'Transcript updated successfully' });
  } catch (err) { next(err); }
});

/** DELETE /transcripts/:id */
router.delete('/:id', authenticateUser, async (req, res, next) => {
  try {
    await deleteTranscript(req.params.id, req.user!.id);
    res.json({ message: 'Transcript deleted successfully' });
  } catch (err) { next(err); }
});

export default router;
