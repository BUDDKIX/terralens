# GitHub submission notes

Prepared on 2026-10-26. No repository was created, no remote was added, and no commit or push was performed during preparation.

## Included project

The submission tree retains source, tests, all runtime public assets, bundled imagery and its manifest, build configuration, package manifest/lockfile, validation scripts, recorded JSON measurements, holdout imagery and documented validation checkpoints. JPEG overlays consumed by `scripts/export-validation-reports.mjs` remain included.

`node_modules`, `dist`, TypeScript caches, environment files, local hosting configuration, audit outputs, generated HTML reports, raw RGBA overlays and screenshots are excluded. Eighteen previously tracked generated/local files were removed from the Git index only; their physical files remain available locally. A staged `D` for these paths means removal from the next repository tree, not local deletion.

Historical commits still contain earlier generated artifacts and the former machine-specific launch path. Ignore rules and index removal do not remove history. History was not rewritten. Review that history before choosing to publish it; a clean current tree is not a guarantee of a history free of local material. No credential-like patterns were found in the scanned current candidate text files; this limited scan is not a comprehensive secret audit.

## Validation during preparation

- `node --test tests/*.test.mjs`: 39 passed, 0 failed, 0 skipped.
- `npm run build`: TypeScript validation, Vite build and service-worker asset generation passed.
- `node scripts/check-offline.mjs`: all generated production assets and navigation fallback passed in the offline harness.
- Development and production preview servers each served the app shell with HTTP 200. These checks do not assert browser interactions.
- SHA-256 comparison: all 50 source, script, test, public-asset and configuration files present at task start remained byte-identical. All four catalog image checksums matched the manifest.
- Existing `node_modules` and `dist` remained present; neither folder is tracked. No dependencies were reinstalled.

The preceding polish edits to `src/images.ts`, `src/styles.css` and `tests/final-release.test.mjs` were already uncommitted when this task began. They were preserved exactly; their Git diffs are not changes introduced by submission preparation.

## Reviewer setup

Use Node.js 24 and npm from the repository root:

```sh
npm ci
npm run dev
```

For validation and a production demonstration:

```sh
npm run test
npm run build
node scripts/check-offline.mjs
npm run preview
```

Open the localhost URL printed by Vite. No private API key, paid service or cloud backend is needed. A fresh `npm ci` was not repeated during preparation; the lockfile is included and existing installed dependencies were used for validation.

## Optional numerical validation tools

Normal tests/build/runtime use only repository files. The additional `scripts/validate-scenarios.mjs` accepts a caller-supplied jobs JSON and decoded RGBA inputs; the original local jobs file is not included. Jobs require `beforeRGBA`, `afterRGBA`, `width`, `height`, `options` and `scene` (plus optional `preparation`). Prepare both rasters on the same grid; decoding/resampling choices can change results. This is a developer tool, not a prerequisite for running the app.

`scripts/export-validation-reports.mjs` reads included recorded measurements, source images and JPEG overlays to regenerate historical report examples. Its output is ignored. Those examples are historical measurements; rerendering them is not a new engine validation or a PDF verification.

## Publishing after review

No remote is currently configured. Create an empty GitHub repository in your own account when you are ready. Review the working tree, existing history and pre-existing polish changes before committing. The following commands are for you to execute after approval; replace the remote placeholder with your repository URL:

```sh
git status --short
git diff
git diff --cached
git add .
git diff --cached --stat
git diff --cached --name-status
git commit -m "Prepare TerraLens hackathon submission"
git remote add origin https://github.com/YOUR-ACCOUNT/terralens.git
git push -u origin main
```

This assumes the current `main` branch and an empty remote. If the destination already contains commits, reconcile its history before pushing; do not force-push. Keep audit outputs and local environment files ignored. Check staged contents before committing.

## Remaining review items

- PDF saving/pagination remains unverified: the prior in-app print action timed out. All 13 report-preview images loaded during the polish check. See [that record](validation/MINIMAL-POLISH.md).
- Browser offline reload still requires checking on the presentation browser with the localhost server running. The harness does not certify browser cache lifecycle or eviction behavior.
- Choose a code license deliberately before inviting reuse. No code license was added; imagery attribution remains separate.
- Development used Codex assistance. Preserve the hackathon's required disclosure format if one is supplied.

## Optional maintainability work after submission

1. `src/App.tsx` is 1,115 lines and combines persistence, scene loading, worker coordination, review and reporting. Consider extracting those responsibilities with behavior-focused regression coverage later.
2. `src/styles.css` contains successive responsive/theme overrides. Consolidating overlapping rules may reduce cascade surprises; defer it until after the demonstration.
3. `src/report.mjs` embeds long HTML/CSS templates and repeats review-status presentation used in React. Small template helpers could make report changes easier to inspect.
4. `src/SourceMetadata.tsx` compresses several state updates and form fields into long lines. A focused readability pass would help debugging.
5. `exportReport(download = false)` has an alternate download branch, while its current call site uses the default and the preview has its own download control. Review that duplication before removing any branch.

No confirmed unused import removal is proposed from the focused audit. No source comment or executable file was edited.
