import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs/promises';
import path from 'path';
import { updateJob } from './jobService';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export interface ParsedUtterance {
  speaker_label: string;
  text: string;
  start_time: number;
  end_time: number;
  confidence?: number;
  order_index: number;
}

export interface TranscriptionResult {
  full_text: string;
  duration_seconds: number;
  speaker_count: number;
  utterances: ParsedUtterance[];
}

export async function transcribeAudio(audioFilePath: string, jobId?: string): Promise<TranscriptionResult> {
  const MODELS = ['gemini-2.5-flash', 'gemini-3.5-transcribe'];

  const audioBuffer = await fs.readFile(audioFilePath);
  const base64Audio = audioBuffer.toString('base64');
  const ext = path.extname(audioFilePath).toLowerCase();
  const mimeType = getMimeType(ext);

  let lastError: Error = new Error('Unknown error');

  for (const modelName of MODELS) {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        console.log(`[transcription] Trying ${modelName} attempt ${attempt}/3`);
        if (jobId) updateJob(jobId, { message: `Transcribing... attempt ${attempt}/3` });
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await transcribeWithModel(model, base64Audio, mimeType);

        if (!result.full_text?.trim()) {
          throw new Error('Model returned empty transcription');
        }

        console.log(`[transcription] Success with ${modelName}, ${result.utterances.length} utterances`);
        return result;
      } catch (err: any) {
        lastError = err;
        const status = err?.status ?? err?.cause?.status;
        const isRetryable = status === 503 || status === 429 || err?.cause?.code === 'ECONNRESET' || err?.message === 'Model returned empty transcription';
        console.error(`[transcription] ${modelName} attempt ${attempt}/3 failed: ${err?.message}`);
        if (!isRetryable || attempt === 3) break;
        await new Promise(res => setTimeout(res, 2000 * attempt));
      }
    }
    console.warn(`[transcription] ${modelName} exhausted, trying next model...`);
  }

  throw lastError;
}

// ─── Single transcription approach: plain text with speaker labels ────────────
// No JSON — avoids the model embedding JSON in full_text or hallucinating structure.

async function transcribeWithModel(
  model: any,
  base64Audio: string,
  mimeType: string
): Promise<TranscriptionResult> {
  const prompt = `You are transcribing a Hinglish audio recording (Hindi + English mixed speech).

STRICT REQUIREMENTS — all of these are mandatory, no exceptions:
1. Use ONLY Latin/Roman alphabet (a-z, A-Z). Zero Devanagari characters allowed.
2. Hindi words MUST be written in Roman phonetic spelling:
   - "theek hai" NOT "ठीक है"
   - "haan" NOT "हां"
   - "acha" NOT "अच्छा"
   - "karo" NOT "करो"
   - "nahi" NOT "नहीं"
   - "yaar" NOT "यार"
3. English words stay in English as-is.
4. Do NOT translate. "theek hai" stays "theek hai", not "okay".
5. No Devanagari script whatsoever. If you are about to write any Hindi script character, write the Roman phonetic version instead.
6. No JSON, no markdown, no code blocks, no asterisks, no special formatting.

OUTPUT FORMAT (follow exactly, no brackets):
Speaker 1: what they said in Roman letters
Speaker 2: what they said in Roman letters
Speaker 1: what they said in Roman letters

- New "Speaker N:" line every time the speaker changes
- Use Speaker 1, Speaker 2, Speaker 3 for different speakers
- Single speaker recording = use Speaker 1 throughout

TRANSCRIBE NOW (Roman letters only, no Devanagari):`;

  const response = await model.generateContent([
    prompt,
    { inlineData: { mimeType, data: base64Audio } },
  ]);

  const rawText = response.response.text().trim();
  console.log(`[transcription] Raw output preview: ${rawText.substring(0, 300)}`);

  // Strip any markdown code fences the model might add despite instructions
  const cleanText = rawText
    .replace(/^```[\w]*\n?/gm, '')
    .replace(/^```$/gm, '')
    .trim();

  return parseSpeakerLabelOutput(cleanText);
}

// ─── Parser: "Speaker N: text" format ────────────────────────────────────────

function parseSpeakerLabelOutput(text: string): TranscriptionResult {
  if (!text.trim()) return buildFallbackResult('');

  const lines = text.split('\n').filter(l => l.trim());
  const utterances: ParsedUtterance[] = [];
  let currentSpeaker = 'Speaker 1';
  let buffer: string[] = [];
  let index = 0;

  const flush = () => {
    if (buffer.length === 0) return;
    const uText = buffer.join(' ').trim();
    if (!uText) return;
    const wordCount = uText.split(/\s+/).filter(Boolean).length;
    const start = utterances.length > 0 ? utterances[utterances.length - 1].end_time : 0;
    const duration = Math.max(0.5, wordCount / 2.5);
    utterances.push({
      speaker_label: currentSpeaker,
      text: uText,
      start_time: parseFloat(start.toFixed(1)),
      end_time: parseFloat((start + duration).toFixed(1)),
      order_index: index++,
    });
    buffer = [];
  };

  for (const line of lines) {
    // Match "Speaker 1:", "Speaker 2:", etc. at start of line
    const speakerMatch = line.match(/^(Speaker\s+\d+)\s*:\s*(.*)/i);
    if (speakerMatch) {
      flush();
      currentSpeaker = speakerMatch[1];
      const rest = speakerMatch[2].trim();
      if (rest) buffer.push(rest);
    } else {
      // Continuation of current speaker
      buffer.push(line.trim());
    }
  }
  flush();

  // If model ignored format instructions and returned plain text, wrap as one utterance
  if (utterances.length === 0) {
    return buildFallbackResult(text);
  }

  const full_text = utterances.map(u => u.text).join(' ');
  const duration_seconds = utterances[utterances.length - 1]?.end_time ?? estimateDuration(full_text);
  const speaker_count = new Set(utterances.map(u => u.speaker_label)).size;

  return { full_text, duration_seconds, speaker_count, utterances };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildFallbackResult(text: string): TranscriptionResult {
  const clean = text.trim();
  const duration_seconds = estimateDuration(clean);
  return {
    full_text: clean,
    duration_seconds,
    speaker_count: 1,
    utterances: clean ? [{
      speaker_label: 'Speaker 1',
      text: clean,
      start_time: 0,
      end_time: duration_seconds,
      order_index: 0,
    }] : [],
  };
}

function estimateDuration(text: string): number {
  return Math.round(text.split(/\s+/).filter(Boolean).length / 2.5);
}

function getMimeType(ext: string): string {
  const map: Record<string, string> = {
    '.mp3': 'audio/mp3',
    '.wav': 'audio/wav',
    '.m4a': 'audio/mp4',
    '.mp4': 'audio/mp4',
    '.webm': 'audio/webm',
    '.ogg': 'audio/ogg',
    '.aac': 'audio/aac',
    '.flac': 'audio/flac',
  };
  return map[ext] ?? 'audio/mp4';
}
