import { Box, Text, useInput } from "ink";

import { useTerminalSize } from "./terminal-size.js";

export function Confirm({
    message,
    onConfirm,
    onDismiss,
}: {
    message: string;
    onConfirm: () => void;
    onDismiss: () => void;
}) {
    const { columns, rows } = useTerminalSize();

    useInput((input, key) => {
        if (input === "y" || input === "Y") onConfirm();
        else if (input === "n" || input === "N" || key.escape) onDismiss();
    });

    return (
        <Box width={columns} height={rows} flexDirection="column" justifyContent="center" alignItems="center">
            <Box
                borderStyle="round"
                borderColor="yellow"
                paddingX={2}
                paddingY={1}
                flexDirection="column"
                alignItems="center"
            >
                <Text bold>{message}</Text>
                <Box marginTop={1}>
                    <Text dimColor>y to confirm · n or Esc to cancel</Text>
                </Box>
            </Box>
        </Box>
    );
}
