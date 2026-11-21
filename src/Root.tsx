import { Folder } from "remotion";
import { CountTheClacks } from "./videos/count-the-clacks/CountTheClacks";

// One folder per series; one registration per video.
export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Folder name="the-sound-of-pi">
        <CountTheClacks />
      </Folder>
    </>
  );
};
