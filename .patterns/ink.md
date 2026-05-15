# Ink Pattern

## Recommendation

For this repo, the best default pattern when building **Ink-based terminal UIs on Effect v4 + React 19 + `@effect/cli`** is:

1. **Render Ink at the `@effect/cli` subcommand boundary**, wrapping the `Instance` so the UI lifetime becomes an `Effect`:

    ```ts
    Command.make("ui", {}, () =>
      Effect.promise(() => {
        const app = render(<App />)
        return app.waitUntilExit()
      })
    )
    ```

    Use `Effect.acquireUseRelease` (with `app.unmount()` as the release) when the UI must be torn down on Effect interruption rather than only on `useApp().exit()` from inside the tree.

2. **Place TUI code under `apps/<app>/src/ui/`** (e.g. `apps/cli/src/ui/App.tsx`). One `App.tsx` root per interactive subcommand; share leaf components from `src/ui/components/`.
3. **No `import React from "react"` boilerplate** — `tsconfig.base.json` sets `"jsx": "react-jsx"`. Named imports only (`import { useState } from "react"`). Ink examples in `.repos/ink/` still use the legacy default import; ignore that.
4. **Function components only.** Ink's reconciler has no class-component path. Use hooks (`useState`, `useEffect`, `useRef`, `use`, `useTransition`) and Ink's hooks (`useApp`, `useInput`, `useFocus`, `useStdin`, `useStdout`, `useIsScreenReaderEnabled`, `useWindowSize`).
5. **Clean exit via `useApp().exit()`** — never call `process.exit()` from inside the React tree. Ink restores raw mode, cursor visibility, and (if used) the primary screen _before_ the process exits when you go through `exit()`.
6. **Input via `useInput((input, key) => …)`** (see `.repos/ink/examples/use-input/use-input.tsx`). For tab-based focus, wrap focusable children with `useFocus()` and read `isFocused` to render highlight state; `useFocusManager()` gives programmatic control.
7. **For Effect-produced state** (services, streams, layers), use `@effect/atom-react` per `.patterns/atom-react.md` — _but see the channel-mismatch note in §1 of Core Rules below before installing it_. Until the channel is resolved, use plain `useEffect` + a per-component `ManagedRuntime` for ad-hoc Effect bridging, with `runtime.dispose()` in the cleanup function.
8. **For append-only output (logs, build steps, chat history), use `<Static>`** — otherwise every state change repaints the entire accumulated list. The dynamic part of the screen sits as a sibling of `<Static>`, not inside it.
9. **Trust `patchConsole: true` (Ink v7 default)** — `console.log` is intercepted and printed above the live frame, not into the middle of it. For high-volume debug logging during development, prefer `fs.appendFileSync("debug.log", …)` + `tail -f debug.log` so the live frame stays clean.
10. **Full-screen apps pass `{ alternateScreen: true }` to `render()`** — vim/htop-style, restores the terminal on exit, does not pollute scrollback. Inline panels (single-line spinner, progress bar above prompt) omit it.
11. **Tests use `ink-testing-library`** (not yet installed; add when writing the first test). Assert against `instance.lastFrame()` / `instance.frames`. When the component depends on Effect state, follow `.patterns/testing.md` — `it.effect`/`it.layer` for the data, then render the Ink subtree inside the test's Effect.

## Why This Pattern

- **`Effect.promise(() => waitUntilExit())`** makes the Ink UI a first-class Effect citizen: parent-fiber interruption can tear it down, `@effect/cli`'s arg validation runs before any rendering, and the UI's exit value flows back as the Effect's success. Inverting the wrapping (calling `render()` and returning `Effect.void`) leaks the React tree — `NodeRuntime.runMain` would resolve the parent Effect immediately and Ink would keep running unattended until `Ctrl-C`.
- **`useApp().exit()` over `process.exit()`** is the only path that runs Ink's terminal-restoration sequence. `process.exit()` kills the process mid-frame and leaves the terminal in raw mode and/or the alternate screen, requiring `reset` or a new pane to recover.
- **`<Static>`** matters because Ink redraws every frame: a `useState` array of 1000 log lines re-emits all 1000 lines on every keystroke. `<Static>` writes new items once and never repaints them; the dynamic part of the screen (prompt, status bar) is the only thing that's redrawn.
- **`react-jsx` + named imports** matches the Effect codebase style and avoids the `React` global shim that older Ink examples use. The `@effect/language-service` plugin has no React-specific rules, so JSX flies through clean.
- **One `ManagedRuntime` per Ink app** (whether via atom-react's `Atom.runtime(layer)` or a manual `ManagedRuntime.make(layer)`) mirrors the services-and-layers pattern's "one runtime per surface" rule — each interactive subcommand is a surface with its own scope.

## Relevant Upstream Files

- `.repos/ink/src/render.ts` — `render(node, options): Instance`, `RenderOptions`, `Instance` (`rerender`, `unmount`, `waitUntilExit`, `waitUntilRenderFlush`, `clear`). Note `patchConsole`, `exitOnCtrlC`, `alternateScreen`, `interactive`, `kittyKeyboard` options.
- `.repos/ink/src/index.ts` — public API surface: components (`Box`, `Text`, `Static`, `Transform`, `Newline`, `Spacer`), hooks (`useApp`, `useInput`, `usePaste`, `useStdin`, `useStdout`, `useStderr`, `useFocus`, `useFocusManager`, `useIsScreenReaderEnabled`, `useCursor`, `useAnimation`, `useWindowSize`, `useBoxMetrics`), utilities (`measureElement`, `renderToString`, `kittyFlags`).
- `.repos/ink/src/hooks/use-app.ts` — `useApp()` returns `{ exit, waitUntilRenderFlush }`.
- `.repos/ink/src/hooks/use-input.ts` — `useInput(handler, options?)`, `Key` type (`upArrow`, `downArrow`, `return`, `escape`, `ctrl`, `shift`, `meta`, etc.).
- `.repos/ink/src/components/Box.tsx` — `<Box>` Yoga flexbox props (`flexDirection`, `justifyContent`, `alignItems`, `gap`, `padding*`, `margin*`, `width`, `height`, `minWidth`, `borderStyle`, `borderColor`).
- `.repos/ink/src/components/Text.tsx` — `<Text>` styling props (`color`, `backgroundColor`, `bold`, `dimColor`, `italic`, `underline`, `strikethrough`, `inverse`, `wrap`).
- `.repos/ink/src/components/Static.tsx` — `<Static>` for append-only output (logs, history).
- `.repos/ink/examples/use-input/use-input.tsx` — canonical `useInput` + `useApp().exit` shape.
- `.repos/ink/examples/select-input/select-input.tsx` — list selection + accessibility (`aria-role="list"`, `aria-state={{selected}}`, `useIsScreenReaderEnabled()`).
- `.repos/ink/examples/concurrent-suspense/concurrent-suspense.tsx` — React 19 Suspense in Ink (relevant for atom-react `useAtomSuspense`).
- `.repos/ink/examples/static/static.tsx` — `<Static>` log accumulation pattern.
- `.repos/ink/examples/alternate-screen/` — `{ alternateScreen: true }` full-screen mode.
- `.repos/ink/examples/use-focus/` — `useFocus()` + `useFocusManager()` for tab navigation.
- `.repos/ink/examples/chat/` — multi-line input + scrolling history; closest analogue if `fof` builds a REPL-style UI.

## Core Rules

### 1. Channel-mismatch warning before installing `@effect/atom-react`

`@effect/atom-react` is currently published on the **`beta`** dist-tag (`4.0.0-beta.X`) with a strict peer `effect: ^4.0.0-beta.66`. This repo's `pnpm.overrides` pins every `@effect/*` package to **`0.0.0-snapshot-<sha>`**, and the snapshot channel does _not_ publish `@effect/atom-react`. Installing it naively will either fail peer resolution or pull a second `effect` copy, recreating the SHA-drift problem that `pnpm.overrides` exists to prevent.

**Resolution options** (decide before `pnpm add`):

- (a) **Migrate the whole repo to the `beta` channel.** Replace every `0.0.0-snapshot-<sha>` in `pnpm.overrides` with the matching `4.0.0-beta.66` (or current latest beta) tag. Cleanest if you want atom-react now and don't need a feature only on the snapshot channel.
- (b) **Stay on snapshot, defer atom-react.** Use plain `useState` + a per-component `ManagedRuntime` (Rule 4) for any Effect bridging. The Ink UI can be perfectly functional without atom-react; the bridge is purely an ergonomics layer.
- (c) **Vendor a local `atom-react` clone** built against the snapshot. High effort; only worth it if you need atom-react features and can't migrate channels.

**Default for this repo until decided: option (b).** Don't run `pnpm add @effect/atom-react` until the channel choice is made and overrides updated.

### 2. Effect + `@effect/cli` ↔ Ink composition

```ts
// apps/cli/src/index.ts
import { Command } from "@effect/cli"
import { NodeContext, NodeRuntime } from "@effect/platform-node"
import { Effect } from "effect"
import { render } from "ink"
import { App } from "./ui/App.js"

const ui = Command.make("ui", {}, () =>
  Effect.acquireUseRelease(
    Effect.sync(() => render(<App />, { patchConsole: true })),
    (instance) => Effect.promise(() => instance.waitUntilExit()),
    (instance) => Effect.sync(() => instance.unmount())
  )
)

const fof = Command.make("fof").pipe(
  Command.withDescription("fof"),
  Command.withSubcommands([ui])
)

const cli = Command.run(fof, { name: "fof", version: "0.0.0" })

cli(process.argv).pipe(
  // @effect-diagnostics-next-line strictEffectProvide:off
  Effect.provide(NodeContext.layer),
  NodeRuntime.runMain
)
```

`acquireUseRelease` guarantees `unmount()` runs on Effect interruption (Ctrl-C handled by `NodeRuntime`, parent fiber failure). If the UI only ever exits via `useApp().exit()`, the simpler `Effect.promise(() => render(<App />).waitUntilExit())` is fine.

### 3. Component layout

```
apps/cli/src/
├── index.ts              # @effect/cli entry, mounts subcommands
├── ui/
│   ├── App.tsx           # root for the interactive subcommand
│   ├── components/       # shared leaves (StatusBar, List, Spinner…)
│   └── runtime.ts        # ManagedRuntime per UI surface (if using Effect bridging)
└── commands/             # non-interactive subcommand handlers (no Ink)
```

### 4. Effect state without atom-react (interim pattern)

While option (b) of Rule 1 is in effect, bridge Effect → React via a per-component `ManagedRuntime` and ordinary `useState` + `useEffect`. Dispose the runtime on unmount so streams/scopes shut down cleanly.

```tsx
// apps/cli/src/ui/App.tsx
import { useEffect, useState } from "react";
import { Box, Text, useApp } from "ink";
import { Effect, Layer, ManagedRuntime } from "effect";
import { Clock } from "./services/Clock.js";

export function App() {
    const { exit } = useApp();
    const [now, setNow] = useState<string | undefined>();

    useEffect(() => {
        const runtime = ManagedRuntime.make(Clock.Live);
        const fiber = runtime.runFork(
            Clock.use((c) =>
                Effect.forever(
                    Effect.flatMap(c.now, (t) => Effect.sync(() => setNow(t.toISOString()))).pipe(
                        Effect.delay("1 second"),
                    ),
                ),
            ),
        );
        return () => {
            fiber.unsafeInterruptAsFork(fiber.id());
            void runtime.dispose();
        };
    }, []);

    return (
        <Box flexDirection="column" gap={1}>
            <Text>Now: {now ?? "—"}</Text>
            <Text dimColor>Press q to quit.</Text>
        </Box>
    );
}
```

When option (a) or (c) of Rule 1 ships, replace this pattern with `useAtomValue(clockAtom)` per `.patterns/atom-react.md`.

### 5. Input handling

```tsx
import { useApp, useInput, Box, Text } from "ink";

export function Prompt() {
    const { exit } = useApp();
    const [value, setValue] = useState("");

    useInput((input, key) => {
        if (key.escape || (key.ctrl && input === "c")) {
            exit();
            return;
        }
        if (key.return) {
            // submit
            return;
        }
        if (key.backspace || key.delete) {
            setValue((v) => v.slice(0, -1));
            return;
        }
        if (!key.ctrl && !key.meta) {
            setValue((v) => v + input);
        }
    });

    return <Text>→ {value}</Text>;
}
```

`useInput` is a no-op in non-TTY environments (CI, piped stdout) — the same component can safely render in `ink-testing-library` tests, which feed a fake stdin.

### 6. Layout: Yoga flexbox

```tsx
<Box flexDirection="column" gap={1} padding={1} borderStyle="round" borderColor="cyan">
    <Box justifyContent="space-between">
        <Text bold>Title</Text>
        <Text dimColor>v0.0.0</Text>
    </Box>
    <Box flexDirection="row" gap={2}>
        <Box width="50%" borderStyle="single">
            <Text>left</Text>
        </Box>
        <Box width="50%" borderStyle="single">
            <Text>right</Text>
        </Box>
    </Box>
</Box>
```

`<Box>` is always flex; the default `flexDirection` is `row`. Use `gap` for spacing between children, `padding*` for inner spacing, `margin*` for outer. `width="50%"` / `height={10}` / `minHeight={3}` accept numbers (cells), strings (percent), or `auto`.

### 7. Append-only output with `<Static>`

```tsx
import { Static, Box, Text } from "ink";

export function Build({ logs, status }: { logs: ReadonlyArray<string>; status: string }) {
    return (
        <>
            <Static items={logs}>
                {(line, i) => (
                    <Text key={i} dimColor>
                        {line}
                    </Text>
                )}
            </Static>
            <Box marginTop={1}>
                <Text color="cyan">{status}</Text>
            </Box>
        </>
    );
}
```

`<Static>` writes each item exactly once. Append new lines by replacing the `items` array prop (don't mutate). The trailing `<Box>` is the dynamic region.

### 8. Suspense + async (Effect-via-atom-react form, post-Rule-1 resolution)

```tsx
import { Suspense } from "react";
import { useAtomSuspense } from "@effect/atom-react";
import { Box, Text } from "ink";
import { userAtom } from "../atoms.js";

function UserBadge() {
    const user = useAtomSuspense(userAtom).value;
    return <Text color="green">{user.name}</Text>;
}

export function App() {
    return (
        <Box flexDirection="column">
            <Text>Welcome:</Text>
            <Suspense fallback={<Text dimColor>Loading…</Text>}>
                <UserBadge />
            </Suspense>
        </Box>
    );
}
```

See `.repos/ink/examples/concurrent-suspense/concurrent-suspense.tsx` for the non-atom-react form (throw a promise from the data accessor).

### 9. Testing

When `ink-testing-library` is added:

```ts
// apps/cli/test/ui/App.test.tsx
import { describe, it, expect } from "@effect/vitest"
import { render } from "ink-testing-library"
import { App } from "../../src/ui/App.js"

describe("App", () => {
  it("renders the prompt", () => {
    const { lastFrame } = render(<App />)
    expect(lastFrame()).toContain("→")
  })
})
```

For tests that depend on Effect state, build the test inside `it.effect(...)`, provision the layer with `it.layer(...)`, then render Ink with the layer's services already wired (atom-react: `<RegistryProvider initialValues={[Atom.initialValue(runtime.layer, testLayer)]}>` per `.patterns/atom-react.md` §7). For the interim non-atom-react pattern, inject the `ManagedRuntime` via prop or context.

## Anti-patterns

- ❌ `import React from "react"` — unnecessary with `react-jsx`; matches old Ink examples but not this repo's style.
- ❌ `process.exit()` from inside a component — leaves terminal in raw mode / alternate screen. Use `useApp().exit()`.
- ❌ `console.log` for debug output during development — works (thanks to `patchConsole`) but pushes the live frame down and clutters the visible area. Use a file + `tail -f`.
- ❌ `<Box>{1000 lines}</Box>` for log output — repaints every frame. Use `<Static>`.
- ❌ Starting an Effect in `useEffect(() => { Effect.runPromise(...) }, [])` without scoping it — the Effect outlives the component on unmount. Either use a `ManagedRuntime` (interim pattern) or atom-react (target pattern).
- ❌ `pnpm add @effect/atom-react` against the snapshot channel — see Rule 1. Resolve the channel first.
- ❌ Class components — not supported by Ink's reconciler.
