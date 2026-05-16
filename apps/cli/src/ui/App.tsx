import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { Match } from "effect";
import { Box, Text, useApp, useInput, useWindowSize } from "ink";

import { Screen, screenAtom } from "./app-atoms.js";
import { Collect } from "./screens/Collect.js";
import { Countdown } from "./screens/Countdown.js";
import { Opening } from "./screens/Opening.js";
import { Results } from "./screens/Results.js";
import { Settings } from "./screens/Settings.js";
import { ShowFist } from "./screens/ShowFist.js";
import { loadSettingsAtom, saveSettingsAtom, settingsAtom } from "./settings/atoms.js";

function SettingsLoading() {
    const { columns, rows } = useWindowSize();
    return (
        <Box width={columns} height={rows} flexDirection="column" justifyContent="center" alignItems="center">
            <Text dimColor>Loading settings…</Text>
        </Box>
    );
}

export function App() {
    const { exit } = useApp();
    const screen = useAtomValue(screenAtom);
    const setScreen = useAtomSet(screenAtom);
    const loadResult = useAtomValue(loadSettingsAtom);
    const settings = useAtomValue(settingsAtom);
    const saveSettings = useAtomSet(saveSettingsAtom);
    const settingsLoaded = loadResult._tag !== "Initial";

    useInput((input) => {
        if (input === "q") exit();
    });

    return Match.value(screen).pipe(
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
}
