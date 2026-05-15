import { Data } from "effect";
import { Atom } from "effect/unstable/reactivity";

import { type VoteCounts } from "./types.js";

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
