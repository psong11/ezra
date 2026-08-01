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
    },
  },
}

module.exports = nextConfig
