# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies for better-sqlite3
RUN apk add --no-cache python3 make g++

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

# Install gifsicle, curl for healthcheck, and runtime deps for better-sqlite3
RUN apk add --no-cache gifsicle curl

# Copy package files and install production dependencies
COPY package*.json ./
RUN apk add --no-cache python3 make g++ && \
    npm ci --only=production && \
    apk del python3 make g++

# Copy built assets from builder
COPY --from=builder /app/dist ./dist

# Copy baseline model (pre-generated from training data)
COPY server/model/baseline.json ./dist/server/model/baseline.json

# Create directories for uploads/output/data
RUN mkdir -p /app/uploads /app/output /app/data

# Set environment variables
ENV NODE_ENV=production
ENV PORT=5050
ENV UPLOAD_DIR=/app/uploads
ENV OUTPUT_DIR=/app/output
ENV DATABASE_PATH=/app/data/gif-compressor.db

# Volume for persistent data
VOLUME ["/app/uploads", "/app/output", "/app/data"]

EXPOSE 5050

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD curl -f http://localhost:5050/api/health || exit 1

CMD ["node", "dist/server/index.js"]
