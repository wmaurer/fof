import { RegistryContext } from "@effect/atom-react";
import { NodeRuntime, NodeServices } from "@effect/platform-node";
import { Effect } from "effect";
import { Command } from "effect/unstable/cli";
import { AtomRegistry } from "effect/unstable/reactivity";
import { render } from "ink";

import { App } from "./ui/App.js";

const makeRegistry = Effect.acquireRelease(
    Effect.sync(() => AtomRegistry.make()),
    (r) => Effect.sync(() => r.dispose()),
);

const makeInstance = (registry: ReturnType<typeof AtomRegistry.make>) =>
    Effect.acquireRelease(
        Effect.sync(() =>
            render(
                <RegistryContext.Provider value={registry}>
                    <App />
                </RegistryContext.Provider>,
                { alternateScreen: true },
            ),
        ),
        (i) => Effect.sync(() => i.unmount()),
    );

const fof = Command.make("fof", {}, () =>
    Effect.gen(function* () {
        const registry = yield* makeRegistry;
        const instance = yield* makeInstance(registry);
        yield* Effect.promise(() => instance.waitUntilExit());
    }).pipe(Effect.scoped, Effect.withSpan("fof.run")),
).pipe(Command.withDescription("fist of five — group decision-making in the terminal"));

Command.run(fof, { version: "0.0.0" }).pipe(
    // @effect-diagnostics-next-line strictEffectProvide:off
    Effect.provide(NodeServices.layer),
    NodeRuntime.runMain,
);
