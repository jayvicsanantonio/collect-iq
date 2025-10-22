# Development Documentation

Development tools, workflows, and best practices for CollectIQ contributors.

## Development Tools

### Version Control

- [Git Subtree Guide](./Git-Subtree.md) - Managing the monorepo with git subtrees

## Development Workflow

### Local Development

1. **Clone Repository**

   ```bash
   git clone <repository-url>
   cd collect-iq
   ```

2. **Install Dependencies**

   ```bash
   pnpm install
   ```

3. **Set Up Environment**
   - Copy `.env.example` to `.env`
   - Configure AWS credentials
   - Set up local development environment

4. **Start Development Servers**

   ```bash
   # Frontend
   pnpm web:dev

   # Backend (local testing)
   cd services/backend
   pnpm test
   ```

### Code Quality

**Linting**:

```bash
pnpm lint              # Lint all packages
pnpm lint:fix          # Auto-fix linting issues
```

**Type Checking**:

```bash
pnpm typecheck         # Check TypeScript types
```

**Testing**:

```bash
pnpm test              # Run all tests
pnpm test:e2e          # Run E2E tests
```

### Git Workflow

1. **Create Feature Branch**

   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make Changes**
   - Write code
   - Add tests
   - Update documentation

3. **Commit Changes**

   ```bash
   git add .
   git commit -m "feat: your feature description"
   ```

4. **Push and Create PR**
   ```bash
   git push origin feature/your-feature-name
   ```

### Commit Message Convention

Follow conventional commits:

- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation changes
- `style:` - Code style changes (formatting)
- `refactor:` - Code refactoring
- `test:` - Adding or updating tests
- `chore:` - Maintenance tasks

## Development Best Practices

### Code Style

- Use TypeScript for type safety
- Follow ESLint rules
- Use Prettier for formatting
- Write self-documenting code
- Add comments for complex logic

### Testing

- Write unit tests for business logic
- Write integration tests for API endpoints
- Write E2E tests for critical user flows
- Aim for 80%+ code coverage

### Documentation

- Update docs when changing features
- Add inline code comments
- Write clear commit messages
- Update README files

### Performance

- Optimize bundle sizes
- Use lazy loading where appropriate
- Monitor CloudWatch metrics
- Profile slow operations

## Related Documentation

- [Backend Development](../backend/development/) - Backend-specific development
- [Frontend Development](../Frontend/) - Frontend-specific development
- [Infrastructure](../infrastructure/) - Infrastructure development
- [Testing Guide](../backend/development/TESTING.md) - Testing strategies

## Navigation

- [← Back to Main Documentation](../README.md)

---

**Last Updated**: October 22, 2025
