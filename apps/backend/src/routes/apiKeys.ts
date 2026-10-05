import express from 'express';
import { authenticateUser, AuthenticatedRequest } from '../middleware/auth';
import { generateApiKey, ApiKeyRecord } from '../services/apiKeyService';
import { supabase } from '../config/supabase';

const router = express.Router();

// ─── POST /api/keys ───────────────────────────────────────────────────────────

/** Generate a new API key for the authenticated user. Returns the plaintext key once. */
router.post('/', authenticateUser, async (req: AuthenticatedRequest, res, next) => {
  try {
    const name: string = req.body.name || 'My API Key';
    const { key, record } = await generateApiKey(req.user!.id, name);
    res.status(201).json({ key, record });
  } catch (err) { next(err); }
});

// ─── GET /api/keys ────────────────────────────────────────────────────────────

/** List all API keys for the authenticated user. key_hash is never returned. */
router.get('/', authenticateUser, async (req: AuthenticatedRequest, res, next) => {
  try {
    const { data, error } = await supabase
      .from('api_keys')
      .select('id, user_id, key_prefix, name, created_at, last_used_at')
      .eq('user_id', req.user!.id)
      .order('created_at', { ascending: false });

    if (error) throw new Error(`Failed to fetch API keys: ${error.message}`);

    res.json({ keys: (data ?? []) as ApiKeyRecord[] });
  } catch (err) { next(err); }
});

// ─── DELETE /api/keys/:id ─────────────────────────────────────────────────────

/** Delete an API key by ID — only the owner may delete their own key. */
router.delete('/:id', authenticateUser, async (req: AuthenticatedRequest, res, next) => {
  try {
    const { data, error } = await supabase
      .from('api_keys')
      .delete()
      .eq('id', req.params.id)
      .eq('user_id', req.user!.id)
      .select('id')
      .single();

    if (error || !data) {
      return res.status(404).json({ error: 'API key not found' });
    }

    res.status(204).send();
  } catch (err) { next(err); }
});

export default router;
