"use client";
import useGlobalStore from "@/stores/globalStore";
import useModalStore from "@/stores/modalStore";
import { lazy, Suspense } from "react";
import Loading from "../modules/ui/Loading";
import AudioManager from "./voice/AudioManager";
import ImageViewer from "../modules/ImageViewer";

const ChatPage = lazy(() => import("./ChatPage"));

const MiddleBar = () => {
  const { selectedRoom, isRoomDetailsShown } = useGlobalStore((state) => state);
  const { imageViewerUrl } = useModalStore((state) => state);
  const modalSetter = useModalStore((state) => state.setter);

  return (
    <>
      <div
        className={` chatBackground relative ${
          !selectedRoom && "hidden"
        }  md:block md:w-[60%] lg:w-[65%] ${
          isRoomDetailsShown ? "xl:w-[50%]" : "xl:w-[70%]"
        }   text-white overflow-x-hidden  scroll-w-none size-full `}
      >
        <AudioManager />
        {selectedRoom !== null ? (
          <Suspense
            fallback={
              <div className="size-full h-screen flex-center">
                <Loading size="xl" />
              </div>
            }
          >
            <ChatPage />
          </Suspense>
        ) : (
          <div className="size-full min-h-dvh"></div>
        )}
      </div>

      {/* Image Viewer Modal */}
      {imageViewerUrl && (
        <ImageViewer
          imageUrl={imageViewerUrl}
          onClose={() => modalSetter({ imageViewerUrl: null })}
        />
      )}
    </>
  );
};

export default MiddleBar;
