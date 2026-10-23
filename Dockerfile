FROM node:22-alpine AS build
WORKDIR /preview
COPY package.json package-lock.json ./
RUN npm ci
COPY index.html vite.config.mjs ./
COPY web ./web
RUN npm run build

FROM caddy:2-alpine
COPY --from=build /preview/dist /srv
COPY Caddyfile /etc/caddy/Caddyfile
COPY start.sh /usr/local/bin/start-preview
RUN chmod +x /usr/local/bin/start-preview
CMD ["/usr/local/bin/start-preview"]
