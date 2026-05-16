import { assert, describe, it } from "@effect/vitest";
import { ConfigProvider, Effect, FileSystem, Layer, Path, PlatformError } from "effect";

import { DEFAULT_SETTINGS, type Settings } from "../../src/ui/settings/model.js";
import { SettingsStore } from "../../src/ui/settings/SettingsStore.js";

const SETTINGS_FILE = "/tmp/fof-test/.config/fof/settings.json";

const makeTestLayer = (seed?: ReadonlyMap<string, string>) => {
    const files = new Map<string, string>(seed);
    const FsTest = FileSystem.layerNoop({
        exists: (path) => Effect.sync(() => files.has(path)),
        readFileString: (path) => Effect.sync(() => files.get(path) ?? ""),
        writeFileString: (path, data) =>
            Effect.sync(() => {
                files.set(path, typeof data === "string" ? data : new TextDecoder().decode(data));
            }),
        makeDirectory: () => Effect.void,
    });
    const ConfigTest = ConfigProvider.layer(ConfigProvider.fromUnknown({ HOME: "/tmp/fof-test" }));
    const layer = Layer.fresh(SettingsStore.layer).pipe(Layer.provide(Layer.mergeAll(FsTest, Path.layer, ConfigTest)));
    return { layer, files };
};

describe("SettingsStore", () => {
    describe("with no existing settings file", () => {
        const { layer } = makeTestLayer();
        it.layer(layer)((it) => {
            it.effect("returns defaults", () =>
                Effect.gen(function* () {
                    const store = yield* SettingsStore;
                    const loaded = yield* store.load;
                    assert.deepStrictEqual(loaded, DEFAULT_SETTINGS);
                }),
            );
        });
    });

    describe("when saving then loading", () => {
        const { layer, files } = makeTestLayer();
        it.layer(layer)((it) => {
            it.effect("round-trips a settings object through the file system", () =>
                Effect.gen(function* () {
                    const store = yield* SettingsStore;
                    const settings: Settings = { mode: "poll", includeZero: true };
                    yield* store.save(settings);
                    assert.isTrue(files.has(SETTINGS_FILE), "save must write to the expected path");
                    const loaded = yield* store.load;
                    assert.deepStrictEqual(loaded, settings);
                }),
            );
        });
    });

    describe("with a corrupt settings file", () => {
        const { layer } = makeTestLayer(new Map([[SETTINGS_FILE, "not json"]]));
        it.layer(layer)((it) => {
            it.effect("falls back to defaults", () =>
                Effect.gen(function* () {
                    const store = yield* SettingsStore;
                    const loaded = yield* store.load;
                    assert.deepStrictEqual(loaded, DEFAULT_SETTINGS);
                }),
            );
        });
    });

    describe("when the file system rejects writes", () => {
        const FsFailing = FileSystem.layerNoop({
            exists: () => Effect.succeed(false),
            makeDirectory: () => Effect.void,
            writeFileString: () =>
                Effect.fail(
                    PlatformError.systemError({
                        _tag: "PermissionDenied",
                        module: "FileSystem",
                        method: "writeFileString",
                        description: "test: write rejected",
                    }),
                ),
        });
        const ConfigTest = ConfigProvider.layer(ConfigProvider.fromUnknown({ HOME: "/tmp/fof-test" }));
        const layer = Layer.fresh(SettingsStore.layer).pipe(
            Layer.provide(Layer.mergeAll(FsFailing, Path.layer, ConfigTest)),
        );

        it.layer(layer)((it) => {
            it.effect("surfaces the failure through the save Effect", () =>
                Effect.gen(function* () {
                    const store = yield* SettingsStore;
                    const result = yield* Effect.result(store.save({ mode: "poll", includeZero: true }));
                    assert.strictEqual(result._tag, "Failure", "save must fail when writeFileString rejects");
                }),
            );
        });
    });
});
