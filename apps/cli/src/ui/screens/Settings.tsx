import { Match } from "effect";
import { Box, Text, useInput, useWindowSize } from "ink";
import { useState } from "react";

import { cycleFocus } from "./focus.js";

import type { Settings as SettingsT } from "../types.js";

type Row = "mode" | "veto";
const ROWS: ReadonlyArray<Row> = ["mode", "veto"];

function Choice({ left, right, selected }: { left: string; right: string; selected: "left" | "right" }) {
    return (
        <Text>
            <Text
                bold={selected === "left"}
                color={selected === "left" ? "green" : undefined}
                dimColor={selected !== "left"}
            >
                {left}
            </Text>
            {"   "}
            <Text
                bold={selected === "right"}
                color={selected === "right" ? "green" : undefined}
                dimColor={selected !== "right"}
            >
                {right}
            </Text>
        </Text>
    );
}

export function Settings({ settings, onSave }: { settings: SettingsT; onSave: (next: SettingsT) => void }) {
    const { columns, rows } = useWindowSize();
    const [focus, setFocus] = useState<Row>("mode");
    const [draft, setDraft] = useState<SettingsT>(settings);

    const toggleFocused = () => {
        if (focus === "mode") {
            setDraft((d) => ({ ...d, mode: d.mode === "consensus" ? "poll" : "consensus" }));
        } else {
            setDraft((d) => ({ ...d, includeZero: !d.includeZero }));
        }
    };

    useInput((input, key) => {
        Match.value({ input, key }).pipe(
            Match.whenOr({ key: { escape: true } }, { key: { return: true } }, () => onSave(draft)),
            Match.whenOr({ key: { downArrow: true } }, { key: { tab: true } }, () =>
                setFocus(cycleFocus(ROWS, focus, 1)),
            ),
            Match.when({ key: { upArrow: true } }, () => setFocus(cycleFocus(ROWS, focus, -1))),
            Match.whenOr({ input: " " }, { key: { leftArrow: true } }, { key: { rightArrow: true } }, () =>
                toggleFocused(),
            ),
            Match.orElse(() => {}),
        );
    });

    return (
        <Box width={columns} height={rows} flexDirection="column" justifyContent="center" alignItems="center">
            <Box marginBottom={2}>
                <Text bold underline>
                    Settings
                </Text>
            </Box>
            <Box flexDirection="column">
                <Box flexDirection="row" alignItems="center">
                    <Box width={22} justifyContent="flex-end" marginRight={2}>
                        <Text bold={focus === "mode"} color={focus === "mode" ? "cyan" : undefined}>
                            {focus === "mode" ? "▸ " : "  "}Mode
                        </Text>
                    </Box>
                    <Choice left="consensus" right="poll" selected={draft.mode === "consensus" ? "left" : "right"} />
                </Box>
                <Box flexDirection="row" alignItems="center" marginTop={1}>
                    <Box width={22} justifyContent="flex-end" marginRight={2}>
                        <Text bold={focus === "veto"} color={focus === "veto" ? "cyan" : undefined}>
                            {focus === "veto" ? "▸ " : "  "}Include 0 (veto)
                        </Text>
                    </Box>
                    <Choice left="yes" right="no" selected={draft.includeZero ? "left" : "right"} />
                </Box>
            </Box>
            <Box marginTop={3} flexDirection="column" alignItems="center">
                <Text dimColor>↑↓ to move · ←→/space to toggle</Text>
                <Text dimColor>Enter/Esc to save & return</Text>
            </Box>
        </Box>
    );
}
