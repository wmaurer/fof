import { assert, describe, it } from "@effect/vitest";

import { cycleFocus } from "../../src/ui/screens/focus.js";

describe("cycleFocus", () => {
    const order = ["a", "b", "c"] as const;

    it("advances from the middle to the next item", () => {
        assert.strictEqual(cycleFocus(order, "b", 1), "c");
    });

    it("wraps from the last item to the first when advancing", () => {
        assert.strictEqual(cycleFocus(order, "c", 1), "a");
    });

    it("steps back from the middle to the previous item", () => {
        assert.strictEqual(cycleFocus(order, "b", -1), "a");
    });

    it("wraps from the first item to the last when stepping back", () => {
        assert.strictEqual(cycleFocus(order, "a", -1), "c");
    });
});
