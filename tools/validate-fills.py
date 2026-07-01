#!/usr/bin/env python3
"""
validate-fills.py — pre-publish guard for the curated-fill catalog.

Mirrors the gates the DrumFillGenerator app applies at runtime, so a broken or
partial catalog is caught *before* it ships from `fills/v2.json` rather than
relying only on the device-side drop + coverage fall-back (the safety net, not
the primary gate). See the app repo `docs/REMOTE_FILLS.md` §5.

The Swift source of truth is `CuratedFill.validated()` +
`FillCatalogStore.coversAllTimeSignatures` (app repo). Keep this in sync when the
grammar, instrument codes, or supported grids change. Stdlib only.

Usage:  python3 tools/validate-fills.py fills/v2.json
Exit:   0 = valid, 1 = invalid (details on stderr).
"""

from __future__ import annotations

import json
import re
import sys

# --- compiled-in vocabulary (mirror the Swift enums) -------------------------

SUPPORTED_SCHEMA_VERSION = 2

# DrumInstrument.code
INSTRUMENT_CODES = {"KCK", "SNR", "HHT", "TM1", "TM2", "FTM"}

# Limb letters resolved by PatternParser.resolveLimb (case-insensitive).
LIMB_LETTERS = {"R", "L", "K"}

# TimeSignature (raw value == case name) -> beats per bar.
BEATS_PER_BAR = {"fourFour": 4, "threeFour": 3}

# A beat's slot count is its subdivision (1 quarter / 2 eighth / 3 triplet /
# 4 sixteenth); anything else is rejected by the parser.
VALID_SLOT_COUNTS = {1, 2, 3, 4}

REST_SLOT = "."
# CODE _ LIMB [ +|- ] — no leading digits, no velocity numbers.
SLOT_RE = re.compile(r"^([A-Za-z0-9]{3})_([A-Za-z])([+-]?)$")


class ValidationError(Exception):
    pass


def _derive_grid(name: str, tokens: str):
    """Parse the v2 grammar the way PatternParser.parsePattern does, returning
    (beats_per_bar_case, bar_count, hit_count). Raises ValidationError on any
    malformed token / unknown code / bad grid — mirroring ParseError."""
    bars = [b.strip() for b in tokens.split("|")]
    if not bars:
        raise ValidationError(f'"{name}": empty tokens')

    beats_per_bar = None
    beat_slots = []  # list of slot-token lists, one per global beat
    for bar in bars:
        beats = [b.strip() for b in bar.split("/")]
        if beats_per_bar is None:
            beats_per_bar = len(beats)
        elif len(beats) != beats_per_bar:
            raise ValidationError(f'"{name}": ragged bars (beat count differs between bars)')
        for beat in beats:
            beat_slots.append(beat.split())

    if not beats_per_bar or beats_per_bar <= 0:
        raise ValidationError(f'"{name}": no beats')

    ts_case = {4: "fourFour", 3: "threeFour"}.get(beats_per_bar)
    if ts_case is None:
        raise ValidationError(f'"{name}": unsupported beats-per-bar {beats_per_bar} (must be 3 or 4)')

    hit_count = 0
    for slots in beat_slots:
        if len(slots) not in VALID_SLOT_COUNTS:
            raise ValidationError(
                f'"{name}": beat has {len(slots)} slots (subdivision must be 1/2/3/4)'
            )
        for token in slots:
            if token == REST_SLOT:
                continue
            m = SLOT_RE.match(token)
            if not m:
                raise ValidationError(f'"{name}": malformed slot token "{token}"')
            code = m.group(1).upper()
            limb = m.group(2).upper()
            if code not in INSTRUMENT_CODES:
                raise ValidationError(f'"{name}": unknown instrument code "{code}"')
            if limb not in LIMB_LETTERS:
                raise ValidationError(f'"{name}": unknown limb "{limb}"')
            hit_count += 1

    return ts_case, len(bars), hit_count


def validate_fill(fill: dict) -> str:
    """Mirror CuratedFill.validated(): parse, then check the derived time
    signature / bar count agree with the declared values and the fill is
    audible. Returns the fill name on success; raises ValidationError."""
    name = fill.get("name")
    if not isinstance(name, str) or not name:
        raise ValidationError("a fill is missing a non-empty \"name\"")
    for key in ("attribution", "timeSignature", "tokens"):
        if key not in fill:
            raise ValidationError(f'"{name}": missing required key "{key}"')

    declared_ts = fill["timeSignature"]
    if declared_ts not in BEATS_PER_BAR:
        raise ValidationError(f'"{name}": unknown timeSignature "{declared_ts}"')
    declared_bars = fill.get("barCount", 1)  # defaults to 1, like the decoder

    derived_ts, derived_bars, hit_count = _derive_grid(name, fill["tokens"])

    if derived_ts != declared_ts:
        raise ValidationError(
            f'"{name}": tokens derive {derived_ts} but declared {declared_ts}'
        )
    if derived_bars != declared_bars:
        raise ValidationError(
            f'"{name}": tokens derive {derived_bars} bar(s) but declared {declared_bars}'
        )
    if hit_count == 0:
        raise ValidationError(f'"{name}": no audible hits')
    return name


def main(argv) -> int:
    if len(argv) != 2:
        print("usage: validate-fills.py <catalog.json>", file=sys.stderr)
        return 2
    path = argv[1]

    try:
        with open(path, encoding="utf-8") as f:
            catalog = json.load(f)
    except (OSError, json.JSONDecodeError) as exc:
        print(f"FAIL: cannot read/parse {path}: {exc}", file=sys.stderr)
        return 1

    errors = []

    schema = catalog.get("schemaVersion")
    if schema != SUPPORTED_SCHEMA_VERSION:
        errors.append(
            f"schemaVersion is {schema!r}; this guard validates v{SUPPORTED_SCHEMA_VERSION}"
        )

    fills = catalog.get("fills")
    if not isinstance(fills, list) or not fills:
        errors.append('"fills" must be a non-empty array')
        fills = []

    # Per-fill gate (CuratedFill.validated()).
    ok_fills = []
    for fill in fills:
        try:
            validate_fill(fill)
            ok_fills.append(fill)
        except ValidationError as exc:
            errors.append(str(exc))

    # Catalog-wide coverage gate (coversAllTimeSignatures): every time signature
    # must have at least one one-bar fill, else the app falls back to the bundled
    # seed and the remote catalog never reaches users.
    for ts_case in BEATS_PER_BAR:
        if not any(
            f["timeSignature"] == ts_case and f.get("barCount", 1) == 1 for f in ok_fills
        ):
            errors.append(f'no one-bar fill covers time signature "{ts_case}"')

    if errors:
        print(f"FAIL: {path} — {len(errors)} problem(s):", file=sys.stderr)
        for e in errors:
            print(f"  - {e}", file=sys.stderr)
        return 1

    print(f"OK: {path} — {len(ok_fills)} fills, all valid, every time signature covered")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
