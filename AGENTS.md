# Fastypest Agent Handbook

## Purpose
This repository ships a TypeScript utility that snapshots and restores relational databases during automated tests. Any modification must preserve deterministic restores across supported engines (MySQL, MariaDB, PostgreSQL, CockroachDB) while keeping the published package consumable through `dist/`.

## Global Engineering Principles
- **Language & Comments**: Write code and tests in English. Do not add comments; prefer expressive naming and small pure functions.
- **Paradigms**: Uphold SOLID, clean code, and functional principles. Prefer pure, side-effect-free utilities. Isolate unavoidable side effects (database I/O, logging) behind well-named abstractions.
- **Typing**: Use full static typing—never use `any`. Leverage generics, discriminated unions, or helper types when necessary.
- **Magic Values**: Avoid magic strings or numbers. Extract them to constants or configuration, except when they are intentional log messages, user-facing emojis/icons, or database literals already defined in seed/query files.
- **Naming**: Classes use `PascalCase`, variables and functions use `camelCase`, enums and constant objects use `SCREAMING_SNAKE_CASE` when exported or reused, otherwise `camelCase`. Test descriptions use sentence case and quote literal table/entity names when relevant.
- **Imports & Exports**: Prefer explicit exports and maintain re-export barrels where already present (`src/index.ts`, `src/core/index.ts`, `src/core/sql-script/index.ts`, `tests/seeds/index.ts`). Keep import order stable: Node modules, third-party, internal modules.
- **No Console Calls**: Route runtime diagnostics through the logging layer (`createScopedLogger`).

## Repository Structure & Responsibilities
- `src/`: Library source. Everything here must compile with SWC + `tsc --emitDeclarationOnly`. Maintain compatibility with Node >= 18.20.3.
  - `core/`: Fastypest orchestration, SQL script abstraction, configuration, subscribers, and shared types.
    - `fastypest.ts`: Central class orchestrating initialization, dependency ordering, table restoration, and logging. Extend this class with pure helper methods that manipulate in-memory state, and keep transactional work inside TypeORM `EntityManager` scopes. Reuse existing constants (e.g., `PROGRESS_OFFSET`, `INDEX_OFFSET_CONFIG`) or add new constants at the top-level when necessary.
    - `config.ts`: Holds database-specific tunables. Introduce new offsets or engine flags here rather than in-line.
    - `types.ts`: Centralized type aliases and enums. Add new public types here to keep the public API coherent, and re-export via `src/core/index.ts`.
    - `sql-script/`: Handles query templates. When adding queries:
      - Update the JSON file that matches the database engine.
      - Keep placeholders using `{{ key }}` syntax for substitution.
      - Ensure `QueryPath` types stay valid; extend the JSON shape rather than embedding SQL inline.
    - `subscribers/`: Contains TypeORM subscribers. Keep subscriber implementations side-effect free except for invoking provided callbacks.
  - `logging/`: Winston-based logging utilities.
    - Follow existing constant definitions (`LOGGING_*`). New log levels or icons belong in `constants.ts` with descriptive names.
    - The logger API (`ScopedLogger`, `LoggerTimer`) is the approved interface. Do not bypass it.
- `tests/`: Integration tests executed against dockerized databases.
  - Specs live under `tests/__tests__`. Follow Jest conventions (`describe`, `it`) and keep fixtures deterministic.
  - Configuration (`tests/config`) bootstraps TypeORM connections and seeds. Reuse helper utilities such as `ConnectionUtil` rather than duplicating transaction logic.
  - Seed data (`tests/seeds`) reflects current entity shapes. Update both seed arrays and entity definitions together.
  - Utilities (`tests/utils`) may extend `Fastypest` for test purposes; preserve the inheritance hierarchy to reuse core logic.
- `scripts/`: Node-based CLI helpers (e.g., Docker prep). Use Node ESM-compatible syntax when editing TypeScript (`prepare-docker.ts`). Keep synchronous `spawn.sync` usage and promise wrappers intact for consistent exit handling.
- `docker-compose.yml`: Defines integration test services. Update environment variables and ports coherently with `tests/config/orm.config.ts`.
- `eslint.config.mjs`: Source of lint rules. Ensure new patterns comply; run `yarn eslint` locally before committing.

## Coding Standards by Concern
- **Database Access**: All database interactions should go through TypeORM repositories, query builders, or `execQuery` helpers. When introducing new raw SQL, add query templates to the appropriate JSON and expose them via `QueryPath`-compatible structures.
- **Transactions**: Wrap stateful DB operations in `EntityManager.transaction` blocks. Never mutate `EntityManager` outside the transaction callback.
- **Logging**: Construct user-facing log text with descriptive emojis and capitalize key nouns, matching existing tone (e.g., `"🧪 Temporary table prepared"`). Compose optional details as ``Progress ${current}/${total}`` etc., avoiding interpolation of undefined values.
- **Timers**: Prefer `logger.timer(label)` when measuring multi-step processes. Call `mark` for intermediate milestones and `end` exactly once.
- **Error Handling**: Throw explicit `Error` instances with clear messages. Avoid swallowing errors—propagate and rely on callers/tests to handle them.
- **Functional Composition**: Break down complex routines into private helper methods with single responsibilities. Maintain immutability of collections where practical; use `const` and `readonly` when possible.

## Testing Conventions
- Execute `yarn build` before integration tests when mimicking CI (`yarn test`). Specs should:
  - Use `beforeAll` for expensive setup (`fastypest.init()`, seeding lookups) and `afterEach` for restoration, mirroring `tests/config/jest.setup.ts`.
  - Prefer repository methods for data assertions. Raw SQL is acceptable only when testing raw query scenarios and must be wrapped in helper functions with extracted constants (see `insertBasicQuery`).
  - Keep expectations explicit (`expect(value).toBe(...)`, `expect(value).toBeDefined()`). When checking nullability, use `toBeNull()` rather than `toBe(undefined)`.
  - When randomness is required (e.g., `randomIndex`), document it via extracted constants or deterministic seeds to avoid flakiness.

## Tooling & Automation
- **Node/Yarn**: Use Node 20.18.0 (Volta-pinned) and Yarn 4.8.1. Add dependencies via `yarn add` so the zero-installs `.yarn` directory stays consistent.
- **Build**: `yarn build` runs SWC then `tsc` for declarations and copies JSON assets. Ensure new files are included by matching existing glob patterns.
- **Linting**: Run `yarn eslint` (auto-fix enabled) prior to committing. The pre-commit hook (`lefthook.yml`) also executes `scripts/pre-commit.js`; keep it passing.
- **Formatting**: Adhere to Prettier defaults implicit in existing code (two spaces for indentation, trailing commas where allowed).

## GitHub Workflows
- The workflow `.github/workflows/dependabot-auto-merge.workflow.yml` manages both Dependabot and auto-release pull requests. Use the default `GITHUB_TOKEN` for approvals, reviewer assignments, and comments so they remain attributed to the GitHub Actions bot. Reserve `secrets.PAT_FINE` strictly for enabling auto-merge after the approvals are in place. Avoid introducing additional secrets or inline tokens.

## Git & PR Workflow
- Keep commits focused and messages descriptive. Reference impacted domains (`core`, `logging`, `tests`, etc.).
- Update `CHANGELOG.md` only through the release process unless explicitly instructed.
- When introducing public API changes, update both `README.md` files (English and Spanish) and ensure exported types/functions are documented.

## Prohibited Patterns
- No `any`, `as unknown as`, or unchecked type assertions. When narrowing, use type guards.
- No inline `require` or CommonJS additions inside TypeScript sources.
- No side-effectful top-level execution beyond constant initialization.
- No global mutable singletons outside logging configuration. Use class instances and dependency injection where needed.
- Do not edit generated artifacts under `dist/`.

By following this handbook, you ensure Fastypest remains reliable, type-safe, and easy to maintain across databases and testing environments.
