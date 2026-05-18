# OpenStarChat

A **client-side React** chat app for **[OpenRouter](https://openrouter.ai/)** (and optional free OpenAI-compatible providers). There is **no backend**: chats, characters, prompts, and settings live in **localStorage** via Zustand.

## Quick start

```bash
npm install
npm run dev -- --host 0.0.0.0
```

Open the URL Vite prints (default `http://localhost:5173/`). Add your **OpenRouter API key** in **Settings** (stored only in the browser). Without a key you can still browse the UI if a **free provider** is enabled in Settings.

```bash
npm run build
```

Runs `tsc -b && vite build`; output in `dist/`.

## Features

### Chat & models

- **OpenRouter** streaming chat with **cancel**, **regenerate**, **edit & resend**, and **branch from message**.
- **Model picker** with search, categories, favorites, recents, sorting, and refresh.
- **Per-chat temperature & max tokens** (sent with streaming requests).
- **Compare models** side-by-side (same prompt to multiple models).
- **Optional free LLM** path: Pollinations.ai or any **OpenAI-compatible** base URL when no OpenRouter key is set.

### Messages & input

- **Markdown** for assistant replies (GFM, code highlighting).
- **Markdown for user bubbles** and a **live Markdown underlay** in the composer (type `*italic*`, `` `code` ``, etc.).
- **Multi-image** user turns (several images + text in one message).
- **Attachments**: images, **PDF text extraction** (client-side via `pdfjs-dist`), and common **text files** append as context blocks.
- **Web Speech** microphone input where the browser supports it.
- **Predictive text** (optional): ghost completion; **Tab** to accept.
- **Per-chat drafts** persisted in localStorage.

### “Power user” API options (per chat, under the sliders panel)

- **Built-in tools** (time, random int) plus optional **extra tools JSON** merged into the OpenRouter request. Only built-in tool **names** are executed locally; unknown tools return an error JSON to the model.
- **Structured JSON**: optional **JSON Schema** text → `response_format` for models that support it.
- **Reasoning stream**: when the provider sends reasoning deltas, a collapsible **Thinking** block is filled.
- **Tool-call loop**: if the model finishes with `tool_calls`, the app runs built-in tools, appends `tool` messages, and **continues** the conversation (depth-limited).

### Characters & prompts

- **Characters** with colors, emoji, optional avatar, system prompt, tags, notes; **AI Character Builder** and **Transcriber** (including vision for reference images).
- **Prompt library** with built-ins and custom prompts.

### Organization & data

- **Pinned chats**, **folders**, **tags**, sidebar **search** (titles + message text).
- **Bookmarks** on individual messages.
- **Memory snippets** (global “always remember” lines injected into the system stack).
- **Export / import**: full backup JSON, chats-only JSON, Markdown, plain text.
- **Usage panel** (sidebar **Usage** or **Ctrl/Cmd+U**): rough **assistant token** totals and **estimated spend** from cached model pricing (refresh models in the picker for best accuracy).

### Titles & speech

- **AI chat titles** (optional in Settings): after the first meaningful assistant reply, a small model suggests a short title instead of truncating the first user line.
- **Read aloud** on assistant bubbles: **browser `speechSynthesis`** or optional **ElevenLabs** (API key + voice id; falls back to browser if the request fails, e.g. CORS).

### Look & feel

- **Themes**: dark, AMOLED, light, Dracula, Nord, cyberpunk, solarized, and **custom** color pickers.
- **Idle animation** (starfield / shooting stars / aurora / random) after inactivity; click to dismiss.
- **Android / Capacitor** project in-repo (Java 21 + SDK for native builds; not required for web).

## Keyboard shortcuts

| Shortcut | Action |
|----------|--------|
| **Ctrl/Cmd+K** | Model picker |
| **Ctrl/Cmd+N** | New chat (needs key or free provider) |
| **Ctrl/Cmd+/** | Prompt library |
| **Ctrl/Cmd+B** | Bookmarks |
| **Ctrl/Cmd+U** | Usage estimates |
| **Ctrl/Cmd+,** | Settings |
| **Ctrl/Cmd+Shift+P** | Toggle Characters page |
| **Escape** | Close modals |

## Tech stack

TypeScript, **React 19**, **Vite 8**, **Tailwind CSS 3**, **Zustand 5**, `react-markdown`, `remark-gfm`, `remark-breaks`, `react-syntax-highlighter`, **pdfjs-dist** (lazy), optional **Capacitor 8** for Android.

## License

See repository license (if any).
