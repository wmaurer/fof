import { useAtomSet } from "@effect/atom-react";
import { Match, Result } from "effect";
import { Box, Text, useInput } from "ink";
import { useCallback, useMemo, useState } from "react";

import { toastAtom } from "../app-atoms.js";
import { useTerminalSize } from "../terminal-size.js";
import { FIST_VALUES, FIST_WORDS, decodeVoteCounts, displayValues, type FistValue, type VoteCounts } from "../types.js";
import { cycleFocus } from "./focus.js";

type Focus = FistValue | "submit";

const initialValues = (): Record<FistValue, string> =>
    Object.fromEntries(FIST_VALUES.map((v) => [v, ""])) as Record<FistValue, string>;

export function Collect({ includeZero, onSubmit }: { includeZero: boolean; onSubmit: (counts: VoteCounts) => void }) {
    const { columns, rows } = useTerminalSize();
    const setToast = useAtomSet(toastAtom);
    const [values, setValues] = useState<Record<FistValue, string>>(initialValues);
    const visible = useMemo(() => displayValues(includeZero), [includeZero]);
    const focusOrder = useMemo<ReadonlyArray<Focus>>(() => [...visible, "submit"], [visible]);
    const [focus, setFocus] = useState<Focus>(() => visible[0]!);

    const submit = useCallback(() => {
        const raw = Object.fromEntries(FIST_VALUES.map((v) => [v, values[v] || "0"]));
        const result = decodeVoteCounts(raw);
        if (Result.isFailure(result)) {
            setToast("Internal error: invalid vote counts");
            return;
        }
        onSubmit(result.success);
    }, [values, onSubmit, setToast]);

    useInput((input, key) => {
        const navigated = Match.value({ key }).pipe(
            Match.when({ key: { tab: true } }, ({ key: k }) => {
                setFocus(cycleFocus(focusOrder, focus, k.shift ? -1 : 1));
                return true;
            }),
            Match.when({ key: { downArrow: true } }, () => {
                setFocus(cycleFocus(focusOrder, focus, 1));
                return true;
            }),
            Match.when({ key: { upArrow: true } }, () => {
                setFocus(cycleFocus(focusOrder, focus, -1));
                return true;
            }),
            Match.orElse(() => false),
        );
        if (navigated) return;
        if (focus === "submit") {
            if (key.return) submit();
            return;
        }
        if (key.return) {
            const idx = focusOrder.indexOf(focus);
            setFocus(focusOrder[idx + 1]!);
            return;
        }
        const f: FistValue = focus;
        if (key.backspace || key.delete) {
            setValues((v) => ({ ...v, [f]: v[f].slice(0, -1) }));
            return;
        }
        const digits = input.replace(/\D/g, "");
        if (digits.length > 0) {
            setValues((v) => ({ ...v, [f]: (v[f] + digits).slice(0, 3) }));
        }
    });

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
                        <Text bold={focus === v}>{values[v].padEnd(3, " ")}</Text>
                    </Box>
                </Box>
            ))}
            <Box marginTop={2}>
                <Box borderStyle="round" borderColor={focus === "submit" ? "cyan" : "gray"} paddingX={3}>
                    <Text bold={focus === "submit"}>Submit</Text>
                </Box>
            </Box>
            <Box marginTop={2}>
                <Text dimColor>Tab / ↑↓ to move · digits to type · Enter to submit</Text>
            </Box>
        </Box>
    );
}
