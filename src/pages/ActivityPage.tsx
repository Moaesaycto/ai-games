import { useState, type ReactNode } from "react";
import Page from "@/components/Page";
import { Paragraph, Title } from "@/components/Text";
import ActivityLoader from "@/components/ActivityLoader";
import { GiClockwiseRotation } from "react-icons/gi";

const ActivityPage = () => {
  const [activeNode, setActiveNode] = useState<ReactNode>(null);

  return (
    <Page>
      <Title level={1}>Activity Loader</Title>
      {activeNode ? (
        <div className="mx-auto w-full rounded-2xl bg-neutral-600 text-white p-6">
          {activeNode}
          <div className="mt-6 flex justify-end">
            <button
              onClick={() => setActiveNode(null)}
              className="rounded bg-white/20 px-4 py-2 hover:bg-white/30 flex flex-row gap-2 items-center"
            >
              <GiClockwiseRotation />
              <span>
                Load another activity
              </span>
            </button>
          </div>
        </div>
      ) : (
        <>
          <Paragraph>
            You will be able to access the activities here. Enter the activity code below to get access to the activity.
          </Paragraph>
          <div className="flex justify-center w-full">
            <ActivityLoader onLoaded={setActiveNode} />
          </div>
        </>
      )}
    </Page>
  );
};

export default ActivityPage;
