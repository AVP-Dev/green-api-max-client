# Multi-stage build for production-ready SPA hosting

# -----------------------------------------------------------------------------
# Stage 1: Build application assets
# -----------------------------------------------------------------------------
FROM node:22-bookworm-slim AS builder

WORKDIR /app

# Build-time Vite env (вшиваются в бандл; runtime environment: для них не работает).
# Значения приходят из docker-compose build.args или --build-arg.
ARG VITE_TRUSTED_PARENT_ORIGINS=""
ARG VITE_DEFAULT_API_URL="https://3100.api.green-api.com"
ENV VITE_TRUSTED_PARENT_ORIGINS=$VITE_TRUSTED_PARENT_ORIGINS
ENV VITE_DEFAULT_API_URL=$VITE_DEFAULT_API_URL

# Copy dependency manifests (package-lock.json required for deterministic npm ci)
COPY package.json package-lock.json ./

# Install project dependencies deterministically for the target platform architecture
RUN npm ci --no-audit --no-fund

# Copy application source code
COPY . .

# Compile TypeScript and bundle frontend with Vite into /app/dist
RUN npm run build

# -----------------------------------------------------------------------------
# Stage 2: Serve static files with lightweight Nginx Alpine
# -----------------------------------------------------------------------------
FROM nginx:alpine AS runner

# Remove default Nginx template files
RUN rm -rf /usr/share/nginx/html/* /etc/nginx/conf.d/default.conf

# Copy production Nginx server block configured for Single Page Apps
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built artifacts from the builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# NOTE on USER: intentionally running the nginx master process as root so it can
# bind privileged ports 80/3000/8080 (Coolify default routing). Worker processes
# already drop privileges via `user nginx;` in the base image's /etc/nginx/nginx.conf.
# Switching to `USER nginx` would require moving all listeners to unprivileged
# ports (>=1024) and updating Coolify/docker-compose port mappings accordingly.
# Expose only port 80 as the canonical entrypoint (3000/8080 listeners are kept
# in nginx.conf solely for Coolify compatibility, not advertised here).
EXPOSE 80

# Health check to ensure Nginx is answering requests
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://127.0.0.1:80/ || wget --quiet --tries=1 --spider http://127.0.0.1:3000/ || exit 1

# Launch Nginx in the foreground
CMD ["nginx", "-g", "daemon off;"]
