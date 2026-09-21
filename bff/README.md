# BFF (Backend for Frontend) — optional proxy for multi-user prod

Pure-SPA mode keeps `apiTokenInstance` in the browser (session/local storage).
For untrusted multi-user deployments run this BFF: tokens live in the server
vault, the browser sends only `idInstance`.

## Run

```bash
cd bff
BFF_PORT=3101 \
BFF_TOKENS_JSON='{"310022742216":"<token>"}' \
GREEN_API_BASE=https://3100.api.green-api.com \
BFF_CORS_ORIGINS=https://web.max.example.com \
node server.mjs
```

Single-instance shortcut instead of JSON vault:

```bash
BFF_ID_INSTANCE=310022742216 BFF_API_TOKEN=<token> node server.mjs
```

Health: `GET /health` → `{ ok: true, mode: 'bff', instances: N }`.

## Client wiring

Build-time (Vite embeds at build):

```bash
VITE_BFF_URL=https://bff.example.com npm run build
# or docker-compose build.args (see VITE_BFF_URL in .env)
```

Then enable per-device: Settings → Connection → «BFF-прокси».
Client routes `sendMessage / receiveNotification / deleteNotification`
through the BFF without the token (`src/utils/bffClient.ts`).
Diagnostics/journal endpoints still go direct.
