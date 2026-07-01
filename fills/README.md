# Curated fill catalog

`v2.json` is the hosted curated-fill catalog for the **DrumFillGenerator** iOS
app. GitHub Pages serves it from `main` at:

    https://drumfillgenerator.com/fills/v2.json

The app fetches it once per launch and caches it, so a published change reaches
users on their **next launch** — no App Store release. This file is seeded from
the app's bundled source of truth, `DrumFillGenerator/Resources/CuratedFills.json`
(schema v2). Keep the two in step.

## Add or fix a fill (no app release)

Works **only** for fills using what's already compiled into the app: the
existing instrument codes (`KCK/SNR/HHT/TM1/TM2/FTM`), the v2 token grammar, and
the supported grids (4/4 & 3/4 × quarter/eighth/triplet/sixteenth per beat). A
fill needing a **new instrument, time signature, or token syntax** still needs
an app release. A breaking schema change ships as `fills/v3.json` against a
bumped `FillCatalog.supportedSchemaVersion` in the app.

1. Append the fill to `v2.json` (schema below).
2. Run the guard locally — it must pass before you push:

   ```sh
   python3 tools/validate-fills.py fills/v2.json
   ```

   CI (`.github/workflows/validate-fills.yml`) runs the same check on every PR
   and on push to `main`.
3. Open a PR; merge to `main` publishes it.

## Schema (v2)

```json
{
  "schemaVersion": 2,
  "fills": [
    {
      "name": "Around the Kit (16ths)",
      "attribution": "Classic four-per-drum sixteenth roll",
      "timeSignature": "fourFour",
      "barCount": 1,
      "tokens": "SNR_R+ SNR_L- SNR_R- SNR_L / TM1_R+ TM1_L- TM1_R- TM1_L / TM2_R+ TM2_L- TM2_R- TM2_L / FTM_R+ FTM_L- FTM_R- FTM_L",
      "isFree": true
    }
  ]
}
```

- `timeSignature` — `fourFour` | `threeFour`. Redundant metadata: the parser
  infers it from beats-per-bar and the guard rejects a mismatch.
- `barCount` — bars (default `1` when omitted); derived from the `|`-separated
  sections and checked against the declared value.
- `tokens` — v2 DSL: whitespace-separated slots, `/` between beats, `|` between
  bars. A slot is `CODE_LIMB[+|-]` (instrument code, `R`/`L`/`K` limb, optional
  `+` accent / `-` ghost / none base; kick is always base) or `.` for a rest.
  A beat's **slot count is its subdivision** (1 quarter / 2 eighth / 3 triplet /
  4 sixteenth) — subdivision, time signature, and bar count are all derived from
  structure, never declared in the tokens. No leading digits, no velocities.
- `isFree` — optional, defaults to `true` (all curated fills are free).

## Guard

`tools/validate-fills.py` mirrors the app's gates (`CuratedFill.validated()` +
`FillCatalogStore.coversAllTimeSignatures`): per-fill token grammar and declared
time-signature / bar-count agreement, plus catalog-wide coverage (every time
signature has at least one one-bar fill). It is the pre-publish net; the app
also drops individual invalid fills and falls back to its bundled seed if the
catalog is unusable. Full design: the app repo's `docs/REMOTE_FILLS.md`.
