import { Match } from "effect";
import { Box, Text, useInput } from "ink";
import { useState } from "react";

import { Confirm } from "../Confirm.js";
import { useTerminalSize } from "../terminal-size.js";
import { cycleFocus } from "./focus.js";

import type { Settings as SettingsT } from "../settings/model.js";

type Row = "mode" | "veto";
const ROWS = ["mode", "veto"] as const satisfies ReadonlyArray<Row>;

const CHOICE_LEFT_WIDTH = 12;

function Choice({ left, right, selected }: { left: string; right: string; selected: "left" | "right" }) {
    return (
        <Box flexDirection="row">
            <Box width={CHOICE_LEFT_WIDTH}>
                <Text
                    bold={selected === "left"}
                    color={selected === "left" ? "green" : undefined}
                    dimColor={selected !== "left"}
                >
                    {left}
                </Text>
            </Box>
            <Box>
                <Text
                    bold={selected === "right"}
                    color={selected === "right" ? "green" : undefined}
                    dimColor={selected !== "right"}
                >
                    {right}
                </Text>
            </Box>
        </Box>
    );
}

export function Settings({
    settings,
    onSave,
    onCancel,
}: {
    settings: SettingsT;
    onSave: (next: SettingsT) => void;
    onCancel: () => void;
}) {
    const { columns, rows } = useTerminalSize();
    const [focus, setFocus] = useState<Row>("mode");
    const [draft, setDraft] = useState<SettingsT>(settings);
    const [confirming, setConfirming] = useState(false);

    const dirty = draft.mode !== settings.mode || draft.includeZero !== settings.includeZero;

    const toggleFocused = () => {
        if (focus === "mode") {
            setDraft((d) => ({ ...d, mode: d.mode === "consensus" ? "poll" : "consensus" }));
        } else {
            setDraft((d) => ({ ...d, includeZero: !d.includeZero }));
        }
    };

    useInput((input, key) => {
        if (confirming) return;
        Match.value({ input, key }).pipe(
            Match.when({ key: { return: true } }, () => onSave(draft)),
            Match.when({ key: { escape: true } }, () => {
                if (dirty) setConfirming(true);
                else onCancel();
            }),
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

    if (confirming) {
        return (
            <Confirm message="Discard unsaved settings?" onConfirm={onCancel} onDismiss={() => setConfirming(false)} />
        );
    }

    return (
        <Box width={columns} height={rows} flexDirection="column" justifyContent="center" alignItems="center">
            <Box marginBottom={2}>
                <Text bold underline>
                    Settings
                </Text>
            </Box>
            <Box flexDirection="column">
                <Box flexDirection="row" alignItems="center">
                    <Box width={22} marginRight={2}>
                        <Text bold={focus === "mode"} color={focus === "mode" ? "cyan" : undefined}>
                            {focus === "mode" ? "▸ " : "  "}Mode
                        </Text>
                    </Box>
                    <Choice left="consensus" right="poll" selected={draft.mode === "consensus" ? "left" : "right"} />
                </Box>
                <Box flexDirection="row" alignItems="center" marginTop={1}>
                    <Box width={22} marginRight={2}>
                        <Text bold={focus === "veto"} color={focus === "veto" ? "cyan" : undefined}>
                            {focus === "veto" ? "▸ " : "  "}Include 0 (veto)
                        </Text>
                    </Box>
                    <Choice left="yes" right="no" selected={draft.includeZero ? "left" : "right"} />
                </Box>
            </Box>
            <Box marginTop={3} flexDirection="column" alignItems="center">
                <Text dimColor>↑↓ to move · ←→/space to toggle</Text>
                <Text dimColor>Enter to save · Esc to cancel</Text>
            </Box>
        </Box>
    );
}
