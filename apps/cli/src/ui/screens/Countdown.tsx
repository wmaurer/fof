import { useAtomSet } from "@effect/atom-react";
import { Array, Effect, Layer } from "effect";
import { Atom } from "effect/unstable/reactivity";
import { Box, Text, useInput } from "ink";
import { useEffect, useRef, useState } from "react";

import { renderBanner } from "../banner.js";
import { useTerminalSize } from "../terminal-size.js";

const START_FROM = 3;
const TICK = "1 second";

const countdownRuntime = Atom.runtime(Layer.empty);

const downFrom = Array.makeBy(START_FROM - 1, (i) => START_FROM - 1 - i);

interface TickerArg {
    readonly onTick: (n: number) => void;
    readonly onDone: () => void;
}

const tickerAtom = countdownRuntime.fn((arg: TickerArg) =>
    Effect.gen(function* () {
        yield* Effect.forEach(downFrom, (n) =>
            Effect.gen(function* () {
                yield* Effect.sleep(TICK);
                yield* Effect.sync(() => arg.onTick(n));
            }),
        );
        yield* Effect.sleep(TICK);
        yield* Effect.sync(arg.onDone);
    }),
);

export function Countdown({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
    const { columns, rows } = useTerminalSize();
    const start = useAtomSet(tickerAtom);
    const [remaining, setRemaining] = useState(START_FROM);
    const fired = useRef(false);
    const onDoneRef = useRef(onDone);
    const onCancelRef = useRef(onCancel);
    onDoneRef.current = onDone;
    onCancelRef.current = onCancel;

    const fire = (fn: () => void) => {
        if (fired.current) return;
        fired.current = true;
        fn();
    };

    useEffect(() => {
        start({
            onTick: setRemaining,
            onDone: () => fire(onDoneRef.current),
        });
        return () => start(Atom.Interrupt);
    }, [start]);

    useInput((_input, key) => {
        if (key.escape) fire(onCancelRef.current);
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
