// ─── Database row types (match actual Supabase schema) ───────────────────────

export interface Profile {
  id: string;
  email: string;
  display_name?: string;
  avatar_url?: string;
  created_at: string;
  updated_at: string;
}

export interface Transcript {
  id: string;
  user_id: string;
  title: string;
  full_text: string;
  summary?: string;
  duration_seconds?: number;
  speaker_count: number;
  audio_url?: string;
  source: 'recording' | 'upload';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  // joined fields (present when fetched with select)
  utterances?: Utterance[];
  tags?: Tag[];
}

export interface Utterance {
  id: string;
  transcript_id: string;
  speaker_label: string;
  text: string;
  start_time?: number;
  end_time?: number;
  confidence?: number;
  order_index: number;
  created_at: string;
}

export interface Tag {
  id: string;
  user_id: string;
  name: string;
  color: string;
  created_at: string;
}

export interface TranscriptTag {
  transcript_id: string;
  tag_id: string;
}

// ─── API request / response shapes ───────────────────────────────────────────

export interface TranscriptWithTags extends Transcript {
  transcript_tags: { tags: Tag }[];
}

export interface TranscriptSearchQuery {
  query?: string;
  tag_ids?: string[];
  date_from?: string;
  date_to?: string;
  page?: number;
  page_size?: number;
}

export interface AudioRecording {
  uri: string;
  duration: number;
  size: number;
  mimeType: string;
}
