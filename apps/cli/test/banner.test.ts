import { assert, describe, it } from "@effect/vitest";

import { renderBanner } from "../src/ui/banner.js";

describe("renderBanner", () => {
    it("renders a single character as 5 rows of width 5", () => {
        const rows = renderBanner("3").split("\n");
        assert.strictEqual(rows.length, 5);
        for (const row of rows) assert.strictEqual(row.length, 5);
    });

    it("separates multiple characters with a single space column", () => {
        const rows = renderBanner("FI").split("\n");
        assert.strictEqual(rows.length, 5);
        assert.strictEqual(rows[0], "##### #####");
    });

    it("falls back to whitespace for unknown characters", () => {
        const rows = renderBanner("?").split("\n");
        assert.strictEqual(rows.length, 5);
        for (const row of rows) assert.strictEqual(row, "     ");
    });

    it("scales both rows and columns by the scale factor", () => {
        const single = renderBanner("3").split("\n");
        const scaled = renderBanner("3", { scale: 3 }).split("\n");
        assert.strictEqual(scaled.length, single.length * 3);
        assert.strictEqual(scaled[0]!.length, single[0]!.length * 3);
    });

    it("scale: 1 is equivalent to omitting scale", () => {
        assert.strictEqual(renderBanner("3"), renderBanner("3", { scale: 1 }));
    });
});
