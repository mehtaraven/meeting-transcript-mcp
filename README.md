# Meeting Transcript MCP App

A comprehensive meeting transcription application with MCP (Model Context Protocol) integration for Claude AI. Record or upload conversations, get AI-powered transcriptions with speaker diarization, and seamlessly access your meeting context from Claude AI.

## Features

- 🎙️ **Audio Recording**: Record meetings directly in the app
- 📤 **File Upload**: Upload existing audio files
- 🤖 **AI Transcription**: OpenAI Whisper-powered transcription
- 👥 **Speaker Diarization**: Identify multiple speakers
- 🏷️ **Project Tagging**: Organize transcripts by project
- 🔍 **Smart Search**: Full-text search across all transcripts
- 🔌 **MCP Integration**: Expose transcripts to Claude AI
- 📱 **Cross-Platform**: iOS, Android, and Web support

## Project Structure

```
meeting-transcript-mcp/
├── apps/
│   ├── backend/          # Node.js API server
│   ├── mobile/           # React Native (Expo) app
│   └── mcp-server/       # MCP server for Claude integration
├── packages/
│   └── shared/           # Shared types and utilities
└── supabase/            # Database schema and migrations
```

## Tech Stack

- **Frontend**: React Native with Expo
- **Backend**: Node.js + Express + TypeScript
- **Database**: Supabase (PostgreSQL)
- **Transcription**: OpenAI Whisper API
- **MCP**: Model Context Protocol SDK
- **Storage**: Supabase Storage

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Supabase account
- OpenAI API key
- Expo CLI (for mobile development)

### 1. Clone and Install

```bash
cd meeting-transcript-mcp
npm install
```

### 2. Set up Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Run the database schema:
   - Go to SQL Editor in Supabase dashboard
   - Copy and run `supabase/schema.sql`
3. Get your credentials:
   - Project URL
   - Anon/Public key
   - Service Role key (keep this secret!)

### 3. Configure Environment Variables

**Backend** (`apps/backend/.env`):
```bash
cp apps/backend/.env.example apps/backend/.env
# Edit and add your credentials
```

**Mobile** (`apps/mobile/.env`):
```bash
cp apps/mobile/.env.example apps/mobile/.env
# Edit and add your credentials
```

**MCP Server** (`apps/mcp-server/.env`):
```bash
cp apps/mcp-server/.env.example apps/mcp-server/.env
# Edit and add your credentials
```

### 4. Start Development

**Backend Server**:
```bash
npm run dev:backend
```

**Mobile App**:
```bash
npm run dev:mobile
```

**MCP Server**:
```bash
npm run dev:mcp
```

## MCP Integration with Claude

### Setup MCP Server

1. Build the MCP server:
```bash
cd apps/mcp-server
npm run build
```

2. Configure Claude to use the MCP server.

Add to your MCP settings (`.kiro/settings/mcp.json` or `~/.kiro/settings/mcp.json`):

```json
{
  "mcpServers": {
    "meeting-transcript": {
      "command": "node",
      "args": [
        "z:\\Work\\Kiro\\meeting-transcript-mcp\\apps\\mcp-server\\dist\\index.js"
      ],
      "env": {
        "SUPABASE_URL": "your-supabase-url",
        "SUPABASE_SERVICE_ROLE_KEY": "your-service-role-key"
      }
    }
  }
}
```

3. Restart Claude/Kiro to load the MCP server

### Using MCP Tools in Claude

Once configured, Claude can access these tools:

**Get Latest Transcript**:
```
Get my most recent meeting transcript
```

**Search Transcripts**:
```
Search my transcripts for "project alpha" discussions from last week
```

**Get Specific Transcript**:
```
Get transcript details for ID: abc-123
```

## API Documentation

### Backend Endpoints

#### Authentication
All endpoints require Bearer token authentication.

#### Transcripts

**GET** `/api/transcripts`
- Get all transcripts for user
- Query params: `page`, `page_size`

**GET** `/api/transcripts/:id`
- Get specific transcript

**POST** `/api/transcripts/upload`
- Upload audio file and create transcript
- Form data: `audio_file`, `title`, `project_tags`

**POST** `/api/transcripts/search`
- Search transcripts
- Body: `query`, `project_tags`, `date_from`, `date_to`, `page`, `page_size`

**PUT** `/api/transcripts/:id`
- Update transcript

**DELETE** `/api/transcripts/:id`
- Delete transcript

## Development

### Build All Packages

```bash
npm run build
```

### Clean All

```bash
npm run clean
```

## Deployment

### Backend

Deploy to any Node.js hosting:
- Heroku
- Railway
- Render
- DigitalOcean App Platform

### Mobile App

Build with EAS:
```bash
cd apps/mobile
npm run build:android
npm run build:ios
```

### MCP Server

The MCP server runs locally on the user's machine. Distribute the built package.

## Use Cases

1. **Development Meetings**: Record team standups and let Claude understand project context
2. **Client Calls**: Transcribe client discussions for AI-assisted follow-up
3. **Brainstorming Sessions**: Capture ideas and let AI help structure them
4. **Code Reviews**: Record review discussions for future reference
5. **Interview Notes**: Transcribe technical interviews with searchable history

## Roadmap

- [ ] Real-time transcription during recording
- [ ] Action items extraction
- [ ] Meeting summaries
- [ ] Calendar integration
- [ ] Team collaboration features
- [ ] Custom vocabulary for better accuracy
- [ ] Export to PDF/DOCX
- [ ] Meeting analytics

## License

MIT

## Support

For issues and questions, please open an issue on GitHub.
