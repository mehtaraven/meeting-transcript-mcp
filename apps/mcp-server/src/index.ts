#!/usr/bin/env node
/**
 * Meeting Transcript MCP Server — HTTP + SSE transport with API key auth
 *
 * Transport: HTTP SSE on PORT 3001 (configurable via PORT env var)
 *
 * Authentication:
 *  All connections require an API key passed as:
 *    Authorization: Bearer <api_key>
 *  The server SHA-256 hashes the raw key, looks it up in the api_keys table
 *  using the Supabase service role client, and derives the user_id server-side.
 *  A user can only ever access their own data — the user_id comes from the
 *  verified key record, not from any client-supplied argument.
 *
 * Tools:
 *  - get_latest_transcript   Latest transcript with utterance breakdown
 *  - search_transcripts      Full-text + tag + date search
 *  - get_transcript_by_id    Single transcript by UUID
 *  - list_tags               All tags for a user
 */

import express from 'express';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { createClient } from '@supabase/supabase-js';
import { createHash } from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

// ─── Env validation ───────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('[MCP] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const PORT = process.env.PORT ?? '3001';

// Service client — used to validate API keys and query data scoped to the verified user
const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ─── API key auth helper ──────────────────────────────────────────────────────

/**
 * Hashes the raw API key, looks it up in api_keys, updates last_used_at,
 * and returns the owning user_id. Returns null if the key is not found.
 */
async function resolveUserFromApiKey(rawKey: string): Promise<string | null> {
  const keyHash = createHash('sha256').update(rawKey).digest('hex');

  const { data, error } = await serviceClient
    .from('api_keys')
    .select('id, user_id')
    .eq('key_hash', keyHash)
    .limit(1)
    .single();

  if (error || !data) {
    return null;
  }

  // Update last_used_at — fire and forget, don't block the connection
  serviceClient
    .from('api_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', data.id)
    .then(() => {/* no-op */});

  return data.user_id as string;
}

// ─── DB select string ─────────────────────────────────────────────────────────

const FULL_SELECT = `
  id, title, full_text, summary, duration_seconds, speaker_count,
  source, status, created_at,
  utterances ( speaker_label, text, start_time, end_time, order_index ),
  transcript_tags ( tags ( id, name, color ) )
`;

// ─── Format for Claude ────────────────────────────────────────────────────────

function fmtTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

function formatTranscript(t: any): string {
  const date = new Date(t.created_at).toLocaleString();
  const tags: string[] = (t.transcript_tags ?? [])
    .map((tt: any) => tt.tags?.name)
    .filter(Boolean);

  const utterances: any[] = [...(t.utterances ?? [])].sort(
    (a: any, b: any) => (a.order_index ?? 0) - (b.order_index ?? 0)
  );

  let out = `## ${t.title}\n`;
  out += `**Date:** ${date}\n`;
  out += `**Duration:** ${t.duration_seconds ? Math.round(t.duration_seconds) + 's' : 'unknown'}\n`;
  out += `**Speakers:** ${t.speaker_count}\n`;
  out += `**Tags:** ${tags.length ? tags.join(', ') : 'none'}\n`;
  out += `**ID:** ${t.id}\n`;

  if (t.summary) {
    out += `\n### Summary\n${t.summary}\n`;
  }

  if (utterances.length > 0) {
    out += `\n### Conversation\n`;
    utterances.forEach((u: any) => {
      const time = u.start_time != null ? `[${fmtTime(u.start_time)}] ` : '';
      out += `**${u.speaker_label}:** ${time}${u.text}\n\n`;
    });
  } else if (t.full_text) {
    out += `\n### Transcript\n${t.full_text}\n`;
  }

  return out;
}

// ─── Tool registration helper ─────────────────────────────────────────────────

/**
 * Registers all 4 MCP tools on a Server instance.
 * userId is captured in the closure — it comes from the validated API key,
 * not from any tool argument, so callers can never access another user's data.
 */
function registerTools(server: Server, userId: string): void {
  // ── List tools ──────────────────────────────────────────────────────────────
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: 'get_latest_transcript',
        description:
          'Returns the most recent completed meeting transcript for the authenticated user, ' +
          'with the full conversation broken down by speaker and timestamps.',
        inputSchema: {
          type: 'object' as const,
          properties: {},
          required: [],
        },
      },
      {
        name: 'search_transcripts',
        description:
          'Search all meeting transcripts for the authenticated user by keyword, tag name, or date range.',
        inputSchema: {
          type: 'object' as const,
          properties: {
            query: { type: 'string', description: 'Keyword to search for in title and text' },
            tag_names: {
              type: 'array',
              items: { type: 'string' },
              description: 'Filter by tag names e.g. ["project-alpha"]',
            },
            date_from: { type: 'string', description: 'ISO 8601 start date' },
            date_to: { type: 'string', description: 'ISO 8601 end date' },
            limit: { type: 'number', description: 'Max results (default 10)' },
          },
          required: [],
        },
      },
      {
        name: 'get_transcript_by_id',
        description:
          'Fetch one specific transcript by UUID. Only returns it if it belongs to the authenticated user.',
        inputSchema: {
          type: 'object' as const,
          properties: {
            transcript_id: { type: 'string', description: 'Transcript UUID' },
          },
          required: ['transcript_id'],
        },
      },
      {
        name: 'list_tags',
        description: 'List all project/topic tags created by the authenticated user.',
        inputSchema: {
          type: 'object' as const,
          properties: {},
          required: [],
        },
      },
    ],
  }));

  // ── Call tools ──────────────────────────────────────────────────────────────
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      if (name === 'get_latest_transcript') {
        const { data, error } = await serviceClient
          .from('transcripts')
          .select(FULL_SELECT)
          .eq('user_id', userId)
          .eq('status', 'completed')
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (error || !data) {
          return { content: [{ type: 'text', text: 'No completed transcripts found.' }] };
        }
        return { content: [{ type: 'text', text: formatTranscript(data) }] };
      }

      if (name === 'search_transcripts') {
        const { query, tag_names, date_from, date_to, limit = 10 } = (args ?? {}) as any;

        let q = serviceClient
          .from('transcripts')
          .select(FULL_SELECT)
          .eq('user_id', userId)
          .eq('status', 'completed');

        if (query) q = q.or(`title.ilike.%${query}%,full_text.ilike.%${query}%`);
        if (date_from) q = q.gte('created_at', date_from);
        if (date_to) q = q.lte('created_at', date_to);

        let { data, error } = await q
          .order('created_at', { ascending: false })
          .limit(limit);

        if (error) throw error;
        if (!data || data.length === 0) {
          return { content: [{ type: 'text', text: 'No transcripts match your search.' }] };
        }

        // Post-filter by tag names
        if (tag_names?.length > 0) {
          const lower = (tag_names as string[]).map((t: string) => t.toLowerCase());
          data = data.filter((t: any) => {
            const names = (t.transcript_tags ?? [])
              .map((tt: any) => tt.tags?.name?.toLowerCase())
              .filter(Boolean);
            return lower.some((lt: string) => names.includes(lt));
          });
        }

        if (data.length === 0) {
          return { content: [{ type: 'text', text: 'No transcripts match your search.' }] };
        }

        const text = data.map(formatTranscript).join('\n\n---\n\n');
        return { content: [{ type: 'text', text: `Found ${data.length} transcript(s):\n\n${text}` }] };
      }

      if (name === 'get_transcript_by_id') {
        const { transcript_id } = (args ?? {}) as { transcript_id: string };

        const { data, error } = await serviceClient
          .from('transcripts')
          .select(FULL_SELECT)
          .eq('id', transcript_id)
          .eq('user_id', userId) // enforces ownership — wrong user gets "not found"
          .single();

        if (error || !data) {
          return { content: [{ type: 'text', text: 'Transcript not found.' }] };
        }
        return { content: [{ type: 'text', text: formatTranscript(data) }] };
      }

      if (name === 'list_tags') {
        const { data, error } = await serviceClient
          .from('tags')
          .select('id, name, color')
          .eq('user_id', userId)
          .order('name');

        if (error) throw error;
        if (!data || data.length === 0) {
          return { content: [{ type: 'text', text: 'No tags found.' }] };
        }

        const list = data
          .map((t: any) => `- **${t.name}** (${t.color})  id: \`${t.id}\``)
          .join('\n');
        return { content: [{ type: 'text', text: `Your tags:\n${list}` }] };
      }

      throw new Error(`Unknown tool: ${name}`);
    } catch (err) {
      return {
        content: [{ type: 'text', text: `Error: ${(err as Error).message}` }],
        isError: true,
      };
    }
  });
}

// ─── Express app ──────────────────────────────────────────────────────────────

const app = express();
app.use(express.json());

// CORS — allow MCP clients (e.g. Kiro) to connect from any origin
app.use((_req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (_req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }
  next();
});

// Track active SSE transports by sessionId
const transports = new Map<string, SSEServerTransport>();

// ── GET /sse — establish SSE connection ───────────────────────────────────────
app.get('/sse', async (req, res) => {
  const authHeader = req.headers['authorization'];
  const rawKey = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!rawKey) {
    res.status(401).json({ error: 'Missing Authorization: Bearer <api_key> header' });
    return;
  }

  const userId = await resolveUserFromApiKey(rawKey);
  if (!userId) {
    res.status(401).json({ error: 'Invalid or revoked API key' });
    return;
  }

  // Create a new Server + transport per connection so each connection has its own
  // userId closure — one user's connection never leaks into another's.
  const transport = new SSEServerTransport('/message', res);
  const server = new Server(
    { name: 'meeting-transcript-server', version: '1.0.0' },
    { capabilities: { tools: {} } }
  );

  registerTools(server, userId);

  transports.set(transport.sessionId, transport);
  transport.onclose = () => {
    transports.delete(transport.sessionId);
  };

  await server.connect(transport);
});

// ── POST /message — receive client messages ───────────────────────────────────
app.post('/message', async (req, res) => {
  const sessionId = req.query['sessionId'] as string | undefined;
  if (!sessionId) {
    res.status(400).json({ error: 'Missing sessionId query parameter' });
    return;
  }

  const transport = transports.get(sessionId);
  if (!transport) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }

  await transport.handlePostMessage(req, res);
});

// ── GET /health ───────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// ─── Start ────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.error(`[MCP] HTTP server running on port ${PORT}`);
});
