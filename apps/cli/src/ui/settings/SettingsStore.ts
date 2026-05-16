import { Config, Context, Effect, FileSystem, Layer, Path } from "effect";
import * as Schema from "effect/Schema";

import { DEFAULT_SETTINGS, SettingsSchema, type Settings } from "../types.js";

const SettingsFromJson = Schema.fromJsonString(SettingsSchema);

export class SettingsStore extends Context.Service<SettingsStore>()("@wmaurer/fof/ui/settings/SettingsStore", {
    make: Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;

        const home = yield* Config.string("HOME").pipe(Config.withDefault(""));
        const xdgConfigHome = yield* Config.string("XDG_CONFIG_HOME").pipe(
            Config.withDefault(path.join(home, ".config")),
        );
        const settingsDir = path.join(xdgConfigHome, "fof");
        const settingsFile = path.join(settingsDir, "settings.json");

        const decodeJson = Schema.decodeUnknownEffect(SettingsFromJson);
        const encodeJson = Schema.encodeEffect(SettingsFromJson);

        const load: Effect.Effect<Settings> = Effect.gen(function* () {
            const exists = yield* fs.exists(settingsFile);
            if (!exists) return DEFAULT_SETTINGS;
            const raw = yield* fs.readFileString(settingsFile);
            return yield* decodeJson(raw);
        }).pipe(
            Effect.catchCause((cause) =>
                Effect.logError("settings load failed; using defaults", cause).pipe(Effect.as(DEFAULT_SETTINGS)),
            ),
        );

        const save = (settings: Settings): Effect.Effect<void> =>
            Effect.gen(function* () {
                yield* fs.makeDirectory(settingsDir, { recursive: true });
                const json = yield* encodeJson(settings);
                yield* fs.writeFileString(settingsFile, json);
            }).pipe(Effect.catchCause((cause) => Effect.logError("settings save failed", cause)));

        return { load, save } as const;
    }),
}) {
    static readonly layer = Layer.effect(this, this.make);
}
