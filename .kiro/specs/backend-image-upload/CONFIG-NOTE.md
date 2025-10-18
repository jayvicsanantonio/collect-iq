# Configuration Reference Note

## 📍 Location

The complete environment variable configuration for the upload system is documented in:

**`docs/config.md`** (project root)

This file is **NOT** in the spec folder because it contains configuration for the entire CollectIQ backend, not just the upload system.

---

## 🔧 Upload-Specific Configuration

From `docs/config.md`, the upload system uses these environment variables:

### Size & Type Constraints

```bash
MAX_UPLOAD_MB=12                                    # Default: 12 MB
ALLOWED_UPLOAD_MIME=image/jpeg,image/png,image/heic # Comma-separated
PRESIGN_TTL_SECONDS=300                             # Default: 5 minutes
```

### AWS Resources

```bash
UPLOAD_BUCKET=collectiq-uploads-hackathon
TABLE_NAME=collectiq-hackathon
INGESTION_STATE_MACHINE_ARN=arn:aws:states:...
```

### Observability

```bash
CLOUDWATCH_NAMESPACE=CollectIQ/Uploads
LOG_LEVEL=INFO
```

---

## 📖 Quick Reference

For a condensed version of upload configuration, see:

- **[quick-reference.md](./quick-reference.md)** - Developer cheat sheet with all upload env vars

For the complete project-wide configuration reference:

- **[docs/config.md](../../../docs/config.md)** - All backend environment variables

---

## 🔗 Related

- [quick-reference.md](./quick-reference.md) - Upload-specific quick reference
- [technical-spec.md](./technical-spec.md) - Configuration management section
- [design.md](./design.md) - Configuration management design
