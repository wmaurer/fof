import { assert, describe, it } from "@effect/vitest";

import { decodeVoteCounts } from "../src/ui/fist.js";

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
        const decoded = decodeVoteCounts(counts({ "0": "0", "1": "1", "2": "2", "3": "3", "4": "4", "5": "5" }));
        assert.deepStrictEqual(decoded, { 0: 0, 1: 1, 2: 2, 3: 3, 4: 4, 5: 5 });
    });

    it("throws on non-integer counts", () => {
        assert.throws(() => decodeVoteCounts(counts({ "1": "1.5" })));
    });

    it("throws on negative counts", () => {
        assert.throws(() => decodeVoteCounts(counts({ "0": "-1" })));
    });

    it("throws on counts above 999", () => {
        assert.throws(() => decodeVoteCounts(counts({ "0": "1000" })));
    });

    it("throws on missing keys", () => {
        const { "5": _omit, ...partial } = counts({});
        assert.throws(() => decodeVoteCounts(partial));
    });
});
