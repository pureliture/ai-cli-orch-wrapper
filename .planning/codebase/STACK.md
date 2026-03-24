# Technology Stack

**Analysis Date:** 2026-03-24

## Languages

**Primary:**
- TypeScript 5.x - All source code in `src/`

**Secondary:**
- JavaScript (ES2022 modules) - Compiled output in `dist/`

## Runtime

**Environment:**
- Node.js >=18.0.0 (required; active environment is v25.7.0)

**Package Manager:**
- npm (inferred from `package-lock.json`)
- Lockfile: `package-lock.json` present (lockfileVersion 3)

## Frameworks

**Core:**
- None - pure Node.js standard library; no application framework

**Testing:**
- Node.js built-in test runner (`node --test`) - invoked via `npm test`

**Build/Dev:**
- TypeScript compiler (`tsc`) - build via `npm run build`, watch via `npm run dev`
- `tsc --noEmit` - used as linter via `npm run lint`

## Key Dependencies

**Critical:**
- None at runtime - zero production dependencies; all dependencies are devDependencies

**Infrastructure (devDependencies):**
- `typescript` ^5.0.0 - TypeScript compiler
- `@types/node` ^20.0.0 - Node.js type definitions

## Standard Library Usage

The codebase uses only Node.js built-in modules:
- `node:fs` (`readFileSync`, `writeFileSync`, `existsSync`, `mkdirSync`) - file I/O in `src/registry/lockfile.ts` and `src/commands/download.ts`
- `node:path` (`join`, `basename`) - path manipulation in `src/commands/download.ts`
- `fetch` (global, available in Node >=18) - HTTP downloads in `src/commands/download.ts`

## Configuration

**TypeScript (`tsconfig.json`):**
- `target`: ES2022
- `module`: NodeNext
- `moduleResolution`: NodeNext
- `strict`: true
- `outDir`: `./dist`
- `rootDir`: `./src`
- `declaration`: true, `declarationMap`: true, `sourceMap`: true
- `resolveJsonModule`: true

**Environment:**
- No `.env` file present
- No environment variables required by current implementation

**Build:**
- `tsconfig.json` at project root
- Output goes to `dist/` (committed; not gitignored based on repo state)

## Platform Requirements

**Development:**
- Node.js >=18.0.0
- npm (any recent version supporting lockfileVersion 3)

**Production:**
- Node.js >=18.0.0
- Binary entrypoint: `dist/cli.js` (invoked as `wrapper` via `bin` field in `package.json`)
- Library entrypoint: `dist/index.js` (for programmatic use)

---

*Stack analysis: 2026-03-24*
