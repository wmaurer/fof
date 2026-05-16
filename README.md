# fof

**fist of five** — group decision-making in the terminal.

Published on npm as [`@wmaurer/fof`](https://www.npmjs.com/package/@wmaurer/fof). Run it directly with no install:

```sh
npx @wmaurer/fof
```

For the user-facing docs — how a round works, what the votes mean, consensus vs. poll mode — see [`apps/cli/README.md`](./apps/cli/README.md).

## Development

A pnpm workspace built on **Effect v4** (beta channel) + **Ink + React**, with TypeScript executed directly via `tsx` in dev and bundled via `tsdown` for publish.

```sh
pnpm install
pnpm dev              # run the CLI with hot reload (tsx watch)
pnpm start            # run once
pnpm typecheck        # tsgo --noEmit
pnpm test             # vitest
pnpm build            # bundle apps/cli → dist/fof.mjs (tsdown)
```

The CLI source lives at [`apps/cli/`](./apps/cli/). Architecture notes — toolchain quirks, Effect v4 conventions, and the patterns under [`.patterns/`](./.patterns/) — are in [`CLAUDE.md`](./CLAUDE.md).

## Releasing

Tag a commit `vX.Y.Z` and push — `.github/workflows/release.yml` runs typecheck + test + build and publishes `@wmaurer/fof` to npm with provenance. Requires the `NPM_TOKEN` repo secret.

## License

MIT — see [LICENSE](./LICENSE).
