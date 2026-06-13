# Verity — Product Requirements Document

## Overview

Verity is a multi-tenant SaaS platform that extracts structured intelligence from sales call transcripts using LLMs, compares that intelligence against rep-submitted call forms, and surfaces actionable coaching insights through dashboards. Each company (tenant) configures their own evaluation templates and prompts — making Verity fully white-label and extensible.

---

## Problem Statement

Sales managers have no scalable way to evaluate call quality across their team. Listening to recordings manually is slow, inconsistent, and doesn't produce structured data. Reps self-report call outcomes with no cross-verification. Coaching decisions are based on gut feel, not evidence.

Verity solves this by automating transcript analysis, standardizing evaluation criteria per company, and generating dashboards that surface patterns across hundreds of calls.

---

## Target Users

| Role | Description |
|---|---|
| **Super Admin** | Verity team (india) — manages tenants, billing, platform config |
| **Company Admin** | Client company's admin — configures templates, manages reps and managers |
| **Manager** | Reviews call analyses, dashboard, coaches reps |
| **Rep** | Submits call forms, views own feedback |

---

## Core Concepts

### Tenant
A company using Verity. Each tenant has isolated data and their own evaluation template.

### Evaluation Template
Per-tenant configuration that defines:
- The LLM prompt for transcript analysis
- The JSON output schema the LLM must follow
- The comparison prompt (how to compare analysis vs rep form)

### Call
A sales call with a transcript (uploaded as file or text). Goes through a lifecycle: `uploaded → queued → analyzing → analyzed → form_pending → compared → complete`

### Call Analysis
LLM-generated structured output for a call, conforming to the tenant's evaluation template.

### Rep Form
Structured form submitted by the rep after the call.

### Comparison
LLM-generated comparison between the call analysis and rep form — surfaces alignment, mismatches, and findings.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | NestJS + TypeScript |
| Database | MongoDB (Mongoose) |
| Queue | BullMQ + Redis |
| File Storage | AWS S3 |
| LLM | Anthropic Claude API |
| Validation | Zod |
| Auth | JWT + Refresh Tokens |
| Frontend | React + TypeScript + Tailwind + Recharts |
| Hosting | Railway (MVP), AWS ECS (scale) |

---

## Data Models

### Company (Tenant)
```
_id, name, slug, plan, isActive, createdAt
```

### User
```
_id, companyId, name, email, passwordHash, role (super_admin | company_admin | manager | rep), isActive, createdAt
```

### EvaluationTemplate
```
_id
companyId
isActive (boolean — only one active per company)
callAnalysisPrompt (string — LLM instruction, with {{transcript}} placeholder)
outputSchema (JSON Schema object — defines LLM response shape)
createdAt
```

### Call
```
_id
companyId
repId
managerId (optional)
transcriptUrl (S3 key)
status (uploaded | queued | analyzing | analyzed | form_pending | comparing | complete | failed)
createdAt, updatedAt
```

### CallAnalysis
```
_id
callId
companyId
rawLlmOutput (string — original LLM response, for debugging)
parsedOutput (object — validated structured output)
score (number 0-100, if template includes scoring)
analysisStatus (success | validation_failed | llm_error)
createdAt
```

### RepForm
```
_id
callId
companyId
repId
datapoints (object — key-value pairs submitted by the rep)
submittedAt
```

### ComparisonResult
```
_id
callId
companyId
alignmentScore (number 0-100)
findings (array of { field, repValue, transcriptValue, status: match|mismatch|partial, note })
rawLlmOutput (string)
createdAt
```

---

## API Endpoints

### Auth
```
POST /auth/login
```

### Companies (Super Admin)
```
POST   /companies
GET    /companies
GET    /companies/:id
PATCH  /companies/:id
```

### Users
```
POST   /users (company admin creates reps/managers)
GET    /users (scoped to company)
PATCH  /users/:id
DELETE /users/:id
```

### Evaluation Templates
```
POST   /templates
GET    /templates/active (get current active template for company)
PATCH  /templates/:id/activate
```

### Calls
```
POST   /calls (upload transcript — triggers analysis job)
GET    /calls (list, filterable by rep, date, status)
GET    /calls/:id
GET    /calls/:id/analysis
GET    /calls/:id/comparison
POST   /calls/:id/form (rep submits form — triggers comparison job)
```

### Analytics
```
GET    /analytics/summary (overall stats for company)
GET    /analytics/reps (per-rep breakdown)
GET    /analytics/trends (time-series data)
GET    /analytics/fields (frequency of field values across calls)
```

---

## Core Flows

### Flow 1: Call Analysis
```
1. Rep/manager uploads transcript (file or text) → POST /calls
2. Call saved with status: queued
3. BullMQ job enqueued: analyze-call
4. Job processor:
   a. Fetch active EvaluationTemplate for company
   b. Build prompt using template.prompt + transcript
   c. Call Claude API
   d. Validate response against template.outputSchema (Zod)
   e. If valid: save CallAnalysis, update Call status → analyzed
   f. If invalid: save raw output, update Call status → failed, alert
5. HTTP response to client: 202 Accepted + jobId
```

### Flow 2: Rep Form Submission
```
1. Rep submits form → POST /calls/:id/form
2. RepForm saved
3. Call status → comparing
4. BullMQ job enqueued: compare-call
5. Job processor:
   a. Fetch CallAnalysis + RepForm
   b. Fetch template.comparisonPrompt
   c. Build prompt with both datasets
   d. Call Claude API
   e. Parse and save ComparisonResult
   f. Update Call status → complete
```

### Flow 3: Dashboard Load
```
1. Manager loads dashboard
2. Frontend calls GET /analytics/summary + /analytics/fields
3. Backend runs MongoDB aggregation queries on CallAnalysis + ComparisonResult
4. Returns structured aggregated data
5. Frontend renders charts (no LLM involved)
```

---

## Multi-Tenancy Rules

- Every DB document has `companyId`
- All queries are scoped by `companyId` extracted from JWT
- Super admin can query across companies
- Company admins cannot access other companies' data
- Only one active template per company at a time

---

## Non-Functional Requirements

- LLM calls must be async (BullMQ) — never block HTTP responses
- All LLM outputs must be validated before saving — raw output always preserved for debugging
- S3 transcript URLs must use presigned URLs (never public)
- JWT access tokens: 7 day expiry (no refresh tokens for MVP)
- API rate limiting per tenant (configurable)
- All endpoints require auth except /auth/login

---

## MVP Scope (Phase 1)

- [ ] Auth (login, JWT, refresh)
- [ ] Company + User management
- [ ] Evaluation Template CRUD
- [ ] Call upload + async LLM analysis
- [ ] Rep form submission + async comparison
- [ ] Call detail view (analysis + comparison)
- [ ] Basic analytics dashboard (field frequency, rep scores, call list)

## Phase 2

- [ ] Template versioning UI (deferred)
- [ ] Bulk call upload
- [ ] Email notifications (analysis complete, weekly digest)
- [ ] Rep self-service dashboard
- [ ] Webhook support (notify external systems on call complete)
- [ ] Billing integration (Stripe, per-seat or per-call)

## Phase 3

- [ ] White-label (custom domain per tenant)
- [ ] API access for tenants (they call Verity programmatically)
- [ ] LLM provider choice per tenant (OpenAI, Anthropic, Gemini)
- [ ] Fine-tuned models per tenant
