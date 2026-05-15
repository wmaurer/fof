import { RegistryContext } from "@effect/atom-react";
import { NodeRuntime, NodeServices } from "@effect/platform-node";
import { Effect } from "effect";
import { Command } from "effect/unstable/cli";
import { AtomRegistry } from "effect/unstable/reactivity";
import { render } from "ink";

import { App } from "./ui/App.js";

const fof = Command.make("fof", {}, () =>
    Effect.acquireUseRelease(
        Effect.sync(() => {
            const registry = AtomRegistry.make();
            const instance = render(
                <RegistryContext.Provider value={registry}>
                    <App />
                </RegistryContext.Provider>,
                { alternateScreen: true },
            );
            return { instance, registry };
        }),
        ({ instance }) => Effect.promise(() => instance.waitUntilExit()),
        ({ instance, registry }) =>
            Effect.sync(() => {
                instance.unmount();
                registry.dispose();
            }),
    ),
).pipe(Command.withDescription("fist of five — group decision-making in the terminal"));

Command.run(fof, { version: "0.0.0" }).pipe(
    // @effect-diagnostics-next-line strictEffectProvide:off
    Effect.provide(NodeServices.layer),
    NodeRuntime.runMain,
);
