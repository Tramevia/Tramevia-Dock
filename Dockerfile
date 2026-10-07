# Tramevia Dock — production image (Docker, Railway, Render…)
FROM node:24-alpine
LABEL org.opencontainers.image.source="https://github.com/Tramevia/Tramevia-Dock" \
      org.opencontainers.image.description="Self-hosted multistream control room for OBS: unified chat, community lists and stream info for Twitch, Kick, YouTube and TikTok."
# CONTAINER=1 tells the in-app updater this is a Docker install (notice only, it never changes its own files).
ENV NODE_ENV=production CONTAINER=1 HOST=0.0.0.0 PORT=8787 DATA_DIR=/data
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY src ./src
COPY public ./public
RUN mkdir -p /data && chown node:node /data
USER node
VOLUME /data
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8787)+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "src/server.js"]
