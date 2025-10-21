# Backend Image Upload Spec

## 📦 Quick Overview

Defense-in-depth image upload validation system for CollectIQ with three validation layers.

**Status**: Requirements ✅ | Design ✅ | Tasks ✅ | Implementation ⏳ (~30% complete)

---

## 🚀 Quick Start

### For Developers

1. Check [IMPLEMENTATION_STATUS.md](./IMPLEMENTATION_STATUS.md) - See what's done and what's next
2. Read [requirements.md](./requirements.md) - Understand what to build
3. Review [design.md](./design.md) - Understand how it works
4. Open [tasks.md](./tasks.md) - Start implementing
5. Reference [technical-spec.md](./technical-spec.md) - Get code examples

### For Complete Documentation

See **[INDEX.md](./INDEX.md)** for the complete documentation catalog with 10 reference documents.

---

## 📋 Core Documents

| Document                                               | Purpose                         | Lines |
| ------------------------------------------------------ | ------------------------------- | ----- |
| [requirements.md](./requirements.md)                   | What to build (13 requirements) | 300+  |
| [design.md](./design.md)                               | How it works (architecture)     | 600+  |
| [tasks.md](./tasks.md)                                 | Implementation steps (16 tasks) | 400+  |
| [IMPLEMENTATION_STATUS.md](./IMPLEMENTATION_STATUS.md) | Current progress (~30%)         | 400+  |

---

## 📚 Reference Documents

| Document                                     | Purpose                          | Lines  |
| -------------------------------------------- | -------------------------------- | ------ |
| [technical-spec.md](./technical-spec.md)     | Detailed spec with code examples | 1,100+ |
| [presign-examples.md](./presign-examples.md) | S3 policy patterns               | 800+   |
| [error-catalog.md](./error-catalog.md)       | RFC 7807 error reference         | 900+   |
| [openapi.yaml](./openapi.yaml)               | API specification                | 400+   |
| [acceptance-tests.md](./acceptance-tests.md) | Test scenarios (19 tests)        | 700+   |
| [quick-reference.md](./quick-reference.md)   | Developer cheat sheet            | 300+   |

**Total**: ~5,900 lines of documentation

---

## 🎯 Key Features

- **12 MB Limit** (configurable)
- **JPEG/PNG/HEIC** support
- **Three-Layer Validation** (Presign → S3 → Ingestion)
- **RFC 7807 Errors** (consistent, actionable)
- **HEIC Transcoding** (background conversion to JPEG)
- **Observability** (metrics, logs, tracing)

---

## 🏗️ Architecture

```
Client → API Gateway → Presign Lambda → S3 → Ingestion Lambda → DynamoDB + Step Functions
         (JWT)         (Validate)       (Policy)  (Magic #)
```

**Defense Layers**:

1. Presign: Validate type/size → 400 if invalid
2. S3 Policy: Enforce constraints → 403 if invalid
3. Ingestion: Magic number check → Delete + metric if invalid

---

## 📊 Current Status

**~30% Complete** (see [IMPLEMENTATION_STATUS.md](./IMPLEMENTATION_STATUS.md))

✅ **Done**: Project structure, utilities, auth, presign handler (needs refactoring)  
⚠️ **Partial**: Presign uses PUT instead of POST  
❌ **Todo**: S3 bucket, ingestion handler, HEIC transcode, config endpoint

**Next**: Refactor presign → Create S3 bucket → Implement ingestion

---

## 🔗 Quick Links

- **[INDEX.md](./INDEX.md)** - Complete documentation catalog
- **[IMPLEMENTATION_STATUS.md](./IMPLEMENTATION_STATUS.md)** - What's done, what's next
- **[tasks.md](./tasks.md)** - Start implementing here
- **[quick-reference.md](./quick-reference.md)** - Daily development cheat sheet

---

**For complete documentation, see [INDEX.md](./INDEX.md)**
