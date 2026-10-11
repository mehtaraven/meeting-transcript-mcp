# Quick Start Guide

Get up and running in 30 minutes!

## Prerequisites Checklist

- [ ] Node.js 18+ installed
- [ ] npm or yarn installed
- [ ] Supabase account created
- [ ] OpenAI API key obtained
- [ ] Expo CLI installed (for mobile dev)

## 1. Clone & Install (2 minutes)

```bash
cd meeting-transcript-mcp
npm install
```

## 2. Supabase Setup (10 minutes)

### Create Project
1. Visit [supabase.com](https://supabase.com)
2. Click "New Project"
3. Name it `meeting-transcript-app`
4. Choose a strong database password
5. Select closest region
6. Click "Create Project" (wait 2-3 minutes)

### Run Database Schema
1. Go to SQL Editor
2. Click "New Query"
3. Paste contents of `supabase/schema.sql`
4. Click "Run"
5. Verify "Success" message

### Get Credentials
1. Go to Settings → API
2. Copy these three values:
   - **Project URL**
   - **anon public** key
   - **service_role** key (keep secret!)

## 3. OpenAI Setup (3 minutes)

1. Go to [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
2. Click "Create new secret key"
3. Name it "meeting-transcript"
4. Copy the key (starts with `sk-`)

## 4. Configure Environment (5 minutes)

### Backend
```bash
cd apps/backend
cp .env.example .env
```

Edit `apps/backend/.env`:
```env
PORT=3000
NODE_ENV=development
SUPABASE_URL=<your-project-url>
SUPABASE_ANON_KEY=<your-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<your-service-key>
OPENAI_API_KEY=<your-openai-key>
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=104857600
```

### Mobile
```bash
cd apps/mobile
cp .env.example .env
```

Edit `apps/mobile/.env`:
```env
EXPO_PUBLIC_SUPABASE_URL=<your-project-url>
EXPO_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
EXPO_PUBLIC_API_URL=http://localhost:3000
```

**On Physical Device?** Use your computer's IP:
```bash
# Windows
ipconfig
# Look for IPv4 Address like 192.168.1.100

# Mac/Linux
ifconfig | grep "inet "
```

Then update:
```env
EXPO_PUBLIC_API_URL=http://192.168.1.100:3000
```

### MCP Server
```bash
cd apps/mcp-server
cp .env.example .env
```

Edit `apps/mcp-server/.env`:
```env
SUPABASE_URL=<your-project-url>
SUPABASE_SERVICE_ROLE_KEY=<your-service-key>
```

## 5. Start Everything (5 minutes)

### Terminal 1 - Backend
```bash
cd meeting-transcript-mcp
npm run dev:backend
```

Wait for:
```
🚀 Backend server running on http://localhost:3000
```

Test it:
```bash
curl http://localhost:3000/health
```

### Terminal 2 - Mobile App
```bash
cd meeting-transcript-mcp
npm run dev:mobile
```

Choose your platform:
- Press `w` for web browser
- Press `a` for Android (requires Android Studio)
- Press `i` for iOS (Mac only, requires Xcode)
- Scan QR with Expo Go app

### Terminal 3 - Build MCP Server
```bash
cd meeting-transcript-mcp/apps/mcp-server
npm run build
```

## 6. Configure MCP in Kiro (5 minutes)

Create or edit `.kiro/settings/mcp.json`:

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

**Important:** Use absolute path to `index.js`!

Restart Kiro to load the MCP server.

## 7. Test Complete Flow (5 minutes)

### Create Account
1. Open mobile app
2. Tap "Sign up"
3. Enter email and password
4. Check email for verification link
5. Click verification link
6. Return to app and sign in

### Record First Transcript
1. Tap "Record" tab
2. Enter title: "Test Recording"
3. Enter tags: "test"
4. Tap microphone button
5. Speak for 10 seconds: "This is a test of the meeting transcript app. It should transcribe this audio and make it available to Claude AI."
6. Tap stop button
7. Wait for upload (should take 5-15 seconds)
8. See success message

### View in App
1. Tap "Transcripts" tab
2. Pull down to refresh
3. Tap on your transcript
4. Read the transcription

### Test MCP with Claude
Open Kiro and chat:
```
Get my latest meeting transcript
```

Claude should fetch and display your transcript!

Try:
```
What was I saying in my latest recording?
```

Claude will analyze the transcript content!

## Troubleshooting

### Backend won't start
```bash
# Check Node version
node --version  # Should be 18+

# Clear and reinstall
rm -rf node_modules package-lock.json
npm install
```

### Mobile app shows network error
1. Verify backend is running
2. Check API_URL in mobile .env
3. Try with computer's IP instead of localhost
4. Disable firewall temporarily

### Transcription fails
1. Check OpenAI API key is valid
2. Verify you have API credits
3. Try with a shorter audio file
4. Check backend logs for errors

### MCP not working
1. Verify absolute path in mcp.json
2. Check Supabase credentials
3. Restart Kiro after config changes
4. Look for errors in Kiro console

### Database errors
1. Verify schema was run successfully
2. Check Supabase project is active
3. Test database connection in Supabase dashboard

## Next Steps

✅ You now have a working meeting transcript app!

**Try These:**
1. Upload an existing audio file
2. Add multiple project tags
3. Search through transcripts
4. Ask Claude to summarize a meeting
5. Test speaker diarization with multiple speakers

**Customize:**
- Adjust max file size in backend .env
- Change audio quality in mobile app
- Add custom styling to mobile UI
- Extend MCP tools with new features

**Deploy:**
- See SETUP.md for production deployment
- Configure environment-specific settings
- Set up monitoring and logging

## Need Help?

- Check logs in each terminal
- Review ARCHITECTURE.md for system design
- Read SETUP.md for detailed instructions
- Check GitHub issues for known problems

Happy transcribing! 🎙️
