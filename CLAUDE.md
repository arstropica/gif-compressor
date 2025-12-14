# GIF Compressor

A local Docker-based GIF compression tool that replicates Freeconvert's GIF compression functionality using **gifsicle** with lossy LZW compression.

## Quick Start

```bash
# Production (Docker)
docker-compose up --build

# Development (requires local Redis on port 6379)
npm install
npm run dev
```

Access the app at **http://localhost:5050**

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend                              │
│  React 18 + Vite + TypeScript + Tailwind + Radix UI         │
│  State: Zustand | Data: TanStack React Query                │
└─────────────────────┬───────────────────────────────────────┘
                      │ HTTP + WebSocket
┌─────────────────────▼───────────────────────────────────────┐
│                        Backend                               │
│  Express.js + TypeScript                                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │   Routes    │  │   Queue     │  │  Compress   │         │
│  │  /api/*     │  │  p-queue    │  │  gifsicle   │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
└─────────────────────┬───────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────┐
│                     Data Layer                               │
│  ┌─────────────────────┐  ┌─────────────────────┐          │
│  │  SQLite             │  │  Redis              │          │
│  │  Job persistence    │  │  Pub/sub for        │          │
│  │  + history          │  │  real-time updates  │          │
│  └─────────────────────┘  └─────────────────────┘          │
└─────────────────────────────────────────────────────────────┘
```

## Features

- **Drag/drop multiple GIFs** for batch compression
- **Global settings** applied to all files, or **per-image overrides**
- **Download individual** compressed files or **all as ZIP**
- **Compression statistics** showing file size reduction percentage
- **Configurable queue concurrency** (1-10 parallel jobs, default 2)
- **Filterable job history** with search and status filters
- **Real-time progress** via WebSocket
- **Resize with best-fit** logic (maintains aspect ratio, never upscales)
- **TTL-based cleanup** via `GIF_RETENTION_TTL` environment variable

## Compression Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `compression_level` | 1-200 | 75 | Lossy LZW compression (`gifsicle --lossy=N`) |
| `drop_frames` | none/n2/n3/n4 | none | Keep every Nth frame |
| `reduce_colors` | boolean | false | Enable color palette reduction |
| `number_of_colors` | 2-256 | 256 | Target palette size |
| `optimize_transparency` | boolean | true | Replace duplicate pixels with transparency |
| `undo_optimizations` | boolean | false | Reset prior optimizations first |
| `resize_enabled` | boolean | false | Enable resizing |
| `target_width` | number | null | Max width for best-fit resize |
| `target_height` | number | null | Max height for best-fit resize |

### Best-Fit Resize Logic

When resizing is enabled, images scale to fit within target dimensions while maintaining aspect ratio:

```
Example: 512x512 input with 384x256 target
Scale factors: X = 384/512 = 0.75, Y = 256/512 = 0.5
Result: Uses min(0.75, 0.5) = 0.5 → 256x256 output
```

## API Endpoints

### Upload & Download
- `POST /api/upload` - Upload GIF(s) with compression options
- `GET /api/download/:jobId` - Download compressed GIF
- `GET /api/download/:jobId/original` - Download original GIF
- `GET /api/download/zip/archive?ids=a,b,c` - Download multiple as ZIP

### Jobs
- `GET /api/jobs` - List jobs (query: `status`, `filename`, `limit`, `offset`)
- `GET /api/jobs/counts` - Get counts by status
- `GET /api/jobs/:id` - Get single job
- `DELETE /api/jobs/:id` - Delete job and files
- `POST /api/jobs/:id/retry` - Retry failed job

### Queue
- `GET /api/queue/config` - Get concurrency setting
- `PUT /api/queue/config` - Set concurrency (`{ "concurrency": N }`)

### System
- `GET /api/health` - Health check

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 5050 | Server port |
| `REDIS_URL` | redis://redis:6379/0 | Redis connection string |
| `DATABASE_PATH` | /app/data/gif-compressor.db | SQLite database path |
| `UPLOAD_DIR` | /app/uploads | Uploaded files directory |
| `OUTPUT_DIR` | /app/output | Compressed files directory |
| `GIF_RETENTION_TTL` | (empty) | Seconds until auto-cleanup, empty = indefinite |
| `DEFAULT_CONCURRENCY` | 2 | Initial queue concurrency |
| `MAX_CONCURRENCY` | 10 | Maximum allowed concurrency |
| `MAX_FILE_SIZE` | 104857600 | Max upload size in bytes (100MB) |

## Project Structure

```
gif-compressor/
├── docker-compose.yml          # Redis + app services
├── Dockerfile                  # Multi-stage build with gifsicle
├── package.json
├── vite.config.ts              # Frontend build config
├── tailwind.config.js
├── tsconfig.json               # Frontend TypeScript
├── tsconfig.server.json        # Backend TypeScript
├── server/
│   ├── index.ts                # Express server entry
│   ├── websocket.ts            # WebSocket + Redis pub/sub
│   ├── types.ts                # Server-side types
│   ├── db/
│   │   ├── schema.ts           # SQLite schema
│   │   └── client.ts           # Database operations
│   ├── routes/
│   │   ├── upload.ts           # File upload handling
│   │   ├── jobs.ts             # Job CRUD + filters
│   │   ├── download.ts         # Single + ZIP download
│   │   └── queue.ts            # Concurrency settings
│   └── services/
│       ├── compression.ts      # Gifsicle wrapper
│       ├── queue.ts            # p-queue job processor
│       └── cleanup.ts          # TTL-based file cleanup
└── src/
    ├── main.tsx                # React entry
    ├── App.tsx                 # Router + providers
    ├── index.css               # Tailwind + CSS variables
    ├── api/
    │   ├── types.ts            # Shared TypeScript types
    │   └── client.ts           # API fetch functions
    ├── components/
    │   ├── ui/                 # Radix UI primitives
    │   ├── upload/
    │   │   ├── DropZone.tsx    # Drag/drop area
    │   │   └── FileList.tsx    # Pending files list
    │   ├── settings/
    │   │   ├── GlobalSettings.tsx
    │   │   ├── PerImageSettings.tsx
    │   │   └── QueueSettings.tsx
    │   ├── jobs/
    │   │   ├── JobList.tsx     # Filterable history
    │   │   ├── JobCard.tsx     # Single job display
    │   │   ├── JobFilters.tsx
    │   │   └── JobStatusBadge.tsx
    │   └── layout/
    │       └── Header.tsx
    ├── hooks/
    │   ├── useJobs.ts          # React Query hooks
    │   └── useWebSocket.ts     # Real-time updates
    ├── store/
    │   ├── settingsStore.ts    # Compression options (persisted)
    │   ├── uploadStore.ts      # Pending files state
    │   └── jobsStore.ts        # Filters + selection
    └── pages/
        ├── HomePage.tsx        # Upload + settings
        └── HistoryPage.tsx     # Job history
```

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18, Vite, TypeScript |
| State | Zustand (persisted to localStorage) |
| Data Fetching | TanStack React Query v5 |
| Real-time | WebSocket + Redis pub/sub |
| Styling | Tailwind CSS + Radix UI |
| Backend | Express.js + TypeScript |
| Database | SQLite (better-sqlite3) |
| Cache/PubSub | Redis 7 |
| Compression | gifsicle |
| Queue | p-queue |
| Container | Docker + Docker Compose |

## How It Works

1. **Upload**: Files are uploaded via multipart form to `/api/upload`
2. **Queue**: Jobs are added to p-queue with configurable concurrency
3. **Process**: gifsicle compresses each GIF with specified options
4. **Notify**: Redis pub/sub broadcasts progress to WebSocket clients
5. **Store**: Results saved to SQLite, files to disk
6. **Cleanup**: Optional cron job removes expired files based on TTL

## Background

This tool replicates the compression functionality of [Freeconvert's GIF Compressor](https://www.freeconvert.com/gif-compressor). Analysis of their API revealed they use:

- **Lossy LZW compression** via gifsicle's `--lossy` flag (default level 75)
- **Frame optimization** with `-O3`
- **Optional color reduction**, transparency optimization, and frame dropping

The key to high-quality compression without banding artifacts is using moderate lossy levels (75) without aggressive color reduction.
