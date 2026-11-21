import { PageHeader } from "@/components/ui";
import { VideoBoard } from "@/components/team/video-board";
import { footageIsLate } from "@/lib/pipeline-health";
import { DEMO_NOW, demoBoardVideos } from "../sample";

/** Demo of the team's Videos page. */
export default function DemoTeamVideos() {
  return (
    <>
      <PageHeader
        title="Videos"
        subtitle="Every video in progress, in the three steps your clients see. The ones waiting on you are at the top of each step."
      />
      <VideoBoard videos={demoBoardVideos((s) => footageIsLate(s, DEMO_NOW))} />
    </>
  );
}
