import { supabase } from '../config/supabase';
import fs from 'fs/promises';
import path from 'path';
import { SUPABASE_STORAGE_BUCKET } from '@meeting-transcript/shared';

/**
 * Upload a local audio file into Supabase Storage under {userId}/{fileName}.
 * Returns a signed URL valid for 1 year (bucket is private).
 */
export async function uploadAudioFile(
  localPath: string,
  fileName: string,
  userId: string
): Promise<string> {
  const fileBuffer = await fs.readFile(localPath);
  const storagePath = `${userId}/${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from(SUPABASE_STORAGE_BUCKET)
    .upload(storagePath, fileBuffer, {
      contentType: getContentType(fileName),
      upsert: false,
    });

  if (uploadError) {
    throw new Error(`Storage upload failed: ${uploadError.message}`);
  }

  // Signed URL valid for 1 year
  const { data: signedData, error: signError } = await supabase.storage
    .from(SUPABASE_STORAGE_BUCKET)
    .createSignedUrl(storagePath, 60 * 60 * 24 * 365);

  if (signError || !signedData) {
    throw new Error(`Failed to create signed URL: ${signError?.message}`);
  }

  return signedData.signedUrl;
}

/**
 * Delete an audio file from storage given its full storage path.
 */
export async function deleteAudioFile(storagePath: string): Promise<void> {
  const { error } = await supabase.storage
    .from(SUPABASE_STORAGE_BUCKET)
    .remove([storagePath]);

  if (error) {
    console.error(`Failed to delete audio file ${storagePath}:`, error.message);
  }
}

function getContentType(fileName: string): string {
  const ext = path.extname(fileName).toLowerCase();
  const map: Record<string, string> = {
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.m4a': 'audio/mp4',
    '.mp4': 'audio/mp4',
    '.webm': 'audio/webm',
    '.ogg': 'audio/ogg',
  };
  return map[ext] ?? 'application/octet-stream';
}
