# RetireOps - Technical Architecture

**System Design for 1000+ Concurrent Users on Docker**

Version: 1.0.0
Last Updated: 2025-12-15
Target Scale: 1000+ concurrent users
Deployment: Docker containers on cloud infrastructure

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Architecture Overview](#architecture-overview)
3. [Technology Stack](#technology-stack)
4. [System Components](#system-components)
5. [Docker Infrastructure](#docker-infrastructure)
6. [Scalability & Performance](#scalability--performance)
7. [Security Architecture](#security-architecture)
8. [Data Architecture](#data-architecture)
9. [API Design](#api-design)
10. [Monitoring & Operations](#monitoring--operations)
11. [Deployment Strategy](#deployment-strategy)
12. [Cost Estimation](#cost-estimation)

---

## Executive Summary

### System Requirements

**Functional Requirements:**

- Canadian retirement planning calculations (tax, benefits, projections)
- Support for 1000+ concurrent users
- Real-time Monte Carlo simulations (1000+ runs)
- Complex multi-year projections (30-40 years)
- Scenario comparison and analysis
- PDF report generation
- Multi-tenant isolation

**Non-Functional Requirements:**

- **Performance:** < 2 seconds for deterministic projections
- **Performance:** < 5 seconds for Monte Carlo simulations
- **Availability:** 99.9% uptime (8.76 hours downtime/year)
- **Scalability:** Horizontal scaling to 10,000+ users
- **Security:** SOC 2 Type II compliance ready
- **Data Privacy:** PIPEDA compliant (Canadian privacy law)

---

## Architecture Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Load Balancer                            │
│                    (NGINX / AWS ALB)                             │
└────────────┬────────────────────────────────────────────────────┘
             │
    ┌────────┴────────┐
    │                 │
    ▼                 ▼
┌─────────┐      ┌─────────┐      ┌─────────┐
│  Web    │      │  Web    │ ...  │  Web    │
│ Server  │      │ Server  │      │ Server  │
│ (Next)  │      │ (Next)  │      │ (Next)  │
└────┬────┘      └────┬────┘      └────┬────┘
     │                │                │
     └────────┬───────┴────────────────┘
              │
              ▼
     ┌────────────────┐
     │   API Gateway  │
     │   (Node.js)    │
     └────────┬───────┘
              │
     ┌────────┴────────────────────────────┐
     │                                     │
     ▼                                     ▼
┌─────────────┐                    ┌──────────────┐
│ Calculation │                    │   Worker     │
│   Engine    │◄───────────────────│    Queue     │
│  (Node.js)  │                    │   (Redis)    │
└──────┬──────┘                    └──────┬───────┘
       │                                  │
       │         ┌────────────────────────┘
       │         │
       ▼         ▼
   ┌─────────────────┐        ┌──────────────┐
   │   PostgreSQL    │        │    Redis     │
   │   (Primary DB)  │        │    Cache     │
   └─────────────────┘        └──────────────┘
```

### Architecture Pattern: Microservices with Shared Calculation Engine

**Why This Pattern:**

- **Performance:** Calculation engine can be optimized separately
- **Scalability:** Scale web servers and calculation workers independently
- **Maintainability:** Clear separation of concerns
- **Cost:** Efficient resource utilization (calculation-heavy workloads isolated)

---

## Technology Stack

### Core Technologies

| Layer                  | Technology               | Justification                                      |
| ---------------------- | ------------------------ | -------------------------------------------------- |
| **Frontend**           | Next.js 14 + React 18    | SSR for SEO, React Server Components, excellent DX |
| **UI Framework**       | Tailwind CSS + shadcn/ui | Modern, performant, accessible components          |
| **Backend API**        | Node.js 20 + Express     | JavaScript everywhere, excellent JSON handling     |
| **Calculation Engine** | TypeScript + Node.js     | Type safety for complex calculations, shared code  |
| **Database**           | PostgreSQL 16            | ACID compliance, JSON support, proven reliability  |
| **Cache**              | Redis 7                  | In-memory performance, pub/sub for real-time       |
| **Queue**              | BullMQ (Redis-based)     | Job scheduling, retries, priority queues           |
| **Authentication**     | NextAuth.js + JWT        | Industry standard, supports multiple providers     |
| **PDF Generation**     | Puppeteer                | Full HTML/CSS rendering, charts support            |
| **Charts**             | Recharts                 | React-native, declarative, performant              |
| **Containerization**   | Docker + Docker Compose  | Development parity, easy deployment                |
| **Orchestration**      | Kubernetes (K8s)         | Production-grade scaling, self-healing             |

### Development Tools

| Purpose             | Tool                                      |
| ------------------- | ----------------------------------------- |
| **Language**        | TypeScript 5.3+                           |
| **Package Manager** | pnpm (faster than npm/yarn)               |
| **Testing**         | Jest + React Testing Library + Playwright |
| **Linting**         | ESLint + Prettier                         |
| **Type Checking**   | TypeScript strict mode                    |
| **CI/CD**           | GitHub Actions                            |
| **Monitoring**      | Prometheus + Grafana                      |
| **Logging**         | Winston + ELK Stack                       |
| **Error Tracking**  | Sentry                                    |

---

## System Components

### 1. Web Server (Next.js)

**Responsibilities:**

- Server-side rendering for initial page loads
- Client-side hydration and interactivity
- Session management
- Static asset serving
- API route handlers (lightweight only)

**Configuration:**

```typescript
// next.config.js
module.exports = {
  output: 'standalone', // For Docker optimization
  compress: true,
  poweredByHeader: false,

  // Performance optimizations
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },

  // Image optimization
  images: {
    domains: ['cdn.retireops.com'],
    formats: ['image/avif', 'image/webp'],
  },

  // Environment variables
  env: {
    API_BASE_URL: process.env.API_BASE_URL,
  },
};
```

**Scaling:**

- Run 3-10 replicas behind load balancer
- Auto-scale based on CPU (target: 70%)
- Each instance: 512MB RAM, 0.5 CPU

---

### 2. API Gateway (Express)

**Responsibilities:**

- Authentication and authorization
- Rate limiting
- Request validation
- Routing to calculation engine
- Response transformation
- WebSocket connections (for real-time updates)

**Key Routes:**

```typescript
// Core API structure
POST   /api/v1/projections              // Create new projection
GET    /api/v1/projections/:id          // Get projection results
PUT    /api/v1/projections/:id          // Update projection
DELETE /api/v1/projections/:id          // Delete projection

POST   /api/v1/projections/:id/scenarios         // Create scenario
GET    /api/v1/projections/:id/scenarios/:sid    // Get scenario
POST   /api/v1/projections/:id/compare           // Compare scenarios

POST   /api/v1/monte-carlo/:id          // Run Monte Carlo (async)
GET    /api/v1/monte-carlo/:id/status   // Check MC job status

POST   /api/v1/reports/:id/pdf          // Generate PDF report
GET    /api/v1/reports/:id/pdf/download // Download PDF

GET    /api/v1/tax-tables/:year/:province  // Get tax tables
GET    /api/v1/benefit-rates/:year          // Get CPP/OAS rates

// User management
POST   /api/v1/auth/register            // User registration
POST   /api/v1/auth/login               // Login
POST   /api/v1/auth/refresh             // Token refresh
GET    /api/v1/users/me                 // Current user profile
```

**Rate Limiting:**

```typescript
import rateLimit from 'express-rate-limit';

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
});

// Heavy computation endpoints
const computeLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 Monte Carlo runs per minute
});

app.use('/api/', apiLimiter);
app.use('/api/v1/monte-carlo', computeLimiter);
```

---

### 3. Calculation Engine (Core Business Logic)

**Modular Architecture:**

```
src/calculation-engine/
├── core/
│   ├── projection-engine.ts      # Main simulation loop
│   ├── tax-engine.ts              # Tax calculations
│   ├── account-engine.ts          # Account rules & updates
│   ├── benefit-engine.ts          # CPP/OAS/GIS calculations
│   ├── withdrawal-engine.ts       # Withdrawal strategies
│   └── monte-carlo-engine.ts      # Monte Carlo simulation
│
├── models/
│   ├── user-profile.model.ts
│   ├── account.model.ts
│   ├── income.model.ts
│   ├── projection.model.ts
│   └── scenario.model.ts
│
├── config/
│   ├── tax-tables/
│   │   ├── federal-2024.json
│   │   ├── federal-2025.json
│   │   ├── ontario-2024.json
│   │   └── ... (all provinces)
│   ├── rrif-rates.json
│   ├── cpp-rates.json
│   └── oas-rates.json
│
├── utils/
│   ├── date-utils.ts
│   ├── money-utils.ts
│   ├── tax-utils.ts
│   └── math-utils.ts
│
└── workers/
    ├── projection-worker.ts       # Background projection jobs
    └── monte-carlo-worker.ts      # Background MC jobs
```

**Key Calculation Functions:**

```typescript
// projection-engine.ts
export class ProjectionEngine {
  /**
   * Run year-by-year projection
   * @returns Array of yearly results
   */
  async runProjection(input: ProjectionInput): Promise<ProjectionOutput> {
    const results: YearlyProjection[] = [];

    let state = this.initializeState(input);

    for (let year = input.startYear; year <= input.endYear; year++) {
      // Step 1: Process age-based events
      state = this.processAgeEvents(state, year);

      // Step 2: Calculate income
      const income = this.calculateIncome(state, year);

      // Step 3: Calculate withdrawals
      const withdrawals = this.calculateWithdrawals(state, year);

      // Step 4: Apply investment growth
      state = this.applyGrowth(state, year);

      // Step 5: Calculate taxes
      const taxes = this.calculateTaxes(income, state, year);

      // Step 6: Update balances
      state = this.updateBalances(state, income, withdrawals, year);

      // Record year results
      results.push({
        year,
        age: this.calculateAge(state.profile.birthdate, year),
        income,
        withdrawals,
        taxes,
        balances: state.balances,
        // ... more fields
      });
    }

    return {
      summary: this.generateSummary(results),
      yearlyData: results,
      successMetrics: this.calculateMetrics(results),
    };
  }
}
```

**Performance Optimizations:**

```typescript
// 1. Memoization for tax calculations
import memoize from 'fast-memoize';

const calculateTaxMemoized = memoize((income: number, province: string, year: number) => {
  return calculateTax(income, province, year);
});

// 2. Worker threads for Monte Carlo
import { Worker } from 'worker_threads';

export async function runMonteCarlo(
  input: ProjectionInput,
  simulations: number = 1000
): Promise<MonteCarloResult> {
  const workers = os.cpus().length;
  const simulationsPerWorker = Math.ceil(simulations / workers);

  const workerPromises = Array(workers)
    .fill(null)
    .map((_, i) => {
      return new Promise((resolve) => {
        const worker = new Worker('./monte-carlo-worker.js', {
          workerData: {
            input,
            simulations: simulationsPerWorker,
            seed: i,
          },
        });
        worker.on('message', resolve);
      });
    });

  const results = await Promise.all(workerPromises);
  return aggregateResults(results);
}

// 3. Streaming for large projections
export function* streamProjection(input: ProjectionInput) {
  for (let year = input.startYear; year <= input.endYear; year++) {
    yield calculateYear(year);
  }
}
```

---

### 4. Database Layer (PostgreSQL)

**Schema Design:**

```sql
-- Users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  last_login TIMESTAMP,
  is_active BOOLEAN DEFAULT true,
  subscription_tier VARCHAR(50) DEFAULT 'free'
);

-- Projections table
CREATE TABLE projections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,

  -- Store entire input as JSON for flexibility
  input_data JSONB NOT NULL,

  -- Cache computed results
  output_data JSONB,

  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  last_calculated TIMESTAMP,

  -- Performance tracking
  calculation_time_ms INTEGER,

  -- Version for schema migrations
  schema_version VARCHAR(10) DEFAULT '1.0.0',

  -- Indexes
  CONSTRAINT projections_name_length CHECK (char_length(name) <= 255)
);

-- Scenarios table (for comparisons)
CREATE TABLE scenarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  projection_id UUID REFERENCES projections(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,

  -- Modifications from base projection
  modifications JSONB NOT NULL,

  -- Computed results
  output_data JSONB,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Monte Carlo jobs (for async processing)
CREATE TABLE monte_carlo_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  projection_id UUID REFERENCES projections(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,

  status VARCHAR(50) DEFAULT 'pending', -- pending, running, completed, failed
  simulations INTEGER DEFAULT 1000,

  -- Results
  result_data JSONB,

  -- Progress tracking
  progress INTEGER DEFAULT 0, -- 0-100

  -- Timing
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),

  -- Error handling
  error_message TEXT
);

-- Shared tax/benefit configuration (cached)
CREATE TABLE config_data (
  id SERIAL PRIMARY KEY,
  config_type VARCHAR(50) NOT NULL, -- 'tax_table', 'cpp_rate', etc.
  year INTEGER NOT NULL,
  province VARCHAR(2), -- NULL for federal
  data JSONB NOT NULL,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(config_type, year, province)
);

-- Indexes for performance
CREATE INDEX idx_projections_user_id ON projections(user_id);
CREATE INDEX idx_projections_updated ON projections(updated_at DESC);
CREATE INDEX idx_scenarios_projection ON scenarios(projection_id);
CREATE INDEX idx_mc_jobs_status ON monte_carlo_jobs(status) WHERE status IN ('pending', 'running');
CREATE INDEX idx_mc_jobs_user ON monte_carlo_jobs(user_id);
CREATE INDEX idx_config_lookup ON config_data(config_type, year, province);

-- JSONB indexes for faster queries
CREATE INDEX idx_projections_input ON projections USING GIN(input_data);
CREATE INDEX idx_projections_output ON projections USING GIN(output_data);
```

**Connection Pooling:**

```typescript
import { Pool } from 'pg';

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,

  // Connection pool settings for 1000+ users
  max: 20, // Maximum connections in pool
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,

  // Performance tuning
  statement_timeout: 10000, // 10s max query time
  query_timeout: 10000,
});

export const query = (text: string, params?: any[]) => {
  return pool.query(text, params);
};
```

---

### 5. Caching Layer (Redis)

**Use Cases:**

1. **Session Storage** (user authentication)
2. **API Response Caching** (tax tables, benefit rates)
3. **Computed Projection Caching** (expensive calculations)
4. **Job Queue** (Monte Carlo, PDF generation)
5. **Rate Limiting** (per-user request tracking)
6. **Real-time Pub/Sub** (progress updates)

**Configuration:**

```typescript
import Redis from 'ioredis';

// Primary cache
export const redis = new Redis({
  host: process.env.REDIS_HOST,
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,

  // Performance
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,

  // Connection pool
  lazyConnect: true,

  // Cluster mode for scaling
  // cluster: [
  //   { host: 'redis-1', port: 6379 },
  //   { host: 'redis-2', port: 6379 },
  // ],
});

// Cache strategies
export class CacheService {
  // Cache projection results for 1 hour
  async cacheProjection(id: string, data: any) {
    await redis.setex(
      `projection:${id}`,
      3600, // 1 hour TTL
      JSON.stringify(data)
    );
  }

  // Cache tax tables for 1 year (changes annually)
  async cacheTaxTable(province: string, year: number, data: any) {
    await redis.setex(
      `tax:${province}:${year}`,
      31536000, // 1 year
      JSON.stringify(data)
    );
  }

  // Invalidate cache on update
  async invalidateProjection(id: string) {
    await redis.del(`projection:${id}`);
  }
}
```

---

### 6. Job Queue (BullMQ)

**Queue Architecture:**

```typescript
import { Queue, Worker } from 'bullmq';

// Monte Carlo queue (high priority)
export const monteCarloQueue = new Queue('monte-carlo', {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
    removeOnComplete: 100, // Keep last 100 completed
    removeOnFail: 500,
  },
});

// PDF generation queue (lower priority)
export const pdfQueue = new Queue('pdf-generation', {
  connection: redis,
  defaultJobOptions: {
    attempts: 2,
    backoff: {
      type: 'fixed',
      delay: 2000,
    },
  },
});

// Worker for Monte Carlo
const mcWorker = new Worker(
  'monte-carlo',
  async (job) => {
    const { projectionId, simulations } = job.data;

    // Update progress
    await job.updateProgress(0);

    const result = await runMonteCarloSimulation(projectionId, simulations, (progress) =>
      job.updateProgress(progress)
    );

    await job.updateProgress(100);
    return result;
  },
  {
    connection: redis,
    concurrency: 5, // Run 5 MC jobs concurrently
  }
);

// Listen for progress events
mcWorker.on('progress', (job, progress) => {
  // Publish to WebSocket for real-time UI updates
  pubsub.publish(`mc:${job.data.projectionId}`, {
    progress,
    status: 'running',
  });
});
```

---

## Docker Infrastructure

### Docker Compose (Development)

```yaml
# docker-compose.yml
version: '3.9'

services:
  # Load Balancer
  nginx:
    image: nginx:alpine
    ports:
      - '80:80'
      - '443:443'
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/ssl:/etc/nginx/ssl:ro
    depends_on:
      - web
      - api
    networks:
      - retireops-network

  # Web Frontend (Next.js) - 3 replicas
  web:
    build:
      context: ./apps/web
      dockerfile: Dockerfile
    environment:
      - NODE_ENV=production
      - NEXT_PUBLIC_API_URL=http://api:4000
    deploy:
      replicas: 3
      resources:
        limits:
          cpus: '0.5'
          memory: 512M
        reservations:
          cpus: '0.25'
          memory: 256M
    healthcheck:
      test: ['CMD', 'curl', '-f', 'http://localhost:3000/api/health']
      interval: 30s
      timeout: 10s
      retries: 3
    networks:
      - retireops-network

  # API Gateway
  api:
    build:
      context: ./apps/api
      dockerfile: Dockerfile
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://retireops:${DB_PASSWORD}@postgres:5432/retireops
      - REDIS_URL=redis://redis:6379
      - JWT_SECRET=${JWT_SECRET}
    deploy:
      replicas: 3
      resources:
        limits:
          cpus: '1.0'
          memory: 1024M
    depends_on:
      - postgres
      - redis
    healthcheck:
      test: ['CMD', 'curl', '-f', 'http://localhost:4000/health']
      interval: 30s
      timeout: 10s
      retries: 3
    networks:
      - retireops-network

  # Calculation Workers
  worker:
    build:
      context: ./apps/worker
      dockerfile: Dockerfile
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://retireops:${DB_PASSWORD}@postgres:5432/retireops
      - REDIS_URL=redis://redis:6379
    deploy:
      replicas: 5 # Scale based on load
      resources:
        limits:
          cpus: '2.0'
          memory: 2048M
    depends_on:
      - postgres
      - redis
    networks:
      - retireops-network

  # PostgreSQL Database
  postgres:
    image: postgres:16-alpine
    environment:
      - POSTGRES_DB=retireops
      - POSTGRES_USER=retireops
      - POSTGRES_PASSWORD=${DB_PASSWORD}
      - POSTGRES_INITDB_ARGS=--encoding=UTF8 --lc-collate=C --lc-ctype=C
    volumes:
      - postgres-data:/var/lib/postgresql/data
      - ./database/init.sql:/docker-entrypoint-initdb.d/init.sql
    ports:
      - '5432:5432'
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 4096M
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U retireops']
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - retireops-network

  # Redis Cache & Queue
  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes --maxmemory 2gb --maxmemory-policy noeviction
    volumes:
      - redis-data:/data
    ports:
      - '6379:6379'
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 2048M
    healthcheck:
      test: ['CMD', 'redis-cli', 'ping']
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - retireops-network

  # Monitoring - Prometheus
  prometheus:
    image: prom/prometheus:latest
    volumes:
      - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus-data:/prometheus
    ports:
      - '9090:9090'
    networks:
      - retireops-network

  # Monitoring - Grafana
  grafana:
    image: grafana/grafana:latest
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=${GRAFANA_PASSWORD}
    volumes:
      - grafana-data:/var/lib/grafana
      - ./monitoring/grafana/dashboards:/etc/grafana/provisioning/dashboards
    ports:
      - '3001:3000'
    depends_on:
      - prometheus
    networks:
      - retireops-network

volumes:
  postgres-data:
  redis-data:
  prometheus-data:
  grafana-data:

networks:
  retireops-network:
    driver: bridge
```

### Dockerfile Examples

**Next.js Web App:**

```dockerfile
# apps/web/Dockerfile
FROM node:20-alpine AS base

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Dependencies stage
FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Builder stage
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build Next.js app
RUN pnpm build

# Production stage
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy built application
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

CMD ["node", "server.js"]
```

**API Gateway:**

```dockerfile
# apps/api/Dockerfile
FROM node:20-alpine AS base

RUN corepack enable && corepack prepare pnpm@latest --activate

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 apiuser

COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./

USER apiuser

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:4000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

CMD ["node", "dist/index.js"]
```

---

## Scalability & Performance

### Horizontal Scaling Strategy

```yaml
# kubernetes/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: retireops-web
spec:
  replicas: 3 # Start with 3, auto-scale to 10
  selector:
    matchLabels:
      app: retireops-web
  template:
    metadata:
      labels:
        app: retireops-web
    spec:
      containers:
        - name: web
          image: retireops/web:latest
          resources:
            requests:
              memory: '256Mi'
              cpu: '250m'
            limits:
              memory: '512Mi'
              cpu: '500m'
          ports:
            - containerPort: 3000
          env:
            - name: NEXT_PUBLIC_API_URL
              valueFrom:
                configMapKeyRef:
                  name: app-config
                  key: api_url
---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: retireops-web-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: retireops-web
  minReplicas: 3
  maxReplicas: 10
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: 80
```

### Performance Benchmarks

| Operation                            | Target     | Expected |
| ------------------------------------ | ---------- | -------- |
| Simple projection (1 user, 30 years) | < 2s       | ~500ms   |
| Monte Carlo (1000 simulations)       | < 5s       | ~3s      |
| Scenario comparison (3 scenarios)    | < 3s       | ~1.5s    |
| PDF generation                       | < 10s      | ~5s      |
| API response (cached)                | < 100ms    | ~50ms    |
| Database query (indexed)             | < 50ms     | ~20ms    |
| Concurrent users (1000)              | < 2s (p95) | ~1s      |

### Optimization Techniques

**1. Calculation Optimizations:**

```typescript
// Lazy evaluation
class LazyProjection {
  private _results: Map<number, YearlyProjection> = new Map();

  getYear(year: number): YearlyProjection {
    if (!this._results.has(year)) {
      this._results.set(year, this.calculateYear(year));
    }
    return this._results.get(year)!;
  }
}

// Parallel processing for Monte Carlo
async function runMonteCarloParallel(
  input: ProjectionInput,
  simulations: number
): Promise<MonteCarloResult[]> {
  const batchSize = 100;
  const batches = Math.ceil(simulations / batchSize);

  const results = await Promise.all(
    Array(batches)
      .fill(null)
      .map((_, i) => runSimulationBatch(input, batchSize, i * batchSize))
  );

  return results.flat();
}
```

**2. Database Optimizations:**

```sql
-- Materialized view for common aggregations
CREATE MATERIALIZED VIEW user_projection_summary AS
SELECT
  user_id,
  COUNT(*) as projection_count,
  MAX(updated_at) as last_updated,
  AVG(calculation_time_ms) as avg_calc_time
FROM projections
GROUP BY user_id;

-- Refresh periodically
CREATE INDEX idx_projection_summary ON user_projection_summary(user_id);

-- Partitioning for large tables
CREATE TABLE monte_carlo_jobs_partitioned (
  LIKE monte_carlo_jobs INCLUDING ALL
) PARTITION BY RANGE (created_at);

CREATE TABLE mc_jobs_2024_q4 PARTITION OF monte_carlo_jobs_partitioned
  FOR VALUES FROM ('2024-10-01') TO ('2025-01-01');
```

**3. Caching Strategy:**

```typescript
// Multi-level cache
class CacheManager {
  private l1Cache: Map<string, any> = new Map(); // In-memory
  private l2Cache: Redis; // Redis

  async get(key: string): Promise<any> {
    // Try L1 (fastest)
    if (this.l1Cache.has(key)) {
      return this.l1Cache.get(key);
    }

    // Try L2
    const l2Value = await this.l2Cache.get(key);
    if (l2Value) {
      this.l1Cache.set(key, JSON.parse(l2Value));
      return JSON.parse(l2Value);
    }

    return null;
  }

  async set(key: string, value: any, ttl: number) {
    this.l1Cache.set(key, value);
    await this.l2Cache.setex(key, ttl, JSON.stringify(value));
  }
}
```

---

## Security Architecture

### Authentication & Authorization

```typescript
// JWT-based authentication
import jwt from 'jsonwebtoken';

interface JWTPayload {
  userId: string;
  email: string;
  role: 'user' | 'advisor' | 'admin';
  tier: 'free' | 'premium' | 'enterprise';
}

export function generateAccessToken(payload: JWTPayload): string {
  return jwt.sign(payload, process.env.JWT_SECRET!, {
    expiresIn: '15m', // Short-lived
    issuer: 'retireops.com',
    audience: 'retireops-api',
  });
}

export function generateRefreshToken(userId: string): string {
  return jwt.sign({ userId, type: 'refresh' }, process.env.JWT_REFRESH_SECRET!, {
    expiresIn: '7d',
  });
}

// Middleware
export const authenticateJWT = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as JWTPayload;
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Invalid token' });
  }
};

// Role-based access control
export const requireRole = (...roles: string[]) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
};
```

### Data Encryption

```typescript
// Encrypt sensitive data at rest
import crypto from 'crypto';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY!; // 32 bytes
const IV_LENGTH = 16;

export function encrypt(text: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY, 'hex'), iv);

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  return iv.toString('hex') + ':' + encrypted;
}

export function decrypt(text: string): string {
  const [ivHex, encryptedHex] = text.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY, 'hex'), iv);

  let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

// Use for sensitive fields
class UserModel {
  async createUser(email: string, password: string) {
    const hashedPassword = await bcrypt.hash(password, 12);
    const encryptedEmail = encrypt(email); // If needed for GDPR

    return db.query(
      'INSERT INTO users (email, password_hash) VALUES ($1, $2)',
      [email, hashedPassword] // Email not encrypted for login lookup
    );
  }
}
```

### API Security Headers

```typescript
import helmet from 'helmet';
import cors from 'cors';

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https://cdn.retireops.com'],
      },
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
  })
);

app.use(
  cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['https://retireops.com'],
    credentials: true,
    maxAge: 86400,
  })
);

// CSRF protection for state-changing operations
import csrf from 'csurf';
const csrfProtection = csrf({ cookie: true });
app.post('/api/*', csrfProtection, (req, res, next) => next());
```

---

## Data Architecture

### Data Flow Diagram

```
┌─────────────┐
│   User      │
│  (Browser)  │
└──────┬──────┘
       │ HTTPS
       ▼
┌─────────────────┐
│  Load Balancer  │
└──────┬──────────┘
       │
       ▼
┌─────────────────┐      ┌──────────────┐
│  Web Server     │◄────►│  Redis Cache │
│  (Next.js SSR)  │      │  (Sessions)  │
└──────┬──────────┘      └──────────────┘
       │ REST/GraphQL
       ▼
┌─────────────────┐      ┌──────────────┐
│   API Gateway   │◄────►│  Redis Cache │
│  (Auth, Route)  │      │  (API Cache) │
└──────┬──────────┘      └──────────────┘
       │
       ├─────────────────────┬──────────────────────┐
       │                     │                      │
       ▼                     ▼                      ▼
┌──────────────┐    ┌────────────────┐    ┌─────────────┐
│ Calculation  │    │  Job Queue     │    │ PostgreSQL  │
│   Engine     │    │  (BullMQ)      │    │  Database   │
│  (Sync)      │    │                │    │             │
└──────────────┘    └────┬───────────┘    └─────────────┘
                         │
                         ▼
                  ┌──────────────┐
                  │   Worker     │
                  │   Processes  │
                  │  (MC, PDF)   │
                  └──────────────┘
```

### Data Retention Policy

```typescript
// Automated cleanup jobs
import cron from 'node-cron';

// Delete old completed Monte Carlo jobs after 30 days
cron.schedule('0 2 * * *', async () => {
  // 2 AM daily
  await db.query(`
    DELETE FROM monte_carlo_jobs
    WHERE status = 'completed'
      AND completed_at < NOW() - INTERVAL '30 days'
  `);
});

// Archive old projections (>1 year inactive)
cron.schedule('0 3 * * 0', async () => {
  // 3 AM Sundays
  await db.query(`
    UPDATE projections
    SET archived = true
    WHERE updated_at < NOW() - INTERVAL '1 year'
      AND archived = false
  `);
});

// GDPR compliance - user data export
export async function exportUserData(userId: string): Promise<any> {
  const user = await db.query('SELECT * FROM users WHERE id = $1', [userId]);
  const projections = await db.query('SELECT * FROM projections WHERE user_id = $1', [userId]);
  const scenarios = await db.query(
    `
    SELECT s.* FROM scenarios s
    JOIN projections p ON s.projection_id = p.id
    WHERE p.user_id = $1
  `,
    [userId]
  );

  return {
    user: user.rows[0],
    projections: projections.rows,
    scenarios: scenarios.rows,
    exportedAt: new Date().toISOString(),
  };
}

// GDPR compliance - right to be forgotten
export async function deleteUserData(userId: string): Promise<void> {
  await db.query('BEGIN');
  try {
    await db.query('DELETE FROM monte_carlo_jobs WHERE user_id = $1', [userId]);
    await db.query('DELETE FROM projections WHERE user_id = $1', [userId]); // Cascades
    await db.query('DELETE FROM users WHERE id = $1', [userId]);
    await db.query('COMMIT');
  } catch (err) {
    await db.query('ROLLBACK');
    throw err;
  }
}
```

---

## API Design

### REST API Specifications

**Base URL:** `https://api.retireops.com/v1`

**Authentication:** Bearer token in `Authorization` header

**Response Format:**

```typescript
// Success response
interface SuccessResponse<T> {
  success: true;
  data: T;
  metadata?: {
    timestamp: string;
    version: string;
  };
}

// Error response
interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
  };
}

// Paginated response
interface PaginatedResponse<T> {
  success: true;
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}
```

**Example Endpoints:**

```typescript
// POST /api/v1/projections
// Create new projection
app.post('/api/v1/projections', authenticateJWT, async (req, res) => {
  try {
    const input = validateProjectionInput(req.body);

    // Save to database
    const projection = await db.query(
      `INSERT INTO projections (user_id, name, input_data)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [req.user.userId, input.name, JSON.stringify(input)]
    );

    // Queue calculation job
    await calculationQueue.add('calculate-projection', {
      projectionId: projection.rows[0].id,
      userId: req.user.userId,
    });

    res.status(202).json({
      success: true,
      data: {
        id: projection.rows[0].id,
        status: 'pending',
        message: 'Projection queued for calculation',
      },
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_INPUT',
        message: err.message,
      },
    });
  }
});

// GET /api/v1/projections/:id
// Get projection results
app.get('/api/v1/projections/:id', authenticateJWT, async (req, res) => {
  try {
    // Check cache first
    const cached = await cache.get(`projection:${req.params.id}`);
    if (cached) {
      return res.json({
        success: true,
        data: cached,
        metadata: { cached: true },
      });
    }

    // Fetch from database
    const result = await db.query(
      `SELECT * FROM projections
       WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.user.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Projection not found',
        },
      });
    }

    const projection = result.rows[0];

    // Cache result
    await cache.set(`projection:${req.params.id}`, projection.output_data, 3600);

    res.json({
      success: true,
      data: projection.output_data,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch projection',
      },
    });
  }
});
```

### GraphQL Alternative (Optional)

```typescript
import { ApolloServer, gql } from 'apollo-server-express';

const typeDefs = gql`
  type Projection {
    id: ID!
    name: String!
    description: String
    input: ProjectionInput!
    output: ProjectionOutput
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type ProjectionOutput {
    summary: ProjectionSummary!
    yearlyData: [YearlyProjection!]!
    successMetrics: SuccessMetrics!
  }

  type Query {
    projection(id: ID!): Projection
    projections(limit: Int, offset: Int): [Projection!]!
    scenarios(projectionId: ID!): [Scenario!]!
  }

  type Mutation {
    createProjection(input: CreateProjectionInput!): Projection!
    updateProjection(id: ID!, input: UpdateProjectionInput!): Projection!
    deleteProjection(id: ID!): Boolean!

    runMonteCarlo(projectionId: ID!, simulations: Int!): MonteCarloJob!
  }

  type Subscription {
    monteCarloProgress(jobId: ID!): MonteCarloProgress!
  }
`;

const resolvers = {
  Query: {
    projection: async (_, { id }, context) => {
      if (!context.user) throw new Error('Unauthorized');
      return await ProjectionService.findById(id, context.user.userId);
    },
  },

  Mutation: {
    createProjection: async (_, { input }, context) => {
      if (!context.user) throw new Error('Unauthorized');
      return await ProjectionService.create(input, context.user.userId);
    },
  },

  Subscription: {
    monteCarloProgress: {
      subscribe: (_, { jobId }, context) => {
        return pubsub.asyncIterator(`mc:${jobId}`);
      },
    },
  },
};

const server = new ApolloServer({
  typeDefs,
  resolvers,
  context: ({ req }) => ({
    user: req.user, // From JWT middleware
  }),
});
```

---

## Monitoring & Operations

### Prometheus Metrics

```typescript
import prometheus from 'prom-client';

// Create metrics
const httpRequestDuration = new prometheus.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.5, 1, 2, 5, 10],
});

const projectionCalculationDuration = new prometheus.Histogram({
  name: 'projection_calculation_duration_seconds',
  help: 'Time to calculate projection',
  labelNames: ['type'], // 'deterministic' or 'monte_carlo'
  buckets: [0.5, 1, 2, 5, 10, 30, 60],
});

const activeUsers = new prometheus.Gauge({
  name: 'active_users_total',
  help: 'Number of currently active users',
});

const databaseConnectionPool = new prometheus.Gauge({
  name: 'database_connection_pool_size',
  help: 'Current database connection pool size',
  labelNames: ['state'], // 'idle', 'active'
});

// Expose metrics endpoint
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', prometheus.register.contentType);
  res.end(await prometheus.register.metrics());
});

// Instrument code
app.use((req, res, next) => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    httpRequestDuration
      .labels(req.method, req.route?.path || req.path, res.statusCode)
      .observe(duration);
  });

  next();
});
```

### Logging Strategy

```typescript
import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: {
    service: 'retireops-api',
    environment: process.env.NODE_ENV,
  },
  transports: [
    // Console for development
    new winston.transports.Console({
      format: winston.format.combine(winston.format.colorize(), winston.format.simple()),
    }),

    // File for production
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      maxsize: 10485760, // 10MB
      maxFiles: 5,
    }),
    new winston.transports.File({
      filename: 'logs/combined.log',
      maxsize: 10485760,
      maxFiles: 10,
    }),
  ],
});

// Structured logging
logger.info('Projection calculated', {
  projectionId: '123',
  userId: 'user-456',
  calculationTimeMs: 1234,
  yearsCovered: 30,
});

// Error tracking with Sentry
import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1, // 10% of transactions
});

app.use(Sentry.Handlers.requestHandler());
app.use(Sentry.Handlers.errorHandler());
```

### Health Checks

```typescript
// Comprehensive health check
app.get('/health', async (req, res) => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    checks: {
      database: 'unknown',
      redis: 'unknown',
      queue: 'unknown',
    },
  };

  try {
    // Check database
    await db.query('SELECT 1');
    health.checks.database = 'ok';
  } catch (err) {
    health.checks.database = 'error';
    health.status = 'degraded';
  }

  try {
    // Check Redis
    await redis.ping();
    health.checks.redis = 'ok';
  } catch (err) {
    health.checks.redis = 'error';
    health.status = 'degraded';
  }

  try {
    // Check queue
    const jobCounts = await monteCarloQueue.getJobCounts();
    health.checks.queue = jobCounts.waiting < 100 ? 'ok' : 'warning';
  } catch (err) {
    health.checks.queue = 'error';
  }

  const statusCode = health.status === 'ok' ? 200 : 503;
  res.status(statusCode).json(health);
});
```

---

## Deployment Strategy

### CI/CD Pipeline (GitHub Actions)

```yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Run linting
        run: pnpm lint

      - name: Run type checking
        run: pnpm type-check

      - name: Run unit tests
        run: pnpm test:unit

      - name: Run integration tests
        run: pnpm test:integration

      - name: Upload coverage
        uses: codecov/codecov-action@v3

  build:
    needs: test
    runs-on: ubuntu-latest
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'

    steps:
      - uses: actions/checkout@v3

      - name: Log in to Container Registry
        uses: docker/login-action@v2
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Build and push Docker images
        run: |
          docker build -t ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}/web:${{ github.sha }} ./apps/web
          docker build -t ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}/api:${{ github.sha }} ./apps/api
          docker build -t ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}/worker:${{ github.sha }} ./apps/worker

          docker push ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}/web:${{ github.sha }}
          docker push ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}/api:${{ github.sha }}
          docker push ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}/worker:${{ github.sha }}

  deploy:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to Kubernetes
        uses: azure/k8s-deploy@v4
        with:
          manifests: |
            kubernetes/deployment.yaml
            kubernetes/service.yaml
          images: |
            ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}/web:${{ github.sha }}
            ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}/api:${{ github.sha }}
            ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}/worker:${{ github.sha }}
          kubectl-version: 'latest'
```

### Blue-Green Deployment

```yaml
# kubernetes/blue-green-deployment.yaml
apiVersion: v1
kind: Service
metadata:
  name: retireops-web
spec:
  selector:
    app: retireops-web
    version: blue # Switch to 'green' for deployment
  ports:
    - port: 80
      targetPort: 3000
---
# Blue deployment
apiVersion: apps/v1
kind: Deployment
metadata:
  name: retireops-web-blue
spec:
  replicas: 3
  selector:
    matchLabels:
      app: retireops-web
      version: blue
  template:
    metadata:
      labels:
        app: retireops-web
        version: blue
    spec:
      containers:
        - name: web
          image: retireops/web:1.0.0
---
# Green deployment (new version)
apiVersion: apps/v1
kind: Deployment
metadata:
  name: retireops-web-green
spec:
  replicas: 3
  selector:
    matchLabels:
      app: retireops-web
      version: green
  template:
    metadata:
      labels:
        app: retireops-web
        version: green
    spec:
      containers:
        - name: web
          image: retireops/web:1.1.0
```

---

## Cost Estimation

### Infrastructure Costs (Monthly)

**Cloud Provider: AWS (ap-southeast-2 - Sydney)**

| Component             | Specification              | Quantity | Monthly Cost (USD) |
| --------------------- | -------------------------- | -------- | ------------------ |
| **Compute (ECS/EKS)** |                            |          |                    |
| Web Servers           | t3.small (2 vCPU, 2GB)     | 3        | $45                |
| API Servers           | t3.medium (2 vCPU, 4GB)    | 3        | $90                |
| Workers               | c6i.large (2 vCPU, 4GB)    | 5        | $225               |
| **Database**          |                            |          |                    |
| RDS PostgreSQL        | db.t3.large (2 vCPU, 8GB)  | 1        | $140               |
| Read Replica          | db.t3.medium (2 vCPU, 4GB) | 1        | $70                |
| Storage (SSD)         | 100GB                      | 1        | $12                |
| **Cache & Queue**     |                            |          |                    |
| ElastiCache Redis     | cache.t3.medium            | 1        | $65                |
| **Load Balancer**     |                            |          |                    |
| Application LB        | -                          | 1        | $25                |
| **Storage**           |                            |          |                    |
| S3 (backups, PDFs)    | 50GB                       | 1        | $1.50              |
| EBS Volumes           | 200GB SSD                  | 3        | $20                |
| **Monitoring**        |                            |          |                    |
| CloudWatch            | Logs + Metrics             | 1        | $30                |
| **Data Transfer**     |                            |          |                    |
| Outbound              | 500GB/month                | 1        | $45                |
| **CDN**               |                            |          |                    |
| CloudFront            | 1TB transfer               | 1        | $85                |
| **Backup**            |                            |          |                    |
| Automated Backups     | 30 days retention          | 1        | $25                |
| **Total**             |                            |          | **~$878/month**    |

**At Scale (10,000 users):**

- Auto-scaling: +$500/month
- Database scaling: +$300/month
- CDN: +$200/month
- **Total: ~$1,878/month**

### Alternative: DigitalOcean (Lower Cost)

| Component              | Specification     | Monthly Cost (USD) |
| ---------------------- | ----------------- | ------------------ |
| Kubernetes Cluster     | 3 nodes, 8GB each | $120               |
| Managed PostgreSQL     | 4GB RAM, 2 vCPU   | $60                |
| Managed Redis          | 2GB RAM           | $40                |
| Load Balancer          | -                 | $12                |
| Spaces (S3-compatible) | 250GB             | $5                 |
| Backups                | Daily             | $20                |
| **Total**              |                   | **~$257/month**    |

---

## Summary

This technical architecture provides:

✅ **Scalability:** Horizontal scaling to 10,000+ users
✅ **Performance:** Sub-2-second projections, 5-second Monte Carlo
✅ **Reliability:** 99.9% uptime with health checks and auto-recovery
✅ **Security:** JWT auth, encryption, HTTPS, CSRF protection
✅ **Observability:** Prometheus metrics, structured logging, Sentry
✅ **Cost-Effective:** Starting at $257/month (DigitalOcean) to $878/month (AWS)
✅ **Developer-Friendly:** Docker Compose for local development
✅ **Production-Ready:** Kubernetes deployment with CI/CD

### Next Steps

1. **Phase 1:** Set up Docker Compose locally
2. **Phase 2:** Deploy to DigitalOcean Kubernetes
3. **Phase 3:** Implement monitoring and logging
4. **Phase 4:** Load testing and optimization
5. **Phase 5:** Scale to AWS if needed

---

**Document Version:** 1.0.0
**Last Updated:** 2025-12-15
**Owner:** RetireOps Development Team
