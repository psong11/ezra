# Handoff — Ezra — 2026-09-07

This session evaluated whether to move Ezra's Hebrew audio off Google Cloud TTS (`he-IL-Wavenet-A`) onto ElevenLabs for a more natural read. The answer to "does ElevenLabs do Hebrew" is yes, but only on the `eleven_v3` model — every other ElevenLabs model is a dead end for Hebrew. Rather than guess at the two unknowns (how a Modern Hebrew voice handles niqqud, and how the two providers actually compare by ear), the session built an A/B harness, `scripts/compare-hebrew-tts.ts`, that renders provider x text-treatment audio per verse and prints the character-cost delta. The Google half ran clean and produced real audio; the ElevenLabs half is blocked on an API key that lives on the petsi Pi and needs an interactive auth step Paul has to do himself. Nothing was committed.

## Working tree state
- Branch: `main` · 0 ahead / 0 behind `origin/main`
- Recent commits (newest first):
  - `608db9f` Stop chapter playback dying on a single failed verse
  - `7b602e3` Add a toggle for the English glosses under each word
  - `a58c90f` Highlight other inflections of the same root, not just verbatim copies
  - `1afe0d8` Stop the word-study legend relabeling itself mid-stream
  - `1d7372e` Fix missing highlights from dotted roots; segment noun morphology
  - `17342c4` Switch word studies from OpenAI to Claude
- Uncommitted:
  - `scripts/compare-hebrew-tts.ts` (??) — the new A/B harness
  - `package.json` (M) — adds `"compare-tts": "npx tsx scripts/compare-hebrew-tts.ts"`
  - `.claude/` (??) — was already untracked (holds `launch.json`); now also holds this handoff
- **Pushed?** No, and not committed either. Deliberate: the harness is a throwaway decision tool, not a feature. Commit it only if the evaluation concludes and the script stays useful.

## Live artifacts
- Deployment: `ezra-zeta.vercel.app` — untouched this session.
- Sample audio generated to `<scratchpad>/tts-compare/`: `genesis-1-1__google__pointed.mp3`, `genesis-1-1__google__bare.mp3`. Scratchpad is session-scoped and will be gone; re-run the script to regenerate.

## What's next
1. **Unblock the key.** Paul runs this himself (it triggers a Tailscale browser check an agent cannot complete):
   `ssh paul@100.127.55.30 'grep -rh "^ELEVENLABS_API_KEY=" ~ --include=".env*" 2>/dev/null | head -1' >> .env.local`
2. **Run `npm run compare-tts`.** Defaults to `genesis:1:1` and `psalms:22:2`; takes `book:ch:v` args. Produces 4 mp3s per verse (google|eleven x pointed|bare) plus a char-cost table. Hand the files to Paul with `SendUserFile` — he decides by ear, this is not an agent judgment call.
3. **If the first real v3 call 422s**, the knob is the request body in `synthesizeEleven()`: `model_id: 'eleven_v3'` + `language_code: 'he'` with `voice_settings` deliberately omitted. Endpoint and headers are straight from the docs and are solid; those three body choices are assumptions.
4. **Only if Paul picks ElevenLabs**, implement it: add an `ElevenLabsTTSClient` matching the existing `synthesize({ text, voiceName, languageCode, audioEncoding })` shape in `src/lib/tts/google.ts`, and **add a provider field to `generateCacheKey`** in `src/lib/tts/hash.ts` — without it, new ElevenLabs audio collides with cached Google audio at the same key and listeners get stale voices.

## Carry-forward context
- **ElevenLabs Hebrew is `eleven_v3` only.** `eleven_multilingual_v2` (29 langs) and `eleven_flash_v2_5` (32 langs) do not list Hebrew; `eleven_turbo_v2_5` is deprecated. v3: $0.10/1k chars, 5,000-char request cap. Don't re-derive this.
- **Both providers are Modern Israeli Hebrew.** Neither chants cantillation. The ceiling on this whole exercise is naturalness, not liturgical accuracy — worth saying out loud to Paul before he spends money on it.
- **Niqqud is a billing line item.** ElevenLabs bills per character and niqqud are separate Unicode codepoints. Measured on Genesis 1:1: `prepareHebrewForTTS` output is 58 chars vs 34 bare = **1.71x**. Voicing the Tanakh runs roughly $205 pointed vs $120 bare. The per-verse cache in `src/lib/tts/cache.ts` is `immutable` and blob-backed, so real spend is only on verses actually played.
- **The open empirical question the harness exists to answer:** production currently sends cantillation-stripped, niqqud-*kept* text (`prepareHebrewForTTS`, see the comment at `src/app/api/tts/verse/[bookId]/[chapter]/[verse]/route.ts:61`). Modern Hebrew voices are trained on unpointed text. Nobody documents whether they read niqqud as vowels, ignore it, or trip on it. That applies to Google too — the two Google mp3s alone may show the current pipeline is sending the wrong treatment.
- **Reaching petsi:** the SSH user is `paul` (not `psong11`/`pi`/`ezer`). Bare `ssh petsi` fails host-key verification — known_hosts only has `petsi.local` and `172.20.154.213`. Neither resolved this session (petsi is online but off-LAN). The tailscale IP `100.127.55.30` presents the same ed25519 key as the trusted `petsi.local` entry (verified), but still demands the interactive browser check. Use `paul@petsi.local` when on the same network; otherwise hand Paul the command.
- **Memory scoping gotcha:** the detailed Ezra memory lives at `~/.claude/projects/-Users-paulsong/memory/project_ezra.md`, keyed to `/Users/paulsong`. A session rooted in this repo gets an empty memory dir and will NOT auto-load it. Read that file explicitly at session start — it holds the word-study architecture, the streaming/caching gotchas, and the cache-key versioning rules.
- **Google auth here uses ADC via `credentials.json`.** `.env.local` needs `GOOGLE_APPLICATION_CREDENTIALS="credentials.json"` (file path); the `_JSON` string variant gets mangled by env pulls and 401s.
- Memory updated this session: `project_ezra.md` (TTS eval paragraph), `reference_raspberry_pi.md` (petsi tailnet SSH gotcha), `MEMORY.md` (index line).

## Open questions
- Does v3 read niqqud correctly? Unanswered — that is the point of step 2.
- Which ElevenLabs voice? The script defaults to Rachel (`21m00Tcm4TlvDq8ikWAM`), an arbitrary pick. `npm run compare-tts -- --voices` lists the account's voices; override with `ELEVENLABS_VOICE_ID`.
- Is the switch worth it at all, given both providers hit the same Modern-Hebrew ceiling and ElevenLabs adds a per-character bill where Google has a free tier? Paul has not decided.

---

### Auto-loaded on next session start
- `~/.claude/CLAUDE.md` — global rules (response style: concise; memory self-audit).
- Project memory — **only if the session is rooted at `/Users/paulsong`**. See the memory scoping gotcha above.
- This repo has no `CLAUDE.md` or `AGENTS.md`. `ARCHITECTURE.md` and `DEVELOPMENT.md` exist at the root but are not auto-loaded — read them if you need the data-pipeline or dev-server picture.
- `.claude/launch.json` defines an `ezra` dev-server entry on port 3333.

### To resume

Open a fresh Claude Code terminal in this repo. After auto-loaded context, paste this as your first message:

> Picking up Ezra. Read `.claude/handoffs/2026-09-07-hebrew-tts-provider-eval.md` first to catch up on the previous session, then also read `~/.claude/projects/-Users-paulsong/memory/project_ezra.md` since this repo's own memory dir is empty. Then propose your first concrete steps and wait for my go.
