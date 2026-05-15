import { useAtomMount, useAtomValue } from "@effect/atom-react";
import { Effect, Layer, Stream } from "effect";
import { Atom } from "effect/unstable/reactivity";
import { Box, Text, useWindowSize } from "ink";
import { useEffect } from "react";

import { renderBanner } from "../banner.js";

const START_FROM = 3;
const TICK = "1 second";

const countdownRuntime = Atom.runtime(Layer.empty);

const remainingAtom = Atom.make(START_FROM);

const tickerAtom = countdownRuntime.atom((get) => {
    get.set(remainingAtom, START_FROM);
    get.addFinalizer(() => get.set(remainingAtom, START_FROM));
    return Stream.iterate(START_FROM - 1, (n) => n - 1).pipe(
        Stream.take(START_FROM),
        Stream.mapEffect((next) => Effect.sync(() => get.set(remainingAtom, next)).pipe(Effect.delay(TICK))),
    );
});

export function Countdown({ onDone }: { onDone: () => void }) {
    const { columns, rows } = useWindowSize();
    useAtomMount(tickerAtom);
    const remaining = useAtomValue(remainingAtom);

    useEffect(() => {
        if (remaining < 1) onDone();
    }, [remaining, onDone]);

    return (
        <Box width={columns} height={rows} flexDirection="column" justifyContent="center" alignItems="center">
            <Text color="cyan">{renderBanner(String(remaining), { scale: 3 })}</Text>
        </Box>
    );
}
