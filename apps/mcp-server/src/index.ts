#!/usr/bin/env node
/**
 * Meeting Transcript MCP Server — Streamable HTTP transport with API key auth
 *
 * Transport: Streamable HTTP on PORT 3001 (MCP SDK v1.x)
 * Endpoint:  POST /mcp  (Kiro connects here)
 *
 * Authentication:
 *  Authorization: Bearer <api_key>
 *  Key is SHA-256 hashed, looked up in api_keys table, user_id derived server-side.
 */

import express, { Request, Response } from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createClient } from '@supabase/supabase-js';
import { createHash } from 'crypto';
import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

// ─── Env ──────────────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('[MCP] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const PORT = process.env.PORT ?? '3001';

const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ─── API key auth ─────────────────────────────────────────────────────────────

async function resolveUserFromApiKey(rawKey: string): Promise<string | null> {
  const keyHash = createHash('sha256').update(rawKey).digest('hex');
  const { data, error } = await serviceClient
    .from('api_keys')
    .select('id, user_id')
    .eq('key_hash', keyHash)
    .limit(1)
    .single();

  if (error || !data) return null;

  // Fire-and-forget last_used_at update
  serviceClient
    .from('api_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', data.id)
    .then(() => {});

  return data.user_id as string;
}

// ─── DB helpers ───────────────────────────────────────────────────────────────

const FULL_SELECT = `
  id, title, full_text, summary, duration_seconds, speaker_count,
  source, status, created_at,
  utterances ( speaker_label, text, start_time, end_time, order_index ),
  transcript_tags ( tags ( id, name, color ) )
`;

function fmtTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

function formatTranscript(t: any): string {
  const date = new Date(t.created_at).toLocaleString();
  const tags: string[] = (t.transcript_tags ?? []).map((tt: any) => tt.tags?.name).filter(Boolean);
  const utterances: any[] = [...(t.utterances ?? [])].sort(
    (a: any, b: any) => (a.order_index ?? 0) - (b.order_index ?? 0)
  );

  let out = `## ${t.title}\n`;
  out += `**Date:** ${date}\n`;
  out += `**Duration:** ${t.duration_seconds ? Math.round(t.duration_seconds) + 's' : 'unknown'}\n`;
  out += `**Speakers:** ${t.speaker_count}\n`;
  out += `**Tags:** ${tags.length ? tags.join(', ') : 'none'}\n`;
  out += `**ID:** ${t.id}\n`;

  if (t.summary) out += `\n### Summary\n${t.summary}\n`;

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

// ─── MCP server factory ───────────────────────────────────────────────────────

function createMcpServer(userId: string): McpServer {
  const server = new McpServer({
    name: 'meeting-transcript-server',
    version: '1.0.0',
  });

  server.tool(
    'get_latest_transcript',
    'Returns the most recent completed meeting transcript for the authenticated user, with full speaker breakdown and timestamps.',
    {},
    async () => {
      const { data, error } = await serviceClient
        .from('transcripts')
        .select(FULL_SELECT)
        .eq('user_id', userId)
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error || !data) return { content: [{ type: 'text', text: 'No completed transcripts found.' }] };
      return { content: [{ type: 'text', text: formatTranscript(data) }] };
    }
  );

  server.tool(
    'search_transcripts',
    'Search meeting transcripts by keyword, tag name, or date range.',
    {
      query: z.string().optional().describe('Keyword to search in title and text'),
      tag_names: z.array(z.string()).optional().describe('Filter by tag names'),
      date_from: z.string().optional().describe('ISO 8601 start date'),
      date_to: z.string().optional().describe('ISO 8601 end date'),
      limit: z.number().optional().describe('Max results (default 10)'),
    },
    async ({ query, tag_names, date_from, date_to, limit = 10 }) => {
      let q = serviceClient
        .from('transcripts')
        .select(FULL_SELECT)
        .eq('user_id', userId)
        .eq('status', 'completed');

      if (query) q = q.or(`title.ilike.%${query}%,full_text.ilike.%${query}%`);
      if (date_from) q = q.gte('created_at', date_from);
      if (date_to) q = q.lte('created_at', date_to);

      let { data, error } = await q.order('created_at', { ascending: false }).limit(limit);
      if (error) throw error;
      if (!data || data.length === 0) return { content: [{ type: 'text', text: 'No transcripts match your search.' }] };

      if (tag_names?.length) {
        const lower = tag_names.map(t => t.toLowerCase());
        data = data.filter((t: any) => {
          const names = (t.transcript_tags ?? []).map((tt: any) => tt.tags?.name?.toLowerCase()).filter(Boolean);
          return lower.some(lt => names.includes(lt));
        });
      }

      if (data.length === 0) return { content: [{ type: 'text', text: 'No transcripts match your search.' }] };
      const text = data.map(formatTranscript).join('\n\n---\n\n');
      return { content: [{ type: 'text', text: `Found ${data.length} transcript(s):\n\n${text}` }] };
    }
  );

  server.tool(
    'get_transcript_by_id',
    'Fetch a specific transcript by UUID. Only returns it if it belongs to the authenticated user.',
    { transcript_id: z.string().describe('Transcript UUID') },
    async ({ transcript_id }) => {
      const { data, error } = await serviceClient
        .from('transcripts')
        .select(FULL_SELECT)
        .eq('id', transcript_id)
        .eq('user_id', userId)
        .single();

      if (error || !data) return { content: [{ type: 'text', text: 'Transcript not found.' }] };
      return { content: [{ type: 'text', text: formatTranscript(data) }] };
    }
  );

  server.tool(
    'list_tags',
    'List all project/topic tags created by the authenticated user.',
    {},
    async () => {
      const { data, error } = await serviceClient
        .from('tags')
        .select('id, name, color')
        .eq('user_id', userId)
        .order('name');

      if (error) throw error;
      if (!data || data.length === 0) return { content: [{ type: 'text', text: 'No tags found.' }] };
      const list = data.map((t: any) => `- **${t.name}** (${t.color})  id: \`${t.id}\``).join('\n');
      return { content: [{ type: 'text', text: `Your tags:\n${list}` }] };
    }
  );

  return server;
}

// ─── Express app ──────────────────────────────────────────────────────────────

const app = express();
app.use(express.json());

app.use((_req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Mcp-Session-Id');
  if (_req.method === 'OPTIONS') { res.sendStatus(204); return; }
  next();
});

// ── POST /mcp — Streamable HTTP endpoint ─────────────────────────────────────
app.post('/mcp', async (req: Request, res: Response) => {
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

  const server = createMcpServer(userId);
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // stateless mode
  });

  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
});

// ── GET /health ───────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.error(`[MCP] Streamable HTTP server running on port ${PORT}`);
});
