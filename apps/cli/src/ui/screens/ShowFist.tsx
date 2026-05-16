import { Box, Text, useInput } from "ink";

import { useTerminalSize } from "../terminal-size.js";

export function ShowFist({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
    const { columns, rows } = useTerminalSize();

    useInput((input, key) => {
        if (key.escape) onCancel();
        else if (key.return || input === " ") onDone();
    });

    return (
        <Box width={columns} height={rows} flexDirection="column" justifyContent="center" alignItems="center">
            <Box borderStyle="double" borderColor="yellow" paddingX={4} paddingY={1}>
                <Text bold color="yellow">
                    SHOW YOUR FIST NOW
                </Text>
            </Box>
            <Box marginTop={2}>
                <Text dimColor>press space or enter to count results · esc to cancel</Text>
            </Box>
        </Box>
    );
}
