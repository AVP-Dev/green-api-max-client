# MAX Web Messenger Client

A lightweight, production-ready React web client designed to interface with the MAX messenger ecosystem via GREEN-API HTTP endpoints. It delivers a fast, responsive user interface inspired by modern web messaging standards, complete with chat management, message delivery status, contact search, and configurable gateway routing.

---

## Tech Stack

- **Frontend Framework:** React 19 / React 18+ (Functional Components, Hooks)
- **Language:** TypeScript 5+ (Strict Typing)
- **Bundler & Tooling:** Vite 6+
- **Styling:** Tailwind CSS (Utility-first, responsive layouts, custom color tokens)
- **Icons:** Lucide Icons (`lucide-react`)
- **State Management & Persistence:** React Context / Local State with `localStorage` persistence
- **Containerization:** Docker (Multi-stage build) & Nginx Alpine

---

## Features

- **MAX Ecosystem Compatibility:** Strict plain numeric phone formatting (e.g., `79991234567`) without external suffix pollution.
- **Bidirectional Communication:** Instant text messaging via `sendMessage` and real-time message reception via `receiveNotification`.
- **Gateway & Instance Routing:** Support for standard public GREEN-API gateway (`https://api.green-api.com`) as well as dedicated instance host routes (e.g. `https://7103.api.greenapi.com`).
- **Dialog Management:** Real-time search, chat creation, pinning conversations to the top, unread counters, and chat deletion.
- **Full Bilingual Localization:** Seamless runtime switching between Russian and English (UI controls, timestamps, status indicators, and alerts).
- **Responsive Layout:** Adaptive desktop split-pane and mobile-first full-screen viewport with bottom navigation.

---

## Getting Started

### Prerequisites
- Node.js 20.x or higher
- npm 10.x or higher (or pnpm / bun)

### Installation & Local Development

```bash
# Clone the repository
git clone https://github.com/your-username/max-web-messenger.git

# Navigate to project directory
cd max-web-messenger

# Install dependencies
npm install

# Start local development server (runs on port 3000)
npm run dev
```

The application will be available at `http://localhost:3000`.

### Production Build

```bash
# Type-check and build production bundle
npm run build

# Preview production build locally
npm run preview
```

Static build artifacts will be generated in the `dist/` directory.

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

## Project Structure

```
├── public/                 # Static assets, icons, and PWA manifest
├── scripts/                # Asset generation scripts
├── src/
│   ├── components/         # Modular React UI components
│   │   ├── AuthScreen.tsx       # Instance credential & gateway connection
│   │   ├── ChatArea.tsx         # Message viewport & action controls
│   │   ├── DialogList.tsx       # Conversation items with avatars and badges
│   │   ├── NewChatModal.tsx     # Contact phone validation modal
│   │   ├── SettingsModal.tsx    # Connection, gateway, audio & data controls
│   │   └── Sidebar.tsx          # Contact search, pin list & action header
│   ├── hooks/              # Custom React hooks (polling engine)
│   ├── i18n/               # Localization strings (EN / RU)
│   ├── services/           # GREEN-API REST client service
│   ├── types.ts            # Shared TypeScript interfaces & types
│   ├── utils/              # Formatting, sound chime, and avatar color hash
│   ├── App.tsx             # Root application orchestrator
│   └── main.tsx            # React application entry point
├── Dockerfile              # Multi-stage production container build
├── nginx.conf              # Production Nginx SPA routing & security headers
├── package.json            # Dependencies and npm scripts
└── tsconfig.json           # TypeScript configuration
```

---

## License

This project is released under the MIT License.
