# Design and Implementation

This document combines architecture, design decisions, and implementation details for the Driver Management Service.

> **Task Specification**: This implementation addresses the requirements outlined in [REQUIREMENTS.md](REQUIREMENTS.md), which describes the coding challenge for adding driver tipping functionality to the service.

## Table of Contents

1. [System Architecture](#system-architecture)
2. [Design Decisions](#design-decisions)
3. [Data Flow](#data-flow)
4. [Implementation Details](#implementation-details)
5. [Storage Strategy](#storage-strategy)

---

## System Architecture

### High-Level Architecture

![High-Level Architecture Diagram](High-Level-Architecture-Diagram.png)

**Components:**
- **API Gateway**: REST API entry point routing to Lambda functions
- **Lambda Functions**: 4 handlers (create/get driver, get tips, tip consumer)
- **Application Layer**: Handlers → Services → Repositories
- **Data Storage**: DynamoDB tables (drivers, tips) and SQS queue

**Architecture Pattern:**
```
API Gateway → Lambda Handler → Service → Repository → DynamoDB
```

### Component Responsibilities

**Handler Layer** (`src/handler.ts`):
- Parse HTTP events, validate with Zod schemas
- Map domain models to DTOs
- Handle errors and format responses

**Service Layer** (`src/services/driver.service.ts`):
- Business logic and orchestration
- Enforce business rules
- Generate UUIDs, calculate time buckets

**Repository Layer** (`src/repositories/`):
- Abstract data access
- Transform between domain models and DynamoDB items
- Implement aggregation logic

**Dependency Injection** (`src/di.ts`):
- Manual DI in composition root
- Wire repositories → services → handlers

---

## Design Decisions

| Decision | Rationale |
|----------|-----------|
| **Pre-aggregation** over raw events | O(1) reads, predictable costs, matches access pattern |
| **DynamoDB** over RDS | Serverless fit, atomic operations, fast reads |
| **Manual DI** over framework | Faster cold starts, explicit dependencies |
| **Repository pattern** | Enables testability, separates concerns |
| **Service layer** | Encapsulates business logic |
| **Zod validation** | Runtime type safety, clear errors |
| **Handler factories** | Enables dependency injection for testability |

### Why Pre-Aggregation?

The requirement is to expose aggregated tips, not event history. Pre-aggregation provides:

1. **Performance**: O(1) reads via single `GetItem` operation
2. **Cost**: Fixed costs regardless of tip volume
3. **Concurrency**: DynamoDB `ADD` is atomic and lock-free
4. **Simplicity**: Directly serves the access pattern (driverId + time window)

**Alternatives Considered:**
- Raw events table: Scales poorly, requires querying and summing
- Event sourcing + CQRS: Overkill for this use case
- Both events + aggregates: Production might need this, but not required here

---

## Data Flow

### Create Driver Flow

![Create Driver Flow](create-driver-flow.png)

**Flow:** Client → API Gateway → Handler → Service → Repository → DynamoDB

**Transformations:**
1. JSON request → `CreateDriverRequest` (Zod validated)
2. `CreateDriverRequest` → `Driver` (UUID generated)
3. `Driver` → DynamoDB PutItem
4. DynamoDB item → `Driver` → `DriverResponse` → JSON response

### Get Driver Flow

![Get Driver Flow](Get-Driver-Flow.png)

**Flow:** Extract ID → Service → Repository → DynamoDB GetItem → Return driver or 404

### Get Driver Tips Flow

![Get Driver Tips Flow](Get-Driver-Tips-Flow.png)

**Flow:**
1. Verify driver exists
2. Calculate time buckets (day/week)
3. Parallel queries to tips table
4. Return daily and weekly aggregates

### SQS Tip Event Processing Flow

![SQS Tip Event Processing Flow](SQS-Tip-Event-Processing-Flow.png)

**Flow:**
1. SQS batch (up to 10 messages) → Lambda
2. Parse and validate each message with Zod
3. Calculate time buckets (day/week)
4. Parallel DynamoDB `ADD` operations (atomic increments)
5. Return batch failures for retry

**Error Handling:** Failed messages added to `batchItemFailures` for SQS retry

### Sequence Diagram

![Create Driver Sequence](Create-Driver-Sequence.png)

---

## Implementation Details

### Tip Event Consumption

**Implementation:**
- `TipConsumerHandler` consumes from SQS queue `driver-tips-event-queue-ts`
- Batch processing with partial failure support
- Zod schema validation (`TipEventSchema`)
- `TipRepository` interface with `DynamoTipRepository` implementation

### REST API Extension

**New Endpoint:** `GET /drivers/{id}/tips`

**Response:**
```json
{
  "daily": {
    "driverId": "...",
    "aggregationKey": "DAY#2024-01-15",
    "totalAmount": 42.50,
    "updatedAt": "2024-01-15T10:30:00Z"
  },
  "weekly": {
    "driverId": "...",
    "aggregationKey": "WEEK#2024-W03",
    "totalAmount": 125.75,
    "updatedAt": "2024-01-15T10:30:00Z"
  }
}
```

### Testability Improvements

**Problem:** Handlers were tightly coupled to data access.

**Solution:**
- Repository interfaces (`DriverRepository`, `TipRepository`)
- Handler factories (`createHandlers`, `createTipConsumerHandler`)
- Manual DI in `di.ts` composition root
- Service layer for business logic

### Code Quality Improvements

**Separation of Concerns:**
- Handlers: HTTP/SQS parsing, validation, response formatting
- Services: Business logic
- Repositories: Data access only
- Utils: Reusable utilities

**Error Handling:**
- Custom exceptions (`DriverNotFoundError`, `ValidationError`)
- Proper HTTP status code mapping
- SQS batch failure handling

**Type Safety:**
- DTOs for API contracts
- TypeScript interfaces for repositories
- Zod schemas for runtime validation

---

## Storage Strategy

### DynamoDB Tables

#### Drivers Table
- **Partition Key**: `id` (String)
- **Attributes**: `firstname`, `lastname`, `driverLicenseId`

#### Tips Table
- **Partition Key**: `PK` (String) - Format: `DRIVER#{driverId}`
- **Sort Key**: `SK` (String) - Format: `DAY#{YYYY-MM-DD}` or `WEEK#{YYYY-Www}`
- **Attributes**: `totalAmount` (Number), `updatedAt`, `createdAt`

**Key Pattern Example:**
```
PK: DRIVER#550e8400-e29b-41d4-a716-446655440000
SK: DAY#2024-01-15
totalAmount: 42.50
updatedAt: 2024-01-15T10:30:00Z
```

### Aggregation Strategy

**How It Works:**
- Each tip event triggers two parallel updates:
  - Daily: `DAY#{YYYY-MM-DD}`
  - Weekly: `WEEK#{YYYY-Www}`
- DynamoDB `ADD` operation atomically increments `totalAmount`
- `if_not_exists(createdAt, :now)` sets timestamp on first write

**Concurrency Safety:**
- DynamoDB `ADD` is atomic and lock-free
- Multiple Lambda invocations can process concurrently
- No race conditions or lost updates

### Time Buckets

- **Day Bucket**: `YYYY-MM-DD` (e.g., `2024-01-15`)
- **Week Bucket**: `YYYY-Www` ISO week format (e.g., `2024-W03`)

**Code Reference:** [`src/utils/time-buckets.ts`](src/utils/time-buckets.ts)

### DynamoDB vs Alternatives

**Why DynamoDB:**
- ✅ Serverless native, auto-scaling
- ✅ Atomic operations for concurrent updates
- ✅ Fast O(1) reads
- ✅ Pay-per-use, cost-effective
- ✅ Seamless AWS integration

**Alternatives Considered:**
- **PostgreSQL/RDS**: Better for complex queries, but requires connection pooling, slower cold starts
- **Redis**: Fast but requires persistence strategy, more operational complexity

**Decision:** DynamoDB fits the access pattern (driverId + time window) and serverless architecture.

---

## Key Design Patterns

1. **Repository Pattern**: Abstracts data access, enables testability
2. **Service Layer**: Encapsulates business logic
3. **Dependency Injection**: Manual DI in composition root (`di.ts`)
4. **Handler Factories**: Enable dependency injection for handlers
5. **DTO Pattern**: Separates API contracts from domain models
6. **Schema Validation**: Zod schemas at handler boundaries

---

## Related Documentation

- [README-old.md](README-old.md) - Original project overview and quick start
- [REQUIREMENTS.md](REQUIREMENTS.md) - Coding challenge requirements
- [api-tests.http](api-tests.http) - API testing examples

---

## Infrastructure

Infrastructure defined in [`cdk/infra.ts`](cdk/infra.ts):
- API Gateway REST API
- 4 Lambda functions
- 2 DynamoDB tables
- SQS queue with KMS encryption
- IAM roles with least-privilege permissions

For deployment: `npm run deploy`

---

## Note on Diagrams

The PNG diagram files referenced in this document need to be generated from the mermaid diagrams. You can use:
- [Mermaid Live Editor](https://mermaid.live/)
- `mermaid-cli`: `mmdc -i diagram.mmd -o diagram.png`
- VS Code extensions that export mermaid diagrams
