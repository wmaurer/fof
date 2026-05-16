import { Data, Duration, Effect, Layer } from "effect";
import { Atom } from "effect/unstable/reactivity";

import { type VoteCounts } from "./fist.js";

export type Screen = Data.TaggedEnum<{
    Opening: {};
    Settings: {};
    Countdown: {};
    ShowFist: {};
    Collect: {};
    Results: { readonly counts: VoteCounts };
}>;

export const Screen = Data.taggedEnum<Screen>();

export const screenAtom: Atom.Writable<Screen> = Atom.make<Screen>(Screen.Opening());

const TOAST_MS = Duration.seconds(4);
const toastRuntime = Atom.runtime(Layer.empty);
const toastStateAtom: Atom.Writable<string | null> = Atom.make<string | null>(null);

export const toastAtom: Atom.Atom<string | null> = toastStateAtom;

export const showToastAtom = toastRuntime.fn((message: string | null, get) =>
    Effect.gen(function* () {
        get.set(toastStateAtom, message);
        if (message === null) return;
        yield* Effect.sleep(TOAST_MS);
        get.set(toastStateAtom, null);
    }),
);
