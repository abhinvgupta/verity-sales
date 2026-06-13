
What This Project Is
Verity is a multi-tenant SaaS platform for sales call intelligence. It ingests call transcripts, runs LLM-based analysis using per-tenant configurable prompts and schemas, compares analysis against rep-submitted forms, and surfaces coaching dashboards.
Read this file fully before writing any code.

Tech Stack
* Runtime: Node.js (LTS) with Bun as package manager
* Framework: NestJS + TypeScript (strict mode)
* Database: MongoDB via Mongoose
* Queue: BullMQ + Redis (ioredis)
* Storage: AWS S3 (presigned URLs only — never public bucket)
* LLM: OpenAI API (openai)
* Validation: Zod (primary), class-validator only where NestJS requires it
* Auth: JWT (access 15min) + Refresh tokens (7 days, stored in DB)
* Frontend: React + TypeScript + Tailwind CSS + Recharts
* Testing: Jest + Supertest

Project Structure


verity/
├── apps/
│   ├── api/                          # NestJS backend
│   │   ├── src/
│   │   │   ├── main.ts
│   │   │   ├── app.module.ts
│   │   │   ├── common/
│   │   │   │   ├── decorators/
│   │   │   │   ├── filters/          # Global exception filter
│   │   │   │   ├── guards/           # JwtAuthGuard, RolesGuard
│   │   │   │   ├── interceptors/
│   │   │   │   └── pipes/            # ZodValidationPipe
│   │   │   ├── config/               # ConfigModule setup
│   │   │   ├── modules/
│   │   │   │   ├── auth/
│   │   │   │   ├── companies/
│   │   │   │   ├── users/
│   │   │   │   ├── templates/        # EvaluationTemplate CRUD
│   │   │   │   ├── calls/            # Call lifecycle
│   │   │   │   ├── analysis/         # LLM analysis job processor
│   │   │   │   ├── forms/            # Rep form submission
│   │   │   │   ├── comparison/       # LLM comparison job processor
│   │   │   │   ├── analytics/        # Aggregation queries
│   │   │   │   └── storage/          # S3 service
│   │   │   └── database/
│   │   │       └── schemas/          # All Mongoose schemas
│   │   └── test/
│   └── web/                          # React frontend
│       └── src/
│           ├── pages/
│           ├── components/
│           ├── hooks/
│           ├── api/                  # API client (axios)
│           └── store/
├── packages/
│   └── shared/                       # Shared TypeScript types
│       └── src/
│           ├── types/
│           └── constants/
└── turbo.json

Coding Conventions
General
* Never use console.log — use NestJS Logger in backend, structured logging only
* All environment variables accessed via ConfigService — never process.env directly in business logic
NestJS Patterns
* Repository pattern — services never call Mongoose models directly


  class CallsService {
    constructor(private readonly callsRepo: CallsRepository) {}
  }
* Controllers are thin — only handle HTTP concerns (extract params, call service, return response)
* Services contain business logic only
* Repositories contain all DB queries
* Every module exports only what other modules need
Validation
* Use Zod schemas for all API input validation via custom ZodValidationPipe
* Zod schemas live in dto/ folders alongside their module
* LLM output is validated against Zod before saving — raw output always preserved
Error Handling
* Global exception filter catches all unhandled errors
* Services throw typed NestJS exceptions (NotFoundException, BadRequestException, etc.)
* Never leak stack traces to API responses in production
* LLM validation failures: save raw output, update call status to failed, do NOT throw — log and continue
Multi-Tenancy
* Every DB query MUST be scoped by companyId
* companyId is always extracted from the authenticated JWT payload — never from request body
* Add a TenantGuard that injects companyId into the request context
* Super admin bypass: check role === 'super_admin' before scoping

Database Rules
IDs are string UUIDs — never ObjectId
* Every schema declares _id: { type: String, default: () => randomUUID() } (randomUUID from node:crypto)
* All foreign keys (companyId, repId, callId, …) are plain strings: { type: String, ref: '...', required: true, index: true }
* Never use Types.ObjectId anywhere — no casting, no isValidObjectId checks
Mongoose Schemas
* Every schema includes companyId: { type: String, ref: 'Company', required: true, index: true }
* Always add indexes for fields used in queries — declare them explicitly in schema
* Use timestamps: true on all schemas
* Never use .lean() without a reason — document it when you do
Query Patterns
* Always filter by companyId first
* Use aggregation pipeline for analytics — never fetch all documents and compute in JS

LLM Integration Rules
CRITICAL: LLM calls are always async via BullMQ
* Never call the OpenAI API inside an HTTP request handler
* HTTP handler enqueues job → returns 202 Accepted
* BullMQ processor runs the actual LLM call
Prompt Construction
* Prompts are stored in EvaluationTemplate.prompt in MongoDB — not hardcoded
* Use a PromptBuilder service that interpolates {{transcript}}, {{schema}} placeholders
* Always append strict JSON instruction at the end of every prompt:


  Respond ONLY with valid JSON. No preamble, no explanation, no markdown fences.
Output Validation


typescript
// Always follow this pattern
const raw = await this.openai.chat.completions.create({ ... })
const text = raw.choices[0]?.message?.content ?? ''

// Save raw always
analysis.rawLlmOutput = text

// Then validate
const parsed = safeParseJson(text)
const result = templateSchema.safeParse(parsed)

if (!result.success) {
  analysis.analysisStatus = 'validation_failed'
  await this.analysisRepo.save(analysis)
  this.logger.error('LLM validation failed', { callId, errors: result.error })
  return // do not throw
}

analysis.parsedOutput = result.data
analysis.analysisStatus = 'success'
Model
* Always use gpt-4o
* max_tokens: 2000 for analysis, max_tokens: 1000 for comparison
* Use response_format: { type: 'json_object' } to enforce valid JSON
* Temperature: not set (use default) — we want consistent structured output

Queue Rules (BullMQ)
* Queue names: analyze-call, compare-call
* Job data must be minimal: { callId: string, companyId: string } — fetch everything else inside the processor
* Retry config: { attempts: 3, backoff: { type: 'exponential', delay: 5000 } }
* On final failure: update call status to failed, emit event for alerting
* Never put sensitive data (transcript text, tokens) in job payload

Auth Rules
* JWT access token payload: { sub: userId, companyId, role, email }
* Refresh tokens stored in DB (hashed) with expiry
* JwtAuthGuard applied globally — whitelist public routes with @Public() decorator
* @Roles('manager', 'company_admin') decorator for role-based access
* Password hashing: bcrypt with 12 rounds

S3 Rules
* Transcripts stored at key: transcripts/{companyId}/{callId}/{filename}
* Always generate presigned URLs for upload and download — bucket is never public
* Presigned upload URL expiry: 15 minutes
* Presigned download URL expiry: 1 hour
* StorageService wraps all S3 operations — never call S3 SDK directly from other modules

API Response Shape
All responses follow this envelope:


typescript
// Success
{ success: true, data: T, meta?: { page, limit, total } }

// Error
{ success: false, error: { code: string, message: string } }
Use a global response interceptor to wrap successful responses automatically.

Environment Variables


env
# App
NODE_ENV=development
PORT=3000

# MongoDB
MONGODB_URI=mongodb://localhost:27017/verity

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# JWT
JWT_SECRET=
JWT_REFRESH_SECRET=

# AWS
AWS_REGION=
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
S3_BUCKET_NAME=

# OpenAI
OPENAI_API_KEY=

# Frontend
VITE_API_URL=http://localhost:3000

What NOT to Do
* Do NOT hardcode any taxonomy, prompts, or output schemas — these belong to EvaluationTemplate in DB
* Do NOT call LLM APIs synchronously inside HTTP handlers
* Do NOT put companyId in request body for scoping — always use JWT
* Do NOT use any type
* Do NOT generate frontend before backend API is stable
* Do NOT skip Zod validation on LLM output
* Do NOT expose raw LLM errors or stack traces in API responses
* Do NOT use .env values directly — always use ConfigService
* Do NOT write aggregation logic in application code — use MongoDB aggregation pipeline

Build Order
Build in this exact order. Do not skip ahead.
1. Monorepo setup (Turborepo, shared package)
2. Database schemas (all Mongoose schemas + indexes)
3. Shared types package
4. Auth module (login, JWT, refresh, guards)
5. Companies module
6. Users module
7. Templates module (EvaluationTemplate CRUD)
8. Storage module (S3 service)
9. 
10. Calls module (upload, lifecycle management)
11. Analysis module (BullMQ processor, LLM call, validation)
12. Forms module (rep form submission)
13. Comparison module (BullMQ processor, LLM comparison)
14. Analytics module (aggregation endpoints)
15. Frontend — auth pages
16. Frontend — call upload + detail page
17. Frontend — dashboard + charts

When Generating Code
* Always check if a schema, service, or constant already exists before creating a new one
* Import from @verity/shared for shared types
* Add JSDoc comments on all public service methods
* Generate unit test stubs alongside every service file
* Never leave TODO comments — either implement or raise as a question
