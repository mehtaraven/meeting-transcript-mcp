import { supabase } from '../config/supabase';
import { transcribeAudio } from './transcriptionService';
import { uploadAudioFile, deleteAudioFile } from './storageService';
import { Transcript, TranscriptSearchQuery, TranscriptWithTags } from '@meeting-transcript/shared';
import { updateJob } from './jobService';
import fs from 'fs/promises';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Full select string — joins utterances and tags via transcript_tags */
const TRANSCRIPT_SELECT = `
  *,
  utterances ( id, speaker_label, text, start_time, end_time, confidence, order_index ),
  transcript_tags ( tags ( id, name, color ) )
`;

// ─── Create ───────────────────────────────────────────────────────────────────

interface CreateParams {
  title: string;
  audioFilePath: string;
  audioFileName: string;
  tagIds?: string[];
  source?: 'recording' | 'upload';
}

export async function createTranscript(userId: string, params: CreateParams, jobId?: string): Promise<TranscriptWithTags> {
  const { title, audioFilePath, audioFileName, tagIds = [], source = 'upload' } = params;

  try {
    // 1. Upload audio to Supabase Storage
    if (jobId) updateJob(jobId, { status: 'transcribing', progress: 30, message: 'Uploading to storage...' });
    const audioUrl = await uploadAudioFile(audioFilePath, audioFileName, userId);

    // 2. Transcribe with Whisper
    if (jobId) updateJob(jobId, { status: 'transcribing', progress: 40, message: 'Transcribing with Gemini...' });
    const result = await transcribeAudio(audioFilePath, jobId);

    // 3. Insert transcript row
    if (jobId) updateJob(jobId, { status: 'saving', progress: 85, message: 'Saving transcript...' });
    const { data: transcript, error: tErr } = await supabase
      .from('transcripts')
      .insert({
        user_id: userId,
        title,
        full_text: result.full_text,
        duration_seconds: result.duration_seconds,
        speaker_count: result.speaker_count,
        audio_url: audioUrl,
        source,
        status: 'completed',
      })
      .select()
      .single();

    if (tErr || !transcript) {
      throw new Error(`Failed to create transcript: ${tErr?.message}`);
    }

    // 4. Insert utterances
    if (result.utterances.length > 0) {
      const { error: uErr } = await supabase.from('utterances').insert(
        result.utterances.map(u => ({ ...u, transcript_id: transcript.id }))
      );
      if (uErr) {
        console.error('Failed to insert utterances:', uErr.message);
      }
    }

    // 5. Link tags (if provided)
    if (tagIds.length > 0) {
      const { error: linkErr } = await supabase.from('transcript_tags').insert(
        tagIds.map(tag_id => ({ transcript_id: transcript.id, tag_id }))
      );
      if (linkErr) {
        console.error('Failed to link tags:', linkErr.message);
      }
    }

    // 6. Clean up local temp file
    await fs.unlink(audioFilePath).catch(() => {});

    // 7. Return full transcript with relations
    if (jobId) updateJob(jobId, { status: 'completed', progress: 100, message: 'Done!' });
    return getTranscriptById(transcript.id, userId);
  } catch (err: any) {
    if (jobId) updateJob(jobId, { status: 'failed', progress: 0, message: err?.message ?? 'Unknown error', error: err?.message ?? 'Unknown error' });
    throw err;
  }
}

// ─── Read ─────────────────────────────────────────────────────────────────────

export async function getTranscripts(userId: string, page = 1, pageSize = 20) {
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, error, count } = await supabase
    .from('transcripts')
    .select(TRANSCRIPT_SELECT, { count: 'exact' })
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .range(from, to);

  if (error) throw new Error(`Failed to fetch transcripts: ${error.message}`);

  return { transcripts: data as TranscriptWithTags[], total: count ?? 0, page, page_size: pageSize };
}

export async function getTranscriptById(transcriptId: string, userId: string): Promise<TranscriptWithTags> {
  const { data, error } = await supabase
    .from('transcripts')
    .select(TRANSCRIPT_SELECT)
    .eq('id', transcriptId)
    .eq('user_id', userId)
    .single();

  if (error || !data) {
    const err: any = new Error('Transcript not found');
    err.statusCode = 404;
    throw err;
  }

  return data as TranscriptWithTags;
}

// ─── Update ───────────────────────────────────────────────────────────────────

export async function updateTranscript(
  transcriptId: string,
  userId: string,
  updates: { title?: string; summary?: string; tagIds?: string[] }
): Promise<TranscriptWithTags> {
  const { tagIds, ...fields } = updates;

  // Update scalar fields (only if there's something to update)
  if (Object.keys(fields).length > 0) {
    const { error } = await supabase
      .from('transcripts')
      .update(fields)
      .eq('id', transcriptId)
      .eq('user_id', userId);

    if (error) throw new Error(`Failed to update transcript: ${error.message}`);
  }

  // Replace tag links
  if (tagIds !== undefined) {
    await supabase.from('transcript_tags').delete().eq('transcript_id', transcriptId);

    if (tagIds.length > 0) {
      await supabase.from('transcript_tags').insert(
        tagIds.map(tag_id => ({ transcript_id: transcriptId, tag_id }))
      );
    }
  }

  return getTranscriptById(transcriptId, userId);
}

// ─── Delete ───────────────────────────────────────────────────────────────────

export async function deleteTranscript(transcriptId: string, userId: string): Promise<void> {
  // Fetch audio_url so we can remove the file from storage
  const { data } = await supabase
    .from('transcripts')
    .select('audio_url')
    .eq('id', transcriptId)
    .eq('user_id', userId)
    .single();

  if (data?.audio_url) {
    // Extract storage path: everything after /object/sign/audio-files/
    const match = data.audio_url.match(/\/object\/sign\/audio-files\/([^?]+)/);
    if (match) {
      await deleteAudioFile(decodeURIComponent(match[1]));
    }
  }

  const { error } = await supabase
    .from('transcripts')
    .delete()
    .eq('id', transcriptId)
    .eq('user_id', userId);

  if (error) throw new Error(`Failed to delete transcript: ${error.message}`);
}

// ─── Search ───────────────────────────────────────────────────────────────────

export async function searchTranscripts(userId: string, query: TranscriptSearchQuery) {
  const page = query.page ?? 1;
  const pageSize = query.page_size ?? 20;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let q = supabase
    .from('transcripts')
    .select(TRANSCRIPT_SELECT, { count: 'exact' })
    .eq('user_id', userId);

  if (query.query) {
    q = q.or(`title.ilike.%${query.query}%,full_text.ilike.%${query.query}%`);
  }
  if (query.date_from) q = q.gte('created_at', query.date_from);
  if (query.date_to) q = q.lte('created_at', query.date_to);

  const { data, error, count } = await q
    .order('created_at', { ascending: false })
    .range(from, to);

  if (error) throw new Error(`Search failed: ${error.message}`);

  return { transcripts: data as TranscriptWithTags[], total: count ?? 0, page, page_size: pageSize };
}

// ─── Tags ─────────────────────────────────────────────────────────────────────

export async function getUserTags(userId: string) {
  const { data, error } = await supabase
    .from('tags')
    .select('*')
    .eq('user_id', userId)
    .order('name');

  if (error) throw new Error(`Failed to fetch tags: ${error.message}`);
  return data;
}

export async function createTag(userId: string, name: string, color?: string) {
  const { data, error } = await supabase
    .from('tags')
    .insert({ user_id: userId, name, color: color ?? '#6366f1' })
    .select()
    .single();

  if (error) throw new Error(`Failed to create tag: ${error.message}`);
  return data;
}

export async function deleteTag(tagId: string, userId: string) {
  const { error } = await supabase
    .from('tags')
    .delete()
    .eq('id', tagId)
    .eq('user_id', userId);

  if (error) throw new Error(`Failed to delete tag: ${error.message}`);
}
