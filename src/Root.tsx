import { Folder } from "remotion";
import { CountTheClacks, CountTheClacksCover } from "./videos/count-the-clacks/CountTheClacks";
import { QuartzWatch, QuartzWatchCover } from "./videos/quartz-watch/QuartzWatch";
import { JupiterMoons, JupiterMoonsCover } from "./videos/jupiter-moons/JupiterMoons";

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
    </>
  );
};
