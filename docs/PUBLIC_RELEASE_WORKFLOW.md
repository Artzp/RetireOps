# Public Release Workflow

RetireOps uses a separate DEV repository and PUBLIC repository so everyday development can stay flexible while the source-available release history stays clean.

- DEV repo: the private working repository.
- PUBLIC repo: the clean source-available release repository.

## Principles

- Work normally in DEV.
- Sync to PUBLIC only when preparing a public release.
- Never push DEV history to PUBLIC.
- Keep PUBLIC history clean, reviewable, and safe for source-available publication.
- Do not push PUBLIC until the privacy scan and project checks pass.

## Release Steps

1. Finish the release-ready work in DEV.
2. From the DEV repo root, run:

   ```powershell
   .\scripts\sync-public.ps1
   ```

3. If the script reports that PUBLIC has uncommitted changes, inspect them before continuing. Use `-Force` only when you intentionally want the sync to overwrite the current PUBLIC working tree.
4. Review the PUBLIC diff carefully:

   ```powershell
   cd <PUBLIC repo path>
   git status
   git diff
   ```

5. Run dependency and project checks in PUBLIC:

   ```powershell
   corepack pnpm install --frozen-lockfile
   corepack pnpm check
   ```

6. Commit and push only after the diff, privacy scan, and checks are clean:

   ```powershell
   git add -A
   git commit -m "chore: sync public release"
   git push origin main
   ```

## What The Sync Does

The sync script copies only tracked working files from DEV into PUBLIC. It preserves the PUBLIC `.git` directory, removes PUBLIC files that no longer exist in the safe DEV tree, and excludes known private, local, generated, or planning-only paths.

Excluded paths include local dependency/build outputs, planning folders, agent/tooling folders, specs, local scripts, private environment files, known report artifacts, and DEV-only personal fixture filename patterns.

After copying, the script scans PUBLIC for private names, local machine paths, private key markers, email markers, and API key prefixes. If any match appears, the script fails and prints the matching lines for review.

## Important Safety Rules

- Treat PUBLIC as a release artifact, not the place where active development happens.
- Do not merge, rebase, or push DEV branches into PUBLIC.
- Do not bypass the PUBLIC diff review.
- Do not commit PUBLIC if the privacy scan fails.
- Do not push PUBLIC if checks fail.
- Keep public commits focused on release syncs or small public-facing fixes.
