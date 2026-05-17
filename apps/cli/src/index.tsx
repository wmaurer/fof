import { RegistryProvider } from "@effect/atom-react";
import { NodeRuntime, NodeServices } from "@effect/platform-node";
import { Effect } from "effect";
import { Command } from "effect/unstable/cli";
import { render } from "ink";

import pkg from "../package.json" with { type: "json" };
import { App } from "./ui/App.js";

const makeInstance = Effect.acquireRelease(
    Effect.sync(() =>
        render(
            <RegistryProvider>
                <App />
            </RegistryProvider>,
            { alternateScreen: true },
        ),
    ),
    (i) => Effect.sync(() => i.unmount()),
);

const fof = Command.make("fof", {}, () =>
    Effect.gen(function* () {
        const instance = yield* makeInstance;
        yield* Effect.promise(() => instance.waitUntilExit());
    }).pipe(Effect.scoped, Effect.withSpan("fof.run")),
).pipe(Command.withDescription("fist of five — group decision-making in the terminal"));

Command.run(fof, { version: pkg.version }).pipe(
    // @effect-diagnostics-next-line strictEffectProvide:off
    Effect.provide(NodeServices.layer),
    NodeRuntime.runMain,
);
