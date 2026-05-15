import { Box, Text, useInput, useWindowSize } from "ink";

import { renderBanner } from "../banner.js";

const BANNER = renderBanner("FIST OF FIVE");

export function Opening({ onStart, onSettings }: { onStart: () => void; onSettings: () => void }) {
    const { columns, rows } = useWindowSize();

    useInput((input, key) => {
        if (input === "?") {
            onSettings();
            return;
        }
        if (key.return || input === " ") {
            onStart();
        }
    });

    return (
        <Box width={columns} height={rows} flexDirection="column" justifyContent="center" alignItems="center">
            <Text color="cyan">{BANNER}</Text>
            <Box marginTop={2} flexDirection="column" alignItems="center">
                <Text dimColor>press space or enter to start</Text>
                <Text dimColor>? for settings · q to quit</Text>
            </Box>
        </Box>
    );
}
