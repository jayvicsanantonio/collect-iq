# Packages Documentation

This directory contains documentation for shared packages used across the CollectIQ monorepo.

## Available Packages

### [@collectiq/shared](./shared/)

Common types, interfaces, and Zod schemas shared between frontend and backend.

**Contents**:

- TypeScript interfaces for Card, PricingResult, AuthenticityResult
- Zod schemas for runtime validation
- Shared constants and enums

**Usage**:

```typescript
import { Card, CardSchema, PricingResult } from '@collectiq/shared';
```

[Read More →](./shared/README.md)

---

### [@collectiq/telemetry](./telemetry/)

Observability utilities for logging, metrics, and distributed tracing.

**Contents**:

- Structured JSON logger for CloudWatch
- CloudWatch Metrics emission
- AWS X-Ray tracing utilities

**Usage**:

```typescript
import { logger, metrics, tracing } from '@collectiq/telemetry';

logger.info('Processing card', { cardId, userId });
metrics.recordApiLatency('POST /cards', 'POST', 150);
```

[Read More →](./telemetry/README.md) | [Usage Guide →](./telemetry/USAGE.md)

---

## Package Development

### Adding a New Package

1. Create package directory in `packages/`
2. Add `package.json` with package name `@collectiq/<name>`
3. Add to `pnpm-workspace.yaml`
4. Create documentation in `docs/packages/<name>/`

### Using Packages

Packages are automatically linked via pnpm workspaces:

```json
{
  "dependencies": {
    "@collectiq/shared": "workspace:*",
    "@collectiq/telemetry": "workspace:*"
  }
}
```

### Building Packages

```bash
# Build all packages
pnpm -r build

# Build specific package
pnpm --filter @collectiq/shared build
```

## Documentation Standards

Each package should have:

- `README.md` - Overview and quick start
- `USAGE.md` - Detailed usage examples (if complex)
- API documentation for exported functions/classes
- Examples directory with sample code

---

**Last Updated**: October 22, 2025
