FROM node:20-slim

WORKDIR /app

# Set production environment
ENV NODE_ENV=production
ENV PORT=8080

# Install production dependencies only
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy application source code
COPY server.js config.js ./
COPY src/ ./src/
COPY public/ ./public/
COPY data/ ./data/

# Run as non-root user
USER node

EXPOSE 8080

CMD ["node", "server.js"]
