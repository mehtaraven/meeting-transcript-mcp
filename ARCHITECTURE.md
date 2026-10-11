# Architecture Overview

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                       User Devices                           │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                  │
│  │   iOS    │  │  Android │  │   Web    │                  │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘                  │
│       └─────────────┴──────────────┘                        │
│                      │                                       │
│              React Native App                                │
│                 (Expo)                                       │
└────────────────────┬────────────────────────────────────────┘
                     │
                     │ HTTPS
                     │
          ┌──────────▼──────────┐
          │  Backend API Server │
          │    (Node.js/Express)│
          │                     │
          │  - Authentication   │
          │  - File Upload      │
          │  - CRUD Operations  │
          └──────────┬──────────┘
                     │
        ┌────────────┼────────────┐
        │            │            │
        ▼            ▼            ▼
┌───────────┐ ┌────────────┐ ┌──────────┐
│  Supabase │ │  OpenAI    │ │ Supabase │
│  Database │ │  Whisper   │ │ Storage  │
│(PostgreSQL)│ │    API     │ │  Bucket  │
└───────────┘ └────────────┘ └──────────┘
        │
        │
        │
┌───────▼────────┐
│  MCP Server    │
│   (Node.js)    │
│                │
│ - Get Latest   │
│ - Search       │
│ - Get by ID    │
└───────┬────────┘
        │
        │ stdio
        │
┌───────▼────────┐
│  Claude AI     │
│  (via Kiro)    │
└────────────────┘
```

## Component Details

### Mobile App (React Native + Expo)

**Technology Stack:**
- React Native for cross-platform UI
- Expo for development workflow
- Expo Router for navigation
- Expo AV for audio recording
- Supabase JS client for auth & database

**Key Features:**
- Tab-based navigation (Transcripts, Record, Profile)
- Audio recording with expo-av
- File upload with document picker
- Real-time auth state management
- Offline-capable with local state

**File Structure:**
```
apps/mobile/
├── app/
│   ├── (auth)/          # Authentication screens
│   ├── (tabs)/          # Main app tabs
│   ├── transcript/      # Transcript detail
│   ├── _layout.tsx      # Root layout
│   └── index.tsx        # Entry point
├── contexts/            # React contexts
├── lib/                 # Utilities & config
└── app.json             # Expo config
```

### Backend API (Node.js + Express)

**Technology Stack:**
- Express for REST API
- TypeScript for type safety
- Multer for file uploads
- Supabase client for database & storage
- OpenAI SDK for Whisper API

**Key Features:**
- JWT authentication via Supabase
- Multipart file upload handling
- Background transcription processing
- Full-text search with PostgreSQL
- RESTful API design

**File Structure:**
```
apps/backend/
├── src/
│   ├── routes/          # API endpoints
│   ├── services/        # Business logic
│   ├── middleware/      # Auth, errors, etc.
│   ├── config/          # Configuration
│   ├── utils/           # Helper functions
│   └── index.ts         # Entry point
└── package.json
```

### MCP Server (Model Context Protocol)

**Technology Stack:**
- MCP SDK for protocol implementation
- Supabase client for data access
- stdio transport for Claude communication

**Key Features:**
- Three MCP tools exposed
- Direct database access
- Real-time transcript retrieval
- Search with filters

**File Structure:**
```
apps/mcp-server/
├── src/
│   └── index.ts         # MCP server implementation
├── package.json
└── tsconfig.json
```

### Shared Package

**Purpose:**
- Type definitions shared across all apps
- Constants and configuration
- Zod schemas for validation
- Reduces code duplication

**File Structure:**
```
packages/shared/
├── src/
│   ├── types.ts         # TypeScript interfaces
│   ├── schemas.ts       # Zod validation schemas
│   ├── constants.ts     # Shared constants
│   └── index.ts         # Exports
└── package.json
```

## Data Flow

### Recording & Transcription Flow

1. **User Records Audio** (Mobile App)
   - Request microphone permission
   - Start expo-av recording
   - Display recording timer
   - Stop recording on user tap

2. **Upload to Backend** (Mobile → Backend)
   - Convert recording to FormData
   - Include title and tags
   - Upload via multipart/form-data
   - Backend validates file type & size

3. **Process Audio** (Backend)
   - Save file to temp directory
   - Upload to Supabase Storage
   - Send to OpenAI Whisper API
   - Receive transcript with timestamps

4. **Speaker Diarization** (Backend)
   - Parse Whisper segments
   - Detect speaker changes (2+ sec pauses)
   - Group segments by speaker
   - Assign speaker labels

5. **Save to Database** (Backend → Supabase)
   - Insert transcript record
   - Include speaker data as JSONB
   - Delete temp file
   - Return success to mobile app

6. **Display Result** (Mobile App)
   - Refresh transcript list
   - Show success notification
   - Navigate to detail view

### MCP Query Flow

1. **Claude Receives User Request**
   - "Get my latest transcript"
   - Identifies need for MCP tool

2. **MCP Tool Invocation**
   - Claude calls `get_latest_transcript`
   - Passes user_id parameter
   - MCP server receives via stdio

3. **Database Query** (MCP → Supabase)
   - Query transcripts table
   - Filter by user_id
   - Order by created_at DESC
   - Limit 1

4. **Return to Claude**
   - Format as JSON
   - Include full transcript text
   - Include speaker breakdown
   - Return via MCP protocol

5. **Claude Processes Response**
   - Parse transcript content
   - Understand context
   - Generate helpful response

## Database Schema

### Transcripts Table

```sql
transcripts
├── id (UUID, PK)
├── user_id (UUID, FK → auth.users)
├── title (VARCHAR)
├── audio_file_url (TEXT)
├── audio_duration (NUMERIC)
├── transcript_text (TEXT)
├── speakers (JSONB)
├── project_tags (TEXT[])
├── created_at (TIMESTAMP)
└── updated_at (TIMESTAMP)
```

**Indexes:**
- `idx_transcripts_user_id` - Fast user lookups
- `idx_transcripts_created_at` - Chronological queries
- `idx_transcripts_project_tags` - GIN index for array searches
- `idx_transcripts_text_search` - Full-text search (GIN)

**RLS Policies:**
- Users can only SELECT their own transcripts
- Users can only INSERT with their user_id
- Users can only UPDATE their own transcripts
- Users can only DELETE their own transcripts

### Storage Buckets

**audio-files:**
- Public access for read
- User-scoped write permissions
- Folder structure: `{user_id}/{filename}`
- Supports: mp3, wav, m4a, mp4, webm

## Security Considerations

### Authentication
- Supabase Auth handles user management
- JWT tokens for API authentication
- Row Level Security in database
- Service role key only in backend & MCP

### File Upload
- File type validation (MIME type check)
- File size limits (100MB default)
- Virus scanning recommended for production
- Temporary file cleanup

### API Security
- CORS configured for mobile app
- Rate limiting recommended
- Input validation with Zod schemas
- SQL injection protection via Supabase client

### MCP Security
- Runs locally on user machine
- Direct database access (read-only)
- No network exposure
- User-scoped queries only

## Scalability Considerations

### Current Architecture
- Synchronous transcription (blocking)
- Single server deployment
- Direct file uploads

### Production Recommendations

**Async Processing:**
- Use message queue (Bull, BullMQ)
- Background workers for transcription
- Webhook notifications when complete

**Storage:**
- CDN for audio file delivery
- Separate transcription worker nodes
- Database read replicas for MCP

**Caching:**
- Redis for frequently accessed transcripts
- Client-side caching in mobile app
- API response caching

**Monitoring:**
- Error tracking (Sentry)
- Performance monitoring (New Relic)
- Logging (Winston, Pino)
- Analytics (Mixpanel, Amplitude)

## Deployment Architecture

### Recommended Setup

**Backend:**
- Deploy to Railway, Render, or Heroku
- Environment variables for secrets
- Automatic deployments from Git

**Database:**
- Supabase handles hosting
- Automatic backups enabled
- Connection pooling configured

**Mobile:**
- Build with EAS (Expo Application Services)
- Submit to App Store / Play Store
- OTA updates for quick fixes

**MCP:**
- Distributed as npm package
- User installs locally
- Auto-updates via npm

## Future Enhancements

**Real-time Transcription:**
- WebSocket connection
- Streaming audio to backend
- Live transcript updates

**Improved Diarization:**
- Use AssemblyAI or similar
- Speaker identification by voice
- Custom speaker labels

**Team Features:**
- Shared transcripts
- Commenting system
- Access control

**Integration:**
- Calendar sync (Google, Outlook)
- Slack notifications
- Export to various formats
