# Schema Pattern

## Recommendation

For this repo, the best default pattern when modeling data with `effect/Schema` (v4) is:

1. Use `Schema.Class<Self>("Identifier")(fields)` for plain records that should be constructible with `new`.
2. Use `Schema.TaggedClass<Self>()("Tag", fields)` for variants that participate in a discriminated union (adds `_tag`).
3. Use `Schema.TaggedErrorClass<Self>()("Tag", fields)` for typed, yieldable errors. **There is no `Schema.TaggedError` in v4** — the export is `TaggedErrorClass`.
4. Build unions with `Schema.Union([A, B, C])` (array argument).
5. Build closed string-set unions with `Schema.Literals([...])`. `Schema.Literal(x)` accepts a single literal only.
6. Use `Schema.decodeUnknownEffect(schema)(input)` at every untrusted boundary (SSE wire, bridge messages, `chrome.storage`). Use `Schema.decodeEffect(schema)(input)` only when the input is already typed as `Encoded`.
7. Use `Schema.encodeSync(schema)(value)` for in-process serialization where decoding the result is impossible (e.g. the producer just constructed the value). Use `Schema.encodeEffect(schema)(value)` everywhere a `SchemaError` is recoverable.
8. Constrain "any schema for `A`" parameters with `Schema.Schema<A>`.

## Why This Pattern

- `Schema.Class` and `TaggedClass` give you `instanceof`, constructors, and methods alongside runtime decode/encode — no separate type alias drift.
- `decodeUnknownEffect` keeps boundary parsing inside the Effect channel where `SchemaError` composes with the rest of the program's error union.
- Tagged unions (`TaggedClass` + `Union`) match upstream's recommended pattern for `Match.tag(...)` exhaustiveness — the same shape `effect-solutions show data-modeling` returns.
- Pinning every wire schema in `@moat-assistant/api` keeps the server, the AI client, the UI, and the bridge layer encoding-compatible by construction.

## Relevant Upstream Files

- `.repos/effect/packages/effect/src/Schema.ts` — single-file source for `Class`, `TaggedClass`, `ErrorClass`, `TaggedErrorClass`, `Union`, `Literal`, `Literals`, `Array`, `Struct`, `String`, `Number`, `Unknown`, all `decode*`/`encode*` variants.
- `.repos/effect/packages/effect/src/SchemaParser.ts` — the `Parser.*` primitives that the public `Schema.decode*Sync/Effect/Exit/Promise/Option/Result` helpers wrap.
- `.repos/effect/packages/effect/src/SchemaIssue.ts` — issue tree carried by `SchemaError`.
- `.repos/effect/packages/effect/test/schema/Schema.test.ts` — canonical examples for `Class`, `TaggedClass`, `TaggedErrorClass`, `Union`, `Literals`.

## Core Rules

### 1. `Schema.Class<Self>("Identifier")(fields)`

The first call takes the identifier (also used as the schema's annotation key); the second takes the fields struct.

```ts
export class PingResponse extends Schema.Class<PingResponse>("PingResponse")({
    status: Schema.Literal("ok"),
}) {}

const ok = new PingResponse({ status: "ok" });
```

`Class` instances expose `.make(...)`, `.makeEffect(...)`, `.makeOption(...)`, and the schema API on the class itself (`PingResponse.fields`, `PingResponse.ast`).

### 2. `Schema.TaggedClass<Self>()("Tag", fields)`

The first call's argument is the optional **identifier** (defaults to the tag); the second call's first argument is the **tag** value injected as `_tag`.

```ts
export class TextDelta extends Schema.TaggedClass<TextDelta>()("TextDelta", {
    delta: Schema.String,
}) {}

const part = new TextDelta({ delta: "hi" });
part._tag; // "TextDelta"
```

If the identifier needs to differ from the tag, pass it: `Schema.TaggedClass<TextDelta>("WireTextDelta")("TextDelta", { ... })`. Do **not** pass the tag twice purely as a habit — the first slot is identifier, not tag.

### 3. `Schema.TaggedErrorClass<Self>()("Tag", fields)` — there is no `Schema.TaggedError`

```ts
export class ChatRateLimitError extends Schema.TaggedErrorClass<ChatRateLimitError>()("ChatRateLimitError", {
    retryAfterMs: Schema.Number,
}) {}
```

Instances are `YieldableError`, so they can be `yield*`-ed inside `Effect.gen`. They serialize/deserialize through the schema like any other `TaggedClass`.

### 4. `Schema.Union([A, B, C])`

In v4, `Union` takes a single **array** of members.

```ts
export const StreamPart = Schema.Union([TextDelta, Finish, StreamErrorPart]);
export const ChatError = Schema.Union([ChatRateLimitError, ChatUpstreamError]);
export const BridgeMessage = Schema.Union([ToggleOverlay, SelectionAdded, SelectionCleared]);
```

For closed sets of literal values, prefer `Schema.Literals([...])`:

```ts
const Role = Schema.Literals(["user", "assistant", "system"]);
```

`Schema.Literal(x)` accepts a **single** literal only; `Schema.Literal("a", "b", "c")` is not v4 syntax.

### 5. Primitives, structs, arrays

```ts
Schema.String;
Schema.Number;
Schema.Unknown;
Schema.Array(item); // ReadonlyArray
Schema.Struct({ a: Schema.String });
```

Use `Struct` for ad-hoc shapes that don't need a class identity, `Class` when you want construction or methods, and `TaggedClass` when the value is a member of a discriminated union.

### 6. `decodeUnknownEffect` vs `decodeEffect`

Both return `Effect<A, SchemaError, R>`. The difference is the input type:

- `decodeUnknownEffect(schema)(input: unknown, options?)` — the right choice for SSE frames, bridge payloads, `chrome.storage` reads, anything from off-process.
- `decodeEffect(schema)(input: Encoded, options?)` — only when TypeScript already knows the input shape matches `Encoded`. Using this on `unknown` will force an unsound cast at the call site.

There is no unsuffixed `Schema.decode(schema)` runtime decoder in v4. `Schema.decode` is reserved for transformation construction; do not import it for boundary parsing.

```ts
const decoded = yield * Schema.decodeUnknownEffect(StreamPart)(rawJson);
```

### 7. `encodeSync` vs `encodeEffect`

- `encodeSync(schema)(value: A)` — throws `SchemaError` on failure. Use only when failure is a programmer bug, not a recoverable case (e.g. `JSON.stringify(encodeSync(StreamPart)(part))` in the SSE sender, where `part` was constructed locally and _must_ encode).
- `encodeEffect(schema)(value: A)` — returns `Effect<Encoded, SchemaError>`. Use at any boundary where you want to keep the failure inside the effect channel.
- `encodeUnknownEffect`/`encodeUnknownSync` — for unknown inputs. Rarely needed in this repo.

### 8. `SchemaError`, not `ParseError`

In Effect v4, the error returned from every `*Effect` decode/encode is `SchemaError` (re-exported from `Schema`). The v3 alias `ParseError` and the v3 module `effect/schema/ParseResult` do **not** exist. Match on `Schema.isSchemaError(err)` if you need to narrow generically; otherwise let the typed `SchemaError` flow through `Effect`'s error channel.

### 9. Generic constraint: `Schema.Schema<A>`

When a service method must accept "any schema producing `A`", parameterize over `Schema.Schema<A>`:

```ts
export interface ChromeStorage {
    get<A>(key: string, schema: Schema.Schema<A>): Effect<A | undefined>;
    set<A>(key: string, schema: Schema.Schema<A>, value: A): Effect<void>;
    changes<A>(key: string, schema: Schema.Schema<A>): Stream<A>;
}
```

`Schema.Schema<A>` is the smallest constraint that exposes `Type` and the AST; `decodeUnknownEffect`/`encodeEffect` accept any `Top`, so they accept any `Schema.Schema<A>`.

## Practical Patterns For This Repo

### SSE wire format → Task 5, Task 23, Task 25

- Each frame variant is a `TaggedClass` (`TextDelta`, `Finish`, `StreamErrorPart`).
- The wire union is `StreamPart = Schema.Union([...])`.
- Sender (server, Task 23) uses `Schema.encodeSync(StreamPart)(part)` then `JSON.stringify(...)`; the value just came from a typed `Stream`, so a sync throw is acceptable.
- Receiver (`parseSseStream`, Task 9) uses `Schema.decodeUnknownEffect(StreamPart)(json)`; failures become `SchemaError` in the stream's error channel.

### Chat schemas → Task 4, Task 6

- `ChatMessage`, `ChatStreamRequest` as `Schema.Class`. Use `Schema.Literals(["user","assistant","system"])` for `role`.
- Errors as `Schema.TaggedErrorClass`: `ChatRateLimitError`, `ChatUpstreamError`. Compose with `Schema.Union([...])` if a callsite must surface the union.

### Client-side transport errors → Task 12

- `ServerUnreachable` and `SseStreamInterrupted` are `Schema.TaggedErrorClass`. They live in the AI client and can be yielded in `Effect.gen`.
- Body encoding: `Schema.encodeSync(ChatStreamRequest)(request)` before `JSON.stringify`.

### UI domain types → Task 14, Task 37

- `SelectedMessage`, `QuickAction`, `TeamsMessage` as `Schema.Class`. Pure data, no tag.

### Bridge envelope → Task 33, Task 34

- `ToggleOverlay`, `SelectionAdded`, `SelectionCleared` are `TaggedClass`es; `BridgeMessage = Schema.Union([...])`.
- Every bridge receiver runs `Schema.decodeUnknownEffect(BridgeMessage)(message)` and logs+drops on `SchemaError`. The sender uses `Schema.encodeEffect(BridgeMessage)(message)` (boundary, not local) so a serialization error stays inside Effect.
- `ChromeStorage.get/set/changes` accept `schema: Schema.Schema<A>` and decode raw values with `decodeUnknownEffect` and encode with `encodeEffect`.

### Storage round-trip → Task 41

- `ChatHistorySchema = Schema.Array(ChatMessage)`. Reads decode with `decodeUnknownEffect`; writes encode with `encodeEffect`. Change streams from `chrome.storage.onChanged` re-decode every event.

## Anti-Patterns

1. **Using `Schema.decode(schema)` on `unknown` input.** That call doesn't exist as a v4 runtime decoder. Use `decodeUnknownEffect` at boundaries, `decodeEffect` when input is already `Encoded`.
2. **`Schema.TaggedError(...)`.** v4 exports `TaggedErrorClass`, not `TaggedError`.
3. **`Schema.Literal("a", "b", "c")` for unions.** Use `Schema.Literals(["a","b","c"])`.
4. **`Schema.Union(A, B, C)` (variadic).** v4 takes an array: `Schema.Union([A, B, C])`.
5. **Skipping schema decoding on bridge/storage receivers.** A `chrome.runtime` message or `storage.local` value is `unknown` until proven otherwise — always run it through `decodeUnknownEffect`.
6. **Throwing `encodeSync` failures across an Effect boundary.** If the value comes from outside the producer or might be malformed, use `encodeEffect` so `SchemaError` flows through the error channel instead of a synchronous throw.
7. **Importing from `effect/schema/ParseResult` or referring to `ParseError`.** Neither exists in v4; the error type is `SchemaError`.

## Decision Rule

### `Class` vs `Struct`

- Use `Class` when the value has identity, methods, or appears in a service signature where `instanceof` matters.
- Use `Struct` for inline ad-hoc shapes (e.g. response payloads with no methods).

### `TaggedClass` vs `Class`

- Use `TaggedClass` whenever the value is one variant of a `Union`. The `_tag` field gives `Match.tag` exhaustiveness for free.
- Use plain `Class` for non-variant records.

### `decodeUnknownEffect` vs `decodeEffect`

- `decodeUnknownEffect` for any value the type system cannot prove is `Encoded` (network, bridge, storage, JSON.parse output).
- `decodeEffect` only when TypeScript already gives you `Encoded`.

### `encodeSync` vs `encodeEffect`

- `encodeSync` when the producer just built the value and any encode failure is a programmer bug (sender side of SSE, in-process bodies).
- `encodeEffect` when failure should be observable in the Effect error channel (boundaries, generic services like `ChromeStorage`).

## Short Checklist

Before adding a schema-touching change, check:

1. Is this a variant of a union? Use `TaggedClass` + `Union`.
2. Is this a typed error? Use `TaggedErrorClass` (not `TaggedError`).
3. Is the input `unknown`? Use `decodeUnknownEffect`.
4. Is encoding allowed to throw? Only if locally constructed; otherwise `encodeEffect`.
5. Is `Schema.Union([...])` an array? Is `Schema.Literals([...])` used for multi-literal sets?
6. Is the error type referred to as `SchemaError` (not `ParseError`)?
7. Are generic schema parameters typed `Schema.Schema<A>`?

## Used by

- **Task 3** — `PingResponse` (`Schema.Class`, `Schema.Literal`).
- **Task 4** — `ChatMessage`, `ChatStreamRequest` (`Schema.Class`, `Schema.Literals`, `Schema.Array`); `Schema.encodeEffect`/`Schema.decodeUnknownEffect` smoke test.
- **Task 5** — `TextDelta`, `Finish`, `StreamErrorPart`, `StreamPart` union (`Schema.TaggedClass`, `Schema.Union`).
- **Task 6** — `ChatRateLimitError`, `ChatUpstreamError`, `ChatError` union (`Schema.TaggedErrorClass`, `Schema.Union`).
- **Task 9** — `parseSseStream` runs `Schema.decodeUnknownEffect(StreamPart)`.
- **Task 12** — `ServerUnreachable`, `SseStreamInterrupted` (`Schema.TaggedErrorClass`); `Schema.encodeSync(ChatStreamRequest)` in the request body.
- **Task 14** — `SelectedMessage`, `QuickAction` (`Schema.Class`).
- **Task 23** — server SSE handler runs `Schema.encodeSync(StreamPart)`.
- **Task 25** — SSE round-trip test exercises the encode/decode pair.
- **Task 33** — `ToggleOverlay`, `SelectionAdded`, `SelectionCleared`, `BridgeMessage` (`Schema.TaggedClass`, `Schema.Union`, `Schema.decodeUnknownEffect` on receivers).
- **Task 34** — `ChromeStorage` service generic over `Schema.Schema<A>`; `Schema.decodeUnknownEffect` / `Schema.encodeEffect` for storage round-tripping; bridge encode/decode.
- **Task 37** — `TeamsMessage` (`Schema.Class`).
- **Task 41** — `ChatHistorySchema = Schema.Array(ChatMessage)`; `chrome.storage` change stream decodes every event.
