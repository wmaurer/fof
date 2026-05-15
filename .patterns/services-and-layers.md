# Services & Layers Pattern

## Recommendation

For this repo, the best default pattern when wiring services and layers with Effect v4 is:

1. Define services as classes that extend `Context.Service<Self>()(id, { make })`. **There is no `Effect.Service` in v4** — the canonical class-form constructor lives on `Context`.
2. Build the service shape with the auto-generated `MyService.of({...})` builder when constructing layers (or just return a plain object literal — `of` is an identity-typed helper that constrains the shape).
3. Expose every implementation as a `static readonly` property on the class: `static readonly Live = ...` for production wiring and `static readonly makeTest = (...) => Layer.succeed(...)` (or `static readonly testLayer = ...`) for deterministic test stand-ins.
4. Use `Layer.succeed(Tag)(value)` (curried) for trivial implementations and `Layer.effect(Tag)(scoped)` for layers that allocate state, depend on other services, or need a `Scope`.
5. Combine independent layers with `Layer.mergeAll(...)` and feed dependencies with `Layer.provide(child)`. Use `Layer.provideMerge(child)` only when the child's services must remain visible in the resulting layer's success type (e.g. in test layers that need to expose a server URL alongside the service under test).
6. Construct one `ManagedRuntime.make(layer)` per surface (popup, overlay, content script, service worker, harness). Never reach for a process-wide singleton.
7. Yield services directly inside `Effect.gen`: `const chat = yield* ChatService` — every `Context.Service` instance is `Yieldable`.

## Why This Pattern

- The `Context.Service` class form gives one value that is both the **tag** (yieldable, identifiable in `Context`) and the **constructor namespace** (`.of`, `.layer`, `.makeTest`, `.Live`). Tests and call sites reference the same identifier.
- Co-locating `Live`/`makeTest` on the class keeps the wiring with the contract; per-surface `ManagedRuntime`s then compose well-named layers instead of redoing the wiring per app.
- One `ManagedRuntime` per surface matches the extension's reality: each context (popup, overlay, content, SW, harness) has its own JS realm, its own lifecycle, and a different layer set (`ChromeRuntimeLive` vs `ChromeRuntimeStubLive`, `ChatService.Live` vs `ChatService.makeTest`). A single global runtime cannot model that.
- The curried `Layer.succeed(Tag)(value)` / `Layer.effect(Tag)(effect)` form matches every example in `.repos/effect/`, including the upstream `effect-solutions services-and-layers` guide and `Layer.test.ts`.

## Relevant Upstream Files

- `.repos/effect/packages/effect/src/Context.ts` — `Service`, `ServiceClass`, `.of`, `.context`, `.use`, `.useSync`, `Yieldable` proto.
- `.repos/effect/packages/effect/src/Layer.ts` — `succeed`, `sync`, `effect`, `effectContext`, `mergeAll`, `merge`, `provide`, `provideMerge`, `unwrap`.
- `.repos/effect/packages/effect/src/ManagedRuntime.ts` — `make`, `runFork`, `runPromise`, `runPromiseExit`, `runSync`, `runSyncExit`, `runCallback`, `dispose`.
- `.repos/effect/packages/effect/test/Layer.test.ts` — class-form `Context.Service<Self, Shape>()("id")`, curried `Layer.effect(Tag)(...)`, `provide` vs `provideMerge`, `Layer.mock`.
- `.repos/effect/packages/effect/test/ManagedRuntime.test.ts` — `ManagedRuntime.make(layer)`, `runPromise`, `dispose`, shared `memoMap`.
- `.repos/effect/packages/effect/src/unstable/cluster/internal/entityReaper.ts` — canonical "service-with-state via `make: Effect.gen`" pattern, plus `static readonly layer = Layer.effect(this)(this.make)`.

## Core Rules

### 1. Defining a service with `Context.Service`

Two equivalent v4 forms — pick the shape that fits the implementation.

**Form A — class-only, layer built externally (preferred when there are multiple variants like `Live`/`Stub`/`Test`):**

```ts
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Stream from "effect/Stream";

export class ChatService extends Context.Service<
    ChatService,
    { readonly streamReply: (request: ChatStreamRequest) => Stream.Stream<StreamPart, ServerUnreachable> }
>()("@moat-assistant/ai-client/ChatService") {}
```

**Form B — class plus a default `make` effect (preferred when there is exactly one production layer and you want `static readonly layer = Layer.effect(this)(this.make)`):**

```ts
export class EntityReaper extends Context.Service<EntityReaper>()("effect/cluster/EntityReaper", {
    make: Effect.gen(function* () {
        // allocate state, yield* deps...
        return { register } as const;
    }),
}) {
    static readonly layer: Layer.Layer<EntityReaper> = Layer.effect(this)(this.make);
}
```

Notes:

- The first type parameter (`Self`) lets the class be referenced as both tag and value. The second type parameter (`Shape`) is the service's interface; it can be inferred from `make` if you supply it.
- The string id (`"@moat-assistant/extension/ChromeStorage"`) must be globally unique. Use the package-scoped prefix the rest of this repo uses.
- Methods on the service shape should not have lingering `R` requirements — keep dependencies inside the layer's construction effect, not in method signatures.

### 2. Building Live and Test layers as static methods

Every service the plan touches has at least one stand-in (`Stub`, `makeTest`) and one production (`Live`) layer. Co-locate them on the class:

```ts
export class ChatService extends Context.Service<ChatService, {
  readonly streamReply: (request: ChatStreamRequest) => Stream.Stream<StreamPart, ServerUnreachable>
}>()("@moat-assistant/ai-client/ChatService") {
  static readonly makeTest = (script: ReadonlyArray<StreamPart>): Layer.Layer<ChatService> =>
    Layer.succeed(ChatService)(ChatService.of({
      streamReply: () => Stream.fromIterable(script)
    }))

  static readonly Live = (baseUrl: string): Layer.Layer<ChatService> =>
    Layer.succeed(ChatService)(ChatService.of({
      streamReply: (request) => /* fetch + parseSseStream(...) */
    }))
}
```

`ChatService.of({...})` is the `ServiceClass.of` helper from `Context.ts` (line 211 in upstream): `of(this: void, self: Shape): Shape` — it is an identity function with the right type. Use it so TypeScript infers the shape from the class instead of from the literal alone. Returning a bare object literal works too, but `.of` keeps inference local and surfaces shape mismatches at the construction site rather than at the `Layer.succeed` callsite.

For services that need a scope or other services to construct (e.g. `ChromeStorageStubLive` building a `Map`), use `Layer.effect`:

```ts
export const ChromeStorageStubLive = Layer.effect(ChromeStorage)(
  Effect.sync(() => {
    const map = new Map<string, unknown>()
    return ChromeStorage.of({
      get:    /* read from map, decode with Schema.decodeUnknownEffect */,
      set:    /* encode with Schema.encodeEffect, write to map */,
      changes: () => Stream.empty
    })
  })
)
```

### 3. `Layer.succeed` vs `Layer.effect`

| Constructor                    | When                                                                                                   | Argument shape                                                                        |
| ------------------------------ | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| `Layer.succeed(Tag)(value)`    | The implementation is a plain object literal you can build synchronously and it has no dependencies.   | Curried: tag first, then value. The dual form `Layer.succeed(Tag, value)` also works. |
| `Layer.sync(Tag)(() => value)` | Same as above but you want lazy construction (re-evaluated each build).                                | Curried tag, then thunk.                                                              |
| `Layer.effect(Tag)(effect)`    | The service needs to allocate (e.g. `Map`, `Ref`, latches), open a scope, or depend on other services. | Curried: tag first, then `Effect<Shape, E, R>`. Replaces v3 `Layer.scoped`.           |
| `Layer.effectContext(effect)`  | The effect already produces a `Context.Context<...>` of multiple services.                             | Single `Effect<Context, E, R>` argument.                                              |

Both `succeed` and `effect` are dual: `(Tag)(value)` and `(Tag, value)` both compile. The curried form reads better in `pipe(...)` chains; the dual form is slightly terser at the top level. Pick one and stay consistent — this repo prefers the curried form because it matches every upstream example.

### 4. Composing layers (`mergeAll`, `provide`, `provideMerge`)

```ts
// Combine independent layers (none depends on the others' outputs).
const ExtensionLayer = Layer.mergeAll(
  ChatService.Live(baseUrl),
  ChromeRuntimeLive,
  ChromeStorageLive
)

// Feed a dependency into a layer's input requirements but do NOT re-export it.
const ChatHandlersWithLm = ChatHandlersLive.pipe(Layer.provide(StubLanguageModelLive))
// ChatHandlersWithLm provides whatever ChatHandlersLive provides; LanguageModel is consumed.

// Feed a dependency into a layer AND keep it visible in the success type.
const TestServerLive = HttpRouter.serve(TestRoutesLive, { ... })
  .pipe(Layer.provideMerge(NodeHttpServer.layerTest))
// TestServerLive exposes both the server's services AND the test server's services
// (so the test can yield* the test server URL alongside the API).
```

Decision rule for `provide` vs `provideMerge`:

- **`Layer.provide(child)`** — child's outputs satisfy the parent's `R` and are then _consumed_. The combined layer's success type is just the parent's. Use this for production wiring where downstream code never needs to grab the dependency directly.
- **`Layer.provideMerge(child)`** — child's outputs satisfy the parent's `R` _and_ remain in the combined layer's success type. Use this when the test (or a higher-level composition) must `yield*` both the parent service and the dependency. The plan uses `provideMerge` exactly once — Task 25's `NodeHttpServer.layerTest` — which is correct: the integration test needs the route layer wired up _and_ the test server's URL/handle to fire requests against.

`Layer.mergeAll(...)` is variadic (rest args) and **not** an array. `Layer.merge(self, that)` is the binary version.

### 5. `ManagedRuntime` per surface

```ts
import * as ManagedRuntime from "effect/ManagedRuntime";

const layer = Layer.mergeAll(ChatService.Live("http://localhost:3000"), ChromeRuntimeLive, ChromeStorageLive);
const runtime = ManagedRuntime.make(layer);
const registry = AtomRegistry.make({ runtime });
```

`ManagedRuntime.make(layer)` returns a `ManagedRuntime<R, ER>` that exposes:

- `runFork(effect, options?)` — forks the effect onto the runtime; returns a `Fiber`. Used by stream subscriptions like the `postMessage` pump in Task 39 and the storage subscription in Task 41.
- `runPromise(effect, options?)` / `runPromiseExit(...)` — for one-shot async work.
- `runSync(effect)` / `runSyncExit(effect)` — synchronous edges only.
- `runCallback(effect, { onExit })` — callback-style edges.
- `memoMap` — pass to a sibling `ManagedRuntime.make(layer, { memoMap })` to share built layers across runtimes (rarely needed in this repo).
- `dispose()` / `disposeEffect` — release the layer scope; interrupts in-flight fibers. Surfaces with a finite lifetime (popup close, overlay teardown) should call `dispose()` in their unmount handler.

Why per-surface, not global:

- Each surface has a different layer set. The popup uses `ChromeRuntimeLive` with no selection subscription; the overlay calls `makeExtensionRegistry({ listenForSelections: true })` and forks a `Stream.runForEach` that needs the overlay's window scope. The harness flips between `ChatStubLive` and `ChatService.Live(baseUrl)` via React state.
- Scope ownership matches the host's lifecycle. When the popup closes its `ManagedRuntime` is disposed; storage listeners and SSE streams that were `runFork`-ed inside it shut down with it.
- Service workers and content scripts run in different JS realms entirely — they cannot share a JS runtime even if you wanted to.

### 6. Yielding services in `Effect.gen`

`Context.Service` extends `Yieldable`, so the class itself is the tag and you can `yield*` it directly:

```ts
import * as Effect from "effect/Effect";

const program = Effect.gen(function* () {
    const chat = yield* ChatService; // Effect<ChatService.Shape, never, ChatService>
    const storage = yield* ChromeStorage;
    const runtime = yield* ChromeRuntime;
    yield* runtime.sendMessage(toggleOverlay);
    return yield* Stream.runCollect(chat.streamReply(request));
});
```

There is no need for a separate `Tag` value. `ChatService` _is_ the tag — that is the point of the class form. The service's shape is `Context.Service.Shape<typeof ChatService>` if you ever need to name it externally.

For non-generator code, `ChatService.use(fn)` and `ChatService.asEffect()` are also available.

## Practical Patterns For This Repo

### Service definitions → Tasks 11, 12, 23, 34

- `ChatService` (Tasks 11, 12) — class extends `Context.Service<ChatService, Shape>()("@moat-assistant/ai-client/ChatService")`, exposes `static makeTest(script)` and `static Live(baseUrl)` returning `Layer.Layer<ChatService>`.
- Server-side `LanguageModel` (Task 23) — already a `Context.Service` in `effect/unstable/ai`; the plan provides `StubLanguageModelLive = Layer.succeed(LanguageModel.LanguageModel)(LanguageModel.LanguageModel.of({...}))`.
- `ChromeStorage`, `ChromeRuntime` (Task 34) — class form, with three layers each: `*StubLive` (constructed via `Layer.effect` if it allocates a `Map`, otherwise `Layer.succeed`), `*Live` (real `chrome.*` calls).
- Future `ChromeTabs`, `ChromeCommands` (Task 40) — same pattern.

### Layer composition for the server → Tasks 7, 23

```ts
const ChatHandlersWithLm = ChatHandlersLive.pipe(Layer.provide(StubLanguageModelLive));

export const HttpApiRoutesLive = Layer.mergeAll(
    HttpApiBuilder.layer(Api, { openapiPath: "/openapi.json" }).pipe(
        Layer.provide(SystemHandlersLive),
        Layer.provide(ChatHandlersWithLm),
    ),
    HttpApiScalar.layer(Api, { path: "/docs" }),
);
```

`provide` (not `provideMerge`) feeds handlers into the API builder — the server program never needs to `yield* ChatHandlers` directly.

### Per-surface runtimes → Tasks 17, 21, 35, 36, 39, 41

- `packages/ui/src/test-utils/index.ts` (Task 17) — `makeRegistry(layer)` calls `ManagedRuntime.make(layer)` and wraps it in `AtomRegistry.make({ runtime })` for component tests.
- `apps/web/src/runtime.tsx` (Task 21) — harness creates a `ManagedRuntime` from `ChatStubLive` or `ChatService.Live(...)` based on a React state toggle.
- `apps/extension/src/lib/runtime.ts` (Task 35, 36) — `makeExtensionRegistry()` builds a `Layer.mergeAll(ChatService.Live(baseUrl), ChromeRuntimeLive, ChromeStorageLive)` and creates the per-context `ManagedRuntime`.
- Task 39 extends the same module with `runtime.runFork(Stream.runForEach(postMessageStream(...), ...))` for the overlay's selection pump.
- Task 41 extends it again with `runtime.runFork(...)` for the `chrome.storage.onChanged` subscription.

### Test layers → Tasks 11, 17, 18, 25, 42

- `ChatService.makeTest(script)` returns `Layer.Layer<ChatService>` and is the unit-test layer for any UI component or atom that depends on `ChatService`.
- Task 25's `TestServerLive` uses `Layer.provideMerge(NodeHttpServer.layerTest)` because the test fiber needs the test-server URL and the server's services together.
- Task 42's `FailingChatLive` is a one-off `Layer.succeed(ChatService)(ChatService.of({ streamReply: () => Stream.fail(...) }))` for an error-path test.

## Anti-Patterns

1. **`Effect.Service<Self>()(...)`.** Does not exist in v4. Use `Context.Service<Self>()(...)`. (See "Open questions / plan-vs-upstream mismatches" — the plan's snippets use the v3-flavoured spelling throughout. Migrate at implementation time.)
2. **`Layer.succeed(Tag, value)` vs `Layer.succeed(Tag)(value)` mixed within one file.** Both compile. Pick one — this repo uses the curried form.
3. **`Layer.mergeAll([a, b, c])` (array argument).** It is variadic: `Layer.mergeAll(a, b, c)`.
4. **Reaching for `Layer.scoped`.** Removed in v4 — `Layer.effect(Tag)(effect)` is the replacement and accepts `Effect<Shape, E, R | Scope>`.
5. **A single global `ManagedRuntime` shared across surfaces.** Each surface has its own layer mix and lifecycle. Build per-surface.
6. **Forgetting to `runtime.dispose()` (or wire it to the host's unmount/teardown).** Long-lived `Stream.runForEach` fibers will leak listeners on `chrome.runtime.onMessage` / `chrome.storage.onChanged`.
7. **Using `ServiceTag.of(...)` like a constructor that produces an `Effect`.** `Service.of` is an identity helper that gives you the _value_ of the service shape (`Shape -> Shape`, type-narrowed). Wrap it in `Layer.succeed`/`Layer.effect`, never yield it.
8. **`Layer.provideMerge` everywhere "to be safe".** It widens the success type of every consumer and pulls otherwise-internal services into the public surface. Default to `Layer.provide`; reach for `provideMerge` only when the dependency must remain reachable downstream (test fixtures and a small set of compositional layers).

## Decision Rule

### Class form A (no `make`) vs form B (with `make`)

- **A (class only)** — when the service has multiple implementations (`Live`/`Stub`/`Test`) or its construction depends on runtime parameters (`baseUrl`, scripted streams). Every browser-extension service in the plan is form A.
- **B (`make`)** — when there is exactly one canonical implementation and you want `static readonly layer = Layer.effect(this)(this.make)`. Common in upstream's internal services (`EntityReaper`, `McpServer`).

### `Layer.succeed` vs `Layer.effect`

- **`succeed`** — the implementation is a plain object literal with no allocation, no `Scope`, and no other service dependencies.
- **`effect`** — anything else: needs to allocate state, depends on another service (`yield* Database`), or holds resources that must be released when the layer scope closes.

### `Layer.provide` vs `Layer.provideMerge`

- **`provide`** — the dependency is an implementation detail; downstream code does not need to see it.
- **`provideMerge`** — the dependency must stay in the success type for downstream consumers (tests that need both, or compositional layers exposing multiple services).

## Short Checklist

Before adding or editing service/layer wiring, check:

1. Is the service defined with `Context.Service<Self>()(id, ...)`? (Not `Effect.Service`.)
2. Are `Live`/`Test`/`Stub` layers exposed as `static` properties on the class?
3. Are layers built with the curried `Layer.succeed(Tag)(value)` / `Layer.effect(Tag)(effect)` form?
4. Is `Layer.mergeAll` called variadically (no array)?
5. Is `Layer.provide` the default, with `Layer.provideMerge` reserved for cases where the dependency must remain visible?
6. Does each surface (popup/overlay/content/SW/harness) have its own `ManagedRuntime.make(layer)`?
7. Does every long-lived `runtime.runFork(...)` (storage, postMessage, runtime.onMessage) have a `runtime.dispose()` path tied to host teardown?
8. Are services consumed via `const svc = yield* MyService` inside `Effect.gen` (rather than via separate tag values)?

## Used by

- **Task 7** — `Layer.mergeAll(...)` + `Layer.provide(SystemHandlersLive)` / `Layer.provide(ChatHandlersLive)` to wire `HttpApiBuilder.layer(Api)`.
- **Task 11** — `class ChatService extends Context.Service<ChatService, Shape>()("...")`; `static makeTest = (script) => Layer.succeed(ChatService)(ChatService.of({...}))`; `it.layer(ChatService.makeTest(script))` consumes it.
- **Task 12** — adds `static Live = (baseUrl) => Layer.succeed(ChatService)(ChatService.of({...}))` alongside `makeTest`.
- **Task 17** — `makeRegistry(layer)` calls `ManagedRuntime.make(layer)` then `AtomRegistry.make({ runtime })`; `TestRegistryProvider` builds one per render.
- **Task 18** — uses `ChatService.makeTest([])` as the layer for component tests.
- **Task 21** — harness `ManagedRuntime.make(layer)` per render; flips between `ChatStubLive` and `ChatService.Live(baseUrl)` based on React state.
- **Task 23** — `StubLanguageModelLive = Layer.succeed(LanguageModel.LanguageModel)(LanguageModel.LanguageModel.of({...}))`; `ChatHandlersWithLm = ChatHandlersLive.pipe(Layer.provide(StubLanguageModelLive))`.
- **Task 25** — `Layer.provideMerge(NodeHttpServer.layerTest)` for the integration-test server layer.
- **Task 34** — `class ChromeStorage extends Context.Service<...>()("...")`, `class ChromeRuntime extends Context.Service<...>()("...")`; `ChromeStorageStubLive = Layer.effect(ChromeStorage)(Effect.sync(() => ChromeStorage.of({...})))`; `ChromeRuntimeLive = Layer.succeed(ChromeRuntime)(ChromeRuntime.of({...}))`.
- **Task 35** — popup's `makeExtensionRegistry()` builds `Layer.mergeAll(ChatService.Live(...), ChromeRuntimeLive, ChromeStorageLive)` and `ManagedRuntime.make(layer)`.
- **Task 36** — overlay calls the same `makeExtensionRegistry()`; same `ManagedRuntime` shape per overlay context.
- **Task 39** — extends `makeExtensionRegistry({ listenForSelections: true })` with `runtime.runFork(Stream.runForEach(postMessageStream("self"), ...))`; relies on per-surface `ManagedRuntime` so the fiber is bound to the overlay's lifetime.
- **Task 40** — adds `ChromeCommands` (and possibly `ChromeContextMenus`) services to `makeExtensionRegistry`'s merged layer.
- **Task 41** — `runtime.runFork(Effect.gen(function* () { const storage = yield* ChromeStorage; ... }))` for the `chrome.storage.local` change-stream subscription.
- **Task 42** — `FailingChatLive = Layer.succeed(ChatService)(ChatService.of({ streamReply: () => Stream.fail(...) }))` as a per-test failure-path layer.
