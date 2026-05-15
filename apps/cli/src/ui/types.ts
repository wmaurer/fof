import { Array } from "effect";
import * as Schema from "effect/Schema";

export const FIST_VALUES = [0, 1, 2, 3, 4, 5] as const;
export type FistValue = (typeof FIST_VALUES)[number];
export type VoteCounts = Record<FistValue, number>;

export const CONSENSUS_THRESHOLD = 3;

export const FIST_WORDS: Record<FistValue, string> = {
    0: "veto",
    1: "one",
    2: "two",
    3: "three",
    4: "four",
    5: "five",
};

export const SettingsSchema = Schema.Struct({
    mode: Schema.Literals(["consensus", "poll"]),
    includeZero: Schema.Boolean,
});

export type Settings = Schema.Schema.Type<typeof SettingsSchema>;
export type Mode = Settings["mode"];

export const DEFAULT_SETTINGS: Settings = {
    mode: "consensus",
    includeZero: false,
};

export const displayValues = (includeZero: boolean): ReadonlyArray<FistValue> =>
    includeZero ? FIST_VALUES : Array.filter(FIST_VALUES, (v): v is Exclude<FistValue, 0> => v !== 0);
