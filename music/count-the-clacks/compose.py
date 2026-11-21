"""Count the Clacks — soundtrack, composed with Audio as Code.

One clock for sound and picture: 120 BPM, 16 bars (64 beats = 32 s), 30 fps.
The clack layers are generated from the simulation's own collision events
(public/count-the-clacks/timeline.json), so every hit you hear is a hit you see.

Low end: the kick is the "dem" (music/_shared/dem.py), tuned to the chord root under it (Am F C G -> A1 F1 C2 G1),
with the triangle bass on the same root an octave up. No separate sub: kick, bass, chords and melody agree on every note.

Run from the repo root:  uv run python music/count-the-clacks/compose.py
"""

import json
import wave
from pathlib import Path

import sys

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "_shared"))
from dem import dem_tracks  # noqa: E402
from audio_as_code import (
    Chorus, Delay, Ducker, Filter, Note, Reverb, Song, Tone, Track, export_midi, render,
)
from audio_as_code import Automation, AutomationPoint, measure_loudness

ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
OUT = HERE / "output"
PUBLIC = ROOT / "public" / "count-the-clacks"

BPM = 120
BARS = 16
BEATS = BARS * 4
SPB = 60 / BPM  # seconds per beat

timeline = json.loads((PUBLIC / "timeline.json").read_text())
events = timeline["audioEvents"]


def bar(b: int) -> float:
    return b * 4.0


def n(pitch, start, dur, vel=0.8):
    return Note(pitch=int(pitch), start=round(float(start), 6), duration=round(float(dur), 6), velocity=float(min(1.0, max(0.01, vel))))


# ---------------------------------------------------------------- harmony
# i - VI - III - VII in A minor (Am F C G), one chord per bar
ROOTS = [45, 41, 48, 43]
CHORDS = [[57, 60, 64], [53, 57, 60], [55, 60, 64], [55, 59, 62]]

# sections (bar indices, 0-based)
INTRO, L1, L2, BUILD, DROP, OUTRO = range(0, 2), range(2, 4), range(4, 8), [8], range(9, 14), range(14, 16)

# ---------------------------------------------------------------- drums
kick_beats, kicks, snares, claps, hats, open_hats, crashes = [], [], [], [], [], [], []
for b in range(BARS):
    t = bar(b)
    if b in L1:
        for q in (0, 2):
            kick_beats.append(t + q)
        hats += [n(42, t + 1, 0.1, 0.35), n(42, t + 3, 0.1, 0.35)]
    if b in L2:
        for q in (0, 2):
            kick_beats.append(t + q)
        if b in (5, 7):
            kick_beats.append(t + 2.5)
        snares += [n(38, t + 1, 0.25, 0.7), n(38, t + 3, 0.25, 0.75)]
        hats += [n(42, t + e / 2, 0.1, 0.5 if e % 2 == 0 else 0.35) for e in range(8)]
    if b in BUILD:
        kick_beats.append(t)
        snares += [n(38, t + s / 4, 0.12, 0.2 + 0.75 * (s / 15) ** 2) for s in range(16)]
    if b in DROP:
        for q in range(4):
            kick_beats.append(t + q)
        snares += [n(38, t + 1, 0.25, 0.8), n(38, t + 3, 0.25, 0.85)]
        claps += [n(39, t + 1, 0.25, 0.7), n(39, t + 3, 0.25, 0.7)]
        hats += [n(42, t + s / 4, 0.08, 0.45 if s % 2 == 0 else 0.28) for s in range(16) if s % 4 != 2]
        open_hats += [n(46, t + q + 0.5, 0.3, 0.45) for q in range(4)]
        if b == 13:
            snares += [n(38, t + 3 + s / 4, 0.12, 0.55 + 0.1 * s) for s in range(4)]
    if b == 9 or b == 14:
        crashes.append(n(51, t, 3.5, 0.75))
    if b == 14:
        kick_beats.append(t)
# the "dem": each kick is tuned to the root of the chord it sits under (A1, F1, C2, G1), so the kick IS the bass
# note an octave under the triangle bass; it rings until the next kick (at most most of two beats)
kick_beats = sorted(set(kick_beats))
kick_hits = []
for i, kb in enumerate(kick_beats):
    gap = (kick_beats[i + 1] if i + 1 < len(kick_beats) else BEATS) - kb
    kick_hits.append((kb, ROOTS[int(kb // 4) % 4] - 12, 0.9 * min(gap, 2.0), 1.0 if kb % 4 == 0 else 0.9))
duck = Ducker(trigger_beats=tuple(sorted(set(kick_beats))), depth=0.6, attack_seconds=0.004, release_seconds=0.17)

# ---------------------------------------------------------------- pad, bass, arp
pad, tri, arp_l, arp_r = [], [], [], []
for b in range(BARS):
    c = b % 4
    t, root, ch = bar(b), ROOTS[c], CHORDS[c]
    if b not in BUILD:
        pad += [n(p, t, 3.9, 0.45 if b in DROP else 0.38) for p in ch]
    if b in INTRO:
        tri.append(n(root, t, 3.8, 0.55))
    elif b in L1:
        tri += [n(root, t + q, 0.85, 0.7) for q in range(4)]
    elif b in L2:
        tri += [n(root + (12 if e % 2 else 0), t + e / 2, 0.4, 0.7) for e in range(8)]
    elif b in BUILD:
        tri += [n(root, t + s / 4, 0.2, 0.4 + 0.4 * s / 15) for s in range(16)]
    elif b in DROP:
        steps = [0, 2, 3, 5, 6, 8, 10, 11, 13, 14]
        offs = [0, 12, 0, 12, 0, 0, 12, 7, 12, 10]
        tri += [n(root + o, t + s / 4, 0.38, 0.8) for s, o in zip(steps, offs)]
    elif b in OUTRO:
        tri.append(n(45 if b == 15 else root, t, 3.8, 0.5))
    # arpeggio: chord tones in 16ths, alternating left/right
    if b in L1 or b in L2 or b in DROP or b in OUTRO:
        vel = 0.35 if b in L1 else 0.5
        for s in range(16):
            p = ch[s % 3] + 12 + (12 if s % 6 >= 3 else 0)
            (arp_l if s % 2 == 0 else arp_r).append(n(p, t + s / 4, 0.18, vel * (1.0 if s % 4 == 0 else 0.8)))
    if b in INTRO:
        for e in range(8):
            (arp_l if e % 2 == 0 else arp_r).append(n(ch[e % 3] + 12, t + e / 2, 0.4, 0.4))

# ---------------------------------------------------------------- lead hook (the drop)
HOOK = [
    [(0, 81, 4), (4, 79, 2), (6, 76, 4), (10, 76, 2), (12, 79, 2), (14, 81, 2)],
    [(0, 84, 4), (4, 81, 2), (6, 77, 4), (10, 77, 2), (12, 79, 2), (14, 81, 2)],
    [(0, 79, 4), (4, 76, 2), (6, 72, 4), (10, 72, 2), (12, 74, 2), (14, 76, 2)],
    [(0, 74, 3), (3, 76, 3), (6, 79, 4), (10, 83, 2), (12, 81, 2), (14, 79, 2)],
]
HOOK_END = [(0, 76, 3), (3, 79, 3), (6, 83, 4), (10, 86, 6)]
lead, lead_low = [], []
for b in DROP:
    phrase = HOOK_END if b == 13 else HOOK[b % 4]
    for p, pitch, ln in phrase:
        lead.append(n(pitch, bar(b) + p / 4, ln / 4 * 0.92, 0.85 if p in (0, 6) else 0.72))
        lead_low.append(n(pitch - 12, bar(b) + p / 4, ln / 4 * 0.92, 0.6))

# outro: the digits of pi become the melody (digit -> A minor pentatonic, two octaves)
PENT10 = [69, 72, 74, 76, 79, 81, 84, 86, 88, 91]
pi_mel = [n(PENT10[int(d)], bar(14) + i / 2, 0.45, 0.8) for i, d in enumerate("3141592653589793")]

# riser into the drop: a wide chord gliding up an octave over the build bar
riser = [n(p, bar(8), 3.95, 0.7) for p in (57, 64, 69)]

# ---------------------------------------------------------------- clacks from the simulation
PENTA = [0, 3, 5, 7, 10]


def pn(k: int, base: int) -> int:
    return base + 12 * (k // 5) + PENTA[k % 5]


hits_wall, hits_block, mel_l1, mel_wall, mel_block, roll_wall, roll_block = [], [], [], [], [], [], []
for e in events:
    beat = e["sec"] / SPB
    wall = e["type"] == "wall"
    hits = hits_wall if wall else hits_block
    if e["level"] == 1:
        hits.append(n(84, beat, 0.25, 1.0))
        mel_l1.append(n([81, 76, 84][e["index"]], beat, 0.9, 0.9))
    elif e["level"] == 2:
        # every clack keeps its percussive hit at full strength, plus a pentatonic note
        hits.append(n(84, beat, 0.2, 0.95))
        k = e["index"] // 2
        (mel_wall if wall else mel_block).append(n(pn(k, 57 if wall else 69), beat, 0.3, 0.95))
    else:
        # level 3: 314 hits in ~8 s. Each one is still a hit; the pitch climbs two octaves
        k = int(e["index"] / (e["total"] - 1) * 10)
        hits.append(n(84 + k, beat, 0.15, 0.75 + 0.25 * k / 10))
        (roll_wall if wall else roll_block).append(n(pn(k, 69) - (12 if wall else 0), beat, 0.15, 0.8 + 0.2 * k / 10))

# The clacks are the point of the video: the arrangement makes room for them.
# During the squeeze (level 3, bars 10-13) hats and arp step back so the hits stay on top.
SQUEEZE = (bar(9), bar(13) + 0.5)


def thin(notes, factor):
    return [n(x.pitch, x.start, x.duration, x.velocity * (factor if SQUEEZE[0] <= x.start < SQUEEZE[1] else 1.0)) for x in notes]


hats, open_hats, arp_l, arp_r = thin(hats, 0.45), thin(open_hats, 0.4), thin(arp_l, 0.5), thin(arp_r, 0.5)

# ---------------------------------------------------------------- song
rev_short = Reverb(decay_seconds=1.2, mix=0.18)
rev_long = Reverb(decay_seconds=2.6, mix=0.32)
dotted8 = Delay(time_seconds=0.75 * SPB, feedback=0.35, repeats=5, mix=0.22)

tracks = [
    Track(name="Pad", instrument="wavetable_pad", gain=0.32, tone=Tone(brightness=0.45, cutoff_hz=2400, detune_cents=12),
          notes=tuple(pad), release_seconds=0.6,
          effects=(Filter(mode="lowpass", cutoff_hz=450, end_cutoff_hz=9000, sweep_seconds=4.0), Chorus(), rev_long, duck)),
    Track(name="Bass (triangle)", instrument="triangle", gain=0.9, notes=tuple(tri), effects=(duck,)),
    Track(name="Arp L", instrument="synthesizer", gain=0.5, pan=-0.45, tone=Tone(brightness=0.7, detune_cents=4),
          notes=tuple(arp_l), effects=(dotted8, rev_short, duck)),
    Track(name="Arp R", instrument="synthesizer", gain=0.5, pan=0.45, tone=Tone(brightness=0.7, detune_cents=4),
          notes=tuple(arp_r), effects=(dotted8, rev_short, duck)),
    Track(name="Lead (pulse)", instrument="hoover", gain=1.0, tone=Tone(brightness=0.62, cutoff_hz=5200, detune_cents=7),
          notes=tuple(lead), effects=(Chorus(mix=0.3), dotted8, rev_short, Ducker(trigger_beats=duck.trigger_beats, depth=0.25, release_seconds=0.12))),
    Track(name="Lead low", instrument="synthesizer", gain=0.35, tone=Tone(brightness=0.4), notes=tuple(lead_low), effects=(duck,)),
    Track(name="Pi melody", instrument="hoover", gain=1.0, tone=Tone(brightness=0.6, cutoff_hz=4800, detune_cents=6),
          notes=tuple(pi_mel), effects=(Chorus(mix=0.3), Delay(time_seconds=0.75 * SPB, feedback=0.4, repeats=6, mix=0.3), rev_long)),
    Track(name="Riser", instrument="supersaw", gain=0.26, tone=Tone(brightness=0.6, glide_semitones=-12, glide_seconds=1.2, detune_cents=25),
          notes=tuple(riser), effects=(Filter(mode="highpass", cutoff_hz=350), rev_long),
          automation=(Automation(parameter="gain", points=(AutomationPoint(beat=bar(8), value=0.0), AutomationPoint(beat=bar(9) - 0.05, value=1.0), AutomationPoint(beat=bar(9), value=0.0))),)),
    *dem_tracks(kick_hits, gain=0.3, drive=4.0),
    Track(name="Snare", instrument="electronic_snare", gain=0.5, tone=Tone(brightness=0.55), notes=tuple(snares), effects=(rev_short,)),
    Track(name="Clap", instrument="clap", gain=0.4, notes=tuple(claps), effects=(Reverb(decay_seconds=1.0, mix=0.25),)),
    Track(name="Hat", instrument="metal_hat", gain=0.7, pan=0.2, tone=Tone(brightness=0.6), notes=tuple(hats)),
    Track(name="Open hat", instrument="open_hat", gain=0.5, pan=-0.2, notes=tuple(open_hats)),
    Track(name="Crash", instrument="electronic_ride", gain=0.3, tone=Tone(brightness=0.8, decay_seconds=2.5), notes=tuple(crashes), effects=(rev_long,)),
    # --- sonification: the simulation plays these
    Track(name="Clack wall", instrument="fm_percussion", gain=1.0, pan=-0.45, tone=Tone(brightness=0.7), notes=tuple(hits_wall), effects=(rev_short,)),
    Track(name="Clack block", instrument="fm_percussion", gain=1.0, pan=0.45, tone=Tone(brightness=0.75), notes=tuple(hits_block), effects=(rev_short,)),
    Track(name="Clack notes L1", instrument="fm_bell", gain=0.5, tone=Tone(brightness=0.55, decay_seconds=1.2), notes=tuple(mel_l1), effects=(dotted8, rev_long)),
    Track(name="Clack notes wall", instrument="trance_pluck", gain=0.7, pan=-0.4, tone=Tone(brightness=0.6, decay_seconds=0.3), notes=tuple(mel_wall), effects=(dotted8, rev_short)),
    Track(name="Clack notes block", instrument="trance_pluck", gain=0.7, pan=0.4, tone=Tone(brightness=0.65, decay_seconds=0.3), notes=tuple(mel_block), effects=(dotted8, rev_short)),
    Track(name="Squeeze roll wall", instrument="trance_pluck", gain=0.45, pan=-0.5, tone=Tone(brightness=0.7, decay_seconds=0.12), notes=tuple(roll_wall), effects=(rev_short,)),
    Track(name="Squeeze roll block", instrument="trance_pluck", gain=0.45, pan=0.5, tone=Tone(brightness=0.75, decay_seconds=0.12), notes=tuple(roll_block), effects=(rev_short,)),
]

song = Song(title="Count the Clacks", bpm=float(BPM), beats=float(BEATS), seed=314, master_gain=0.8, tracks=tuple(tracks))


def limit(x: np.ndarray, sr: int, ceiling: float, release_s: float = 0.08, lookahead_s: float = 0.003) -> np.ndarray:
    """Simple lookahead peak limiter: gain follows the loudest sample ahead, releases smoothly."""
    peak = np.abs(x).max(axis=1)
    la = int(lookahead_s * sr)
    ahead = np.maximum.reduce([np.roll(peak, -k) for k in range(la)])
    target = np.minimum(1.0, ceiling / np.maximum(ahead, 1e-9))
    rel = np.exp(-1 / (release_s * sr))
    g = np.empty_like(target)
    cur = 1.0
    for i, t in enumerate(target):
        cur = t if t < cur else t + (cur - t) * rel
        g[i] = cur
    return x * g[:, None]


def finish_loop(path: Path, loop_seconds: float, target_lufs: float = -14.0, ceiling_dbfs: float = -1.0) -> dict:
    """Fold the tail past the loop point onto the start, set loudness, limit peaks."""
    with wave.open(str(path)) as w:
        sr, ch = w.getframerate(), w.getnchannels()
        data = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float64).reshape(-1, ch) / 32768
    n_loop = int(round(loop_seconds * sr))
    out = data[:n_loop].copy()
    tail = data[n_loop:]
    out[: len(tail)] += tail[:n_loop]
    lufs = measure_loudness(out, sr)["integrated_lufs"]
    out *= 10 ** ((target_lufs - lufs) / 20)
    out = limit(out, sr, 10 ** (ceiling_dbfs / 20))
    with wave.open(str(path), "wb") as w:
        w.setnchannels(ch); w.setsampwidth(2); w.setframerate(sr)
        w.writeframes((np.clip(out, -1, 1) * 32767).astype(np.int16).tobytes())
    return {"seconds": n_loop / sr, "tail_folded_seconds": round(len(tail) / sr, 3),
            "lufs": round(measure_loudness(out, sr)["integrated_lufs"], 1), "peak_dbfs": round(20 * np.log10(np.abs(out).max()), 2)}


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    song.save(OUT / "score.json")
    report = render(song, PUBLIC / "track.wav", target_lufs=-14.0, peak_ceiling_dbfs=-1.0)
    loop = finish_loop(PUBLIC / "track.wav", BEATS * SPB)
    try:
        midi = export_midi(song, OUT / "song.mid")
    except ValueError as err:  # e.g. two tracks share a drum voice (panned clack layers)
        midi = {"skipped": str(err)}
    (OUT / "report.json").write_text(json.dumps({"render": report, "loop": loop, "midi": midi}, indent=2, default=str) + "\n")
    print(json.dumps({"loop": loop, "notes": sum(len(t.notes) for t in tracks), "tracks": len(tracks)}, indent=2))


if __name__ == "__main__":
    main()
