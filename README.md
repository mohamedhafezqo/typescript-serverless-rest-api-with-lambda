# Driver Management Service

A serverless REST API for managing drivers and their tip aggregates. Built with TypeScript on AWS Lambda, deployed with AWS CDK. Originally built as a coding challenge.

## Features

- **Driver management** — Create and fetch drivers (master data in DynamoDB).
- **Tip aggregation** — Consume tip events from SQS, store daily and weekly aggregates per driver.
- **Tips API** — `GET /drivers/{id}/tips` returns aggregated tips for today and the current week.
- **Testability** — Handlers use dependency injection and repository interfaces so business logic is unit-tested without AWS.

## Tech stack

| Layer        | Choice                    |
|-------------|---------------------------|
| Runtime     | Node.js 24 (Lambda)       |
| Language    | TypeScript                |
| IaC         | [AWS CDK](https://aws.amazon.com/cdk/) |
| Database    | DynamoDB (drivers + tip aggregates)    |
| Queue       | SQS (tip events)          |
| API         | API Gateway (REST)        |
| Validation  | Zod                       |
| Tests       | Vitest                    |

## Prerequisites

- Node.js 20+
- AWS CLI configured (`aws configure`)
- AWS CDK CLI: `npm install -g aws-cdk` (optional; `npx` can run it)

## Quick start

```sh
npm install
npm run bootstrap   # once per AWS account/region
npm run deploy
```

Deploy output prints the API base URL (e.g. `https://xxxxxx.execute-api.<region>.amazonaws.com/dev`). Use it in the examples below.

## API

Base URL: `https://<api-id>.execute-api.<region>.amazonaws.com/dev`

| Method | Path                 | Description                          |
|--------|----------------------|--------------------------------------|
| POST   | `/drivers`           | Create a driver                      |
| GET    | `/drivers`           | List all drivers                     |
| GET    | `/drivers/{id}`      | Get driver by id                     |
| GET    | `/drivers/{id}/tips` | Get driver’s tip aggregates (daily & weekly) |

### Examples

```sh
# Create a driver
curl -X POST https://<api-id>.execute-api.eu-central-1.amazonaws.com/dev/drivers \
  -H "Content-Type: application/json" \
  -d '{"firstname": "Jane", "lastname": "Doe", "driverLicenseId": "DL123"}'

# Get a driver (use id from create response)
curl https://<api-id>.execute-api.eu-central-1.amazonaws.com/dev/drivers/<driver-id>

# Get tip aggregates for a driver
curl https://<api-id>.execute-api.eu-central-1.amazonaws.com/dev/drivers/<driver-id>/tips
```

Tip aggregates response shape:

```json
{
  "daily": { "driverId": "...", "aggregationKey": "DAY#2024-01-15", "totalAmount": 42.50, "updatedAt": "..." },
  "weekly": { "driverId": "...", "aggregationKey": "WEEK#2024-W03", "totalAmount": 125.75, "updatedAt": "..." }
}
```

There is an `api-tests.http` file for use with the VS Code REST Client (or similar) once you set `baseUrl` to your deployed API.

## Project structure

```
├── cdk/              # CDK app and infra (Lambda, API Gateway, DynamoDB, SQS)
├── src/
│   ├── handler.ts    # API handlers (create/get driver, get tips)
│   ├── tip-consumer-handler.ts  # SQS consumer for tip events
│   ├── di.ts         # Composition root / dependency wiring
│   ├── services/     # Business logic (DriverService)
│   ├── repositories/ # Data access (DynamoDB), behind interfaces
│   ├── dto/, schemas/, utils/
│   └── **/*.spec.ts  # Unit tests
├── api-tests.http    # HTTP examples for manual/exploratory testing
└── IMPLEMENTATION.md # Design choices, storage strategy, tradeoffs
```

## Scripts

| Command           | Description                    |
|-------------------|--------------------------------|
| `npm install`     | Install dependencies           |
| `npm run build`   | Compile TypeScript to `build/` |
| `npm test`        | Run unit tests (Vitest)        |
| `npm run check`   | Lint with Biome                |
| `npm run deploy`  | Deploy stack to AWS            |
| `npm run destroy` | Delete deployed stack          |

## Design and decisions

Tip events are consumed from SQS and stored as **pre-aggregated** daily and weekly totals per driver in DynamoDB (no raw event table). That keeps reads O(1), costs predictable, and concurrency safe via DynamoDB `ADD`. Handlers are thin; business logic lives in services and is covered by unit tests using repository mocks.

Rationale, alternatives, and tradeoffs are described in [IMPLEMENTATION.md](./IMPLEMENTATION.md).

## Clean up (avoid AWS charges)

To remove all resources created by this project:

```sh
npm run destroy
```

Confirm when prompted. This deletes the CDK stack (Lambdas, API Gateway, DynamoDB tables, SQS queue, EventBridge rules, and associated IAM). The CDK bootstrap stack in your account/region is left as-is unless you remove it separately.

To double-check that the app stack is gone:

```sh
aws cloudformation list-stacks
```

The stack created by this app should no longer appear. Its name is defined in `cdk/cdk.ts` (default: `coding-challenge-infra-stack`).
