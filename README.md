# MAX Web Messenger Client

> **English** • [🇷🇺 Русская версия](./README.ru.md) · [📚 Документация](./docs/ru/README.md)

A lightweight, production-ready React web client designed to interface with the MAX messenger ecosystem via GREEN-API HTTP endpoints. It delivers a fast, responsive user interface inspired by modern web messaging standards, complete with chat management, message delivery status, contact search, and configurable gateway routing.

---

## Tech Stack

- **Frontend Framework:** React 19 (Functional Components, Hooks)
- **Language:** TypeScript 7 (Strict Typing, `tsc --noEmit`)
- **Bundler & Tooling:** Vite 8 with `@vitejs/plugin-react` and `vite-plugin-pwa`
- **Styling:** Tailwind CSS (Utility-first, class-based dark theme with centralized palette in `src/theme.ts`)
- **Icons:** Lucide Icons (`lucide-react`)
- **Runtime Validation:** `zod` schemas for GREEN-API payloads (`src/utils/greenApiSchemas.ts`)
- **State Management & Persistence:** React State & Hooks with `localStorage`/`sessionStorage` synchronization
- **Tests:** Vitest unit tests (`npm test`), including a theme centralization guard
- **Containerization:** Docker (Multi-stage build) & Nginx Alpine
- **Continuous Integration:** GitHub Actions (`.github/workflows/ci.yml`)

---

## Features

- **MAX Ecosystem Compatibility:** Strict plain numeric phone formatting (e.g., `79991234567`) without external suffix pollution.
- **Bidirectional Communication:** Instant text messaging via `sendMessage` and real-time message reception via `receiveNotification`.
- **Gateway & Instance Routing:** Support for standard public GREEN-API gateway (`https://api.green-api.com`) as well as dedicated instance host routes (e.g. `https://7103.api.greenapi.com`).
- **Dialog Management:** Real-time search, chat creation, pinning conversations to the top, unread counters, and chat deletion.
- **Full Bilingual Localization:** Seamless runtime switching between Russian and English (UI controls, timestamps, status indicators, and alerts).
- **Responsive Layout:** Adaptive desktop split-pane and mobile-first full-screen viewport with bottom navigation.
- **PWA & Offline Awareness:** Web App Manifest, service worker caching, and real-time offline status banners.
- **Dark Theme:** Light / Dark / System modes with pre-paint init (no flash), switch in Settings → Chat.
- **Resilient Messaging:** Click-to-retry on failed messages, history skeletons, search result counts.
- **Privacy Controls:** Session vs persistent token storage switch, inactivity auto-lock, message TTL, AES-GCM encrypted backups with import.
- **Optional BFF Proxy:** Tokenless browser mode (`bff/`, Node 22 dependency-free) for multi-user prod — see `bff/README.md`.
- **Single-Channel Notifications:** In-app card while you look at the tab, OS notification while it is hidden — never both. Focus-based routing (`resolveNotificationChannel`), per-chat tag dedup, auto-dismiss on return.
- **Scalable Address Book:** Alphabetical sections with sticky headers, live search with result counts, paged rendering for thousands of contacts, GREEN-API sync.
- **Honest Presence:** No fake “online” — the header shows online/recently/last-seen only from real incoming activity (GREEN-API exposes no presence), groups show “group”, and the status refreshes live.

---

## Getting Started

### Prerequisites
- Node.js 20.x or 22.x
- npm 10.x or higher (or pnpm / bun)

### Installation & Local Development

```bash
# Clone the repository
git clone https://github.com/AVP-Dev/green-api-max-client.git

# Navigate to project directory
cd green-api-max-client

# Install dependencies
npm install

# Start local development server (binds to 0.0.0.0:3000)
npm run dev
```

The application will be available at `http://localhost:3000`.

### Production Build & Verification

```bash
# Type check TypeScript codebase
npm run lint

# Run unit tests (vitest)
npm test

# Compile and generate production bundle in dist/
npm run build

# Preview production build locally
npm run preview
```

### Docker Deployment

The repository includes a multi-stage `Dockerfile` and `docker-compose.yml` for automated production deployment:

```bash
# Launch container with Docker Compose
docker compose up -d --build

# Or build and run directly with Docker CLI
docker build -t max-web-messenger .
docker run -d -p 3000:80 --name max-web-messenger max-web-messenger
```

### Environment (build-time)

Copy `.env.example` to `.env` before building. `VITE_*` variables are embedded
by Vite at **build time** — runtime `environment:` does not affect them, use
`docker-compose build.args` (already wired):

```bash
cp .env.example .env
# VITE_TRUSTED_PARENT_ORIGINS=https://crm.example.com,https://portal.example.com
# VITE_DEFAULT_API_URL=https://3100.api.green-api.com
```

Embed allowlist can also be passed per-URL: `?parentOrigin=https://crm.example.com`.
Without it the widget drops inbound postMessage commands in production (fail-closed).

---

## Continuous Integration & Deployment (CI/CD)

The repository is configured with a strict GitHub Actions workflow located at `.github/workflows/ci.yml`:

1. **Type Safety, Lint & Tests (`typecheck`):**
   - Runs on `ubuntu-latest` with Node.js 22.
   - Installs dependencies deterministically via `npm ci`.
   - Executes `tsc --noEmit` to guarantee zero type errors.
   - Runs `npm test` (Vitest unit tests, including the dark-theme centralization guard).

2. **Security Audit (`security-audit`):**
   - Runs `npm audit --omit=dev --audit-level=moderate` (fails on moderate+).

3. **Production Build (`build`):**
   - Compiles static assets using `npm run build` (`vite build`).
   - Verifies the integrity of `dist/index.html` and bundles.
   - Uploads compressed build artifacts for deployment.

4. **Docker Verification (`docker`):**
   - Sets up Docker Buildx with GitHub Actions layer caching.
   - Verifies that the multi-stage container and Nginx SPA configuration build cleanly.

---

## Architecture & Engineering Decisions

### 1. HTTP Long-Polling (`receiveNotification`)
- **Client-Side Polling:** To operate as a self-contained Single-Page Application (SPA) without requiring an intermediate backend or public webhook tunnel, incoming messages are received by calling the GREEN-API `receiveNotification` endpoint.
- **Adaptive Backoff Safeguard:** To conserve network resources and respect rate limits, the polling engine pauses 2 seconds upon an empty queue, accelerates to 300ms immediately after handling a message to drain any burst backlog, and applies an exponential backoff (up to 10 seconds) if transient network or server errors occur.
- **Production Architecture Trade-off:** In enterprise or large-scale multi-user environments, client-side HTTP long-polling introduces unnecessary roundtrips and mobile battery drain. Production architectures typically route incoming events via GREEN-API Webhooks to a backend service, which subsequently streams messages to connected clients via WebSockets or Server-Sent Events (SSE).

### 2. Queue Acknowledgment (`deleteNotification` & `receiptId`)
- **FIFO Queue Mechanism:** GREEN-API functions as a FIFO notification queue. When `receiveNotification` returns an event, it includes a numeric `receiptId`.
- **Preventing Queue Deadlock:** Until the notification is explicitly deleted via `deleteNotification(credentials, receiptId)`, subsequent incoming messages remain queued behind it.
- **Immediate Acknowledgment:** The client processes `incomingMessageReceived` payloads, updates local dialogue state, and immediately invokes `deleteNotification`. Auxiliary events (typing indicators, status updates, system events) are also acknowledged immediately to keep the queue healthy and unblocked.

### 3. Typing Indicators (`sendTyping` / presence)
- **Outgoing typing works:** while typing, the client sends `sendTyping` (`{ chatId, typingTime: 5000 }`, plain numeric first with `@c.us` fallback per official docs).
- **Incoming typing cannot arrive:** GREEN-API has no incoming presence/typing webhook type (verified against the official `type-webhook` list), so “interlocutor is typing” never comes from the network. The header indicator UI is kept (with a “Test: typing indicator” item in the chat ⋮ menu) in case MAX-type instances start emitting presence events; the parser lives in `src/utils/typing.ts`.

### 4. Security & Credential Management
- **Security Notice:** Inputting API tokens (`idInstance`, `apiTokenInstance`) directly into a browser SPA is suitable for demonstration environments, internal tooling, or personal single-tenant use.
- **BFF (Backend for Frontend) Best Practice:** For production deployments with multiple untrusted users, credentials should never be stored in browser `localStorage` or transmitted from client code. Instead, requests should be proxied through a secure backend (BFF) that manages secret credentials in a secure vault and authenticates end-users via JWT or session cookies.
- **Shipped BFF included:** this repo contains a minimal dependency-free BFF (`bff/server.mjs`, see `bff/README.md`) plus tokenless client mode (`src/utils/bffClient.ts`, toggle in Settings → Connection). Details in [`SECURITY.md`](./SECURITY.md).

### 5. Single-Channel Notifications
- **Focus-based routing:** every incoming message fires exactly one visual channel — `resolveNotificationChannel()` in `src/utils/notifications.ts` picks the in-app card (`PopupNotification`) when the tab is focused, or the OS notification when it is hidden, with fallback to the second channel if the primary is switched off.
- **Per-chat dedup & auto-dismiss:** native notifications share `tag: max-chat-<chatId>` (rapid messages replace instead of stacking); stale notifications auto-close on `visibilitychange`/`focus` and when their chat is opened.
- **Tab chrome always on:** flashing title + canvas-drawn favicon badge (`useTabNotification`) work independently of the channel.
- **Full guide (RU):** [`docs/ru/notifications.md`](./docs/ru/notifications.md).

---

## Verified Project Structure

```
├── .github/
│   └── workflows/
│       └── ci.yml             # typecheck + tests + audit + build + docker
├── bff/                       # Optional tokenless BFF proxy (Node 22, no deps)
│   ├── server.mjs             # send/receive/ack forwarding, token vault
│   └── README.md              # BFF contract & run instructions
├── docs/
│   └── ru/                    # Russian docs (cross-linked)
│       ├── README.md          # Docs index
│       ├── notifications.md   # Channels, focus routing, permissions
│       └── settings.md        # Settings tabs walkthrough
├── public/                    # Static web assets and PWA icons
├── scripts/
│   └── generate-icons.js      # Sharp-based icon generation utility
├── src/
│   ├── components/            # Modular React UI components
│   │   ├── AddressBookModal.tsx # Grouped, searchable, paged address book
│   │   ├── AuthScreen.tsx     # Instance credentials & gateway configuration
│   │   ├── Avatar.tsx         # Initials & deterministic pastel colors
│   │   ├── ChatView.tsx       # Message timeline, retry, typing & compose input
│   │   ├── ErrorBoundary.tsx  # React error boundary with data reset
│   │   ├── IntegrationModal.tsx # (legacy, unused) integration dialog
│   │   ├── IntegrationPanel.tsx # Iframe/URL/postMessage CRM integration
│   │   ├── MaxLogo.tsx        # MAX brand vector mark
│   │   ├── MobileBottomNav.tsx # Mobile bottom tab navigation
│   │   ├── NewChatModal.tsx   # Phone validation modal & contact creation
│   │   ├── OfflineIndicator.tsx # Floating connectivity banner
│   │   ├── PopupNotification.tsx # In-app incoming message card
│   │   ├── PWAInstallButton.tsx # Home-screen install button + iOS guide
│   │   ├── QuickRepliesModal.tsx # Quick-reply template manager
│   │   ├── SettingsModal.tsx  # 5 tabs: chat, notifications, gateway, integration, data
│   │   ├── Sidebar.tsx        # Search, pinned chats & conversation list
│   │   └── Skeletons.tsx      # Loading skeletons (chats, dialogs)
│   ├── hooks/
│   │   ├── useGreenApiPolling.ts # Adaptive long-polling engine + webhook types
│   │   ├── useOnlineStatus.ts # Browser online/offline listener
│   │   ├── usePWAInstall.ts   # PWA install prompt controller
│   │   └── useTabNotification.ts # Title flash + canvas favicon badge
│   ├── i18n/
│   │   └── translations.ts    # Complete RU/EN dictionary
│   ├── services/
│   │   └── greenApi.ts        # GREEN-API REST wrapper (allowlist + BFF route)
│   ├── utils/
│   │   ├── backupCrypto.ts    # AES-GCM backup encryption (WebCrypto)
│   │   ├── bffClient.ts       # Tokenless BFF client
│   │   ├── credentialStorage.ts # sessionStorage/localStorage credential vault
│   │   ├── formatters.ts      # Phones, timestamps, avatar colors
│   │   ├── greenApiSchemas.ts # Zod runtime validation of API payloads
│   │   ├── notifications.ts   # Single-channel routing, tag dedup, autoclose
│   │   ├── postMessageSecurity.ts # OWASP postMessage bridge helpers
│   │   ├── quickReplies.ts    # Default quick-reply templates
│   │   ├── sound.ts           # Web Audio notification chime
│   │   ├── storage.ts         # Fail-safe storage wrapper
│   │   └── typing.ts          # Presence/typing extraction + docs note
│   ├── config.ts              # Central defaults (polling, limits, storage keys)
│   ├── theme.ts               # Dark-theme palette + centralization rules
│   ├── types.ts               # Shared TypeScript definitions
│   ├── index.css              # Tailwind, brand styling & safe areas
│   ├── App.tsx                # Central state coordinator & root component
│   └── main.tsx               # React entry point
├── .dockerignore
├── .env.example               # Build-time VITE_* template
├── Dockerfile                 # Multi-stage production container
├── docker-compose.yml         # Orchestration (+ optional bff profile)
├── index.html                 # Entry with MAX meta + pre-paint theme init
├── nginx.conf                 # SPA routing, caching & security headers
├── package.json
├── tsconfig.json              # Strict TypeScript options
├── vitest.config.ts           # Vitest configuration
└── vite.config.ts             # Vite bundler, Tailwind & PWA plugin config
```

---

## Documentation

- [README.ru.md](./README.ru.md) — Russian documentation
- [docs/ru/README.md](./docs/ru/README.md) — Russian docs index
- [docs/ru/notifications.md](./docs/ru/notifications.md) — notification channels & focus routing
- [docs/ru/settings.md](./docs/ru/settings.md) — settings tabs walkthrough
- [bff/README.md](./bff/README.md) — BFF proxy contract & run instructions
- [SECURITY.md](./SECURITY.md) — threat model & vulnerability reporting

---

## Author

Built and maintained by **[Aliaksei Patskevich (AVPDev)](https://avpdev.com)** —
[LinkedIn](https://linkedin.com/in/avp-dev) • [Telegram](https://t.me/AVP_Dev) • [Blog](https://avpdev.com/en/blog/)

---

## License

This project is released under the MIT License. See [LICENSE](./LICENSE).
