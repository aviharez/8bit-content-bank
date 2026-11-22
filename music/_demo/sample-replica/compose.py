"""Replica of the owner's reference sample (not a video): all 40 bars, re-played with the patches in
music/_shared/target_sound.py and the swoop kick, to A/B every instrument against the original.

Inputs are the owner's and stay local (not in the repo): the sample WAV and the transcription score.json from the
earlier analysis (tempo grid, kick hits, bass notes, other notes). Notes of the transcription are assigned to an
instrument by register: E5 and up -> stab, C4-B4 -> lead, A2-B3 -> mid saws (the octave dyads come as two notes),
anything lower in "other" is bleed from the kick and bass and is dropped, as are notes under 0.35 amplitude.
On top, three added parts on the same instruments (see added_parts): lead harmony, 3+3+2 chord stabs, offbeat pulse.

Bus levels are fitted, not set by ear: per 4-bar block and per band (20-60, 60-150, 150-1k, 1-5 kHz), the replica's
bus energies are fitted to the sample's with non-negative least squares (the transcription carries no dynamics).

Run from the repo root:
  uv run --locked python music/_demo/sample-replica/compose.py [sample.wav] [score.json]
Writes out/sample-replica.wav, out/sample-replica-AB.wav (sample then replica, section by section) and
out/sample-replica-stems/<bus>.wav.
"""

import json
import sys
import wave
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "music" / "_shared"))

from mastering import limit  # noqa: E402
from swoop import swoop_hits, swoop_track  # noqa: E402
from target_sound import bass_track, lead_track, mid_track, notes_of, render_buses, stab_track  # noqa: E402

SAMPLE = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "audio-analytic-AI" / "audio-sample.wav"
SCORE = Path(sys.argv[2]) if len(sys.argv) > 2 else ROOT / "audio-analytic-AI" / "claude" / "score.json"
OUT = ROOT / "out"
SR = 48000
SECTIONS = [(0, 4, "intro: 8th kicks, high stabs"), (4, 8, "main: four on the floor, mid saws"),
            (16, 20, "lead: 16th lead over E3 stabs"), (24, 28, "breakdown: held whine"), (28, 32, "bass, then drop")]


def read_wav(path: Path) -> np.ndarray:
    with wave.open(str(path)) as w:
        assert w.getframerate() == SR, "the sample is expected at 48 kHz"
        x = np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(np.float64).reshape(-1, w.getnchannels())
    return x / 32768


def write_wav(path: Path, x: np.ndarray) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(path), "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((np.clip(x, -1, 1) * 32767).astype(np.int16).tobytes())


def band_energy(x: np.ndarray, bar_s: float, off: float, bars: int) -> np.ndarray:
    """[bars, 4] energy in 20-60, 60-150, 150-1k, 1k-5k Hz."""
    m = x.mean(1)
    edges = [20, 60, 150, 1000, 5000]
    out = np.zeros((bars, 4))
    for b in range(bars):
        seg = m[int((off + b * bar_s) * SR): int((off + (b + 1) * bar_s) * SR)]
        spec = np.abs(np.fft.rfft(seg * np.hanning(len(seg)))) ** 2
        f = np.fft.rfftfreq(len(seg), 1 / SR)
        out[b] = [spec[(f >= lo) & (f < hi)].sum() for lo, hi in zip(edges[:-1], edges[1:])]
    return out


def phone_rms(x: np.ndarray) -> float:
    """RMS in 150 Hz-5 kHz (what a phone speaker plays), from the spectrum."""
    m = x.mean(1)
    spec = np.abs(np.fft.rfft(m)) ** 2
    f = np.fft.rfftfreq(len(m), 1 / SR)
    return float(np.sqrt(spec[(f >= 150) & (f < 5000)].sum()))


def nnls(a: np.ndarray, y: np.ndarray) -> np.ndarray:
    """Small non-negative least squares (active set by refitting without negative weights)."""
    keep = np.ones(a.shape[1], bool)
    while True:
        w = np.zeros(a.shape[1])
        w[keep] = np.linalg.lstsq(a[:, keep], y, rcond=None)[0]
        if (w >= 0).all():
            return w
        keep &= w > 0


# ---------------------------------------------------------------- added parts (same instruments, more of them)
# The owner heard about two parts at a time where the sample has more. Three parts are added, each played by one of
# the five approved instruments, unchanged: a harmony under the lead (lead patch), chord stabs on the sample's 3+3+2
# accents (stab patch) and an offbeat octave pulse (mid saws patch). Harmony comes from the bass note under it.
PHRYGIAN = [4, 5, 7, 9, 11, 0, 2]  # E F G A B C D, as pitch classes in scale order
CHORD_STEPS = (0, 3, 6, 8, 11, 14)  # 3+3+2 in each half bar
PULSE_STEPS = (2, 6, 10, 14)  # the offbeat 8ths
BOOST_DB = {"kick": 3.0, "bass": 3.0}  # on top of the fit: the added parts made the mix lean to the mids
PART_LEVEL_DB = {"lead harmony": -6.0, "chords": -6.0, "pulse": -9.0}  # phone-band RMS under the loudest core part


def bass_root(bass_steps, step: int) -> int:
    """Pitch class of the bass note sounding at a 16th step (the last one started before it); E if off the scale."""
    pc = 4
    for st, ln, p in bass_steps:
        if st > step:
            break
        pc = p % 12
    return pc if pc in PHRYGIAN else 4


def triad(pc: int) -> list[int]:
    i = PHRYGIAN.index(pc)
    return [PHRYGIAN[i], PHRYGIAN[(i + 2) % 7], PHRYGIAN[(i + 4) % 7]]


def place(pc: int, low: int) -> int:
    """The pitch with this pitch class at or above `low`."""
    return low + (pc - low) % 12


def third_below(p: int) -> int:
    pc = p % 12
    if pc not in PHRYGIAN:
        return p - 3
    t = PHRYGIAN[(PHRYGIAN.index(pc) - 2) % 7]
    return p - ((pc - t) % 12)


def added_parts(score, lead):
    bass_steps = sorted((int(i), int(ln), int(p)) for i, ln, p in score["bass"])
    steps = score["bars"] * 16
    harmony = [(b, ln, third_below(p), v * 0.85) for b, ln, p, v in lead]
    chords = {0: [], 1: [], 2: []}
    pulse = []
    for bar in range(score["bars"]):
        for st in CHORD_STEPS:
            i = bar * 16 + st
            if i >= steps:
                continue
            for k, pc in enumerate(triad(bass_root(bass_steps, i))):
                chords[k].append((i / 4, 2 / 4 * 0.9, place(pc, 74), 0.9 if st in (0, 8) else 0.75))
        for st in PULSE_STEPS:
            i = bar * 16 + st
            r = place(bass_root(bass_steps, i), 40)
            pulse += [(i / 4, 1.5 / 4, r, 0.8), (i / 4, 1.5 / 4, r + 12, 0.7)]
    return harmony, chords, pulse


def main() -> None:
    score = json.loads(SCORE.read_text())
    bpm, off, bars = score["bpm"], score["offset_s"], score["bars"]
    beats = bars * 4
    bar_s = 240 / bpm

    kick_steps = [int(i) for i, _ in score["drums"]["kick"]]
    kick_vel = {int(i): float(min(1.0, 0.55 + 0.45 * v)) for i, v in score["drums"]["kick"]}
    bass = [(i / 4, ln / 4 * 0.95, p, 0.9) for i, ln, p in score["bass"]]
    stab, lead, mid = [], [], []
    for i, ln, p, a in score["other"]:
        if a < 0.35:
            continue
        ev = (i / 4, ln / 4 * 0.9, p, min(1.0, 0.4 + a))
        (stab if p >= 76 else lead if p >= 60 else mid if p >= 45 else []).append(ev)

    buses = {
        "kick": swoop_track(swoop_hits(kick_steps, kick_vel, end_step=bars * 16), gain=0.5),
        "bass": bass_track(notes_of(bass)),
        "mid": mid_track(notes_of(mid)),
        "lead": lead_track(notes_of(lead)),
        "stab": stab_track(notes_of(stab)),
    }
    harmony, chords, pulse = added_parts(score, lead)
    # one bus per voice: a chord through one hard-clipped bus would intermodulate
    extra_buses = {"lead harmony": lead_track(notes_of(harmony), name="Lead harmony"),
                   "pulse": mid_track(notes_of(pulse), name="Pulse")}
    extra_buses.update({f"chord {k}": stab_track(notes_of(v), name=f"Chord {k}") for k, v in chords.items()})
    _, stems = render_buses(buses, bpm, beats, sample_rate=SR)
    _, extra = render_buses(extra_buses, bpm, beats, sample_rate=SR)
    extra["chords"] = sum(extra.pop(f"chord {k}") for k in range(3))
    n = max(len(v) for v in stems.values())
    stems = {k: np.pad(v, ((0, n - len(v)), (0, 0))) for k, v in stems.items()}

    sample = read_wav(SAMPLE)
    target = band_energy(sample, bar_s, off, bars)
    names = list(stems)
    energies = [band_energy(np.pad(stems[n], ((int(off * SR), 0), (0, 0))), bar_s, off, bars) for n in names]
    # Levels per 4-bar block: the sample's sections differ a lot (e.g. almost no sub in bars 4-7), and the
    # transcription has no dynamics. Fit each block with NNLS (relative error per band), ramp between blocks.
    scale = target.mean(0)
    block = 4
    gains = np.zeros((len(names), bars))
    for b0 in range(0, bars, block):
        sl = slice(b0, min(bars, b0 + block))
        a = np.stack([(e[sl] / scale).ravel() for e in energies], 1)
        w = nnls(a, (target[sl] / scale).ravel())
        gains[:, sl] = np.minimum(np.sqrt(np.maximum(w, 0)), 1.0)[:, None]  # cap at 0 dB: a sparse bus must not fill a band alone
    faders = {n: [float(round(20 * np.log10(max(g, 1e-4)), 1)) for g in gains[k, ::block]] for k, n in enumerate(names)}
    t_bar = (np.arange(len(stems[names[0]])) / SR) / bar_s
    ramp = 0.03 / bar_s  # 30 ms ramps between blocks
    centres = np.arange(bars) + 0.5
    def curve(g):
        idx = np.clip(np.floor(t_bar).astype(int), 0, bars - 1)
        c = g[idx]
        k = int(ramp * bar_s * SR)
        return np.convolve(c, np.ones(k) / k, mode="same") if k > 1 else c
    for k, name in enumerate(names):
        gains[k] *= 10 ** (BOOST_DB.get(name, 0.0) / 20)
    faders = {nm: [float(round(20 * np.log10(max(g, 1e-4)), 1)) for g in gains[k, ::block]] for k, nm in enumerate(names)}
    scaled = {n: stems[n] * curve(gains[k])[:, None] for k, n in enumerate(names)}
    # the added parts: per block, a fixed distance in phone-band RMS under the loudest of lead, stab and mid there
    extra = {k: np.pad(v, ((0, max(0, n - len(v))), (0, 0)))[:n] for k, v in extra.items()}
    blk = lambda x, b0: x[int(b0 * bar_s * SR): int(min(bars, b0 + block) * bar_s * SR)]
    for part, x in extra.items():
        g = np.zeros(bars)
        for b0 in range(0, bars, block):
            ref = max(phone_rms(blk(scaled[c], b0)) for c in ("lead", "stab", "mid"))
            own = phone_rms(blk(x, b0))
            g[b0: b0 + block] = ref / own * 10 ** (PART_LEVEL_DB[part] / 20) if own > 0 else 0.0
        scaled[part] = x * curve(g)[:, None]
        faders[part] = [float(round(20 * np.log10(max(v, 1e-4)), 1)) for v in g[::block]]
    names = list(scaled)
    mix = sum(scaled.values())
    mix = np.pad(mix, ((int(off * SR), 0), (0, 0)))[: len(sample)]
    fit = band_energy(mix, bar_s, off, bars)
    # match the sample's loudness on a phone (RMS 150 Hz-5 kHz over the whole piece), then a peak limiter
    gain = phone_rms(sample) / phone_rms(mix)
    mix = limit(mix * gain, SR, 10 ** (-0.3 / 20))
    write_wav(OUT / "sample-replica.wav", mix)
    for n in names:
        write_wav(OUT / "sample-replica-stems" / f"{n}.wav", scaled[n] * gain)

    gap = np.zeros((int(0.7 * SR), 2))
    ab = []
    for b0, b1, _ in SECTIONS:
        i, j = int((off + b0 * bar_s) * SR), int((off + b1 * bar_s) * SR)
        rep = limit(mix[i:j] * phone_rms(sample[i:j]) / phone_rms(mix[i:j]), SR, 10 ** (-0.3 / 20))
        ab += [sample[i:j], gap, rep, gap, gap]  # each pair level-matched on a phone
    write_wav(OUT / "sample-replica-AB.wav", np.concatenate(ab))

    print("bus levels per 4-bar block (dB, after each bus's own distortion):")
    for n, v in faders.items():
        print(f"  {n:5s}", v)
    print("band balance per section, % of 20 Hz-5 kHz energy (20-60 / 60-150 / 150-1k / 1k-5k):")
    for b0, b1, label in SECTIONS:
        s, r = target[b0:b1].sum(0), fit[b0:b1].sum(0)
        print(f"  bars {b0:2d}-{b1 - 1:2d} {label:34s} sample {np.round(100 * s / s.sum()).astype(int)}"
              f"  replica {np.round(100 * r / r.sum()).astype(int)}")
    print("A/B order:", " | ".join(f"bars {b0}-{b1 - 1}: sample, replica" for b0, b1, _ in SECTIONS))


if __name__ == "__main__":
    main()
