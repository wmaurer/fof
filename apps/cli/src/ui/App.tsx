import { useAtomMount, useAtomSet, useAtomValue } from "@effect/atom-react";
import { Match } from "effect";
import { useApp, useInput } from "ink";
import { useCallback } from "react";

import { Screen, screenAtom } from "./app-atoms.js";
import { Collect } from "./screens/Collect.js";
import { Countdown } from "./screens/Countdown.js";
import { Opening } from "./screens/Opening.js";
import { Results } from "./screens/Results.js";
import { Settings } from "./screens/Settings.js";
import { ShowFist } from "./screens/ShowFist.js";
import { loadSettingsAtom, saveSettingsAtom, settingsAtom } from "./settings/atoms.js";
import { type Settings as SettingsT, type VoteCounts } from "./types.js";

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

    const onStart = useCallback(() => setScreen(Screen.Countdown()), [setScreen]);
    const onSettings = useCallback(() => setScreen(Screen.Settings()), [setScreen]);
    const onSettingsSave = useCallback(
        (next: SettingsT) => {
            saveSettings(next);
            setScreen(Screen.Opening());
        },
        [saveSettings, setScreen],
    );
    const onCountdownDone = useCallback(() => setScreen(Screen.ShowFist()), [setScreen]);
    const onShowFistDone = useCallback(() => setScreen(Screen.Collect()), [setScreen]);
    const onCollectSubmit = useCallback((counts: VoteCounts) => setScreen(Screen.Results({ counts })), [setScreen]);
    const onResultsDone = useCallback(() => setScreen(Screen.Opening()), [setScreen]);

    return Match.value(screen).pipe(
        Match.tag("Opening", () => <Opening onStart={onStart} onSettings={onSettings} />),
        Match.tag("Settings", () => <Settings settings={settings} onSave={onSettingsSave} />),
        Match.tag("Countdown", () => <Countdown onDone={onCountdownDone} />),
        Match.tag("ShowFist", () => <ShowFist onDone={onShowFistDone} />),
        Match.tag("Collect", () => <Collect includeZero={settings.includeZero} onSubmit={onCollectSubmit} />),
        Match.tag("Results", ({ counts }) => <Results counts={counts} settings={settings} onDone={onResultsDone} />),
        Match.exhaustive,
    );
}
