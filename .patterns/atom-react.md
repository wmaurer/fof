# Atom + React Pattern

## Recommendation

For this repo, the best default pattern when wiring atom-based state on Effect v4 is:

1. Define **plain state atoms** with `Atom.make(initialValue)` from `effect/unstable/reactivity/Atom`. Plain values give a `Writable<A>`; `(get) => ...` gives a derived/computed `Atom<A>`; passing an `Effect` or `Stream` gives an `Atom<AsyncResult.AsyncResult<A, E>>`.
2. Define **Effect-backed writer atoms** with `runtime.fn(...)`, **never `Atom.fn` directly** when the writer needs services. First build a per-surface `Atom.runtime(myLayer)`, then use `runtime.fn((arg, get) => Effect.gen(function* () { ... }))`. The first parameter is the **argument**, not a `set` callback; mutations are done with `get.set(otherWritable, value)` or `get.setSelf(value)` from the `FnContext`.
3. Build the `AtomRegistry` per surface with **`AtomRegistry.make(options?)`** from `effect/unstable/reactivity/AtomRegistry`. **There is no `{ runtime }` option** — the runtime is bound to atoms via `Atom.runtime(layer)`, not to the registry. Keep the per-surface `ManagedRuntime` for `runtime.runFork(...)` edge work (storage subscriptions, `postMessage` pumps); keep the per-surface `AtomRegistry` for React.
4. Wire React to the registry with **`<RegistryContext.Provider value={registry}>`** from `@effect/atom-react`. For tests and short-lived surfaces, prefer **`<RegistryProvider>`** (also from `@effect/atom-react`) — it builds and disposes the registry from props automatically.
5. Read atoms in components with hooks exported at the **top level** of `@effect/atom-react`: `useAtomValue`, `useAtomSet`, `useAtom`, `useAtomMount`, `useAtomRefresh`, `useAtomSuspense`, `useAtomSubscribe`. **There is no `Hooks` namespace** — the plan's `Hooks.useAtomValue(...)` import is wrong; rewrite to `import { useAtomValue } from "@effect/atom-react"`.
6. Model anything async (chat reply, fetch, stream) as an `Atom<AsyncResult<A, E>>` from the start. The four observable shapes are `Initial` / `Success` / `Failure`, each carrying `waiting: boolean`. Match with `AsyncResult.match(value, { onInitial, onSuccess, onFailure })`. `useAtomSuspense` integrates with React Suspense and `ErrorBoundary` directly.
7. Per-surface `AtomRegistry` only — never share an instance across popup, overlay, content script, service worker or harness. Each surface has its own JS realm, its own `ManagedRuntime`, and its own React tree.

## Why this pattern

- The atom core lives in `effect/unstable/reactivity/Atom.ts` (and `AtomRegistry.ts`, `AsyncResult.ts`); the React bindings live in `@effect/atom-react`. The plan's split across two import paths is correct — both packages exist, and `@effect/atom-react` re-exports nothing from the atom core, only the React glue (`useAtomValue`, `RegistryContext`, `RegistryProvider`, `HydrationBoundary`, `ScopedAtom`).
- `useAtomValue` uses `React.useSyncExternalStore` under the hood (`packages/atom/react/src/Hooks.ts:52`), so subscriptions tear-cleanly across React 18 concurrent rendering, batching, and SSR/hydration. There is no need for a manual `useEffect` + `useState` bridge.
- `Atom.runtime(layer)` returns a `RuntimeFactory`-bound `AtomRuntime<R, ER>` that exposes `runtime.atom(effect)` and `runtime.fn(arg => effect)`. Atoms produced this way are typed `Atom<AsyncResult.AsyncResult<A, E | ER>>` — the layer's failure channel is incorporated into the result type. This is the only way to flow `ChatService`, `ChromeStorage`, `LanguageModel` (etc.) into atom writers without resorting to `Effect.provide(MyLayer)` everywhere.
- A `Writable<R, W>` atom writer expects `(value: W) => void`. `useAtomSet(atom)` returns exactly that callback (mounting the atom along the way), so component code never directly touches the registry. The harness's `runtime.runPromise(...)` calls in stream-pump tasks (39, 41) stay outside React entirely.
- `AsyncResult` carries `previousSuccess` on `Failure` and `waiting: boolean` on every variant, so an in-flight retry shows `{ _tag: "Success", value: prev, waiting: true }` instead of clearing the screen. This is the right shape for the chat reply UI; a flat `ReadonlyArray<ChatMessage>` cannot express it (Task 42).

## Relevant upstream files

- `.repos/effect/packages/effect/src/unstable/reactivity/Atom.ts` — `make` (line 361, accepts plain value, function, `Effect`, or `Stream`), `readable`/`writable` (lines 319, 335), `Atom`/`Writable`/`AtomContext`/`WriteContext` (lines 51, 110, 119, 157), `setIdleTTL`/`keepAlive`/`autoDispose`/`setLazy`/`withLabel`/`initialValue`/`map`/`mapResult`/`debounce` combinators (lines 168, 1361, 1376, 1386, 1399, 1415, 1489, 1506, 1531), `runtime: RuntimeFactory` (line 731) and `context({ memoMap })` (line 666) for building per-runtime atoms, `AtomRuntime<R, ER>` interface (line 559) with `.atom`/`.fn`/`.pull`/`.subscriptionRef`, `fnSync` (line 951) and `fn` (line 1031) for argument-driven writers, `FnContext` shape (line 920) — the writer signature is `(arg, get: FnContext) => Effect | Stream` and `get` exposes `set`, `setSelf`, `mount`, `refresh`, `subscribe`, `result`, `stream`, `streamResult`, `subscribe`, `addFinalizer`, `registry`. **There is no `(set, ...args) => Effect` form.**
- `.repos/effect/packages/effect/src/unstable/reactivity/AtomRegistry.ts` — `AtomRegistry` interface (line 42) with `get`/`set`/`mount`/`refresh`/`update`/`modify`/`subscribe`/`reset`/`dispose`, `make(options?)` (line 80) — options are `initialValues` / `scheduleTask` / `timeoutResolution` / `defaultIdleTTL`; **no `runtime` option**, the `RuntimeFactory` is wired through `Atom.runtime(layer)` instead. `AtomRegistry` `Context.Service` tag (line 99) and `layer` (line 128) for use inside Effect programs that yield the registry. `toStream`/`toStreamResult`/`getResult`/`mount` (lines 138, 160, 179, 212) for Effect-side bridging.
- `.repos/effect/packages/effect/src/unstable/reactivity/AsyncResult.ts` — three-tag union `Initial<A,E> | Success<A,E> | Failure<A,E>` (line 38) with shared `waiting: boolean` on every variant. **There is no separate `Loading` tag** — "loading" is `result.waiting === true`. Constructors `initial`, `success`, `failure`, `failureWithPrevious`, `waiting`, `waitingFrom` (lines 171, 198, 237, 256, 298, 147); guards `isInitial`, `isSuccess`, `isFailure`, `isInterrupted`, `isWaiting`, `isNotInitial`; combinators `map`, `flatMap`, `match`, `matchWithError`, `matchWithWaiting`, `all` (lines 404, 425, 457, 487, 523, 569). `Schema` builder (line ~880) for serializable round-trips.
- `.repos/effect/packages/atom/react/src/index.ts` — re-exports `Hooks.ts`, `RegistryContext.ts`, `ReactHydration.ts`, `ScopedAtom.ts`. **All hooks land at the top level** (no `Hooks` namespace); the file is named `Hooks.ts` only as an internal organisational unit.
- `.repos/effect/packages/atom/react/src/Hooks.ts` — `useAtomValue<A>(atom, f?)` (line 80), `useAtomSet(atom, options?)` (line 144) — supports `mode: "value" | "promise" | "promiseExit"` for `AsyncResult` writers, `useAtom(atom, options?)` (line 182) returning `[value, set]`, `useAtomMount(atom)` (line 135), `useAtomRefresh(atom)` (line 170), `useAtomSuspense(atom, { suspendOnWaiting?, includeFailure? })` (line 249), `useAtomSubscribe(atom, f, { immediate? })` (line 268), `useAtomInitialValues(...)` (line 61) for one-shot seeding without provider props.
- `.repos/effect/packages/atom/react/src/RegistryContext.ts` — `RegistryContext` (line 24, default value is a fallback `AtomRegistry.make({ scheduleTask, defaultIdleTTL: 400 })` so unprovided trees still work in tests/storybook), `RegistryProvider` (line 33) which builds the registry once via `useRef`, threads `initialValues`/`scheduleTask`/`timeoutResolution`/`defaultIdleTTL` props through to `AtomRegistry.make(...)`, and disposes the registry 500ms after unmount.
- `.repos/effect/packages/atom/react/src/ScopedAtom.ts` — `ScopedAtom.make(factory)` (line 89) for atom instances scoped to a React subtree (`Provider` + `use()` pair). Useful when one atom shape needs many independent live instances inside a single registry (tabs, chat threads).
- `.repos/effect/packages/atom/react/test/index.test.tsx` — canonical examples: `runtime = Atom.runtime(TheNumber.layer)` + `runtime.atom(TheNumber.use((_) => Effect.succeed(_.n)))` with `<RegistryProvider initialValues={[Atom.initialValue(runtime.layer, Layer.succeed(...))]}>` for layer overrides (lines 25-53); `useAtomValue(atom, AsyncResult.getOrThrow)` projection (line 35); `<RegistryContext.Provider value={registry}>` direct wiring (line 92); Suspense + ErrorBoundary integration (lines 122-138, 251-276); `AsyncResult.match(value, { onInitial, onSuccess, onFailure })` UI matching (lines 326-351).

## Core rules

### 1. Defining read-only / state atoms with `Atom.make`

`Atom.make` is the universal entry point. Six overloads (`Atom.ts:361`):

```ts
import * as Atom from "effect/unstable/reactivity/Atom";

// Plain state — returns Writable<A>
const counterAtom = Atom.make(0);

// Computed — returns Atom<A>
const doubledAtom = Atom.make((get) => get(counterAtom) * 2);

// Effect — returns Atom<AsyncResult<A, E>>
const userAtom = Atom.make(
    Effect.gen(function* () {
        const api = yield* HttpClient;
        return yield* api.get("/me").pipe(Effect.flatMap((r) => r.json));
    }),
);

// Stream — returns Atom<AsyncResult<A, E | NoSuchElement>>
const tickAtom = Atom.make(Stream.tick("1 second"));
```

Combinators on `Atom.ts`:

- `Atom.keepAlive(atom)` — never garbage-collect; survives idle TTL.
- `Atom.autoDispose(atom)` — opposite of `keepAlive`; disposes when no listeners.
- `Atom.setIdleTTL(atom, "2 seconds")` — how long to retain after the last unmount.
- `Atom.withLabel(atom, "chatHistory")` — devtools / debugging.
- `Atom.map(atom, f)` and `Atom.mapResult(asyncResultAtom, f)` — derived atoms (don't reach for `useAtomValue(atom, f)` unless the projection is per-component; `Atom.map` is shared across consumers).
- `Atom.debounce(atom, "200 millis")` — coalesce frequent updates (storage change streams, selection events).

### 2. Defining writer atoms with `runtime.fn`

`Atom.fn` exists, but it cannot consume services — its writer's `Effect` requirement is `Scope.Scope | AtomRegistry`, no extra `R`. **For service-backed writers, use `runtime.fn(...)`**, where `runtime = Atom.runtime(layer)`.

```ts
import * as Atom from "effect/unstable/reactivity/Atom";
import * as Effect from "effect/Effect";

// One per surface — built where the AtomRegistry is built.
const surfaceRuntime = Atom.runtime(MoatExtensionLayer);

const sendMessageAtom = surfaceRuntime.fn(
    (message: string, get) =>
        Effect.gen(function* () {
            const chat = yield* ChatService;
            const reply = yield* chat.streamReply({ message }).pipe(
                Stream.runCollect,
                Effect.map((parts) => parts.join("")),
            );
            // Append to history via the FnContext's `set` method:
            const previous = get(chatHistoryAtom);
            get.set(chatHistoryAtom, [
                ...previous,
                { role: "user", content: message },
                { role: "assistant", content: reply },
            ]);
            return reply;
        }),
    { initialValue: "" },
);
```

Critical points:

- The writer signature is **`(arg, get: FnContext) => Effect`**. The first parameter is the value passed to `useAtomSet(atom)(value)`. The plan's `(set, message) => ...` is wrong; rewrite as `(message, get) => ...` and use `get.set(otherAtom, value)` / `get.setSelf(value)` for mutations.
- `runtime.fn(...)` returns `AtomResultFn<Arg, A, E | ER>` — i.e. `Writable<AsyncResult<A, E | ER>, Arg | Reset | Interrupt>`. Calling `useAtomSet(atom)(arg)` triggers the Effect; reading the atom yields the four-state `AsyncResult`.
- Pass `Atom.Reset` as the value to clear the result back to `Initial`. Pass `Atom.Interrupt` to cancel an in-flight fiber (chat reply abort).
- `concurrent: true` lets multiple in-flight calls coexist (otherwise a new call interrupts the prior fiber). For chat send, leave the default — sending a second message before the first reply finishes should cancel the first.

### 3. Building an `AtomRegistry` from a `ManagedRuntime`

The `AtomRegistry` and the `ManagedRuntime` are **independent** in v4. The plan's `AtomRegistry.make({ runtime })` does not exist. Build them side-by-side and let atoms reach the runtime via `Atom.runtime(layer)`:

```ts
import * as ManagedRuntime from "effect/ManagedRuntime";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import * as Atom from "effect/unstable/reactivity/Atom";

export const makeExtensionRegistry = (layer: Layer.Layer<MoatServices>) => {
    const runtime = ManagedRuntime.make(layer); // for runFork / runPromise edge work
    const registry = AtomRegistry.make({
        // for React subscription
        defaultIdleTTL: 400,
    });
    const atomRuntime = Atom.runtime(layer); // for runtime.atom / runtime.fn
    return { runtime, registry, atomRuntime } as const;
};
```

If the same layer is used by both `ManagedRuntime.make` and `Atom.runtime`, share the underlying `Layer.MemoMap` so layers aren't double-built:

```ts
const memoMap = Layer.makeMemoMapUnsafe();
const runtime = ManagedRuntime.make(layer, { memoMap });
const atomRuntimeFactory = Atom.context({ memoMap });
const atomRuntime = atomRuntimeFactory(layer);
```

### 4. Wiring `RegistryContext.Provider` for React

Two ways. **Direct provider** for surfaces that own their registry lifecycle externally (the extension's per-context `makeExtensionRegistry`):

```tsx
import { RegistryContext } from "@effect/atom-react";

export function PopupRoot({ registry, children }: Props) {
    return <RegistryContext.Provider value={registry}>{children}</RegistryContext.Provider>;
}
```

**Built-in provider** for tests, harness, and short-lived surfaces — `RegistryProvider` builds the registry from props on first render (via `useRef`) and disposes it 500ms after unmount:

```tsx
import { RegistryProvider } from "@effect/atom-react";

<RegistryProvider
    initialValues={[
        Atom.initialValue(
            runtime.layer,
            Layer.succeed(ChatService)(
                ChatService.of({
                    /* stub */
                }),
            ),
        ),
    ]}
    defaultIdleTTL={400}
>
    <App />
</RegistryProvider>;
```

`Atom.initialValue(atom, value)` is a `[Atom, value]` tuple constructor (see `Atom.ts:1415`). The runtime atom (`runtime.layer`) is itself an atom whose value is the `Layer`; seeding it with a different `Layer.succeed(...)` is how upstream tests inject test services without a custom runtime. The plan's harness Stub-vs-Live toggle should use this mechanism rather than rebuilding the registry.

### 5. Hooks: `useAtomValue`, `useAtomSet`, `useAtom`, `useAtomMount`

All exported at the **top level** of `@effect/atom-react`:

```tsx
import {
    useAtom,
    useAtomMount,
    useAtomRefresh,
    useAtomSet,
    useAtomSubscribe,
    useAtomSuspense,
    useAtomValue,
} from "@effect/atom-react";

// Read
const history = useAtomValue(chatHistoryAtom);
const length = useAtomValue(chatHistoryAtom, (h) => h.length); // local projection

// Write (also mounts the atom)
const send = useAtomSet(sendMessageAtom);
send("hi");

// Read+write tuple
const [count, setCount] = useAtom(counterAtom);

// Mount only (subscribes the atom to the registry without reading)
useAtomMount(selectionPumpAtom);

// Manual refresh of an Effect/Stream atom
const refresh = useAtomRefresh(userAtom);

// Suspense — throws a Promise on Initial; throws on Failure unless includeFailure: true
const user = useAtomSuspense(userAtom).value;

// Imperative subscription (rarely needed inside React; prefer useAtomValue)
useAtomSubscribe(selectionAtom, (sel) => console.log(sel));
```

`useAtomSet` accepts a `mode` option for `AsyncResult` writers:

- default — fire-and-forget; returns `(value: W) => void`.
- `mode: "promise"` — returns `(value: W) => Promise<Success>`; throws on failure.
- `mode: "promiseExit"` — returns `(value: W) => Promise<Exit<Success, Failure>>`; never throws.

Use `"promise"` when the calling component needs to await the reply (e.g. focus the input after send).

### 6. `AsyncResult` for async / streaming states

`AsyncResult<A, E>` is a three-tag discriminated union with a shared `waiting: boolean`:

| Tag       | Carries                                                      | Means                                                                                 |
| --------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| `Initial` | `waiting`                                                    | Atom mounted but no run completed yet.                                                |
| `Success` | `value: A`, `timestamp`, `waiting`                           | Last run succeeded. `waiting: true` ⇒ refetching.                                     |
| `Failure` | `cause: Cause<E>`, `previousSuccess: Option<...>`, `waiting` | Last run failed. `previousSuccess` retains stale data for "show last good value" UIs. |

There is **no `Loading` tag** — loading is `result.waiting === true` on any variant. Match with `AsyncResult.match`:

```tsx
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";

const result = useAtomValue(userAtom);
return AsyncResult.match(result, {
    onInitial: () => <Spinner />,
    onSuccess: ({ value, waiting }) => <UserCard user={value} stale={waiting} />,
    onFailure: ({ cause, previousSuccess }) =>
        Option.isSome(previousSuccess) ? (
            <UserCard user={previousSuccess.value.value} error={Cause.pretty(cause)} />
        ) : (
            <ErrorChip cause={cause} />
        ),
});
```

For "throw to the nearest `<Suspense>` and `<ErrorBoundary>`", swap to `useAtomSuspense(userAtom).value`. For projecting just the success value, use `AsyncResult.getOrThrow` as the second `useAtomValue` argument (idiomatic in upstream tests).

### 7. Per-surface registry vs global registry

| Surface              | Registry source                                                    | Lifecycle            |
| -------------------- | ------------------------------------------------------------------ | -------------------- |
| Extension popup      | `makeExtensionRegistry()` per popup open                           | Disposed on close    |
| Extension overlay    | `makeExtensionRegistry({ listenForSelections: true })` per overlay | Disposed on unmount  |
| Content script       | `makeExtensionRegistry()` per page load                            | Disposed on navigate |
| Service worker       | `makeExtensionRegistry()` once                                     | Lives with the SW    |
| Harness (`apps/web`) | `useRef` via `<RegistryProvider>` per-mount                        | Auto-disposed        |
| Component test       | `<RegistryProvider>` per render                                    | Auto-disposed        |

A registry is a graph of atom nodes. Sharing it across realms is **physically impossible** for popup/overlay/content/SW, and **logically wrong** for the harness/test split because the layers (`ChatStubLive` vs `ChatService.Live(baseUrl)`) differ. Always per surface.

## Practical patterns for this repo

### Chat history atom (Task 14, 42)

The plan's flat `Atom.make<ReadonlyArray<ChatMessage>>([])` works for the happy path but cannot model per-message status. Upgrade path:

```ts
type ChatMessage = {
    readonly id: string;
    readonly role: "user" | "assistant";
    readonly content: string;
};

// History is a plain Writable; the active reply is its own AsyncResult atom.
export const chatHistoryAtom = Atom.make<ReadonlyArray<ChatMessage>>([]);

export const sendMessageAtom = atomRuntime.fn((message: string, get) =>
    Effect.gen(function* () {
        const chat = yield* ChatService;
        const userMsg: ChatMessage = { id: crypto.randomUUID(), role: "user", content: message };
        get.set(chatHistoryAtom, [...get(chatHistoryAtom), userMsg]);

        const reply = yield* chat.streamReply({ message }).pipe(Stream.runFold("", (acc, part) => acc + part));
        const assistantMsg: ChatMessage = { id: crypto.randomUUID(), role: "assistant", content: reply };
        get.set(chatHistoryAtom, [...get(chatHistoryAtom), assistantMsg]);
        return assistantMsg;
    }),
);
```

Components consume `useAtomValue(chatHistoryAtom)` for the list and `useAtomValue(sendMessageAtom)` for the in-flight `AsyncResult` (showing a per-send spinner / error chip via `AsyncResult.match`). The error chip in Task 42 reads the `Failure` branch of `sendMessageAtom`, not a separate error atom.

### Selection atom (Tasks 14, 39)

```ts
// Updated by Task 39's overlay postMessage pump via runtime.runFork(...).
export const selectionAtom = Atom.make<string | null>(null);
```

The pump runs outside React (`runtime.runFork(Stream.runForEach(postMessageStream("self"), (sel) => Effect.sync(() => registry.set(selectionAtom, sel))))`). Components only `useAtomValue(selectionAtom)`. **Do not** call `chrome.*` from a React effect — go through `ChromeService`-backed atoms.

### Quick actions atom (Task 14)

```ts
export const quickActionsAtom = Atom.make<ReadonlyArray<QuickAction>>(builtinActions);
```

Static array; future work may replace it with `atomRuntime.atom(loadActions)` once persisted in `chrome.storage`.

### Test registry provider (Tasks 17, 18)

```tsx
// packages/ui/src/test-utils/index.ts
import { RegistryContext } from "@effect/atom-react";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import * as Atom from "effect/unstable/reactivity/Atom";

export const makeRegistry = <R, ER>(layer: Layer.Layer<R, ER>) => {
    const runtime = ManagedRuntime.make(layer);
    const registry = AtomRegistry.make();
    const atomRuntime = Atom.runtime(layer);
    return {
        runtime,
        registry,
        atomRuntime,
        dispose: () => {
            runtime.dispose();
            registry.dispose();
        },
    };
};

export function TestRegistryProvider({ layer, children }: Props) {
    const ref = React.useRef<ReturnType<typeof makeRegistry> | null>(null);
    if (ref.current === null) ref.current = makeRegistry(layer);
    React.useEffect(() => () => ref.current?.dispose(), []);
    return <RegistryContext.Provider value={ref.current.registry}>{children}</RegistryContext.Provider>;
}
```

Each test renders with a fresh layer (typically `ChatService.makeTest(script)`); the registry and runtime are torn down on unmount.

### Harness Stub ↔ Live toggle (Task 21)

The plan currently rebuilds the entire `AtomRegistry` (and `ManagedRuntime`) when the toggle flips, losing all atom state (chat history, selection). Trade-off: simple, correct lifecycle teardown, but jarring UX.

**Preferred v4 idiom** — use `Atom.initialValue(runtime.layer, ...)` to seed the runtime atom with a different `Layer`. The registry stays put; only the layer atom rebinds:

```tsx
const stubLayer = ChatService.makeTest(scriptedReplies);
const liveLayer = (baseUrl: string) => ChatService.Live(baseUrl);
const runtime = Atom.runtime(Layer.empty); // placeholder; overridden via initialValues

function Harness() {
    const [mode, setMode] = useState<"stub" | "live">("stub");
    const layer = mode === "stub" ? stubLayer : liveLayer("http://localhost:3000");
    return (
        <RegistryProvider initialValues={[Atom.initialValue(runtime.layer, layer)]}>
            <ChatView />
            <button onClick={() => setMode((m) => (m === "stub" ? "live" : "stub"))}>toggle</button>
        </RegistryProvider>
    );
}
```

Note: `<RegistryProvider>` does not re-seed `initialValues` after first mount (they're applied once via `useRef`). For a true hot-swap, key the provider on `mode`: `<RegistryProvider key={mode} ...>` — that triggers React to unmount/remount, which still loses chat history but correctly rebuilds layer wiring. **History preservation across toggle is a non-trivial follow-up** — most apps accept the reset.

### Storage-backed atom subscription (Task 41)

The `chrome.storage.onChanged` stream is consumed _outside_ React with `runtime.runFork(...)`, then mirrored into an atom for components to read:

```ts
export const settingsAtom = Atom.make(initialSettings).pipe(Atom.keepAlive);

// In makeExtensionRegistry:
runtime.runFork(
    Effect.gen(function* () {
        const storage = yield* ChromeStorage;
        yield* storage.changes("local").pipe(
            Stream.runForEach((entries) =>
                Effect.sync(() => {
                    if ("settings" in entries) registry.set(settingsAtom, entries.settings.newValue as Settings);
                }),
            ),
        );
    }),
);
```

`Atom.keepAlive` prevents the atom from being garbage-collected when no component is reading — important because the storage subscription is the source of truth.

### Error-state atom for `<ErrorChip>` (Task 42)

There is no separate error atom — the `sendMessageAtom`'s `AsyncResult` _is_ the error state. The chip reads it via `AsyncResult.match`:

```tsx
function ChatErrorChip() {
    const result = useAtomValue(sendMessageAtom);
    if (result._tag !== "Failure") return null;
    return <div role="alert">{Cause.pretty(result.cause)}</div>;
}
```

For test-only failure injection (Task 42's `FailingChatLive`), use `RegistryProvider` with `initialValues={[Atom.initialValue(atomRuntime.layer, FailingChatLive)]}` rather than threading a failing service through the live layer.

## Anti-patterns

1. **`AtomRegistry.make({ runtime })`** — the option doesn't exist. Build the registry with `AtomRegistry.make(options)` (no `runtime`) and bind atoms to a runtime via `Atom.runtime(layer)`.
2. **`import { Hooks } from "@effect/atom-react"`** — there is no `Hooks` namespace export. Use `import { useAtomValue, useAtomSet, ... } from "@effect/atom-react"` directly.
3. **`Atom.fn((set, msg) => Effect.gen(...))`** — the writer signature is `(arg, get: FnContext) => Effect`. There is no `set` parameter; mutations go through `get.set(otherAtom, value)` or `get.setSelf(value)`. And for service-backed writers, use `runtime.fn`, not `Atom.fn`.
4. **Sharing a registry across surfaces.** Each surface (popup, overlay, content, SW, harness) has its own JS realm and lifecycle. One `AtomRegistry` per surface; never module-level singleton.
5. **Wrapping every component in `<RegistryContext.Provider>` redundantly.** The outermost layout owns the registry; descendants just `useAtomValue(...)`. The default context value is a stub registry created at module load — usable for storybook / isolated tests, but not what the app should rely on.
6. **Calling `chrome.*` from a React `useEffect`.** Always go through `ChromeService` (`ChromeStorage`, `ChromeRuntime`, `ChromeTabs`) backed by an atom that the component subscribes to. This keeps the layer-swap testability intact and routes cleanup through `ManagedRuntime.dispose()`.
7. **Mutating an atom value directly** — `(history as any).push(msg)`. Atom values are referentially-compared; mutate immutably and call `get.set(historyAtom, [...history, msg])` (or `registry.update(historyAtom, (h) => [...h, msg])` from outside React).
8. **`useState` for derived data that has an atom source.** If `selectionAtom` exists, never `useState` on the selection in a child; `useAtomValue(selectionAtom)`. The atom is the cross-surface source of truth (overlay write → popup read).
9. **Forgetting to model loading/error states**. A `Atom.make<MyData | null>(null)` cannot distinguish "not started" from "loaded with no result" from "failed". Use `Atom.make(myEffect)` ⇒ `AsyncResult` from the start.
10. **Reaching for `useAtomSubscribe` to update local state.** If you find yourself writing `useAtomSubscribe(atom, setLocalCopy)`, just use `useAtomValue(atom)` — `useSyncExternalStore` already does the right thing.

## Decision rule

### Plain `Atom.make(value)` vs Effect-backed atom

- **Plain (`Atom.make(value)`)** — local UI state with no async side effects: open/closed flags, currently selected tab, draft input text, quick actions list.
- **Effect-backed (`atomRuntime.atom(effect)` / `atomRuntime.fn(arg => effect)`)** — anything that needs a service: chat send (`ChatService`), settings load (`ChromeStorage`), permissions check (`ChromeRuntime`), HTTP fetch (`HttpClient`).

### `useAtomValue(atom, f)` vs `Atom.map(atom, f)`

- **`useAtomValue(atom, f)`** — projection used by exactly one component or computed from local props. The transform recomputes on every render.
- **`Atom.map(atom, f)`** — projection shared by multiple components or used in derived chains. The map node is memoized in the registry.

### `RegistryContext.Provider` vs `RegistryProvider`

- **`RegistryContext.Provider value={registry}`** — extension surfaces, where `makeExtensionRegistry()` already built the registry and owns its disposal.
- **`RegistryProvider`** — tests, harness, storybook, anywhere the React tree should own the registry's lifetime. Auto-disposes 500ms after unmount.

### `useAtomValue` (read) vs `useAtomSuspense` (throw-on-pending)

- **`useAtomValue`** — component handles all four states explicitly via `AsyncResult.match`. Default for chat history, selection, settings.
- **`useAtomSuspense`** — component "demands" the success value; the parent provides `<Suspense>` + `<ErrorBoundary>`. Use sparingly — it implicitly couples the component to its parent's boundary structure.

## Short checklist

Before adding or editing atom/React state, check:

1. Is the atom defined in `effect/unstable/reactivity/Atom`, with React glue from `@effect/atom-react`? (Two packages, not one.)
2. Hooks imported at the top level (`useAtomValue`, not `Hooks.useAtomValue`)?
3. For service-backed writers: built with `runtime.fn(...)` from `Atom.runtime(layer)`, **not** `Atom.fn`?
4. Writer signature is `(arg, get) => Effect`, **not** `(set, arg) => Effect`?
5. Async/streaming atoms typed as `Atom<AsyncResult<A, E>>` and consumed via `AsyncResult.match` (or `useAtomSuspense`)?
6. One `AtomRegistry` per surface, owned by the surface's outermost provider?
7. Long-lived stream subscriptions (`chrome.storage.onChanged`, `postMessage`) fed via `runtime.runFork(...)` into `registry.set(...)`, not via React `useEffect`?
8. Atom values mutated immutably (`[...history, msg]`), never `.push`?
9. Provider chosen by lifecycle: `RegistryContext.Provider` for externally-owned registries, `RegistryProvider` for React-owned?
10. Test layers injected via `Atom.initialValue(atomRuntime.layer, testLayer)` in `<RegistryProvider initialValues={[...]}>`, not by rebuilding the registry per render?

## Used by

- **Task 14** — `packages/ui/src/atoms/{chat,selection,quickActions}.ts` define `chatHistoryAtom = Atom.make([])`, `selectionAtom = Atom.make<string|null>(null)`, `quickActionsAtom = Atom.make(builtinActions)`, `sendMessageAtom = atomRuntime.fn((msg, get) => Effect.gen(function* () { const chat = yield* ChatService; ... }))`.
- **Task 15** — `<ChatView>` and `<ChatComposer>` consume the atoms: `useAtomValue(chatHistoryAtom)` for list rendering, `useAtomSet(sendMessageAtom)` for the send button, `useAtomValue(sendMessageAtom)` for the in-flight `AsyncResult` (spinner / error chip).
- **Task 16** — `packages/ui/src/routes/ChatView.tsx` is the canonical hook consumer: read history, fire send, react to AsyncResult.
- **Task 17** — `packages/ui/src/test-utils/index.ts` exports `makeRegistry(layer)` (builds `ManagedRuntime` + `AtomRegistry` + `Atom.runtime(layer)`) and `<TestRegistryProvider>` wrapping `<RegistryContext.Provider>`.
- **Task 18** — component tests render with `<TestRegistryProvider layer={ChatService.makeTest([])}>`, then assert via `useAtomValue(chatHistoryAtom)` snapshots.
- **Task 21** — `apps/web/src/runtime.tsx` (harness) creates a `ManagedRuntime` per `useState` toggle (Stub ↔ Live); should switch to the `Atom.initialValue(runtime.layer, layer)` + `<RegistryProvider key={mode}>` pattern documented above.
- **Task 35** — popup `makeExtensionRegistry()` builds the popup's registry, runtime, and `Atom.runtime(extensionLayer)`; wraps `<App>` in `<RegistryContext.Provider value={registry}>`.
- **Task 36** — overlay calls the same `makeExtensionRegistry({ listenForSelections: true })`; `<OverlayApp>` wrapped in its own `<RegistryContext.Provider>`.
- **Task 39** — overlay's `runtime.runFork(Stream.runForEach(postMessageStream("self"), (sel) => Effect.sync(() => registry.set(selectionAtom, sel))))` populates `selectionAtom` from outside React; components use `useAtomValue(selectionAtom)`.
- **Task 41** — popup/overlay's `runtime.runFork(...)` consumes `chrome.storage.onChanged` and updates a `settingsAtom` (or `quickActionsAtom`) via `registry.set(...)`; atoms marked `Atom.keepAlive`.
- **Task 42** — `<ErrorChip>` reads `useAtomValue(sendMessageAtom)`; the `Failure` branch of the `AsyncResult` is the error source. Test-only `FailingChatLive` is injected via `<RegistryProvider initialValues={[Atom.initialValue(atomRuntime.layer, FailingChatLive)]}>`.
