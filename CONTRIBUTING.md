# Contributing Guide

Thank you for your interest in contributing to the Meeting Transcript MCP App!

## Development Setup

1. Fork the repository
2. Clone your fork
3. Follow QUICKSTART.md to set up locally
4. Create a feature branch: `git checkout -b feature/your-feature`

## Code Style

- TypeScript for all new code
- Use ESLint and Prettier (configs provided)
- Write meaningful commit messages
- Add comments for complex logic

## Project Structure

- `apps/backend` - Node.js API server
- `apps/mobile` - React Native app
- `apps/mcp-server` - MCP protocol server
- `packages/shared` - Shared types and utilities

## Making Changes

### Backend Changes

```bash
cd apps/backend
npm run dev  # Auto-reload on changes
```

- Add new routes in `src/routes/`
- Business logic goes in `src/services/`
- Update types in `packages/shared/src/types.ts`

### Mobile Changes

```bash
cd apps/mobile
npm start
```

- Add screens in `app/` directory
- Reusable components in `components/`
- Update shared types when needed

### MCP Server Changes

```bash
cd apps/mcp-server
npm run dev
```

- Tools are defined in `src/index.ts`
- Update tool schemas carefully
- Test with Kiro after changes

## Testing

Before submitting:

1. Test backend endpoints manually
2. Test mobile app on at least one platform
3. Verify MCP tools work in Kiro
4. Check for TypeScript errors: `npm run build`

## Pull Request Process

1. Update documentation if needed
2. Add description of changes
3. Reference any related issues
4. Ensure all checks pass
5. Request review from maintainers

## Feature Ideas

- Real-time transcription
- Better speaker diarization
- Team collaboration
- Calendar integration
- Export formats (PDF, DOCX)
- Meeting analytics
- Custom vocabulary

## Bug Reports

Include:
- Steps to reproduce
- Expected behavior
- Actual behavior
- Environment (OS, Node version, etc.)
- Logs/screenshots if applicable

## Questions?

Open a GitHub issue with the "question" label.
