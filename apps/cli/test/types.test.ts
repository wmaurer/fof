import { assert, describe, it } from "@effect/vitest";
import { Result } from "effect";

import { decodeVoteCounts } from "../src/ui/types.js";

const counts = (overrides: Partial<Record<"0" | "1" | "2" | "3" | "4" | "5", string>>) => ({
    "0": "0",
    "1": "0",
    "2": "0",
    "3": "0",
    "4": "0",
    "5": "0",
    ...overrides,
});

describe("decodeVoteCounts", () => {
    it("decodes numeric strings into integers keyed by fist value", () => {
        const result = decodeVoteCounts(counts({ "0": "0", "1": "1", "2": "2", "3": "3", "4": "4", "5": "5" }));
        assert.isTrue(Result.isSuccess(result), "happy-path decode must succeed");
        if (Result.isSuccess(result)) {
            assert.deepStrictEqual(result.success, { 0: 0, 1: 1, 2: 2, 3: 3, 4: 4, 5: 5 });
        }
    });

    it("fails on non-integer counts", () => {
        assert.isTrue(Result.isFailure(decodeVoteCounts(counts({ "1": "1.5" }))));
    });

    it("fails on negative counts", () => {
        assert.isTrue(Result.isFailure(decodeVoteCounts(counts({ "0": "-1" }))));
    });

    it("fails on counts above 999", () => {
        assert.isTrue(Result.isFailure(decodeVoteCounts(counts({ "0": "1000" }))));
    });

    it("fails on missing keys", () => {
        const { "5": _omit, ...partial } = counts({});
        assert.isTrue(Result.isFailure(decodeVoteCounts(partial)));
    });
});
