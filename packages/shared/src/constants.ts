export const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100 MB

export const ALLOWED_AUDIO_MIMES = [
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/mp4',
  'audio/m4a',
  'audio/x-m4a',       // iOS often reports .m4a with this MIME type
  'audio/aac',
  'audio/webm',
  'audio/ogg',
  'application/octet-stream', // fallback when MIME detection fails
] as const;

export const ALLOWED_AUDIO_EXTENSIONS = ['.mp3', '.wav', '.m4a', '.mp4', '.webm', '.ogg'] as const;

export const SUPABASE_STORAGE_BUCKET = 'audio-files';

export const TRANSCRIPT_STATUS = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
} as const;

export const MCP_SERVER_NAME = 'meeting-transcript-server';
export const MCP_SERVER_VERSION = '1.0.0';
