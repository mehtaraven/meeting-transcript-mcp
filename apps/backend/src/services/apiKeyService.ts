import { randomBytes, createHash } from 'crypto';
import { supabase } from '../config/supabase';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ApiKeyRecord {
  id: string;
  user_id: string;
  key_prefix: string;
  name: string;
  created_at: string;
  last_used_at: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** SHA-256 hash of the raw key string (hex-encoded). Never stored in plaintext. */
function hashKey(rawKey: string): string {
  return createHash('sha256').update(rawKey).digest('hex');
}

// ─── generateApiKey ───────────────────────────────────────────────────────────

/**
 * Generates a new API key for the given user.
 * The plaintext key is returned ONCE and never stored — only its SHA-256 hash
 * is persisted in the database.
 *
 * Key format:  mtk_<64 hex chars>   (prefix 'mtk_' + 32 random bytes as hex)
 * key_prefix stored in DB: first 8 chars of the full key string (i.e. 'mtk_XXXX')
 */
export async function generateApiKey(
  userId: string,
  name: string
): Promise<{ key: string; record: ApiKeyRecord }> {
  const rawKey = 'mtk_' + randomBytes(32).toString('hex');
  const keyHash = hashKey(rawKey);
  const keyPrefix = rawKey.substring(0, 8); // 'mtk_' + first 4 hex chars

  const { data, error } = await supabase
    .from('api_keys')
    .insert({
      user_id: userId,
      key_hash: keyHash,
      key_prefix: keyPrefix,
      name,
    })
    .select('id, user_id, key_prefix, name, created_at, last_used_at')
    .single();

  if (error || !data) {
    throw new Error(`Failed to create API key: ${error?.message}`);
  }

  return { key: rawKey, record: data as ApiKeyRecord };
}

// ─── validateApiKey ───────────────────────────────────────────────────────────

/**
 * Validates a raw API key submitted by an MCP client.
 * Hashes the key, looks it up in the DB, updates last_used_at on success,
 * and returns the owning userId — or null if the key is invalid.
 */
export async function validateApiKey(rawKey: string): Promise<{ userId: string } | null> {
  const keyHash = hashKey(rawKey);

  const { data, error } = await supabase
    .from('api_keys')
    .select('id, user_id')
    .eq('key_hash', keyHash)
    .limit(1)
    .single();

  if (error || !data) {
    return null;
  }

  // Update last_used_at asynchronously — don't block the response
  supabase
    .from('api_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', data.id)
    .then(({ error: updateErr }) => {
      if (updateErr) {
        console.error('Failed to update last_used_at:', updateErr.message);
      }
    });

  return { userId: data.user_id };
}
