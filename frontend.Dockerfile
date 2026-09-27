FROM node:24-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --legacy-peer-deps
COPY tsconfig*.json vite.config.ts index.html ./
COPY src/ ./src/
# Vite's publicDir — static assets copied verbatim to the site root at build
# time (robots.txt, sitemap.xml, icons, offline.html, push-handler.js).
COPY public/ ./public/
# Post-build helper that emits per-route HTML with page-specific Open-Graph meta.
COPY scripts/ ./scripts/

# Vite inlines VITE_* vars into the JS bundle AT BUILD TIME. The Stripe
# publishable key must therefore be passed as a build arg here, or checkout
# silently runs with an empty key in production. VITE_API_URL is left empty so
# the client uses the relative "/api" path (same-origin behind Caddy).
ARG VITE_STRIPE_KEY=""
ARG VITE_API_URL=""
ARG VITE_SENTRY_DSN=""
ARG SENTRY_ORG=""
ARG SENTRY_PROJECT=""
ARG SENTRY_AUTH_TOKEN=""
ENV VITE_STRIPE_KEY=$VITE_STRIPE_KEY
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_SENTRY_DSN=$VITE_SENTRY_DSN
ENV SENTRY_ORG=$SENTRY_ORG
ENV SENTRY_PROJECT=$SENTRY_PROJECT
ENV SENTRY_AUTH_TOKEN=$SENTRY_AUTH_TOKEN
RUN npm run build && node scripts/gen-og-pages.mjs

FROM nginx:1.27-alpine AS runner
COPY --from=builder /app/dist /usr/share/nginx/html
COPY <<'EOF' /etc/nginx/conf.d/default.conf
server {
    listen 80;
    root /usr/share/nginx/html;
    index index.html;

    gzip on;
    gzip_types text/css application/javascript application/json image/svg+xml;
    gzip_min_length 1024;

    # API + Server-Sent Events. Buffering MUST be off or the SSE stream
    # (/api/r/:slug/events) is held back by nginx and live order updates stall.
    location /api/ {
        proxy_pass http://qcart-api:3001/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Connection "";
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 3600s;
    }

    # User-uploaded images (menu items, logos) are stored on and served by the
    # API container at /uploads/*.
    location /uploads/ {
        proxy_pass http://qcart-api:3001/uploads/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # Hashed build assets are immutable — cache them hard.
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        try_files $uri =404;
    }

    # The SPA shell + service worker MUST always revalidate, or browsers
    # heuristically cache index.html/sw.js and keep serving a stale app for days
    # after a deploy. no-cache = "check freshness every time" (cheap 304s via
    # ETag) so new builds are picked up on the next load. Hashed /assets/ above
    # stay immutable, so this costs nothing for the heavy files.
    location ~* ^/(sw\.js|registerSW\.js|workbox-.*\.js|manifest\.webmanifest|index\.html|offline\.html)$ {
        add_header Cache-Control "no-cache, must-revalidate";
        try_files $uri =404;
    }

    # Vertical marketing pages get their own prerendered HTML (page-specific
    # Open-Graph for social unfurls); they still boot the SPA for real visitors.
    location = /hotels {
        add_header Cache-Control "no-cache, must-revalidate";
        add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' https://js.stripe.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https://api.stripe.com https://*.ingest.sentry.io; frame-src https://js.stripe.com; base-uri 'self'; form-action 'self'";
        try_files /hotels.html /index.html;
    }
    location = /restaurants {
        add_header Cache-Control "no-cache, must-revalidate";
        add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' https://js.stripe.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https://api.stripe.com https://*.ingest.sentry.io; frame-src https://js.stripe.com; base-uri 'self'; form-action 'self'";
        try_files /restaurants.html /index.html;
    }

    # CSP on the SPA HTML page — the API also sets it on /api/ as defence-in-depth.
    # Not at server level to avoid duplicating the API's own CSP on proxied responses.
    location / {
        add_header Cache-Control "no-cache, must-revalidate";
        add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' https://js.stripe.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https://api.stripe.com https://*.ingest.sentry.io; frame-src https://js.stripe.com; base-uri 'self'; form-action 'self'";
        try_files $uri $uri/ /index.html;
    }
}
EOF
