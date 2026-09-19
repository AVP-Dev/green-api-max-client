# Multi-stage build for production-ready SPA hosting

# -----------------------------------------------------------------------------
# Stage 1: Build application assets
# -----------------------------------------------------------------------------
FROM node:22-bookworm-slim AS builder

WORKDIR /app

# Copy dependency manifests first to leverage Docker layer caching
COPY package.json package-lock.json* ./

# Install project dependencies
RUN npm ci || npm install --include=dev

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

# Expose standard web port
EXPOSE 80

# Health check to ensure Nginx is answering requests
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost/ || exit 1

# Launch Nginx in the foreground
CMD ["nginx", "-g", "daemon off;"]
