/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // The word-explanation route reads Bible JSON at request time via fs
    // with dynamic paths, which Vercel's file tracing can't follow — the
    // corpus must be included explicitly or citation verification would
    // silently find no verses in production.
    outputFileTracingIncludes: {
      '/api/word-explanation': ['./src/data/bible/**/*'],
      // Same story for per-verse audio: it looks the verse up by reference
      // instead of receiving its text, so it needs the corpus at runtime.
      '/api/tts/verse/[bookId]/[chapter]/[verse]': ['./src/data/bible/**/*'],
    },
  },
}

module.exports = nextConfig
