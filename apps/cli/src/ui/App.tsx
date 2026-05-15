import { useAtomMount, useAtomSet, useAtomValue } from "@effect/atom-react";
import { Match } from "effect";
import { useApp, useInput } from "ink";

import { Screen, screenAtom } from "./app-atoms.js";
import { Collect } from "./screens/Collect.js";
import { Countdown } from "./screens/Countdown.js";
import { Opening } from "./screens/Opening.js";
import { Results } from "./screens/Results.js";
import { Settings } from "./screens/Settings.js";
import { ShowFist } from "./screens/ShowFist.js";
import { loadSettingsAtom, saveSettingsAtom, settingsAtom } from "./settings/atoms.js";

export function App() {
    const { exit } = useApp();
    const screen = useAtomValue(screenAtom);
    const setScreen = useAtomSet(screenAtom);
    useAtomMount(loadSettingsAtom);
    const settings = useAtomValue(settingsAtom);
    const saveSettings = useAtomSet(saveSettingsAtom);

    useInput((input) => {
        if (input === "q") exit();
    });

    return Match.value(screen).pipe(
        Match.tag("Opening", () => (
            <Opening onStart={() => setScreen(Screen.Countdown())} onSettings={() => setScreen(Screen.Settings())} />
        )),
        Match.tag("Settings", () => (
            <Settings
                settings={settings}
                onSave={(next) => {
                    saveSettings(next);
                    setScreen(Screen.Opening());
                }}
            />
        )),
        Match.tag("Countdown", () => <Countdown onDone={() => setScreen(Screen.ShowFist())} />),
        Match.tag("ShowFist", () => <ShowFist onDone={() => setScreen(Screen.Collect())} />),
        Match.tag("Collect", () => (
            <Collect includeZero={settings.includeZero} onSubmit={(counts) => setScreen(Screen.Results({ counts }))} />
        )),
        Match.tag("Results", ({ counts }) => (
            <Results counts={counts} settings={settings} onDone={() => setScreen(Screen.Opening())} />
        )),
        Match.exhaustive,
    );
}
