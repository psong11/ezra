# Development Guide

This guide covers local development setup, testing, and deployment for the Ezra Bible Reader.

## 📋 Table of Contents
- [Prerequisites](#prerequisites)
- [Local Development Setup](#local-development-setup)
- [Environment Variables](#environment-variables)
- [Running the App](#running-the-app)
- [Testing](#testing)
- [Adding New Bible Books](#adding-new-bible-books)
- [Deployment](#deployment)
- [Troubleshooting](#troubleshooting)

---

## Prerequisites

- **Node.js**: Version 18.0.0 or higher
- **npm**: Comes with Node.js
- **Google Cloud Account**: Required for Text-to-Speech
- **OpenAI API Key**: Required for word explanations (optional)

---

## Local Development Setup

### 1. Clone and Install

```bash
git clone https://github.com/yourusername/ezra.git
cd ezra
npm install
```

### 2. Google Cloud Setup (for TTS)

**Option A: Application Default Credentials (Recommended for Development)**

```bash
# Install Google Cloud CLI if not already installed
# https://cloud.google.com/sdk/docs/install

# Login and set up ADC
gcloud auth application-default login

# Enable the Text-to-Speech API
gcloud services enable texttospeech.googleapis.com
```

**Option B: Service Account (Required for Production)**

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable the **Text-to-Speech API**:
   - Navigate to APIs & Services → Library
   - Search for "Cloud Text-to-Speech API"
   - Click **Enable**
4. Create a service account:
   - Navigate to IAM & Admin → Service Accounts
   - Click **Create Service Account**
   - Name: `ezra-tts-service`
   - Role: **Cloud Text-to-Speech API User**
5. Create a JSON key:
   - Click on the service account
   - Go to **Keys** tab
   - Click **Add Key** → **Create new key** → **JSON**
   - Save the downloaded file securely

### 3. OpenAI Setup (for Word Explanations)

1. Go to [OpenAI Platform](https://platform.openai.com/)
2. Create an API key
3. Add to your `.env.local` file

---

## Environment Variables

Create a `.env.local` file in the project root:

```bash
# Copy the example file
cp .env.local.example .env.local
```

### Required Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `GOOGLE_APPLICATION_CREDENTIALS_JSON` | Full JSON content of service account key | Production only |
| `GOOGLE_APPLICATION_CREDENTIALS` | Path to service account JSON file | Local only |
| `OPENAI_API_KEY` | OpenAI API key for word explanations | Optional |

### Example `.env.local`

```bash
# For local development with ADC (no file needed if using gcloud auth)
# GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json

# For production (Vercel) - paste entire JSON as single line
# GOOGLE_APPLICATION_CREDENTIALS_JSON={"type":"service_account",...}

# OpenAI for word explanations
OPENAI_API_KEY=sk-...
```

---

## Running the App

### Development Server

```bash
# Standard way
npm run dev

# Or use the convenience scripts
./start-dev.sh    # Start in background
./stop-dev.sh     # Stop background server
./status-dev.sh   # Check if running
```

The app will be available at [http://localhost:3000](http://localhost:3000)

### Available Routes

| Route | Description |
|-------|-------------|
| `/` | Home page (redirects to /bible) |
| `/bible/[bookId]/[chapter]` | Bible chapter reader |
| `/test-tts` | TTS testing page |

---

## Testing

### Unit Tests

```bash
# Run all tests
npm test

# Run with UI
npm run test:ui

# Run specific test file
npm test -- src/lib/tts/__tests__/cache.test.ts
```

### TTS Tests

```bash
# Test Google TTS client directly
npm run test:tts

# Test TTS API endpoint
npm run test:tts-api
```

### Manual Testing

1. **TTS Test Page**: Visit `/test-tts` in browser
2. **Word Hover**: Hover over any Hebrew/Greek word to hear pronunciation
3. **Full Chapter**: Click "Listen to Full Chapter" button
4. **Word Explanation**: Click any word to see AI-powered explanation

---

## Adding New Bible Books

The project includes an automated integration system for adding new books.

### Prerequisites

1. XML source file in the `/data` directory
2. Book configuration in `scripts/book-config.ts`

### Steps

1. **Add XML file** to `/data/YourBook.xml`

2. **Add configuration** to `scripts/book-config.ts`:
```typescript
{
  id: 'your-book',
  displayName: 'Your Book',
  testament: 'hebrew', // or 'greek'
  xmlFile: 'YourBook.xml',
  totalChapters: 10,
}
```

3. **Run integration**:
```bash
npm run integrate-books
```

This automatically:
- Converts XML to JSON
- Updates `bibleLoader.ts` with the new book
- Generates TypeScript types

---

## Deployment

### Vercel Deployment

1. **Connect Repository**
   - Go to [Vercel](https://vercel.com)
   - Import your GitHub repository

2. **Add Environment Variables**
   
   In Vercel Dashboard → Settings → Environment Variables:

   | Name | Value | Environments |
   |------|-------|--------------|
   | `GOOGLE_APPLICATION_CREDENTIALS_JSON` | Entire JSON content of service account | All |
   | `OPENAI_API_KEY` | Your OpenAI API key | All |

   ⚠️ **Important**: For `GOOGLE_APPLICATION_CREDENTIALS_JSON`, paste the **entire JSON file content** as a single line.

3. **Deploy**
   ```bash
   # Deploy to production
   vercel --prod
   
   # Or push to main branch for automatic deployment
   git push origin main
   ```

### Vercel Configuration

The `vercel.json` file configures serverless function timeouts:

```json
{
  "functions": {
    "src/app/**/*.tsx": { "maxDuration": 30 },
    "src/app/api/**/route.ts": { "maxDuration": 30 }
  }
}
```

### Checking Deployment Logs

```bash
# View recent logs
vercel logs ezra-zeta.vercel.app

# Follow logs in real-time
vercel logs ezra-zeta.vercel.app --follow
```

---

## Troubleshooting

### TTS Not Working on Vercel (500 Error)

**Symptom**: "Listen to Full Chapter" returns 500 Internal Server Error

**Cause**: Missing or invalid Google Cloud credentials

**Solution**:
1. Verify `GOOGLE_APPLICATION_CREDENTIALS_JSON` is set in Vercel
2. Ensure it contains the **complete** JSON (including `{ }` braces)
3. Check all three environments are selected (Production, Preview, Development)
4. Redeploy after adding the variable

**Debug**: Check Vercel logs for:
- ✅ `🔑 Using Google credentials from JSON environment variable`
- ❌ `Failed to parse GOOGLE_APPLICATION_CREDENTIALS_JSON`

### "Voice requires model" Error

**Symptom**: TTS fails with "This voice requires a model name"

**Cause**: Attempting to use Journey voices (not supported)

**Solution**: The app automatically filters out Journey voices. If this error appears, the voice filtering may have failed. Use standard voices like:
- Hebrew: `he-IL-Wavenet-A`
- Greek: `el-GR-Wavenet-A`
- English: `en-US-Wavenet-A`

### Word Explanations Not Working

**Symptom**: Clicking words doesn't show explanations

**Cause**: Missing or invalid OpenAI API key

**Solution**:
1. Verify `OPENAI_API_KEY` is set
2. Check the key is valid and has credits
3. Redeploy if added after initial deployment

### Local TTS Works, Production Doesn't

**Cause**: Local uses Application Default Credentials (gcloud CLI), but Vercel has no gcloud

**Solution**: Vercel requires explicit credentials via `GOOGLE_APPLICATION_CREDENTIALS_JSON`

### Build Fails Due to Large Data Files

**Symptom**: Build timeout or memory errors

**Cause**: Bible JSON files are loaded at runtime, not build time

**Solution**: This should already be handled. If issues persist:
1. Ensure JSON files are in `src/data/bible/` not bundled
2. Check `next.config.js` for proper configuration

---

## NPM Scripts Reference

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm test` | Run Vitest tests |
| `npm run test:tts` | Test Google TTS client |
| `npm run test:tts-api` | Test TTS API endpoint |
| `npm run integrate-books` | Run book integration script |
| `npm run add-translations` | Add English translations to books |

---

## Getting Help

If you encounter issues not covered here:

1. Check Vercel logs: `vercel logs ezra-zeta.vercel.app`
2. Check browser console for client-side errors
3. Test locally first to isolate environment issues
4. Review the [ARCHITECTURE.md](ARCHITECTURE.md) for system understanding
