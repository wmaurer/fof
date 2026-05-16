import { useAtomValue } from "@effect/atom-react";
import { Array, Duration, Effect, Stream } from "effect";
import { Atom } from "effect/unstable/reactivity";
import { Box, Text, useInput } from "ink";
import { useEffect } from "react";

import { renderBanner } from "../banner.js";
import { useTerminalSize } from "../terminal-size.js";

const START_FROM = 3;
const TICK = Duration.seconds(1);

const downFrom = Array.makeBy(START_FROM - 1, (i) => START_FROM - 1 - i);

const tickerStream = Stream.fromIterable(downFrom).pipe(
    Stream.mapEffect((n) => Effect.as(Effect.sleep(TICK), n)),
    Stream.concat(Stream.fromEffect(Effect.sleep(TICK)).pipe(Stream.drain)),
);

const tickerAtom = Atom.make(tickerStream, { initialValue: START_FROM });

export function Countdown({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
    const { columns, rows } = useTerminalSize();
    const ticker = useAtomValue(tickerAtom);
    const remaining = ticker._tag === "Success" ? ticker.value : START_FROM;
    const completed = ticker._tag === "Success" && !ticker.waiting;

    useEffect(() => {
        if (completed) onDone();
    }, [completed, onDone]);

    useInput((_input, key) => {
        if (key.escape) onCancel();
    });

    return (
        <Box width={columns} height={rows} flexDirection="column" justifyContent="center" alignItems="center">
            <Text color="cyan">{renderBanner(String(remaining), { scale: 3 })}</Text>
            <Box marginTop={2}>
                <Text dimColor>Esc to cancel</Text>
            </Box>
        </Box>
    );
}
