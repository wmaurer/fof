import { Array, Match } from "effect";
import { Box, Text, useInput, useWindowSize } from "ink";

import { CONSENSUS_THRESHOLD, displayValues, type Settings, type VoteCounts } from "../types.js";
import { computeStatus } from "./results-status.js";

const MAX_BAR_WIDTH = 30;
const BAR_CHAR = "█";

export function Results({ counts, settings, onDone }: { counts: VoteCounts; settings: Settings; onDone: () => void }) {
    const { columns, rows } = useWindowSize();

    useInput((input, key) => {
        if (key.return || input === " ") onDone();
    });

    const visible = displayValues(settings.includeZero);
    const total = Array.reduce(visible, 0, (a, v) => a + counts[v]);
    const max = Array.reduce(visible, 0, (a, v) => Math.max(a, counts[v]));
    const weightedSum = Array.reduce(visible, 0, (a, v) => a + v * counts[v]);
    const avg = total > 0 ? weightedSum / total : 0;

    const vetoes = settings.includeZero ? counts[0] : 0;
    const lowVotes = Array.reduce(
        Array.filter(visible, (v) => v > 0 && v < CONSENSUS_THRESHOLD),
        0,
        (a, v) => a + counts[v],
    );

    const status = computeStatus({ total, mode: settings.mode, vetoes, lowVotes });

    return (
        <Box width={columns} height={rows} flexDirection="column" justifyContent="center" alignItems="center">
            <Box marginBottom={1}>
                <Text bold underline>
                    Results
                </Text>
            </Box>
            <Box flexDirection="column">
                {[...visible].reverse().map((v, i, arr) => {
                    const c = counts[v];
                    const width = max > 0 ? Math.round((c / max) * MAX_BAR_WIDTH) : 0;
                    return (
                        <Box key={v} flexDirection="row" alignItems="center" marginBottom={i < arr.length - 1 ? 1 : 0}>
                            <Box width={3} justifyContent="flex-end" marginRight={1}>
                                <Text color={v === 0 ? "red" : undefined}>{v}</Text>
                            </Box>
                            <Box width={MAX_BAR_WIDTH + 5}>
                                <Text>
                                    <Text color={v === 0 ? "red" : "cyan"}>{BAR_CHAR.repeat(width)}</Text>
                                    <Text dimColor> {c}</Text>
                                </Text>
                            </Box>
                        </Box>
                    );
                })}
            </Box>
            <Box marginTop={2} flexDirection="column" alignItems="center">
                <Text>
                    Average: <Text bold>{total > 0 ? avg.toFixed(2) : "—"}</Text>
                    {"  ·  "}
                    {total} {total === 1 ? "vote" : "votes"}
                </Text>
                {Match.value(status).pipe(
                    Match.tag("Hidden", () => null),
                    Match.tag("Blocked", ({ vetoes: v }) => (
                        <Text color="red">
                            ✗ Blocked — {v} {v === 1 ? "veto" : "vetoes"}
                        </Text>
                    )),
                    Match.tag("Consensus", ({ threshold }) => (
                        <Text color="green">✓ Consensus — everyone at {threshold} or above</Text>
                    )),
                    Match.tag("NeedsDiscussion", ({ lowVotes: lv, threshold }) => (
                        <Text color="yellow">
                            ⚠ Needs discussion — {lv} {lv === 1 ? "person" : "people"} below {threshold}
                        </Text>
                    )),
                    Match.exhaustive,
                )}
            </Box>
            <Box marginTop={2}>
                <Text dimColor>press space or enter to start again · q to quit</Text>
            </Box>
        </Box>
    );
}
