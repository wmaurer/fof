import { Data } from "effect";

import { CONSENSUS_THRESHOLD } from "../fist.js";
import { type Settings } from "../settings/model.js";

export type ConsensusStatus = Data.TaggedEnum<{
    Hidden: {};
    Blocked: { readonly vetoes: number };
    Consensus: { readonly threshold: number };
    NeedsDiscussion: { readonly lowVotes: number; readonly threshold: number };
}>;

export const ConsensusStatus = Data.taggedEnum<ConsensusStatus>();

export const computeStatus = (params: {
    readonly total: number;
    readonly mode: Settings["mode"];
    readonly vetoes: number;
    readonly lowVotes: number;
}): ConsensusStatus => {
    if (params.total === 0 || params.mode === "poll") return ConsensusStatus.Hidden();
    if (params.vetoes > 0) return ConsensusStatus.Blocked({ vetoes: params.vetoes });
    if (params.lowVotes === 0) return ConsensusStatus.Consensus({ threshold: CONSENSUS_THRESHOLD });
    return ConsensusStatus.NeedsDiscussion({ lowVotes: params.lowVotes, threshold: CONSENSUS_THRESHOLD });
};
