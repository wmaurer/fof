import { Box, Text, useInput, useWindowSize } from "ink";

export function ShowFist({ onDone }: { onDone: () => void }) {
    const { columns, rows } = useWindowSize();

    useInput((input, key) => {
        if (key.return || input === " ") onDone();
    });

    return (
        <Box width={columns} height={rows} flexDirection="column" justifyContent="center" alignItems="center">
            <Box borderStyle="double" borderColor="yellow" paddingX={4} paddingY={1}>
                <Text bold color="yellow">
                    SHOW YOUR FIST NOW
                </Text>
            </Box>
            <Box marginTop={2}>
                <Text dimColor>press space or enter when you've tallied</Text>
            </Box>
        </Box>
    );
}
