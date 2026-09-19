# MAX Web Messenger Client

A lightweight, production-ready React web client designed to interface with the MAX messenger ecosystem via GREEN-API HTTP endpoints. It delivers a fast, responsive user interface inspired by modern web messaging standards, complete with chat management, message delivery status, contact search, and configurable gateway routing.

---

## Tech Stack

- **Frontend Framework:** React 19 (Functional Components, Hooks)
- **Language:** TypeScript 5+ (Strict Typing, `tsc --noEmit`)
- **Bundler & Tooling:** Vite 6+ with `@vitejs/plugin-react` and `vite-plugin-pwa`
- **Styling:** Tailwind CSS (Utility-first, responsive design, custom MAX brand gradients)
- **Icons:** Lucide Icons (`lucide-react`)
- **State Management & Persistence:** React State & Hooks with `localStorage` synchronization
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

---

## Getting Started

### Prerequisites
- Node.js 20.x or 22.x
- npm 10.x or higher (or pnpm / bun)

### Installation & Local Development

```bash
# Clone the repository
git clone https://github.com/your-username/max-web-messenger.git

# Navigate to project directory
cd max-web-messenger

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

---

## Continuous Integration & Deployment (CI/CD)

The repository is configured with a strict GitHub Actions workflow located at `.github/workflows/ci.yml`:

1. **Type Safety & Lint (`typecheck`):**
   - Runs on `ubuntu-latest` with Node.js 22.
   - Installs dependencies deterministically via `npm ci`.
   - Executes `tsc --noEmit` to guarantee zero type errors.

2. **Production Build (`build`):**
   - Compiles static assets using `npm run build` (`vite build`).
   - Verifies the integrity of `dist/index.html` and bundles.
   - Uploads compressed build artifacts for deployment.

3. **Docker Verification (`docker`):**
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

### 3. Security & Credential Management
- **Security Notice:** Inputting API tokens (`idInstance`, `apiTokenInstance`) directly into a browser SPA is suitable for demonstration environments, internal tooling, or personal single-tenant use.
- **BFF (Backend for Frontend) Best Practice:** For production deployments with multiple untrusted users, credentials should never be stored in browser `localStorage` or transmitted from client code. Instead, requests should be proxied through a secure backend (BFF) that manages secret credentials in a secure vault and authenticates end-users via JWT or session cookies.

---

## Verified Project Structure

```
├── .github/
│   └── workflows/
│       └── ci.yml             # GitHub Actions automated CI/CD pipeline
├── public/                    # Static web assets and PWA icons
│   ├── favicon.svg            # Favicon
│   ├── logo.svg               # MAX brand vector logo
│   ├── apple-touch-icon.png   # iOS touch icon
│   ├── pwa-192x192.png        # PWA standard icon
│   ├── pwa-512x512.png        # PWA splash icon
│   └── pwa-maskable-512x512.png # PWA maskable adaptive icon
├── scripts/
│   └── generate-icons.js      # Sharp-based icon generation utility
├── src/
│   ├── components/            # Modular React UI components
│   │   ├── AuthScreen.tsx     # Instance credentials & gateway configuration
│   │   ├── Avatar.tsx         # Initials extractor & deterministic pastel colors
│   │   ├── ChatView.tsx       # Message timeline, delivery status & compose input
│   │   ├── MaxLogo.tsx        # MAX brand vector mark
│   │   ├── MobileBottomNav.tsx # Mobile view tab navigation (Chats, New, Settings)
│   │   ├── NewChatModal.tsx   # Phone validation modal & contact creation
│   │   ├── OfflineIndicator.tsx # Floating network connectivity banner
│   │   ├── PWAInstallButton.tsx # Home screen installation button
│   │   ├── SettingsModal.tsx  # Diagnostics, gateway routing, audio & data reset
│   │   └── Sidebar.tsx        # Search bar, pinned chats & conversation list
│   ├── hooks/                 # Custom React hooks
│   │   ├── useGreenApiPolling.ts # Adaptive HTTP long-polling engine
│   │   ├── useOnlineStatus.ts # Browser online/offline event listener
│   │   └── usePWAInstall.ts   # PWA installation prompt controller
│   ├── i18n/                  # Localization dictionary
│   │   └── translations.ts    # Complete Russian and English translations
│   ├── services/              # API Client Service
│   │   └── greenApi.ts        # GREEN-API REST endpoints wrapper
│   ├── utils/                 # Pure helper functions
│   │   ├── formatters.ts      # International phone & timestamp formatting
│   │   └── sound.ts           # Web Audio API synthetic notification chime
│   ├── types.ts               # Shared TypeScript definitions
│   ├── index.css              # Tailwind utilities, brand styling & safe area insets
│   ├── App.tsx                # Central state coordinator & root component
│   └── main.tsx               # React application entry point
├── .dockerignore              # Exclusions for Docker image builds
├── .env.example               # Environment variables template
├── .gitignore                 # Version control ignores (credentials, dist, logs)
├── Dockerfile                 # Multi-stage production container build
├── docker-compose.yml         # Container orchestration manifest
├── index.html                 # HTML entry point with MAX meta tags
├── nginx.conf                 # Production Nginx SPA routing & caching
├── package.json               # Node.js project manifest & dependencies
├── package-lock.json          # Dependency lockfile for reproducible builds
├── tsconfig.json              # Strict TypeScript compiler options
└── vite.config.ts             # Vite bundler, Tailwind & PWA plugin config
```

---

## License

This project is released under the MIT License.
