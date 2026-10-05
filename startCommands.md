Backend (Express API):

powershell

cd z:\Work\Kiro\meeting-transcript-mcp
npm run dev:backend

MCP Server (HTTP, port 3001):

powershell

cd z:\Work\Kiro\meeting-transcript-mcp
npm run dev --workspace=apps/mcp-server

The MCP server starts on port 3001. Users connect to it via a URL in their MCP client config (see MCP_SETUP.md) — no local binary or rebuild required.

Mobile (Expo):

powershell

cd z:\Work\Kiro\meeting-transcript-mcp
npm run dev:mobile
