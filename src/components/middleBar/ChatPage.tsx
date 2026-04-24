"use client";

import {
  lazy,
  Suspense,
  useEffect,
  useMemo,
  useState,
  useCallback,
} from "react";
import { IoIosArrowUp, IoMdArrowRoundBack } from "react-icons/io";
import Image from "next/image";
import { PiDotsThreeVerticalBold } from "react-icons/pi";
import MessageSender from "./MessageInput";
import JoinToRoom from "./JoinToRoom";
import useUserStore from "@/stores/userStore";
import useGlobalStore from "@/stores/globalStore";
import useSockets from "@/stores/useSockets";
import MessageModel from "@/models/message";
import { FiBookmark } from "react-icons/fi";
import Loading from "../modules/ui/Loading";
import User from "@/models/user";
import DropDown from "../modules/ui/DropDown";
import { IoLogOutOutline } from "react-icons/io5";
import { AiOutlineDelete } from "react-icons/ai";
import useModalStore from "@/stores/modalStore";
import Modal from "../modules/ui/Modal";
import { scrollToMessage } from "@/utils";
import ProfileGradients from "../modules/ProfileGradients";
import { MdCall, MdVideocam } from "react-icons/md";
import useCallStore from "@/stores/callStore";
import { toaster } from "@/utils";

const ChatBox = lazy(() => import("./ChatBox"));

export interface msgDate {
  date: string;
  usedBy: string;
}

const ChatPage = () => {
  const {
    _id: myID,
    name: myName,
    setter: userDataUpdater,
  } = useUserStore((state) => state);
  const { rooms: roomsSocket } = useSockets((state) => state);
  const { selectedRoom, onlineUsers, isRoomDetailsShown, setter } =
    useGlobalStore((state) => state) || {};
  const { setter: modalSetter } = useModalStore((state) => state);
  const { startCall } = useCallStore();
  const [typings, setTypings] = useState<string[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [showRoomOptions, setShowRoomOptions] = useState(false);
  const [replayData, setReplayData] = useState<string | null>(null);
  const [editData, setEditData] = useState<MessageModel | null>(null);
  const [imageLoadError, setImageLoadError] = useState(false);
  
  // ✅ معالجة آمنة للغرفة المحددة
  const { messages = [], type = "private", participants = [] } = selectedRoom || {};

  // ✅ فحص وجود الغرفة قبل العرض
  if (!selectedRoom) {
    return null; // لا تعرض شيئاً إذا لم توجد غرفة محددة
  }

  // Avatar, name and _id information from room or user information (in private mode)
  const {
    avatar = "",
    name = "",
    lastName = "",
    _id,
  } = useMemo(() => {
    const roomOrUser =
      type === "private"
        ? participants?.find(
            (data) => typeof data !== "string" && data?._id !== myID
          ) ||
          participants?.find(
            (data) => typeof data !== "string" && data?._id === myID
          ) ||
          selectedRoom
        : selectedRoom || null;

    if (roomOrUser && typeof roomOrUser !== "string") {
      return {
        avatar: roomOrUser.avatar || "",
        name: roomOrUser.name || "",
        lastName: (roomOrUser as User).lastName || "",
        _id: roomOrUser._id || "",
      };
    }
    return { avatar: "", name: "", _id: "", lastName: "" };
  }, [myID, participants, selectedRoom, type]);

  // إعادة تعيين خطأ الصورة عند تغيير الصورة
  useEffect(() => {
    setImageLoadError(false);
  }, [avatar]);

  // Calculate the replay message based on replayData (which is the message ID)
  const replayDataMsg = useMemo(() => {
    return messages?.find((msg) => msg._id === replayData);
  }, [messages, replayData]);

  // Calculate pinned messages from messages
  const pinnedMessages = useMemo(() => {
    return messages?.filter((msg) => msg.pinnedAt) || [];
  }, [messages]);

  // Calculate the number of online members (to display in the header)
  const onlineMembersCount = useMemo(() => {
    if (!onlineUsers?.length || !participants?.length) return 0;
    return participants.filter((pId) =>
      onlineUsers.some((data) => data.userID === pId)
    ).length;
  }, [onlineUsers, participants]);

  // Define an event handler for returning (back) from the room
  const handleBack = useCallback(() => {
    setter({ selectedRoom: null, isRoomDetailsShown: false });
  }, [setter]);

  // Event handler for receiving pinned message
  const handlePinMessage = useCallback(
    (msgId: string) => {
      const updatedMessages = messages.map((msg) =>
        msg._id === msgId
          ? { ...msg, pinnedAt: msg.pinnedAt ? null : String(Date.now()) }
          : msg
      );
      setter({
        selectedRoom: {
          ...selectedRoom!,
          messages: updatedMessages,
        },
      });
    },
    [messages, selectedRoom, setter]
  );

  // Register an event listener for the "pinMessage" event from the server
  useEffect(() => {
    roomsSocket?.on("pinMessage", handlePinMessage);
    return () => {
      roomsSocket?.off("pinMessage", handlePinMessage);
    };
  }, [roomsSocket, handlePinMessage]);

  // Remove user from selected group or channel
  const leaveRoom = () => {
    const newParticipants = participants.filter(
      (participant) => participant !== myID
    );
    roomsSocket?.emit("updateRoomData", {
      roomID: selectedRoom?._id,
      participants: [...newParticipants],
    });
    roomsSocket?.once("updateRoomData", ({ _id, participants }) => {
      userDataUpdater((prev) => ({
        ...prev,
        rooms: prev.rooms.map((room) =>
          room._id === _id ? { ...room, participants } : room
        ),
      }));
      setter({
        selectedRoom: { ...selectedRoom!, participants },
      });
    });
  };

  // التحقق من حالة الحظر
  const { blockedUsers = [] } = useUserStore((state) => state);
  const isUserBlocked = useMemo(() => {
    return blockedUsers?.includes(_id) || false;
  }, [_id, blockedUsers]);

  // معالج حظر/إلغاء حظر المستخدم
  const handleBlockUser = useCallback(() => {
    setShowRoomOptions(false);
    
    if (isUserBlocked) {
      // إلغاء الحظر
      modalSetter((prev) => ({
        ...prev,
        isOpen: true,
        title: "إلغاء حظر المستخدم",
        bodyText: `هل تريد إلغاء حظر ${name || ""}؟`,
        onSubmit: async () => {
          roomsSocket?.emit('unblockUser', { 
            userID: myID, 
            targetUserID: _id 
          });
          
          roomsSocket?.once('unblockUser', ({ success, blockedUsers }) => {
            if (success) {
              userDataUpdater((prev) => ({
                ...prev,
                blockedUsers: blockedUsers
              }));
              toaster("success", "تم إلغاء حظر المستخدم بنجاح");
            }
          });
        },
      }));
    } else {
      // حظر المستخدم
      modalSetter((prev) => ({
        ...prev,
        isOpen: true,
        title: "حظر المستخدم",
        bodyText: `هل تريد حظر ${name || ""}؟ لن تتمكن من إرسال أو استقبال رسائل منه.`,
        onSubmit: async () => {
          roomsSocket?.emit('blockUser', { 
            userID: myID, 
            targetUserID: _id 
          });
          
          roomsSocket?.once('blockUser', ({ success, blockedUsers }) => {
            if (success) {
              userDataUpdater((prev) => ({
                ...prev,
                blockedUsers: blockedUsers
              }));
              toaster("success", "تم حظر المستخدم بنجاح");
            }
          });
        },
      }));
    }
  }, [isUserBlocked, _id, name, myID, roomsSocket, modalSetter, userDataUpdater]);

  // حذف جميع الرسائل من المحادثة
  const handleDeleteAllMessages = useCallback(() => {
    setShowRoomOptions(false);
    modalSetter((prev) => ({
      ...prev,
      isOpen: true,
      title: "حذف جميع الرسائل",
      bodyText: "هل تريد حذف جميع الرسائل في هذه المحادثة؟",
      isCheckedText: "حذف للجميع أيضاً",
      onSubmit: async () => {
        const currentIsChecked = useModalStore.getState().isChecked;
        
        // حذف جميع الرسائل
        messages.forEach((msg) => {
          roomsSocket?.emit("deleteMsg", {
            forAll: currentIsChecked,
            msgID: msg._id,
            roomID: selectedRoom?._id,
          });
        });
        
        toaster("success", "تم حذف جميع الرسائل بنجاح");
      },
    }));
  }, [messages, selectedRoom, roomsSocket, modalSetter]);

  const dropDownItems = [
    {
      title: "Go to first message",
      icon: <IoIosArrowUp className="size-5 text-gray-400" />,
      onClick: () => {
        setShowRoomOptions(false);
        const firstMessage = messages[0]?._id;
        if (firstMessage) {
          scrollToMessage(messages[0]?._id);
        }
      },
    },
    messages.length > 0 && {
      title: "حذف جميع الرسائل",
      icon: <AiOutlineDelete className="size-5 text-gray-400" />,
      onClick: handleDeleteAllMessages,
    },
    type === "private" && _id !== myID && {
      title: isUserBlocked ? "إلغاء حظر المستخدم" : "حظر المستخدم",
      icon: <IoLogOutOutline className="size-5 text-gray-400" />,
      onClick: handleBlockUser,
    },
    type !== "private" && {
      title: type === "group" ? "Leave group" : "Leave Channel",
      icon: <IoLogOutOutline className="size-5 text-gray-400" />,
      onClick: () => {
        setShowRoomOptions(false);
        modalSetter((prev) => ({
          ...prev,
          isOpen: true,
          title: type === "group" ? "Leave group" : "Leave Channel",
          bodyText: `Are you sure you want to leave ${selectedRoom?.name}?`,
          onSubmit: async () => {
            leaveRoom();
            setTimeout(() => {
              setter({ selectedRoom: null });
            }, 500);
          },
        }));
      },
    },
  ]
    .map((item) => item || null)
    .filter((item) => item !== null);

  // Handle voice call
  const handleVoiceCall = async () => {
    if (type !== "private") {
      toaster("error", "المكالمات متاحة فقط في المحادثات الخاصة");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      const receiver = participants?.find(
        (p) => typeof p !== "string" && p._id !== myID
      ) as User;

      if (!receiver) {
        toaster("error", "لم يتم العثور على المستخدم");
        return;
      }

      // ✅ إصلاح الحصول على بيانات المستخدم الحالية
      const currentUserData = useUserStore.getState();
      
      // Set caller info before starting call
      useCallStore.setState({
        caller: {
          _id: myID,
          name: myName,
          lastName: currentUserData.lastName || "",
          avatar: currentUserData.avatar,
          username: currentUserData.username,
        },
      });

      startCall(
        {
          _id: receiver._id,
          name: receiver.name,
          lastName: receiver.lastName,
          avatar: receiver.avatar,
          username: receiver.username,
        },
        "voice",
        selectedRoom!._id,
        stream
      );
    } catch (error) {
      console.error("Error starting voice call:", error);
      toaster("error", "فشل في الوصول إلى الميكروفون");
    }
  };

  // Handle video call
  const handleVideoCall = async () => {
    if (type !== "private") {
      toaster("error", "المكالمات متاحة فقط في المحادثات الخاصة");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: true, 
        video: true 
      });
      
      const receiver = participants?.find(
        (p) => typeof p !== "string" && p._id !== myID
      ) as User;

      if (!receiver) {
        toaster("error", "لم يتم العثور على المستخدم");
        return;
      }

      // ✅ إصلاح الحصول على بيانات المستخدم الحالية
      const currentUserData = useUserStore.getState();

      // Set caller info before starting call
      useCallStore.setState({
        caller: {
          _id: myID,
          name: myName,
          lastName: currentUserData.lastName || "",
          avatar: currentUserData.avatar,
          username: currentUserData.username,
        },
      });

      startCall(
        {
          _id: receiver._id,
          name: receiver.name,
          lastName: receiver.lastName,
          avatar: receiver.avatar,
          username: receiver.username,
        },
        "video",
        selectedRoom!._id,
        stream
      );
    } catch (error) {
      console.error("Error starting video call:", error);
      toaster("error", "فشل في الوصول إلى الكاميرا والميكروفون");
    }
  };

  return (
    <div
      data-aos="fade"
      style={{ transform: "none" }}
      className="relative h-dvh flex flex-col chatBackground w-full"
    >
      {/* شريط التحذير عند حظر المستخدم */}
      {type === "private" && _id !== myID && isUserBlocked && (
        <div className="w-full bg-red-600/90 text-white px-4 py-3 flex items-center justify-between">
          <div className="flex-1">
            <p className="text-sm font-vazirBold">تم حظر هذا المستخدم</p>
            <p className="text-xs opacity-90">قم بإلغاء الحظر لإرسال واستقبال الرسائل</p>
          </div>
          <button
            onClick={handleBlockUser}
            className="bg-white text-red-600 px-4 py-2 rounded-md text-sm font-vazirBold hover:bg-gray-100 transition-colors"
          >
            إلغاء الحظر
          </button>
        </div>
      )}
      
      {/* Chat Header */}
      <div
        id="chatContentHeader"
        className="sticky top-0 flex items-center justify-between h-17 p-2 w-full border-b border-white/5 bg-leftBarBg"
        style={{ zIndex: "20" }}
      >
        <div className="flex items-center gap-5 w-full overflow-hidden">
          <IoMdArrowRoundBack
            onClick={handleBack}
            className="cursor-pointer size-6 text-white/80"
          />

          <div
            onClick={() =>
              setter({
                isRoomDetailsShown: !isRoomDetailsShown,
                RoomDetailsData: null,
              })
            }
            className="flex items-center cursor-pointer gap-3 truncate max-w-[80%]"
          >
            {/* تحسين عرض الصورة في رأس المحادثة */}
            {_id === myID ? (
              <div className="size-11 bg-cyan-700 rounded-full shrink-0 flex-center text-white text-2xl">
                <FiBookmark />
              </div>
            ) : avatar && !imageLoadError ? (
              <Image
                src={avatar}
                width={44}
                height={44}
                className="size-11 mt-auto object-center shrink-0 object-cover rounded-full"
                alt=""
                onError={() => setImageLoadError(true)}
                onLoad={() => setImageLoadError(false)}
                unoptimized={avatar.includes('cloudinary')}
              />
            ) : (
              <ProfileGradients
                classNames="size-11 text-center text-xl flex-center"
                id={_id}
              >
                {name && name.length > 0 ? name[0].toUpperCase() : "؟"}
              </ProfileGradients>
            )}

            <div className="flex justify-center flex-col gap-1 truncate">
              <h3 className="text-base font-vazirBold truncate">
                {_id === myID ? "الرسائل المحفوظة" : `${name || ""} ${lastName || ""}`.trim()}
              </h3>

              <div className="text-sm text-darkGray font-vazirBold line-clamp-1 whitespace-normal text-nowrap">
                {selectedRoom?.type !== "channel" &&
                typings.length &&
                typings.filter((tl) => tl !== myName).length ? (
                  <div className="text-lightBlue whitespace-normal line-clamp-1">
                    {typings.join(", ") +
                      (typings.length > 1 ? " يكتبون" : " يكتب") +
                      "... "}
                    <span className="animate-ping font-extrabold font-vazirBold">
                      
                    </span>
                  </div>
                ) : (
                  <>
                    {type === "private" ? (
                      avatar === null ? (
                        // ✅ إذا الصورة بالضبط null → معناها أنا محظور
                        "آخر ظهور منذ زمن طويل"
                      ) : onlineUsers.some((data) => data.userID === _id) ? (
                        <span className="text-lightBlue">متصل</span>
                      ) : (
                        "ظهر مؤخراً"
                      )
                    ) : type === "group" ? (
                      `${participants.length} عضو ${
                        onlineMembersCount
                          ? ", " + onlineMembersCount + " متصل"
                          : ""
                      }`
                    ) : (
                      `${participants.length} مشترك`
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 justify-end">
          {/* Call Buttons - Only show for private chats */}
          {type === "private" && _id !== myID && (
            <>
              <button
                onClick={handleVideoCall}
                className="size-10 rounded-full hover:bg-white/10 flex items-center justify-center transition-all"
                title="مكالمة فيديو"
                data-call-button="video"
              >
                <MdVideocam className="text-lightBlue text-2xl" />
              </button>
              <button
                onClick={handleVoiceCall}
                className="size-10 rounded-full hover:bg-white/10 flex items-center justify-center transition-all"
                title="مكالمة صوتية"
                data-call-button="voice"
              >
                <MdCall className="text-lightBlue text-2xl" />
              </button>
            </>
          )}
          
          <DropDown
            button={
              <PiDotsThreeVerticalBold
                onClick={() => setShowRoomOptions(true)}
                size={20}
                className="w-fit cursor-pointer mr-2"
              />
            }
            dropDownItems={dropDownItems}
            isOpen={showRoomOptions}
            setIsOpen={setShowRoomOptions}
            classNames="top-5 right-0 w-fit text-nowrap"
          />
        </div>
      </div>

      {/* Chat Message */}
      <Suspense
        fallback={
          <div className="size-full flex-center">
            <Loading size="lg" />
          </div>
        }
      >
        <ChatBox
          setTypings={setTypings}
          pinnedMessages={pinnedMessages}
          setEditData={setEditData}
          setReplayData={setReplayData}
          isLoaded={isLoaded}
          _id={_id}
          setIsLoaded={setIsLoaded}
        />
      </Suspense>

      {/* If the room type is private or the user is a member of a group, MessageSender is displayed */}
      {type === "private" || (participants as string[]).includes(myID) ? (
        <MessageSender
          replayData={replayDataMsg}
          editData={editData!}
          closeEdit={() => setEditData(null)}
          closeReplay={() => setReplayData(null)}
        />
      ) : (
        <JoinToRoom
          roomData={selectedRoom!}
          roomSocket={roomsSocket}
          userID={myID}
        />
      )}
      {isRoomDetailsShown && (
        <span
          onClick={() => setter({ isRoomDetailsShown: false })}
          className="inset-0 xl:static absolute transition-all duration-200"
        ></span>
      )}
      <Modal />
    </div>
  );
};

export default ChatPage;
