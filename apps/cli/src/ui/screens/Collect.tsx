import { Array } from "effect";
import { Box, Text, useInput } from "ink";
import TextInput from "ink-text-input";
import { useState } from "react";

import { Confirm } from "../Confirm.js";
import { FIST_VALUES, FIST_WORDS, decodeVoteCounts, displayValues, type FistValue, type VoteCounts } from "../fist.js";
import { useTerminalSize } from "../terminal-size.js";
import { cycleFocus } from "./focus.js";

type Focus = FistValue | "submit";

const initialValues = (): Record<FistValue, string> =>
    Object.fromEntries(FIST_VALUES.map((v) => [v, ""])) as Record<FistValue, string>;

export function Collect({
    includeZero,
    onSubmit,
    onCancel,
}: {
    includeZero: boolean;
    onSubmit: (counts: VoteCounts) => void;
    onCancel: () => void;
}) {
    const { columns, rows } = useTerminalSize();
    const [values, setValues] = useState<Record<FistValue, string>>(initialValues);
    const visible = displayValues(includeZero);
    const focusOrder: Array.NonEmptyReadonlyArray<Focus> = Array.append(visible, "submit");
    const [focus, setFocus] = useState<Focus>(() => visible[0]);
    const [confirming, setConfirming] = useState(false);

    const submit = () => {
        const raw = Object.fromEntries(FIST_VALUES.map((v) => [v, values[v] || "0"]));
        onSubmit(decodeVoteCounts(raw));
    };

    const advanceFocus = (from: Focus) => {
        const idx = focusOrder.indexOf(from);
        setFocus(focusOrder[idx + 1] ?? from);
    };

    useInput((_input, key) => {
        if (confirming) return;
        if (key.escape) {
            setConfirming(true);
            return;
        }
        if (key.tab) {
            setFocus(cycleFocus(focusOrder, focus, key.shift ? -1 : 1));
            return;
        }
        if (key.downArrow) {
            setFocus(cycleFocus(focusOrder, focus, 1));
            return;
        }
        if (key.upArrow) {
            setFocus(cycleFocus(focusOrder, focus, -1));
            return;
        }
        if (focus === "submit" && key.return) submit();
    });

    if (confirming) {
        return (
            <Confirm
                message="Discard votes and return to home?"
                onConfirm={onCancel}
                onDismiss={() => setConfirming(false)}
            />
        );
    }

    return (
        <Box width={columns} height={rows} flexDirection="column" justifyContent="center" alignItems="center">
            <Box marginBottom={2}>
                <Text bold>How many people held up each number?</Text>
            </Box>
            {visible.map((v) => (
                <Box key={v} flexDirection="row" alignItems="center">
                    <Box width={8} justifyContent="flex-end" marginRight={1}>
                        <Text color={v === 0 ? "red" : undefined}>{FIST_WORDS[v]}</Text>
                    </Box>
                    <Box borderStyle="round" borderColor={focus === v ? "cyan" : "gray"} paddingX={1} width={8}>
                        <TextInput
                            focus={focus === v}
                            value={values[v]}
                            placeholder=" "
                            onChange={(next) => {
                                const digits = next.replace(/\D/g, "").slice(0, 3);
                                setValues((curr) => ({ ...curr, [v]: digits }));
                            }}
                            onSubmit={() => advanceFocus(v)}
                        />
                    </Box>
                </Box>
            ))}
            <Box marginTop={2}>
                <Box borderStyle="round" borderColor={focus === "submit" ? "cyan" : "gray"} paddingX={3}>
                    <Text bold={focus === "submit"}>Submit</Text>
                </Box>
            </Box>
            <Box marginTop={2}>
                <Text dimColor>Tab / ↑↓ to move · digits to type · Enter to submit · Esc to cancel</Text>
            </Box>
        </Box>
    );
}
