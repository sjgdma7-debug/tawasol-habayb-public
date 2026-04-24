import Image from "next/image";
import { TbMessage } from "react-icons/tb";
import { IoCopyOutline } from "react-icons/io5";
import { useCallback, useEffect, useState } from "react";
import { toaster, copyText as copyFn } from "@/utils";
import User from "@/models/user";
import useGlobalStore from "@/stores/globalStore";
import { UserStoreUpdater } from "@/stores/userStore";
import useSockets from "@/stores/useSockets";
import Loading from "../modules/ui/Loading";
import Room from "@/models/room";
import RoomCard from "./RoomCard";
import { FiUserPlus } from "react-icons/fi";
import ProfileImageViewer from "@/components/modules/ProfileImageViewer";
import ProfileGradients from "../modules/ProfileGradients";

interface RoomDetailsProps {
  selectedRoomData: Room;
  myData: User & UserStoreUpdater;
  roomData: User & Room;
}

interface Participant {
  _id: string;
  username?: string;
  name?: string;
  avatar?: string;
}

const RoomDetails = ({ selectedRoomData, myData, roomData }: RoomDetailsProps) => {
  const [isCopied, setIsCopied] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [notifications, setNotifications] = useState(true);
  const [groupMembers, setGroupMembers] = useState<Participant[]>([]);
  const [isViewerOpen, setIsViewerOpen] = useState(false);

  const {
    setter,
    isRoomDetailsShown,
    selectedRoom,
    RoomDetailsData,
    onlineUsers = [],
  } = useGlobalStore((state) => state) || {};

  const roomSocket = useSockets((state) => state.rooms);

  const { _id: myID, rooms } = myData || {};
  const { participants, type, _id: roomID } = { ...selectedRoomData };

  // تعريف متغيرات roomData أولاً
  const {
    avatar = "",
    name = "",
    lastName = "",
    username,
    link,
    _id,
    biography,
  } = roomData || {};

  // الآن يمكن استخدام _id بأمان
  const isUserBlockedByMe = myData?.blockedUsers?.some(
    (blockedId: string) => blockedId === _id
  ) || false;

  const onlineUsersCount =
    (participants
      ? participants.filter((participant) => {
          const pId = typeof participant === "string" ? participant : participant._id;
          return onlineUsers?.some((data) => data.userID === pId);
        }).length
      : 0) || 0;

  useEffect(() => {
    if (!roomSocket || !roomID || !isRoomDetailsShown) return;

    if (type && type !== "private" && roomID) {
      let mounted = true;
      try {
        setIsLoading(true);
        roomSocket.emit("getRoomMembers", { roomID });

        const handler = (participantsResponse: Participant[]) => {
          if (!mounted) return;
          setGroupMembers(participantsResponse || []);
          setIsLoading(false);
        };

        roomSocket.once("getRoomMembers", handler);
        const timeout = setTimeout(() => {
          if (mounted) setIsLoading(false);
        }, 7000);

        return () => {
          mounted = false;
          clearTimeout(timeout);
          roomSocket.off("getRoomMembers", handler);
        };
      } catch {
        toaster("error", "فشل تحميل الأعضاء");
        setIsLoading(false);
      }
    }
  }, [roomSocket, roomID, isRoomDetailsShown, type]);

  const copyText = async () => {
    await copyFn((username && "@" + username) || link);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 1000);
  };

  const openChat = () => {
    const isInRoom = selectedRoom?._id === roomID;
    if (isInRoom) return setter({ isRoomDetailsShown: false });

    const roomHistory = rooms.find(
      (data) =>
        data.name === myID + "-" + _id ||
        data.name === _id + "-" + myID ||
        data._id == roomID
    );

    const roomSelected: Omit<Room, "_id" | "lastMsgData" | "notSeenCount"> = {
      admins: [myData._id, _id],
      avatar,
      createdAt: Date.now().toString(),
      creator: myData._id,
      link: (Math.random() * 9999999).toString(),
      locations: [],
      medias: [],
      messages: [],
      name: myData._id + "-" + _id,
      participants: [myData, selectedRoomData] as (string | User)[],
      type: "private",
      updatedAt: Date.now().toString(),
    };

    if (roomHistory) {
      roomSocket?.emit("joining", roomHistory._id);
    } else {
      setter({
        selectedRoom:
          type === "private"
            ? (roomSelected as Room)
            : (RoomDetailsData as Room),
        RoomDetailsData: null,
      });
    }

    setter({ isRoomDetailsShown: false });
  };

  const isUserOnline = useCallback(
    (userId: string) => {
      return !!onlineUsers?.some((data) => data.userID === userId);
    },
    [onlineUsers]
  );

  const SafeAvatar = ({
    avatarUrl,
    displayName,
    id,
    size = 48,
    className = "",
    onClick,
  }: {
    avatarUrl?: string;
    displayName?: string;
    id?: string;
    size?: number;
    className?: string;
    onClick?: () => void;
  }) => {
    const [err, setErr] = useState(false);
    const showImage =
      !!avatarUrl && typeof avatarUrl === "string" && avatarUrl.startsWith("http") && !err;

    return showImage ? (
      <Image
        src={avatarUrl}
        alt={displayName || "avatar"}
        width={size}
        height={size}
        className={`object-cover rounded-full ${className}`}
        onError={() => setErr(true)}
        onClick={onClick}
        unoptimized={avatarUrl?.includes("cloudinary")}
      />
    ) : (
      <ProfileGradients
        id={id || _id || "default-avatar-id"}
        classNames={`size-${Math.round(size / 4)} text-center text-lg flex-center ${className}`}
      >
        {displayName && displayName.length > 0
          ? displayName[0].toUpperCase()
          : "؟"}
      </ProfileGradients>
    );
  };

  return (
    <>
      <div className="bg-chatBg py-2 relative chatBackground">
        <div className="flex items-center gap-3 pb-4 px-2">
          <SafeAvatar
            avatarUrl={avatar}
            displayName={name}
            id={_id}
            size={48}
            className="cursor-pointer"
            onClick={() => {
              if (avatar && typeof avatar === "string" && avatar.startsWith("http")) {
                setIsViewerOpen(true);
              }
            }}
          />

          <div className="flex justify-center flex-col gap-1 text-ellipsis w-[80%]">
            <h3 className="font-vazirBold text-base truncate">
              {`${name || ""} ${lastName || ""}`.trim() || "مستخدم"}
            </h3>

            <div className="text-sm text-darkGray font-vazirBold line-clamp-1 whitespace-normal text-nowrap">
              {type === "private" ? (
                avatar === null ? (
                  // ✅ إذا الصورة بالضبط null (وليس "" أو undefined) → معناها أنا محظور
                  "آخر ظهور منذ زمن طويل"
                ) : isUserOnline(_id) ? (
                  <span className="text-lightBlue">متصل</span>
                ) : (
                  "ظهر مؤخراً"
                )
              ) : type === "group" ? (
                `${participants?.length || 0} عضو${
                  onlineUsersCount ? ", " + onlineUsersCount + " متصل" : ""
                }`
              ) : (
                `${participants?.length || 0} مشترك`
              )}
            </div>
          </div>
        </div>

        {type === "private" && roomID !== myID && (
          <span
            onClick={openChat}
            className="absolute right-3 -bottom-6 size-12 rounded-full cursor-pointer bg-darkBlue flex-center"
          >
            <TbMessage className="size-6" />
          </span>
        )}
      </div>

      <div className="px-3 my-3 space-y-4">
        <p className="text-lightBlue">المعلومات</p>

        {biography && (
          <div>
            <p className="text-[16px]">{biography}</p>
            <p className="text-darkGray text-[13px]">السيرة الذاتية</p>
          </div>
        )}

        <div className="flex items-start justify-between">
          <div>
            <p className="font-vazirLight text-base">
              {(username && "@" + username) || link}
            </p>
            <p className="text-darkGray text-sm">
              {type === "private" ? "اسم المستخدم" : "الرابط"}
            </p>
          </div>

          <div
            onClick={copyText}
            className="cursor-pointer rounded px-2 transition-all duration-300"
          >
            {isCopied ? (
              <p className="text-sm">تم النسخ</p>
            ) : (
              <IoCopyOutline className="size-5" />
            )}
          </div>
        </div>

        <div className="flex items-start justify-between">
          <div>
            <p>الإشعارات</p>
            <p className="text-darkGray text-sm">
              {notifications ? "مفعل" : "معطل"}
            </p>
          </div>

          <input
            type="checkbox"
            checked={notifications}
            className="toggle toggle-info toggle-xs mt-1 mr-1 outline-none"
            onChange={() => setNotifications(!notifications)}
          />
        </div>
      </div>

      {type === "group" && (
        <>
          <div className="h-2 bg-black"></div>
          <div
            className="px-3 py-2 flex items-start gap-4 text-darkBlue cursor-pointer hover:bg-white/5 transition-all duration-200"
            onClick={() => setter({ rightBarRoute: "/add-members" })}
          >
            <FiUserPlus className="size-5 scale-x-[-1]" />
            <span>إضافة أعضاء</span>
          </div>
          <div className="h-2 bg-black"></div>
          <div className="border-t border-black/40">
            {isLoading ? (
              <div className="flex-center mt-10">
                <Loading size="lg" />
              </div>
            ) : (
              <div className="mt-3 space-y-2 ">
                <p className="text-lightBlue px-3">الأعضاء</p>
                <div
                  className="flex flex-col mt-3 w-full overflow-y-auto max-h-[70vh] pr-2
                             scrollbar-thin scrollbar-thumb-gray-500 scrollbar-track-transparent"
                >
                  {groupMembers?.length > 0 ? (
                    groupMembers.map((member) => (
                      <RoomCard
                        key={member._id}
                        {...member}
                        myData={myData}
                        isOnline={isUserOnline(member._id)}
                      />
                    ))
                  ) : (
                    <p className="text-center text-sm text-darkGray mt-4">لا يوجد أعضاء</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </>
      )}
      
      {type === "channel" && selectedRoomData.creator === myID && (
        <>
          <div className="h-2 bg-black"></div>
          <div className="border-t border-black/40">
            {isLoading ? (
              <div className="flex-center mt-10">
                <Loading size="lg" />
              </div>
            ) : (
              <div className="mt-3 space-y-2 ">
                <p className="text-lightBlue px-3">إدارة القناة</p>
                <div
                  className="px-3 py-2 flex items-start gap-4 text-darkBlue cursor-pointer hover:bg-white/5 transition-all duration-200"
                  onClick={() => setter({ rightBarRoute: "/add-subscribers" })}
                >
                  <FiUserPlus className="size-5 scale-x-[-1]" />
                  <span>المشتركين والمشرفين</span>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {isViewerOpen && avatar && typeof avatar === "string" && avatar.startsWith("http") && (
        <ProfileImageViewer imageUrl={avatar} onClose={() => setIsViewerOpen(false)} />
      )}
    </>
  );
};

export default RoomDetails;
