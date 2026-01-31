# Ezra - Hebrew & Greek Bible Reader

A modern web application for reading the complete Bible in its original languages (Hebrew and Greek) with integrated Text-to-Speech, word-by-word translations, and AI-powered explanations.

**Live Demo:** [https://ezra-zeta.vercel.app](https://ezra-zeta.vercel.app)

## ✨ Features

### 📖 Complete Bible in Original Languages
- **66 Books**: Full Hebrew Tanakh (39 books) + Greek New Testament (27 books)
- **~31,102 verses** across **~1,189 chapters**
- Word-by-word display with proper RTL support for Hebrew

### 🔊 Text-to-Speech
- **Google Cloud TTS Integration**: High-quality voice synthesis
- **Hebrew (he-IL)** and **Greek (el-GR)** voices
- Listen to individual verses or full chapters
- Hover-to-speak: Hear individual words on hover
- Adjustable playback speed

### 📝 Word-by-Word Translation
- English gloss displayed under each Hebrew/Greek word
- Click any word for AI-powered detailed explanation
- Grammatical analysis and contextual meaning

### 🎨 Modern UI
- Clean, responsive design with Tailwind CSS
- Dark mode support
- Smooth navigation between books and chapters

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Google Cloud account with Text-to-Speech API enabled
- OpenAI API key (for word explanations)

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/ezra.git
cd ezra

# Install dependencies
npm install

# Set up environment variables
cp .env.local.example .env.local
# Edit .env.local with your API keys

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the app.

## 📚 Documentation

| Document | Description |
|----------|-------------|
| [DEVELOPMENT.md](DEVELOPMENT.md) | Local development setup, testing, and deployment |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Technical architecture and codebase guide |

## 🌐 Deployment

The app is deployed on **Vercel**. For deployment setup:

1. Connect your GitHub repository to Vercel
2. Add environment variables in Vercel dashboard:
   - `GOOGLE_APPLICATION_CREDENTIALS_JSON` - Google Cloud service account JSON
   - `OPENAI_API_KEY` - OpenAI API key for word explanations
3. Deploy!

See [DEVELOPMENT.md](DEVELOPMENT.md#deployment) for detailed instructions.

## 🛠️ Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **TTS**: Google Cloud Text-to-Speech
- **AI**: OpenAI GPT-4o-mini (word explanations)
- **Validation**: Zod
- **Testing**: Vitest
- **Deployment**: Vercel

## 📁 Project Structure

```
ezra/
├── src/
│   ├── app/                 # Next.js App Router pages
│   │   ├── api/             # API routes (tts, voices, word-explanation)
│   │   └── bible/           # Bible reader pages
│   ├── components/          # React components
│   ├── data/
│   │   └── bible/           # Bible JSON data (hebrew/, greek/)
│   ├── lib/                 # Utilities and services
│   │   ├── tts/             # TTS client, cache, chunking
│   │   └── openai/          # Word explanation service
│   └── types/               # TypeScript type definitions
├── data/                    # Source XML files
├── scripts/                 # Build and utility scripts
└── public/                  # Static assets
```

## 📖 Available Books

### Hebrew Bible (Tanakh) - 39 Books
**Torah**: Genesis, Exodus, Leviticus, Numbers, Deuteronomy  
**Prophets**: Joshua, Judges, 1-2 Samuel, 1-2 Kings, Isaiah, Jeremiah, Ezekiel, Hosea, Joel, Amos, Obadiah, Jonah, Micah, Nahum, Habakkuk, Zephaniah, Haggai, Zechariah, Malachi  
**Writings**: Ruth, Psalms, Proverbs, Job, Song of Songs, Ecclesiastes, Lamentations, Esther, Daniel, Ezra, Nehemiah, 1-2 Chronicles

### Greek New Testament - 27 Books
**Gospels**: Matthew, Mark, Luke, John  
**History**: Acts  
**Pauline Epistles**: Romans, 1-2 Corinthians, Galatians, Ephesians, Philippians, Colossians, 1-2 Thessalonians, 1-2 Timothy, Titus, Philemon  
**General Epistles**: Hebrews, James, 1-2 Peter, 1-3 John, Jude  
**Apocalyptic**: Revelation

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

## 🙏 Acknowledgments

- Bible text data from public domain sources
- Google Cloud for Text-to-Speech API
- OpenAI for word explanation capabilities
