import { z } from 'zod';

export const TranscriptCreateSchema = z.object({
  title: z.string().min(1).max(255),
  project_tags: z.array(z.string()).optional(),
  audio_file_name: z.string().optional(),
});

export const TranscriptSearchSchema = z.object({
  query: z.string().optional(),
  project_tags: z.array(z.string()).optional(),
  date_from: z.string().datetime().optional(),
  date_to: z.string().datetime().optional(),
  page: z.number().int().positive().optional().default(1),
  page_size: z.number().int().positive().max(100).optional().default(20),
});

export const SpeakerSegmentSchema = z.object({
  speaker_label: z.string(),
  start_time: z.number(),
  end_time: z.number(),
  text: z.string(),
  confidence: z.number().optional(),
});

export const SpeakerSchema = z.object({
  id: z.string(),
  name: z.string(),
  label: z.string(),
  segments: z.array(SpeakerSegmentSchema),
});

export type TranscriptCreateInput = z.infer<typeof TranscriptCreateSchema>;
export type TranscriptSearchInput = z.infer<typeof TranscriptSearchSchema>;
export type SpeakerSegmentInput = z.infer<typeof SpeakerSegmentSchema>;
export type SpeakerInput = z.infer<typeof SpeakerSchema>;
