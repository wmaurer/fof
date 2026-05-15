# Testing Pattern

## Recommendation

For this repo, the best default testing pattern is:

1. Use `@effect/vitest` for all Effect-based tests.
2. Use `it.effect(...)` as the default test shape.
3. Use `it.layer(...)` or top-level `layer(...)` when a suite shares the same dependencies.
4. Put reusable test layers and helpers under each app's `test/utils/` (e.g. `apps/server/test/utils/`).
5. Test services and APIs through their public interfaces, not by manually building contexts inside each test.
6. Avoid custom wrappers like `withRepository(...)` or `withHttp(...)` that call `Layer.build(...)` and `Effect.provide(...)` by hand.

## Why This Pattern

- `@effect/vitest` already knows how to run `Effect` values correctly.
- `it.layer(...)` expresses test dependencies directly instead of hiding them in helpers.
- Shared test layers reduce setup noise without introducing indirection.
- Colocating reusable test infra in `test/utils/` keeps test files focused on behavior.
- This style matches upstream Effect examples.

## Relevant Files

- `.repos/effect/ai-docs/src/09_testing/10_effect-tests.ts`
- `.repos/effect/ai-docs/src/09_testing/20_layer-tests.ts`
- `.repos/effect/packages/vitest/src/index.ts`
- `.repos/effect/packages/platform-node/test/HttpApi.test.ts`

## Core Rules

### 1. Use `it.effect(...)` for Effect code

Default shape:

```ts
import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";

describe("example", () => {
    it.effect("does work", () =>
        Effect.gen(function* () {
            const value = yield* Effect.succeed(1);
            assert.strictEqual(value, 1);
        }),
    );
});
```

Use this instead of:

- `it(...)` with `Effect.runSync(...)`
- `it(...)` with `Effect.runPromise(...)`
- helper wrappers that execute the effect outside the test body

### 2. Use `assert` from `@effect/vitest`

```ts
import { assert } from "@effect/vitest";
```

Use `assert.strictEqual`, `assert.deepStrictEqual`, `assert.isTrue`, `assert.isDefined`, and related helpers. Do not mix in `expect` for Effect tests unless there is a very specific reason.

### 3. Use `it.layer(...)` when a suite shares dependencies

If multiple tests need the same services, declare the layer once at the suite boundary.

```ts
describe("UsersRepository", () => {
    it.layer(TestUsersRepositoryLive)((it) => {
        it.effect("creates users", () =>
            Effect.gen(function* () {
                const repo = yield* UsersRepository;
                const user = yield* repo.create({ name: "Jane" });
                assert.strictEqual(user.name, "Jane");
            }),
        );
    });
});
```

This is better than rebuilding the same context inside every test.

### 4. Put reusable test layers in `test/utils/`

```text
apps/server/
  test/
    utils/
      layers.ts
      factories.ts
    http/
      api.test.ts
```

### 5. Prefer layers over manual `Layer.build(...)`

Avoid:

```ts
const withRepository = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
    Effect.scoped(
        Effect.gen(function* () {
            const context = yield* Layer.build(TestUsersRepositoryLive);
            return yield* Effect.provide(effect, context);
        }),
    );
```

This hides dependencies, makes tests harder to scan, and duplicates behavior already provided by `@effect/vitest`.

### 6. Test through public interfaces

- repository tests: use the repository service
- service tests: use the service
- HTTP tests: use `HttpApiClient.make(Api)`

For HTTP APIs in this repo, prefer a typed client:

```ts
const client = yield * HttpApiClient.make(Api);
const created = yield * client.users.create({ payload: { name: "Jane" } });
```

That keeps transport tests type-safe and aligned with the shared `HttpApi` definition.

## Layer Usage Guidance

### Use `it.layer(...)` when

- several tests in one suite need the same services
- the layer is expensive or scoped and should be set up once for the block
- the test should read like plain business logic after setup is declared

### Use `.pipe(Effect.provide(layer))` inside one test when

- only one test needs the dependency
- the setup is local and not worth extracting to a suite-level layer

### Be careful: `it.layer(...)` shares the layer within the block

Upstream Effect documents that the layer is shared for the block and released in `afterAll`. State created in one test may still exist in the next test.

Choose deliberately:

1. If you want shared state, use `it.layer(...)` for the block.
2. If you want isolated state per test, provide a fresh layer inside each test.

## Test Layer Design

### Preferred shape

Make test layers small, composable, and named for what they provide.

```ts
export const TestHttpLive = HttpRouter.serve(ApiLive, { disableListenLog: true, disableLogger: true }).pipe(
    Layer.provideMerge(NodeHttpServer.layerTest),
);
```

Guidelines:

- keep one exported layer per testing concern
- build bigger test layers by composing smaller ones
- use `Layer.provide(...)` or `Layer.provideMerge(...)` instead of ad hoc context plumbing
- name them `TestXxxLive` or `Xxx.layerTest` consistently

### Put test-only mutable state behind services

If a test needs inspectable state, prefer a dedicated test service like a `Ref` wrapped in `Context.Service`.

## Practical Patterns For This Repo

### HTTP API tests

- use `it.layer(TestHttpLive)`
- construct a client with `HttpApiClient.make(Api)`
- assert typed success values and typed error values
- prefer exercising real handlers and service wiring, not mocking the transport stack

### Smoke tests

```ts
it.effect("runs a basic Effect smoke test", () =>
    Effect.sync(() => {
        assert.strictEqual(1 + 1, 2);
    }),
);
```

## Anti-Patterns

### 1. Manual context-building helpers

- `withRepository(...)`
- `withHttp(...)`
- helpers that call `Layer.build(...)` for normal test setup

### 2. Mixing test styles randomly

- `expect` in one file, `assert` in another
- `it(...)` plus `Effect.runSync(...)` beside `it.effect(...)`

### 3. Hiding setup in overly generic helpers

If a dependency is important enough to exist, it is usually important enough to be visible as a named test layer.

### 4. Over-mocking service graphs

Prefer real Effect layers and small test implementations over mocking everything at the call-site.

## Decision Rule

### Pattern A: single Effect test with local provide

Use when:

- only one test needs the dependency
- the layer is small and local
- test isolation matters more than shared setup

### Pattern B: suite-level `it.layer(...)`

Use when:

- multiple tests share the same dependency graph
- you want the cleanest, flattest test bodies
- shared setup is intentional

This should be the default for this repo.

## Short Checklist

Before adding or editing tests, check these:

1. Is this an Effect test? Use `it.effect(...)`.
2. Do several tests share the same dependencies? Use `it.layer(...)`.
3. Can shared setup move into `test/utils/`?
4. Am I testing through the public service or API boundary?
5. Am I avoiding manual `Layer.build(...)` helpers?
6. Are assertions using `assert` consistently?
