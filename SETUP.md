# Detailed Setup Guide

## Step-by-Step Setup Instructions

### 1. Supabase Setup (15 minutes)

#### Create Project
1. Go to [supabase.com](https://supabase.com)
2. Click "New Project"
3. Fill in:
   - Name: `meeting-transcript-app`
   - Database Password: (save this!)
   - Region: Choose closest to you
4. Wait for project to initialize

#### Run Database Schema
1. In Supabase Dashboard, go to "SQL Editor"
2. Click "New Query"
3. Open `supabase/schema.sql` from this project
4. Copy all content and paste into SQL Editor
5. Click "Run" (wait for success message)

#### Get API Credentials
1. Go to "Settings" > "API"
2. Copy these values:
   - **Project URL**: `https://xxxxx.supabase.co`
   - **anon/public key**: `eyJh...` (public)
   - **service_role key**: `eyJh...` (secret - keep safe!)

#### Enable Storage
1. Go to "Storage" in dashboard
2. Verify "audio-files" bucket was created
3. If not, create it manually:
   - Click "New Bucket"
   - Name: `audio-files`
   - Public: Yes

### 2. OpenAI Setup (5 minutes)

1. Go to [platform.openai.com](https://platform.openai.com)
2. Sign up or log in
3. Go to "API Keys"
4. Click "Create new secret key"
5. Copy key (starts with `sk-...`)
6. Add billing method if you haven't already

### 3. Backend Setup

#### Install Dependencies
```bash
cd meeting-transcript-mcp/apps/backend
npm install
```

#### Configure Environment
```bash
cp .env.example .env
```

Edit `.env` file:
```bash
PORT=3000
NODE_ENV=development

# From Supabase Dashboard
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# From OpenAI
OPENAI_API_KEY=sk-your-openai-key-here

# Storage
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=104857600
```

#### Start Backend
```bash
npm run dev
```

You should see:
```
🚀 Backend server running on http://localhost:3000
📝 Environment: development
```

Test it:
```bash
curl http://localhost:3000/health
```

Should return:
```json
{"status":"ok","timestamp":"2024-..."}
```

### 4. Mobile App Setup

#### Install Dependencies
```bash
cd meeting-transcript-mcp/apps/mobile
npm install
```

#### Configure Environment
```bash
cp .env.example .env
```

Edit `.env` file:
```bash
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
EXPO_PUBLIC_API_URL=http://localhost:3000
```

**Note for physical devices**: Replace `localhost` with your computer's IP:
```bash
# On Windows
ipconfig
# Look for IPv4 Address

# On Mac/Linux
ifconfig | grep "inet "
```

Then use:
```bash
EXPO_PUBLIC_API_URL=http://192.168.1.x:3000
```

#### Start Mobile App
```bash
npm start
```

This opens Expo Dev Tools. Choose:
- Press `w` for web
- Press `a` for Android (requires Android Studio)
- Press `i` for iOS (requires Xcode, Mac only)
- Scan QR code with Expo Go app

### 5. MCP Server Setup

#### Install Dependencies
```bash
cd meeting-transcript-mcp/apps/mcp-server
npm install
```

#### Configure Environment
```bash
cp .env.example .env
```

Edit `.env`:
```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

MCP_SERVER_NAME=meeting-transcript-server
MCP_SERVER_VERSION=1.0.0
```

#### Build MCP Server
```bash
npm run build
```

#### Configure in Kiro

Edit your MCP config file (`.kiro/settings/mcp.json` or `~/.kiro/settings/mcp.json`):

```json
{
  "mcpServers": {
    "meeting-transcript": {
      "command": "node",
      "args": [
        "Z:\\Work\\Kiro\\meeting-transcript-mcp\\apps\\mcp-server\\dist\\index.js"
      ],
      "env": {
        "SUPABASE_URL": "https://your-project.supabase.co",
        "SUPABASE_SERVICE_ROLE_KEY": "your-service-role-key"
      },
      "disabled": false
    }
  }
}
```

**Important**: Use absolute paths and adjust for your system.

#### Restart Kiro
Close and reopen Kiro to load the MCP server.

#### Test MCP Server

In Kiro chat:
```
Get my latest meeting transcript
```

Claude should respond using the MCP tool.

### 6. Testing the Complete Flow

#### Create an Account
1. Open mobile app
2. Click "Sign up"
3. Enter email and password
4. Check email for verification
5. Click verification link
6. Sign in to app

#### Record a Transcript
1. Go to "Record" tab
2. Enter title: "Test Meeting"
3. Enter tags: "test, demo"
4. Tap microphone to record
5. Speak for 10-15 seconds
6. Tap stop
7. Wait for upload and transcription

#### View in App
1. Go to "Transcripts" tab
2. Pull down to refresh
3. Tap on your transcript
4. View full transcription

#### Access via Claude
1. In Kiro, start new chat
2. Say: "Show me my latest transcript"
3. Claude will use MCP to fetch it
4. Ask: "What was discussed in this meeting?"
5. Claude will analyze the transcript

## Troubleshooting

### Backend Won't Start
- Check Node.js version: `node --version` (need 18+)
- Verify all env vars are set
- Check Supabase credentials
- Try deleting `node_modules` and reinstalling

### Mobile App Errors
- Clear Expo cache: `npx expo start -c`
- Check API_URL points to correct IP
- Ensure backend is running
- Check network connectivity

### Transcription Fails
- Verify OpenAI API key is valid
- Check API quota/billing
- Ensure audio file is valid format
- Check backend logs for errors

### MCP Not Working
- Verify absolute path in config
- Check env vars in MCP config
- Restart Kiro after config changes
- Check Kiro logs for MCP errors
- Ensure Supabase service key is correct

### Database Errors
- Verify schema was run completely
- Check RLS policies are enabled
- Ensure storage bucket exists
- Test database connection

## Next Steps

1. Add your first real meeting transcript
2. Tag it with your project name
3. Ask Claude to analyze it
4. Try searching old transcripts
5. Experiment with speaker detection
6. Set up team sharing (future feature)

## Getting Help

- Check GitHub Issues
- Review error logs
- Test each component separately
- Verify all credentials
- Try with sample data first
