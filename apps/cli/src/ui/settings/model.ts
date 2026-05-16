import * as Schema from "effect/Schema";

export const SettingsSchema = Schema.Struct({
    mode: Schema.Literals(["consensus", "poll"]),
    includeZero: Schema.Boolean,
});

export type Settings = Schema.Schema.Type<typeof SettingsSchema>;

export const DEFAULT_SETTINGS: Settings = { mode: "consensus", includeZero: false };
