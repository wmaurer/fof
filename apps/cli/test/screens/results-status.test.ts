import { assert, describe, it } from "@effect/vitest";

import { computeStatus, ConsensusStatus } from "../../src/ui/screens/results-status.js";
import { CONSENSUS_THRESHOLD } from "../../src/ui/fist.js";

describe("computeStatus", () => {
    it("is Hidden when no votes have been cast", () => {
        const status = computeStatus({ total: 0, mode: "consensus", vetoes: 0, lowVotes: 0 });
        assert.deepStrictEqual(status, ConsensusStatus.Hidden());
    });

    it("is Hidden in poll mode regardless of votes", () => {
        const status = computeStatus({ total: 5, mode: "poll", vetoes: 2, lowVotes: 1 });
        assert.deepStrictEqual(status, ConsensusStatus.Hidden());
    });

    it("is Blocked when at least one veto is present", () => {
        const status = computeStatus({ total: 5, mode: "consensus", vetoes: 2, lowVotes: 0 });
        assert.deepStrictEqual(status, ConsensusStatus.Blocked({ vetoes: 2 }));
    });

    it("is Consensus when there are no vetoes and no low votes", () => {
        const status = computeStatus({ total: 4, mode: "consensus", vetoes: 0, lowVotes: 0 });
        assert.deepStrictEqual(status, ConsensusStatus.Consensus({ threshold: CONSENSUS_THRESHOLD }));
    });

    it("is NeedsDiscussion when at least one vote is below the threshold", () => {
        const status = computeStatus({ total: 5, mode: "consensus", vetoes: 0, lowVotes: 2 });
        assert.deepStrictEqual(
            status,
            ConsensusStatus.NeedsDiscussion({ lowVotes: 2, threshold: CONSENSUS_THRESHOLD }),
        );
    });

    it("Blocked takes precedence over NeedsDiscussion", () => {
        const status = computeStatus({ total: 5, mode: "consensus", vetoes: 1, lowVotes: 3 });
        assert.deepStrictEqual(status, ConsensusStatus.Blocked({ vetoes: 1 }));
    });
});
