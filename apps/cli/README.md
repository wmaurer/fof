# @wmaurer/fof

**fist of five** — group decision-making in the terminal.

Run a quick check with your team: everyone holds up between one and five fingers (and optionally a closed fist for a veto), and `fof` collects the counts and shows the spread. In **consensus mode** it tells you whether the room is aligned, mixed, or blocked. In **poll mode** the numbers mean whatever your question makes them.

## Install / run

No install needed:

```sh
npx @wmaurer/fof
```

Or install globally:

```sh
npm install -g @wmaurer/fof
fof
```

## How a round works

1. **Opening** — title screen. `space` / `enter` to start. `?` for settings. `q` to quit.
2. **Countdown** — `3 · 2 · 1`. A beat for everyone to make up their mind.
3. **Show your fist** — everyone holds up their hand at the same time. `space` / `enter` when you've all looked around the room.
4. **Collect** — type how many people held up each number. `Tab` or `↑` / `↓` between fields, `Enter` on **Submit** to finish.
5. **Results** — a horizontal bar chart, the average, and (in consensus mode) a verdict. `space` / `enter` to run another round.

`Esc` returns to the opening from any step (with a confirm prompt where you'd lose work).

## What the numbers mean

### In consensus mode

The canonical "fist of five" semantics — each number has a fixed meaning:

| Vote     | Meaning                              |
| -------- | ------------------------------------ |
| **5**    | Strong support — let's go.           |
| **4**    | I support this.                      |
| **3**    | I can live with it.                  |
| **2**    | I have reservations — let's discuss. |
| **1**    | I have serious concerns.             |
| **0** 🪨 | Veto — we must not proceed.          |

### In poll mode

The 1–5 scale is **whatever your question makes it**. `fof` just collects the counts and shows the spread; it's the question itself that gives each number meaning. For example:

> _"Is this vibe-coded (1) or AI-engineered (5)?"_

The veto (0) is also available in poll mode if enabled, though it's primarily a consensus-mode concept.

### The `0` vote (veto)

By default, the ballot is **1–5 only**. The `0` vote — a closed fist, called a **veto** in this tool — is **opt-in**: turn on **Include 0 (veto)** in Settings.

In consensus mode, a single veto blocks the decision regardless of how many 5s are in the room. Some teams find this powerful as a "stop the train" signal; others find it discouraging or prone to misuse — which is why it ships off by default. Turn it on if your team has agreed it's a real option.

## Modes

Toggle between `consensus` (default) and `poll` in Settings.

| Mode          | What you see                                                                         |
| ------------- | ------------------------------------------------------------------------------------ |
| **consensus** | Bar chart, average, **and a verdict**: ✓ Consensus / ⚠ Needs discussion / ✗ Blocked. |
| **poll**      | Bar chart and average **only**. No verdict.                                          |

The consensus verdicts use a fixed threshold of **3**:

- **✓ Consensus** — everyone voted ≥ 3 (and no vetoes).
- **⚠ Needs discussion** — at least one vote is 1 or 2. The count of below-threshold votes is shown.
- **✗ Blocked** — at least one veto was cast (only possible when `Include 0` is on). The count of vetoes is shown.

Use **poll** mode when you want to see the spread without the social pressure of a pass/fail label — e.g. temperature checks where you're not yet asking for a decision.

## Settings persistence

Settings live at `$XDG_CONFIG_HOME/fof/settings.json` (or `~/.config/fof/settings.json` on most setups) and are loaded on startup.

## Requirements

Node.js 20 or newer.

## License

MIT — see [LICENSE](./LICENSE).
