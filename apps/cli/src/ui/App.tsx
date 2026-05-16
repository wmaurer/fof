import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { Match } from "effect";
import { Box, Text, useApp, useInput, useWindowSize } from "ink";
import { useEffect } from "react";

import { Screen, screenAtom, toastAtom } from "./app-atoms.js";
import { Collect } from "./screens/Collect.js";
import { Countdown } from "./screens/Countdown.js";
import { Opening } from "./screens/Opening.js";
import { Results } from "./screens/Results.js";
import { Settings } from "./screens/Settings.js";
import { ShowFist } from "./screens/ShowFist.js";
import { loadSettingsAtom, saveSettingsAtom, settingsAtom } from "./settings/atoms.js";
import { TerminalSizeProvider, useTerminalSize } from "./terminal-size.js";

const TOAST_MS = 4000;
const TOAST_ROWS = 3;

function SettingsLoading() {
    const { columns, rows } = useTerminalSize();
    return (
        <Box width={columns} height={rows} flexDirection="column" justifyContent="center" alignItems="center">
            <Text dimColor>Loading settings…</Text>
        </Box>
    );
}

function Toast({ message }: { message: string }) {
    return (
        <Box borderStyle="round" borderColor="red" paddingX={1}>
            <Text color="red">{message}</Text>
        </Box>
    );
}

export function App() {
    const { exit } = useApp();
    const screen = useAtomValue(screenAtom);
    const setScreen = useAtomSet(screenAtom);
    const loadResult = useAtomValue(loadSettingsAtom);
    const settings = useAtomValue(settingsAtom);
    const saveResult = useAtomValue(saveSettingsAtom);
    const saveSettings = useAtomSet(saveSettingsAtom);
    const toast = useAtomValue(toastAtom);
    const setToast = useAtomSet(toastAtom);
    const native = useWindowSize();
    const settingsLoaded = loadResult._tag !== "Initial";

    useEffect(() => {
        if (saveResult._tag === "Failure") setToast("Settings save failed");
    }, [saveResult, setToast]);

    useEffect(() => {
        if (toast === null) return;
        // @effect-diagnostics-next-line globalTimers:off
        const t = setTimeout(() => setToast(null), TOAST_MS);
        return () => clearTimeout(t);
    }, [toast, setToast]);

    useInput((input) => {
        if (input === "q") exit();
    });

    const screenNode = Match.value(screen).pipe(
        Match.tag("Opening", () => (
            <Opening onStart={() => setScreen(Screen.Countdown())} onSettings={() => setScreen(Screen.Settings())} />
        )),
        Match.tag("Settings", () =>
            settingsLoaded ? (
                <Settings
                    settings={settings}
                    onSave={(next) => {
                        saveSettings(next);
                        setScreen(Screen.Opening());
                    }}
                />
            ) : (
                <SettingsLoading />
            ),
        ),
        Match.tag("Countdown", () => (
            <Countdown
                onDone={() => setScreen(Screen.ShowFist())}
                onCancel={() => setScreen(Screen.Opening())}
            />
        )),
        Match.tag("ShowFist", () => (
            <ShowFist onDone={() => setScreen(Screen.Collect())} onCancel={() => setScreen(Screen.Opening())} />
        )),
        Match.tag("Collect", () => (
            <Collect includeZero={settings.includeZero} onSubmit={(counts) => setScreen(Screen.Results({ counts }))} />
        )),
        Match.tag("Results", ({ counts }) => (
            <Results counts={counts} settings={settings} onDone={() => setScreen(Screen.Opening())} />
        )),
        Match.exhaustive,
    );

    if (toast === null) return screenNode;
    const reducedRows = Math.max(0, native.rows - TOAST_ROWS);
    return (
        <Box flexDirection="column" width={native.columns} height={native.rows}>
            <Toast message={toast} />
            <TerminalSizeProvider value={{ columns: native.columns, rows: reducedRows }}>
                {screenNode}
            </TerminalSizeProvider>
        </Box>
    );
}
