import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { Match } from "effect";
import { Box, Text, useApp, useInput, useWindowSize } from "ink";
import { useEffect, useState } from "react";

import { Screen, screenAtom } from "./app-atoms.js";
import { Collect } from "./screens/Collect.js";
import { Countdown } from "./screens/Countdown.js";
import { Opening } from "./screens/Opening.js";
import { Results } from "./screens/Results.js";
import { Settings } from "./screens/Settings.js";
import { ShowFist } from "./screens/ShowFist.js";
import { loadSettingsAtom, saveSettingsAtom, settingsAtom } from "./settings/atoms.js";
import { TerminalSizeProvider, useTerminalSize } from "./terminal-size.js";

const SAVE_ERROR_TOAST_MS = 4000;
const SAVE_ERROR_TOAST_ROWS = 3;

function SettingsLoading() {
    const { columns, rows } = useTerminalSize();
    return (
        <Box width={columns} height={rows} flexDirection="column" justifyContent="center" alignItems="center">
            <Text dimColor>Loading settings…</Text>
        </Box>
    );
}

function SaveErrorToast() {
    return (
        <Box borderStyle="round" borderColor="red" paddingX={1}>
            <Text color="red">Settings save failed</Text>
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
    const native = useWindowSize();
    const settingsLoaded = loadResult._tag !== "Initial";
    const [showSaveError, setShowSaveError] = useState(false);

    useEffect(() => {
        if (saveResult._tag === "Failure") {
            setShowSaveError(true);
            // @effect-diagnostics-next-line globalTimers:off
            const t = setTimeout(() => setShowSaveError(false), SAVE_ERROR_TOAST_MS);
            return () => clearTimeout(t);
        }
        if (saveResult._tag === "Success") setShowSaveError(false);
    }, [saveResult]);

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

    if (!showSaveError) return screenNode;
    const reducedRows = Math.max(0, native.rows - SAVE_ERROR_TOAST_ROWS);
    return (
        <Box flexDirection="column" width={native.columns} height={native.rows}>
            <SaveErrorToast />
            <TerminalSizeProvider value={{ columns: native.columns, rows: reducedRows }}>
                {screenNode}
            </TerminalSizeProvider>
        </Box>
    );
}
