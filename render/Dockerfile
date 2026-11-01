# Export worker image: Playwright's Chromium + ffmpeg + the card site. Build from the repo root:
#   docker build -f render/Dockerfile -t namecard-render .
FROM mcr.microsoft.com/playwright:v1.64.1-noble
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY render/package.json render/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY render/clock.js render/render.mjs render/worker.mjs ./
COPY cards ./site/cards
USER pwuser
ENV NODE_ENV=production
CMD ["node", "worker.mjs"]
