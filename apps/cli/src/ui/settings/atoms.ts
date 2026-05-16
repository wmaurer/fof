import { NodeFileSystem, NodePath } from "@effect/platform-node";
import { Effect, Layer } from "effect";
import { Atom } from "effect/unstable/reactivity";

import { DEFAULT_SETTINGS, type Settings } from "./model.js";
import { SettingsStore } from "./SettingsStore.js";

const settingsRuntime = Atom.runtime(
    SettingsStore.layer.pipe(Layer.provide(Layer.mergeAll(NodeFileSystem.layer, NodePath.layer))),
);

export const settingsAtom = Atom.make<Settings>(DEFAULT_SETTINGS);

export const loadSettingsAtom = settingsRuntime.atom((get) =>
    Effect.gen(function* () {
        const store = yield* SettingsStore;
        const loaded = yield* store.load;
        get.set(settingsAtom, loaded);
        return loaded;
    }),
);

export const saveSettingsAtom = settingsRuntime.fn((next: Settings, get) =>
    Effect.gen(function* () {
        const store = yield* SettingsStore;
        yield* store.save(next);
        get.set(settingsAtom, next);
    }),
);
