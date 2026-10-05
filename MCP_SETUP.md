# MCP Server Setup

## What changed

The old setup required you to build a local binary, set Supabase credentials in environment variables, and pass your user ID with every tool call. That's all gone. The MCP server now runs as a hosted HTTP service. You connect to it with a personal API key — one short line in your MCP config, no credentials, no user IDs.

---

## Available tools

| Tool | Description |
|------|-------------|
| `get_latest_transcript` | Fetch your most recent completed transcript with full speaker breakdown |
| `search_transcripts` | Search by keyword, tag name, or date range |
| `get_transcript_by_id` | Fetch a specific transcript by UUID |
| `list_tags` | List all your project/topic tags |

All tools are scoped to your account automatically via your API key. The `user_token` parameter has been removed — you no longer pass any identity info in tool calls.

---

## Step 1 — Get your API key

1. Open the mobile app
2. Go to the **Profile** tab
3. Tap **MCP Integration**
4. Tap **Generate New API Key**
5. Copy the key — it is shown **once only** and cannot be retrieved again

Keep this key private. Anyone with the key can read your transcripts.

---

## Step 2 — Add to your MCP client config

Open your Kiro MCP config at `C:\Users\<you>\.kiro\settings\mcp.json` and add the `meeting-transcript` entry:

```json
{
  "mcpServers": {
    "meeting-transcript": {
      "url": "http://localhost:3001/sse",
      "headers": {
        "Authorization": "Bearer <your_api_key>"
      }
    }
  }
}
```

Replace `<your_api_key>` with the key you copied in Step 1.

> For a deployed/hosted server, replace `http://localhost:3001/sse` with your server's URL. The config shape stays the same.

---

## Step 3 — Reload MCP in Kiro

Open the Command Palette (`Ctrl+Shift+P`) and run:

```
MCP: Restart All Servers
```

The `meeting-transcript` server should appear in the MCP Servers panel as connected.

---

## Step 4 — Test it in chat

Try these prompts — no user ID needed:

```
Get my latest meeting transcript
```

```
Search my transcripts for anything about project alpha
```

```
List my tags
```

---

## Security

- API keys are hashed with **SHA-256** before being stored in the database. The plaintext key is never saved.
- Each key is scoped to your account only — one key cannot access another user's data.
- Revoke any key at any time from the **Profile** screen in the mobile app.
- Treat your key like a password. If it leaks, revoke it immediately and generate a new one.
