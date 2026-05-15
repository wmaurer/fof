# fof

Small CLI built on **Effect v4** (snapshot channel) + **`@effect/cli`**, with an **Ink + React** TUI for interactive subcommands, in a pnpm workspace.

## Reference repos

These are external code references — read them when you need to understand a pattern or look up an API. They live outside this repo and are not committed.

- **`../moat-ai-assistant`** — sibling repo this one was bootstrapped from. The pnpm workspace layout, `tsconfig.base.json` (including the full `@effect/language-service` plugin diagnostic map), `vitest.config.ts`, `.gitignore`, and `scripts/fetch-references.sh` all mirror it. When unsure about a repo-level convention, check there first before inventing one.
- **`.repos/effect`** — full clone of [`Effect-TS/effect-smol`](https://github.com/Effect-TS/effect-smol), fetched by `bash scripts/fetch-references.sh`. Gitignored. Read this for Effect v4 source, tests, and `examples/` when you need to verify API shapes, find usage patterns, or understand internals (e.g. how `Command.run`, `NodeRuntime.runMain`, or a specific Layer wires up). **Important:** v4 snapshots (`0.0.0-snapshot-<sha>`) publish from `effect-smol`, not `Effect-TS/effect` — always clone effect-smol so the source you read matches what's installed under `@effect/*`.
- **`.repos/ink`** — full clone of [`vadimdemedes/ink`](https://github.com/vadimdemedes/ink). Read this for Ink internals, the built-in component source (`<Box>`, `<Text>`, `<Static>`, etc.), `useInput` / `useApp` / `useStdin` / `useFocus` hook implementations, and the `examples/` directory (idiomatic Ink usage patterns).

Add more entries to the `repos=(name|url[|ref])` array in `scripts/fetch-references.sh` as the project grows; re-run the script to (re-)clone (idempotent — skips existing `.git` dirs).

## Patterns (`.patterns/`)

The `.patterns/` directory holds **distilled Effect v4 conventions** — short, opinionated "for this repo, do it this way" recipes copied over from `../moat-ai-assistant`. Each pattern doc has the same shape: a top-of-file **Recommendation** (numbered rules), a **Why This Pattern** justification, **Relevant Upstream Files** (pointers into `.repos/effect/...`), and **Core Rules** with code examples.

**Read the relevant pattern before writing Effect code in that area.** Pattern docs encode hard-won decisions (e.g. _use `Context.Service` not `Effect.Service` in v4_, _one `ManagedRuntime` per surface_, _`@effect/vitest`'s `it.effect` is the default test shape_) that are easy to get subtly wrong otherwise — the Effect v4 API has moved fast and a lot of stale guidance still floats around.

Pattern docs reference `.repos/effect/...` paths heavily, so the patterns are **most useful after** `bash scripts/fetch-references.sh` has populated `.repos/effect/` — otherwise the "upstream files" links will be dead.

Files:

| File                     | When to read                                                                                                                                                                                                                                                        |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `services-and-layers.md` | Defining `Context.Service` classes, `Live`/`makeTest` layers, `ManagedRuntime`.                                                                                                                                                                                     |
| `schemas.md`             | Modeling data with `effect/Schema` v4 (decoders, encoders, branded types).                                                                                                                                                                                          |
| `testing.md`             | `@effect/vitest`: `it.effect`, `it.layer`, top-level `layer(...)`, test-utils layout.                                                                                                                                                                               |
| `ink.md`                 | Building Ink + React TUIs on Effect v4: `@effect/cli` ↔ Ink composition, layout, input, `<Static>`, Suspense, testing, plus the snapshot/beta channel-mismatch gotcha that blocks naive `@effect/atom-react` install. **Read before writing any `.tsx` component.** |
| `atom-react.md`          | Atom-based state + React. The bridge between Effect (services, layers, streams, scopes) and React's render cycle. Read once `@effect/atom-react` is actually installed (see `ink.md` §1 for the channel-mismatch blocker).                                          |

## Toolchain quirks worth knowing up front

- **`@effect/tsgo`** replaces `tsc`. `pnpm typecheck` invokes `tsgo --noEmit` against the root tsconfig + each app's tsconfig. The root `prepare` script (`effect-tsgo patch`) patches `@typescript/native-preview` on install — needed for the Effect language-service plugin to load. Don't skip it.
- **Effect v4 is on the `beta` channel** as `4.0.0-beta.<n>` (currently `4.0.0-beta.66`). The `effect` package is a **mega-package** — it absorbed what used to be `@effect/cli`, `@effect/schema`, `@effect/printer`, `@effect/typeclass`, and `@effect/platform` into subpaths like `effect/unstable/cli`, `effect/Schema` (also `effect/unstable/schema`), etc. Only `@effect/platform-node` (and its `-shared` companion) is still separate — it provides `NodeRuntime.runMain` and `NodeServices.layer` (formerly `NodeContext.layer`). The `pnpm.overrides` block pins `effect` + `@effect/platform-node*` to the same beta. **When bumping**: update all three together, re-run `pnpm install`, then `pnpm typecheck` — `Schema` and `Command` API shapes do shift between betas.
- **Language-service directive comments**: suppress an Effect lint at a specific line with `// @effect-diagnostics-next-line <rule>:off`. Used in `apps/cli/src/index.tsx` to silence `strictEffectProvide` at the entry-point `Effect.provide(NodeServices.layer)` (the lint is a defensive check against mid-pipeline layer provision, which is safe at program entry), and in `apps/cli/src/ui/settings-store.ts` to silence `nodeBuiltinImport`/`processEnv` at the filesystem-config boundary (no live Effect runtime at React state-initializer time, so `@effect/platform`'s `FileSystem` / `Config` aren't reachable there).
- **`tsx`** runs TypeScript directly — no build step in dev. App scripts use `tsx src/index.tsx` (run) and `tsx watch src/index.tsx` (watch).
- **Ink + React** for the TUI. JSX transform is `react-jsx` (already set in `tsconfig.base.json`) — no `import React from "react"` boilerplate needed. Components live in `.tsx` files; `apps/cli/tsconfig.json` includes both `.ts` and `.tsx`. See `.patterns/ink.md` for the full pattern; the three highest-leverage rules to remember in passing: **(a)** Ink v7's default `patchConsole: true` routes `console.log` safely above the live frame — it won't corrupt rendering — but prefer file logging (`fs.appendFileSync("debug.log", …)` + `tail -f`) for high-volume debug so the live region stays usable. **(b)** Compose `effect/unstable/cli` ↔ Ink at the subcommand boundary with `Effect.acquireUseRelease(... render(<App />) ..., (i) => Effect.promise(() => i.waitUntilExit()), (i) => Effect.sync(() => i.unmount()))` so Effect interruption tears the UI down. **(c)** `@effect/atom-react` is the canonical Effect↔React bridge — check its peer-range against the active `4.0.0-beta.<n>` before `pnpm add`; mismatched betas split the `Effect`/`Stream` type identities the same way snapshot SHAs used to.

## Common commands

```
pnpm start [args]                 # run the CLI (delegates to @fof/cli)
pnpm dev   [args]                 # tsx watch — restart on file change
pnpm typecheck                    # tsgo on root + apps/cli
pnpm test  / pnpm test:watch      # vitest (projects = apps/*, packages/*)
bash scripts/fetch-references.sh  # clone/refresh .repos/ entries
```

## Layout

- `apps/cli/` — `@fof/cli`, the CLI app. Entry: `src/index.ts`.
- `packages/` — placeholder for shared libs (currently empty).
- `.patterns/` — Effect v4 pattern reference docs (see _Patterns_ section above).
- `scripts/fetch-references.sh` — reference-repo cloner; populates `.repos/`.
- `tsconfig.base.json` — Effect-flavored base config with full language-service diagnostic severity map. Edit carefully.
- `tsconfig.json` — workspace-wide `include` for typechecking everything in one pass.
- `vitest.config.ts` — top-level vitest with `projects: ["apps/*", "packages/*"]`.

## Code Style Guidance

- Keep changes minimal and consistent with the existing code.
- Prefer established Effect patterns over ad hoc abstractions.
- Before adding a new approach, check whether `./.repos/effect` already demonstrates the same idea.
- Respect the `@effect/language-service` diagnostics declared in `tsconfig.base.json` — they enforce the workshop's strict Effect rules and they all run as `error`.
- `node:*` imports are forbidden by `nodeBuiltinImport`. The single exception is `apps/server/src/http/server.ts`, which suppresses the rule via a file-level `// @effect-diagnostics` directive because it must construct the Node HTTP server. Do not introduce other Node-builtin imports without an equivalent justification.
