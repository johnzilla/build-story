# Releasing

BuildStory publishes four packages from this monorepo with [Changesets] and
pnpm. All are ESM-only and scoped under `@buildstory`:

| Package | Notes |
|---------|-------|
| `@buildstory/core` | ships `dist/` only |
| `@buildstory/video` | ships `dist/` **and `src/`** (the Remotion bundler compiles the composition from source at render time), tests excluded |
| `@buildstory/heygen` | ships `dist/` only |
| `@buildstory/cli` | ships `dist/` only; installs the `buildstory` command |

> **Naming:** the bare npm name `buildstory` is owned by an unrelated package, so
> the CLI publishes as **`@buildstory/cli`**. Publishing any `@buildstory/*`
> package requires the `buildstory` org (or your user scope) to exist on npm and
> your account to be a member — create it once at npmjs.com before the first
> release. `.changeset/config.json` sets `access: "public"` so scoped packages
> publish publicly.

## One-time setup

- `npm login` (an account with publish rights to the `@buildstory` scope).
- `corepack enable` (pins pnpm to the `packageManager` version).

## Cutting a release

1. **Add a changeset** describing what changed and the bump level:

   ```bash
   pnpm changeset
   ```

   Pick the affected packages and semver bump. This writes a markdown file under
   `.changeset/`. Commit it. `updateInternalDependencies: "patch"` means a bump
   to `core` cascades a patch bump to its workspace dependents.

2. **Version** — apply the pending changesets (updates versions + CHANGELOGs):

   ```bash
   pnpm changeset version
   pnpm install          # refresh the lockfile with the new versions
   ```

   Commit the version bump and generated changelogs.

3. **Verify the gates and the tarballs are clean:**

   ```bash
   pnpm build && pnpm typecheck && pnpm lint && pnpm test
   pnpm -r publish --dry-run --no-git-checks   # inspect every tarball
   ```

   Confirm no test files, `.env`, or scan dumps appear in any tarball, and that
   `@buildstory/video` includes `src/` (minus `__tests__`). Each package ships its
   own committed `LICENSE` and `README.md` (not relying on pnpm's implicit copy),
   so the MIT notice is present under either `pnpm` or `npm` — no copy step needed.

   The CLI's `--version` banner is read at runtime from `@buildstory/cli`'s own
   `package.json` (`buildstory --version` reflects the installed version with no
   rebuild) — it is **not** hardcoded, so `changeset version` keeps it correct
   automatically. Keep it that way; don't reintroduce a literal version string.

4. **Publish** (build first — the tarball ships `dist/`):

   ```bash
   pnpm build
   pnpm -r publish --access public
   ```

   pnpm rewrites the `workspace:*` dependency ranges to the real published
   versions automatically — do **not** use `npm publish` directly, which doesn't
   understand the `workspace:` protocol.

5. **Tag and push:**

   ```bash
   git push --follow-tags origin main
   ```

## Notes

- **ESM-only** is a deliberate decision (not dual-module): the remark ecosystem
  `@buildstory/core` depends on is ESM-only, and every package is `type: module`
  with `tsup --format esm`. Consumers must be ESM (or use dynamic `import()`).
- Publishing order doesn't need to be manual — pnpm publishes in dependency
  order. If you publish one at a time, do `core → video → heygen → cli`.
- The accepted `extract-zip` advisory (GHSA-jmr9-qjv8-65gv, reachable only via
  Remotion's lazy Chrome download) is ignored in `package.json`
  `pnpm.auditConfig.ignoreGhsas`; revisit when Remotion ships a fix.

[Changesets]: https://github.com/changesets/changesets
