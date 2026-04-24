"use client";

import { useEffect, useState } from "react";
import LeftBarContainer from "./LeftBarContainer";
import useSockets from "@/stores/useSockets";
import useUserStore from "@/stores/userStore";
import useGlobalStore from "@/stores/globalStore";
import Loading from "@/components/modules/ui/Loading";
import Image from "next/image";
import ProfileGradients from "@/components/modules/ProfileGradients";
import { 
  MdCall, 
  MdCallMade, 
  MdCallReceived, 
  MdCallMissed, 
  MdVideocam 
} from "react-icons/md";
import { formatDistanceToNow } from "date-fns";
import { ar } from "date-fns/locale";
import { Socket } from "socket.io-client";
import { DefaultEventsMap } from "@socket.io/component-emitter";

// ======== تعريف الأنواع =========
interface CallParticipant {
  _id: string;
  name: string;
  lastName: string;
  avatar?: string;
  username?: string;
}

interface Room {
  _id: string;
  name: string;
  type: string;
  avatar?: string;
  participants: CallParticipant[];
  admins: string[];
  creator: CallParticipant;
  createdAt: string;
  updatedAt?: string;
  [key: string]: any;
}

interface CallRecord {
  _id: string;
  caller: CallParticipant;
  receiver: CallParticipant;
  roomID: Room;
  type: "voice" | "video";
  status: "initiated" | "ringing" | "accepted" | "rejected" | "missed" | "ended" | "failed";
  startTime: string;
  endTime?: string;
  duration: number;
  direction: "outgoing" | "incoming";
}

interface Props {
  getBack: () => void;
}

const CallHistory = ({ getBack }: Props) => {
  const { rooms } = useSockets(); // Socket مباشرة
  const { _id: myID, rooms: userRooms } = useUserStore();
  const { setter: globalSetter } = useGlobalStore();
  const [calls, setCalls] = useState<CallRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // ======== useEffect لتلقي سجل المكالمات =========
  useEffect(() => {
    if (!rooms || !myID) return;

    const socket: Socket<DefaultEventsMap, DefaultEventsMap> = rooms;

    socket.emit("getCallHistory", { userID: myID, limit: 100 });

    const handleCallHistory = ({
      success,
      calls: receivedCalls,
    }: { success: boolean; calls: CallRecord[] }) => {
      if (success) setCalls(receivedCalls);
      setIsLoading(false);
    };

    socket.on("callHistory", handleCallHistory);

    return () => {
      socket.off("callHistory", handleCallHistory);
    };
  }, [rooms, myID]);

  // ======== دوال مساعدة =========
  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds} ثانية`;
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return secs > 0 ? `${minutes} دقيقة و ${secs} ثانية` : `${minutes} دقيقة`;
  };

  const getCallIcon = (call: CallRecord) => {
    const isOutgoing = call.direction === "outgoing";
    const isVideo = call.type === "video";
    const isMissed = call.status === "missed" || call.status === "rejected";

    if (isMissed) return <MdCallMissed className="text-red-500 text-xl" />;
    if (isVideo)
      return (
        <MdVideocam
          className={isOutgoing ? "text-green-500" : "text-blue-500"}
          size={20}
        />
      );
    if (isOutgoing)
      return <MdCallMade className="text-green-500 text-xl" />;
    return <MdCallReceived className="text-blue-500 text-xl" />;
  };

  const getCallStatusText = (call: CallRecord) => {
    if (call.status === "ended" && call.duration > 0)
      return formatDuration(call.duration);

    switch (call.status) {
      case "missed":
        return "مكالمة فائتة";
      case "rejected":
        return "مكالمة مرفوضة";
      case "failed":
        return "فشلت المكالمة";
      default:
        return "لم يتم الرد";
    }
  };

  const getOtherParticipant = (call: CallRecord) =>
    call.direction === "outgoing" ? call.receiver : call.caller;

  const handleCallClick = (call: CallRecord) => {
    const otherUser = getOtherParticipant(call);
    const room = userRooms.find((r) => r._id === call.roomID._id);

    if (room) {
      globalSetter({ selectedRoom: room });
      getBack();
    } else {
      console.warn(
        "لم يتم العثور على الغرفة الخاصة بالمكالمة:",
        call.roomID._id,
        "للمستخدم:",
        otherUser.name
      );
    }
  };

  // ======== الواجهة =========
  return (
    <LeftBarContainer
      getBack={() => {
        getBack();
        globalSetter({ showCreateRoomBtn: true });
      }}
      title="سجل المكالمات" // ✅ استخدم title بدل headerText
    >
      <div className="relative text-white min-h-dvh overflow-y-auto">
        {isLoading ? (
          <div className="flex-center py-20">
            <Loading size="lg" />
          </div>
        ) : calls.length === 0 ? (
          <div className="flex-center flex-col py-20 px-4 text-center">
            <MdCall className="text-6xl text-darkGray mb-4" />
            <p className="text-darkGray text-lg">لا توجد مكالمات بعد</p>
            <p className="text-darkGray text-sm mt-2">
              سيظهر هنا سجل جميع مكالماتك الصوتية والفيديو
            </p>
          </div>
        ) : (
          <div className="flex flex-col">
            {calls.map((call) => {
              const otherUser = getOtherParticipant(call);
              const isMissed =
                call.status === "missed" || call.status === "rejected";

              return (
                <div
                  key={call._id}
                  onClick={() => handleCallClick(call)}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-white/5 cursor-pointer transition-all border-b border-white/5"
                >
                  {/* Avatar */}
                  <div className="relative flex-shrink-0">
                    {otherUser.avatar ? (
                      <Image
                        src={otherUser.avatar}
                        alt={otherUser.name}
                        width={48}
                        height={48}
                        className="rounded-full object-cover"
                        unoptimized={otherUser.avatar.includes("cloudinary")}
                      />
                    ) : (
                      <ProfileGradients
                        id={otherUser._id}
                        classNames="size-12 text-xl flex-center rounded-full"
                      >
                        {otherUser.name[0]?.toUpperCase() || "U"}
                      </ProfileGradients>
                    )}
                  </div>

                  {/* Call Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3
                        className={`font-vazirBold truncate ${
                          isMissed ? "text-red-500" : ""
                        }`}
                      >
                        {otherUser.name} {otherUser.lastName}
                      </h3>
                      {call.type === "video" && (
                        <MdVideocam
                          className="text-darkGray flex-shrink-0"
                          size={16}
                        />
                      )}
                    </div>

                    <div className="flex items-center gap-2 text-sm text-darkGray mt-1">
                      {getCallIcon(call)}
                      <span className={isMissed ? "text-red-500" : ""}>
                        {getCallStatusText(call)}
                      </span>
                    </div>
                  </div>

                  {/* Time and Call Button */}
                  <div className="flex flex-col items-end gap-2 flex-shrink-0">
                    <div className="text-xs text-darkGray text-left">
                      {formatDistanceToNow(new Date(call.startTime), {
                        addSuffix: true,
                        locale: ar,
                      })}
                    </div>
                    {/* ✅ زر إعادة الاتصال */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        // البحث عن الزر المناسب وتشغيله
                        const buttonSelector = `[data-call-button="${call.type}"]`;
                        const callButton = document.querySelector(buttonSelector);
                        if (callButton) {
                          (callButton as HTMLElement).click();
                        } else {
                          console.warn(`لم يتم العثور على زر المكالمة للنوع: ${call.type}`);
                        }
                      }}
                      className="size-8 rounded-full bg-green-500 hover:bg-green-600 flex items-center justify-center transition-all"
                      title={`إعادة مكالمة ${call.type === 'video' ? 'فيديو' : 'صوتية'}`}
                    >
                      {call.type === 'video' ? (
                        <MdVideocam className="text-white" size={18} />
                      ) : (
                        <MdCall className="text-white" size={18} />
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </LeftBarContainer>
  );
};

export default CallHistory;
