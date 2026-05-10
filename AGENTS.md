## Cursor Cloud specific instructions

**Product**: OpenStarChat — a client-side React SPA that wraps the OpenRouter API for AI chat. There is no backend; all state lives in localStorage via Zustand.

**Tech stack**: TypeScript, React 19, Vite 8, Tailwind CSS 3, Zustand 5, npm.

### Running the dev server

```
npm run dev -- --host 0.0.0.0
```

Starts on `http://localhost:5173/`. Hot-module reloading works out of the box.

### Build

```
npm run build
```

Runs `tsc -b && vite build`; output goes to `dist/`.

### Lint / Tests

- No ESLint config or test framework is currently configured in this repo. The only compile-time check is the TypeScript build (`tsc -b`).
- There are no automated test scripts (`npm test` is not defined).

### Key caveats

- The app requires an **OpenRouter API key** at runtime (entered in the Settings modal, stored in localStorage). Without a key, you can explore the full UI but cannot send chat messages.
- The Android/Capacitor build (`android/` directory) requires Java 21 + Android SDK and is not needed for web development.
- No `.env` file is needed; all configuration happens in-browser through the Settings modal.
