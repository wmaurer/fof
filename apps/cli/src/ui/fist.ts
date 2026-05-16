import { Array } from "effect";
import * as Schema from "effect/Schema";

export const FIST_VALUES = [0, 1, 2, 3, 4, 5] as const;
export type FistValue = (typeof FIST_VALUES)[number];

export const CONSENSUS_THRESHOLD = 3;

export const FIST_WORDS: Record<FistValue, string> = {
    0: "veto",
    1: "one",
    2: "two",
    3: "three",
    4: "four",
    5: "five",
};

const Count = Schema.NumberFromString.check(Schema.isInt(), Schema.isBetween({ minimum: 0, maximum: 999 }));

export const VoteCountsSchema = Schema.Struct({
    "0": Count,
    "1": Count,
    "2": Count,
    "3": Count,
    "4": Count,
    "5": Count,
});

export type VoteCounts = Schema.Schema.Type<typeof VoteCountsSchema>;

export const decodeVoteCounts = Schema.decodeUnknownSync(VoteCountsSchema);

export const displayValues = (includeZero: boolean): Array.NonEmptyReadonlyArray<FistValue> =>
    includeZero ? FIST_VALUES : [1, 2, 3, 4, 5];
