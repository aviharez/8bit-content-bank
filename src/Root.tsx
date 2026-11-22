import { Folder } from "remotion";
import { CountTheClacks, CountTheClacksCover } from "./videos/count-the-clacks/CountTheClacks";
import { QuartzWatch, QuartzWatchCover } from "./videos/quartz-watch/QuartzWatch";
import { JupiterMoons, JupiterMoonsCover } from "./videos/jupiter-moons/JupiterMoons";
import { PendulumWave, PendulumWaveCover } from "./videos/pendulum-wave/PendulumWave";
import { GaltonBoard, GaltonBoardCover } from "./videos/galton-board/GaltonBoard";
import { HeartRate, HeartRateCover } from "./videos/heart-rate/HeartRate";
import { GlassResonance, GlassResonanceCover } from "./videos/glass-resonance/GlassResonance";
import { MachOne, MachOneCover } from "./videos/mach-one/MachOne";
import { EightBits, EightBitsCover } from "./videos/eight-bits/EightBits";
import { KeyLock, KeyLockCover } from "./videos/key-lock/KeyLock";
import { Speaker, SpeakerCover } from "./videos/speaker/Speaker";
import { GuitarString, GuitarStringCover } from "./videos/guitar-string/GuitarString";

// One folder per series; one registration per video.
export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Folder name="the-sound-of-pi">
        <CountTheClacks />
        <CountTheClacksCover />
      </Folder>
      <Folder name="how-time-works">
        <QuartzWatch />
        <QuartzWatchCover />
      </Folder>
      <Folder name="orbits">
        <JupiterMoons />
        <JupiterMoonsCover />
      </Folder>
      <Folder name="every-wave">
        <PendulumWave />
        <PendulumWaveCover />
        <GlassResonance />
        <GlassResonanceCover />
        <MachOne />
        <MachOneCover />
        <Speaker />
        <SpeakerCover />
        <GuitarString />
        <GuitarStringCover />
      </Folder>
      <Folder name="probability">
        <GaltonBoard />
        <GaltonBoardCover />
      </Folder>
      <Folder name="how-life-works">
        <HeartRate />
        <HeartRateCover />
      </Folder>
      <Folder name="how-computers-work">
        <EightBits />
        <EightBitsCover />
      </Folder>
      <Folder name="how-things-work">
        <KeyLock />
        <KeyLockCover />
      </Folder>
    </>
  );
};
