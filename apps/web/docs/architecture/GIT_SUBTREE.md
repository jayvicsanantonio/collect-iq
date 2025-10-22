# Git Subtree Documentation

## Overview

The `apps/web` directory is maintained as a **Git subtree** that mirrors the external [collect-iq-ui](https://github.com/jayvicsanantonio/collect-iq-ui) repository. This setup allows the UI codebase to be developed independently while remaining integrated into the CollectIQ monorepo.

## What is a Git Subtree?

Git subtree is a built-in Git feature that embeds one repository inside another as a subdirectory. Unlike submodules, subtrees:

- Keep all code in the main repository (no separate clone needed)
- Work seamlessly with standard Git commands
- Require no special initialization for contributors
- Integrate naturally with pnpm workspaces

## Repository Configuration

- **Subtree Path**: `apps/web`
- **Remote Name**: `web-ui`
- **Remote URL**: `https://github.com/jayvicsanantonio/collect-iq-ui.git`
- **Branch**: `main`
- **Strategy**: Squash commits for clean history

## Common Commands

### Pulling Changes from External Repository

To sync the latest changes from `collect-iq-ui` into the monorepo:

```bash
git subtree pull --prefix=apps/web web-ui main --squash
```

**When to use**: After changes are pushed to the external repository that you want to integrate into the monorepo.

**What it does**:

- Fetches changes from the `web-ui` remote
- Merges them into `apps/web`
- Creates a squashed merge commit
- Preserves monorepo history

### Pushing Changes to External Repository

To push local changes from `apps/web` back to `collect-iq-ui`:

```bash
git subtree push --prefix=apps/web web-ui main
```

**When to use**: After making changes to `apps/web` in the monorepo that should be shared with the external repository.

**What it does**:

- Extracts commits affecting `apps/web`
- Pushes them to the `web-ui` remote
- Updates the external repository

### Viewing Subtree History

To see commits related to the subtree:

```bash
git log --grep="git-subtree-dir: apps/web"
```

### Verifying Remote Configuration

To check that the remote is properly configured:

```bash
git remote -v | grep web-ui
```

Expected output:

```
web-ui  https://github.com/jayvicsanantonio/collect-iq-ui.git (fetch)
web-ui  https://github.com/jayvicsanantonio/collect-iq-ui.git (push)
```

## Workflow Guidance

### When to Work in the Monorepo

Work directly in `apps/web` within the monorepo when:

- Making changes that require integration with other workspace packages
- Testing full-stack features (frontend + backend)
- Working on monorepo-specific configurations
- Developing features that span multiple packages
- You need access to shared packages (`@collect-iq/shared`, `@collect-iq/telemetry`)

**Workflow**:

1. Make changes in `apps/web`
2. Commit to monorepo
3. Push to monorepo remote
4. Optionally push to external repo: `git subtree push --prefix=apps/web web-ui main`

### When to Work in the External Repository

Work directly in the `collect-iq-ui` repository when:

- Focusing purely on UI development
- Working on isolated component development
- Making rapid iterations without monorepo overhead
- Contributing as an external collaborator
- Testing UI-only changes

**Workflow**:

1. Clone `collect-iq-ui` separately
2. Make changes and commit
3. Push to `collect-iq-ui`
4. Pull into monorepo: `git subtree pull --prefix=apps/web web-ui main --squash`

### Recommended Practices

- **Sync frequently**: Pull changes regularly to avoid large merge conflicts
- **Communicate**: Coordinate with team when working on the same files
- **Test after sync**: Run `pnpm install` and `pnpm web:build` after pulling
- **Commit atomically**: Make focused commits that are easy to sync
- **Use feature branches**: For large changes, use branches in both repos

## Troubleshooting

### Merge Conflicts During Pull

**Symptom**: `git subtree pull` stops with conflict markers in files

**Resolution**:

1. Git will pause and show conflicting files
2. Open conflicting files and resolve markers manually
3. Stage resolved files: `git add <file>`
4. Complete the merge: `git commit`
5. Verify workspace: `pnpm install && pnpm web:build`

**Prevention**:

- Pull frequently to minimize divergence
- Coordinate with team on file ownership
- Use feature branches for experimental work

### Failed Push to External Repository

**Symptom**: `git subtree push` fails with permission or conflict errors

**Common Causes**:

- Insufficient GitHub permissions
- External repository has diverged
- Network connectivity issues

**Resolution**:

1. **Check permissions**:

   ```bash
   git ls-remote web-ui
   ```

   If this fails, verify your GitHub access token or SSH keys.

2. **Pull latest changes first**:

   ```bash
   git subtree pull --prefix=apps/web web-ui main --squash
   ```

   Resolve any conflicts, then retry push.

3. **Verify remote URL**:

   ```bash
   git remote get-url web-ui
   ```

   Ensure it matches: `https://github.com/jayvicsanantonio/collect-iq-ui.git`

4. **Force push (use with caution)**:
   ```bash
   git push web-ui `git subtree split --prefix=apps/web`:main --force
   ```
   ⚠️ Only use if you're certain the monorepo version is correct.

### Workspace Build Failures After Sync

**Symptom**: `pnpm web:build` fails after pulling subtree changes

**Resolution**:

1. **Reinstall dependencies**:

   ```bash
   pnpm install
   ```

2. **Clear Next.js cache**:

   ```bash
   rm -rf apps/web/.next
   pnpm web:build
   ```

3. **Check for breaking changes**:

   - Review pulled commits for dependency updates
   - Check for TypeScript errors: `pnpm typecheck`
   - Verify environment variables in `apps/web/.env.local`

4. **Verify workspace configuration**:
   ```bash
   cat pnpm-workspace.yaml
   ```
   Ensure `apps/*` is listed.

### Subtree Remote Not Found

**Symptom**: `fatal: 'web-ui' does not appear to be a git repository`

**Resolution**:

Add the remote manually:

```bash
git remote add web-ui https://github.com/jayvicsanantonio/collect-iq-ui.git
git fetch web-ui
```

Verify:

```bash
git remote -v | grep web-ui
```

### Accidentally Committed to Wrong Repository

**Symptom**: Made changes in external repo that should be in monorepo (or vice versa)

**Resolution**:

1. **From external → monorepo**:

   ```bash
   # In monorepo
   git subtree pull --prefix=apps/web web-ui main --squash
   ```

2. **From monorepo → external**:

   ```bash
   # In monorepo
   git subtree push --prefix=apps/web web-ui main
   ```

3. **Cherry-pick specific commits**:
   ```bash
   # In target repo
   git cherry-pick <commit-hash>
   ```

### Large History or Slow Operations

**Symptom**: Subtree operations take a long time

**Explanation**: Git subtree operations can be slow on large repositories because they rewrite history.

**Mitigation**:

- Use `--squash` flag (already default in our setup)
- Sync frequently with smaller changesets
- Consider splitting very large changes into multiple commits

## Advanced Operations

### Splitting Subtree History

To extract the full history of `apps/web` as a separate branch:

```bash
git subtree split --prefix=apps/web --branch web-history
```

This creates a branch containing only commits that affected `apps/web`.

### Replacing Subtree Remote

If the external repository URL changes:

```bash
git remote set-url web-ui <new-url>
git fetch web-ui
```

### Removing Subtree (Rollback)

To remove the subtree and restore the original directory:

```bash
# Checkout backup branch
git checkout backup-before-subtree-migration

# Reset main to backup
git checkout main
git reset --hard backup-before-subtree-migration

# Remove remote
git remote remove web-ui
```

## Rollback Procedure

If you need to rollback the Git subtree migration and restore the original `apps/web` directory, follow this procedure carefully.

### When to Rollback

Consider rolling back if:

- The subtree integration is causing persistent issues
- Workspace builds are consistently failing after migration
- Sync operations are not working as expected
- You need to revert to the pre-migration state for troubleshooting

### Prerequisites

Before starting the rollback:

1. **Verify backup branch exists**:

   ```bash
   git branch --list backup-before-subtree-migration
   ```

   If the branch doesn't exist, rollback is not possible without data loss.

2. **Commit or stash any uncommitted changes**:

   ```bash
   git status
   git stash push -m "Pre-rollback stash"
   ```

3. **Communicate with team**: Ensure no one else is working on the repository during rollback.

### Rollback Steps

#### Step 1: Return to Backup Branch

Switch to the backup branch to verify its state:

```bash
git checkout backup-before-subtree-migration
```

**Verification**:

```bash
# Check that apps/web exists and contains expected content
ls -la apps/web

# Verify workspace builds
pnpm install
pnpm web:build
```

If the backup branch is in good state, proceed to Step 2.

#### Step 2: Reset Main Branch

Reset the `main` branch to match the backup:

```bash
# Switch back to main
git checkout main

# Reset main to backup state (DESTRUCTIVE - cannot be undone easily)
git reset --hard backup-before-subtree-migration
```

⚠️ **Warning**: This command is destructive and will discard all commits made after the backup was created.

**Verification**:

```bash
# Verify main now matches backup
git log --oneline -5

# Check that apps/web is restored
ls -la apps/web
```

#### Step 3: Remove Subtree Remote

Remove the `web-ui` remote that was added for subtree operations:

```bash
git remote remove web-ui
```

**Verification**:

```bash
# Verify remote is removed
git remote -v

# Should not show web-ui in the list
```

#### Step 4: Verify Workspace Integrity

Ensure the workspace is functional after rollback:

```bash
# Clean and reinstall dependencies
rm -rf node_modules apps/web/node_modules
pnpm install

# Verify build succeeds
pnpm web:build

# Run type checking
pnpm typecheck

# Run tests (if applicable)
pnpm test --run
```

**Expected Results**:

- All dependencies install successfully
- Build completes without errors
- Type checking passes
- Tests pass (if you have them)

#### Step 5: Clean Up (Optional)

If rollback is successful and you're confident you won't need to re-migrate:

```bash
# Delete the backup branch
git branch -D backup-before-subtree-migration
```

⚠️ **Caution**: Only delete the backup branch if you're certain you won't need it.

### Post-Rollback Considerations

After rolling back:

1. **Update documentation**: Remove or update any references to the subtree setup
2. **Notify team**: Inform team members that the subtree has been removed
3. **Review workflow**: Determine if you want to retry the migration or use a different approach
4. **Preserve changes**: If you made valuable changes in the subtree, manually port them to the restored directory

### Troubleshooting Rollback Issues

#### Backup Branch Doesn't Exist

**Symptom**: `git branch --list backup-before-subtree-migration` returns nothing

**Resolution**:

- Check if backup was created with a different name: `git branch --list | grep backup`
- Look for tags: `git tag --list | grep backup`
- If no backup exists, you'll need to manually restore from Git history or a different backup source

#### Uncommitted Changes Blocking Reset

**Symptom**: `git reset --hard` fails due to uncommitted changes

**Resolution**:

```bash
# Stash changes
git stash push -m "Changes before rollback"

# Retry reset
git reset --hard backup-before-subtree-migration

# Review stashed changes later
git stash list
```

#### Workspace Build Fails After Rollback

**Symptom**: `pnpm web:build` fails after rollback

**Resolution**:

1. **Clear all caches**:

   ```bash
   rm -rf node_modules apps/web/node_modules apps/web/.next
   pnpm install
   ```

2. **Check for environment variables**:

   ```bash
   # Verify .env.local exists
   ls -la apps/web/.env.local
   ```

3. **Review Git status**:

   ```bash
   git status
   git log --oneline -10
   ```

4. **Compare with backup**:
   ```bash
   git diff backup-before-subtree-migration
   ```

#### Remote Removal Fails

**Symptom**: `git remote remove web-ui` fails

**Resolution**:

```bash
# Force remove from config
git config --unset remote.web-ui.url
git config --unset remote.web-ui.fetch

# Verify removal
git remote -v
```

### Alternative: Soft Rollback

If you want to preserve recent commits but remove the subtree:

```bash
# Create a new branch from current state
git checkout -b pre-rollback-state

# Switch to main and reset
git checkout main
git reset --hard backup-before-subtree-migration

# Cherry-pick specific commits from pre-rollback-state if needed
git cherry-pick <commit-hash>
```

This allows you to selectively preserve changes while rolling back the subtree.

### Re-attempting Migration

If you rolled back to fix issues and want to retry the migration:

1. Review the original migration documentation
2. Address the issues that caused the rollback
3. Ensure backup branch still exists (or create a new one)
4. Follow the migration steps again from the beginning

### Emergency Recovery

If rollback fails catastrophically:

1. **Clone a fresh copy** of the repository
2. **Restore from remote**: `git fetch origin && git reset --hard origin/main`
3. **Contact team lead** for assistance
4. **Review Git reflog**: `git reflog` to find lost commits

## Additional Resources

- [Git Subtree Official Documentation](https://git-scm.com/book/en/v2/Git-Tools-Advanced-Merging#_subtree_merge)
- [External Repository](https://github.com/jayvicsanantonio/collect-iq-ui)
- [Monorepo Structure](../../docs/Project%20Structure.md)

## Getting Help

If you encounter issues not covered here:

1. Check Git status: `git status`
2. Review recent commits: `git log --oneline -10`
3. Verify workspace: `pnpm install && pnpm web:build`
4. Consult with the team
5. Check GitHub Issues in both repositories

---

**Last Updated**: 2025-10-18
**Maintainer**: CollectIQ Team

# Test Change for Subtree Verification
