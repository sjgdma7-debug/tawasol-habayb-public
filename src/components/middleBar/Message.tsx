import { useOnScreen } from "@/hook/useOnScreen";
import { dateString, getTimeFromDate, scrollToMessage } from "@/utils";
import { IoEye, IoTimeOutline } from "react-icons/io5";
import { TiPin } from "react-icons/ti";
import Image from "next/image";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import MessageActions from "./MessageActions";
import MessageModel from "@/models/message";
import Voice from "@/models/voice";
import useSockets from "@/stores/useSockets";
import VoiceMessagePlayer from "./voice/VoiceMessagePlayer";
import { IoMdCheckmark } from "react-icons/io";
import useModalStore from "@/stores/modalStore";
import useGlobalStore from "@/stores/globalStore";
import ProfileGradients from "../modules/ProfileGradients";
import { TbExclamationCircle } from "react-icons/tb";
import {
  MdAttachFile,
  MdPictureAsPdf,
  MdDescription,
  MdAudiotrack,
  MdCall,
  MdVideocam,
} from "react-icons/md";
import { BsFileEarmarkText, BsFileEarmarkZip } from "react-icons/bs";
import { HiPlay } from "react-icons/hi2";

// 🎯 دالة عرض الأيقونة المناسبة لكل نوع ملف
const FileIcon = ({ name, type }: { name: string; type: string }) => {
  const ext = name?.split(".").pop()?.toLowerCase() || "";

  if (type?.startsWith("image/"))
    return <MdAttachFile className="size-10 text-green-500" />;
  if (type?.startsWith("video/"))
    return <HiPlay className="size-10 text-cyan-500" />;

  if (
    type?.startsWith("audio/") ||
    ["mp3", "wav", "ogg", "m4a", "aac", "flac"].includes(ext)
  ) {
    return <MdAudiotrack className="size-10 text-purple-500" />;
  }

  if (ext === "pdf") return <MdPictureAsPdf className="size-10 text-red-500" />;
  if (["doc", "docx"].includes(ext))
    return <MdDescription className="size-10 text-blue-500" />;
  if (["txt", "rtf"].includes(ext))
    return <BsFileEarmarkText className="size-10 text-green-500" />;
  if (["zip", "rar", "7z", "tar", "gz"].includes(ext)) {
    return <BsFileEarmarkZip className="size-10 text-orange-500" />;
  }

  return <MdAttachFile className="size-10 text-lightBlue" />;
};

// ✅ دالة تنسيق حجم الملف
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};

// ✅ دالة تحديد نوع الميديا - تعمل مع أي نوع بيانات
const getMediaType = (fileData: any): string => {
  if (!fileData || !fileData.type) return "unknown";
  if (fileData.type === "call") return "call";
  if (fileData.type?.startsWith("image/")) return "image";
  if (fileData.type?.startsWith("video/")) return "video";
  if (fileData.type?.startsWith("audio/")) return "audio";
  const ext = fileData.name?.split(".").pop()?.toLowerCase();
  if (["mp3", "wav", "ogg", "m4a", "aac", "flac"].includes(ext || ""))
    return "audio";
  return "file";
};

// ✅ دالة للتحقق من نوع المكالمة - تعمل مع أي نوع بيانات
const isCallData = (fileData: any): boolean => {
  return fileData?.type === "call";
};

// ✅ تعريف الخصائص
export interface msgDataProps {
  myId: string;
  tempId?: string;
  addReplay: (_id: string) => void;
  edit: (data: MessageModel) => void;
  pin: (_id: string) => void;
  isPv?: boolean;
  voiceData?: Voice | null;
  nextMessage: MessageModel;
  replayedToMessage: MessageModel | null;
  stickyDate?: string | null;
  isLastMessageFromUser: boolean;
  setEditData: (data: Partial<MessageModel>) => void;
  setReplayData: (data: Partial<MessageModel>) => void;
}

const Message = memo((msgData: MessageModel & msgDataProps) => {
  const {
    createdAt,
    message,
    seen,
    _id,
    sender,
    myId,
    roomID,
    replayedTo,
    isEdited,
    addReplay,
    edit,
    pin,
    isPv = false,
    nextMessage,
    voiceData: voiceDataProp,
    stickyDate,
    replayedToMessage,
    status,
    fileData,
  } = msgData;

  const [isMounted, setIsMounted] = useState(false);
  const messageRef = useRef<HTMLDivElement | null>(null);
  const rooms = useSockets((state) => state.rooms);
  const modalSetter = useModalStore((state) => state.setter);

  const isThisMessageSelected = useModalStore(
    useCallback((state) => state.msgData?._id === _id, [_id])
  );

  const setter = useGlobalStore((state) => state.setter);
  const selectedRoom = useGlobalStore((state) => state.selectedRoom);
  const [isInViewport, setIsInViewport] = useState<boolean>(false);
  useOnScreen(messageRef, setIsInViewport);

  const isLastMessageFromUserMemo = useMemo(
    () => !nextMessage || nextMessage.sender._id !== sender._id,
    [nextMessage, sender]
  );

  const isFromMe = useMemo(() => sender?._id === myId, [sender, myId]);

  const isChannel = useMemo(
    () => selectedRoom?.type === "channel",
    [selectedRoom?.type]
  );

  const isMeJoined = useMemo(() => {
    if (!selectedRoom) return false;
    const { participants, admins, creator } = selectedRoom;
    return (
      participants.includes(myId) || admins.includes(myId) || creator === myId
    );
  }, [selectedRoom, myId]);

  const canMessageAction = isMeJoined && isThisMessageSelected;
  const messageTime = useMemo(() => getTimeFromDate(createdAt), [createdAt]);
  const stickyDates = useMemo(() => dateString(createdAt), [createdAt]);

  const openProfile = () => {
    setter({
      RoomDetailsData: sender,
      shouldCloseAll: true,
      isRoomDetailsShown: true,
    });
  };

  const updateModalMsgData = (e: React.MouseEvent) => {
    if (msgData._id === useModalStore.getState().msgData?._id) return;
    modalSetter((prev) => ({
      ...prev,
      clickPosition: { x: e.clientX, y: e.clientY },
      msgData,
      edit,
      reply: () => addReplay(_id),
      pin,
    }));
  };

  useEffect(() => {
    if (!isFromMe && !seen.includes(myId) && isInViewport && rooms) {
      rooms.emit("seenMsg", {
        seenBy: myId,
        sender,
        msgID: _id,
        roomID,
        readTime: new Date().toISOString(),
      });
    }
  }, [_id, isFromMe, isInViewport, myId, roomID, rooms, seen, sender]);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  return (
    <>
      {stickyDate && (
        <div
          className="static top-20 text-xs bg-gray-800/80 w-fit mx-auto text-center rounded-2xl py-1 my-2 px-3 z-10"
          data-date={stickyDates}
        >
          {stickyDate}
        </div>
      )}

      <div
        ref={messageRef}
        className={`chat w-full ${isFromMe ? "chat-end" : "chat-start"} ${
          isMounted ? "" : "opacity-0 scale-0"
        }`}
      >
        {!isFromMe &&
          !isPv &&
          !isChannel &&
          isLastMessageFromUserMemo &&
          (sender.avatar && typeof sender.avatar === 'string' && sender.avatar.trim() ? (
            <div
              className="chat-image avatar cursor-pointer z-5"
              onClick={openProfile}
            >
              <div className="size-8 shrink-0 rounded-full">
                <Image
                  src={sender.avatar}
                  width={32}
                  height={32}
                  alt=""
                  className="size-8 shrink-0 rounded-full object-cover"
                  unoptimized={sender.avatar.includes('cloudinary')}
                />
              </div>
            </div>
          ) : (
            <ProfileGradients
              classNames="size-8 chat-image avatar cursor-pointer z-10"
              id={sender?._id}
              onClick={openProfile}
            >
              {sender.name && sender.name[0] ? sender.name[0].toUpperCase() : "؟"}
            </ProfileGradients>
          ))}

        <div
          id="messageBox"
          onClick={updateModalMsgData}
          onContextMenu={updateModalMsgData}
          className={`relative grid break-all w-fit max-w-[80%] min-w-32 xl:max-w-[60%] py-0 rounded-t-xl transition-all duration-200
            ${
              isFromMe
                ? `${
                    !isLastMessageFromUserMemo ? "rounded-br-md col-start-1" : ""
                  } ${
                    canMessageAction ? "bg-darkBlue/60" : "bg-darkBlue"
                  } rounded-bl-xl rounded-br-lg px-1`
                : `${
                    canMessageAction ? "bg-gray-800/60" : "bg-gray-800"
                  } pr-1 rounded-br-xl pl-1`
            }
            ${
              !isLastMessageFromUserMemo &&
              !isFromMe &&
              `${
                !isPv && !isChannel ? `ml-8` : "ml-0"
              } rounded-bl-md col-start-2`
            }
            ${isLastMessageFromUserMemo ? "chat-bubble" : ""}`}
        >
          {!isFromMe && !isPv && (
            <p
              dir="auto"
              className="w-full text-xs font-vazirBold pt-2 pl-1 text-[#13d4d4]"
            >
              {isChannel
                ? selectedRoom?.name
                : sender.name + " " + sender.lastName}
            </p>
          )}

          {/* محتوى الرسالة */}
          <div className="flex flex-col text-sm gap-1 p-1 mt-1 break-words mb-3">
            {replayedToMessage &&
              !replayedToMessage.hideFor.includes(myId) && (
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    scrollToMessage(replayedToMessage?._id);
                  }}
                  className={`${
                    isFromMe
                      ? "bg-lightBlue/20 rounded-l-md"
                      : "bg-green-500/15 rounded-r-md"
                  } cursor-pointer rounded-md text-sm relative w-full py-1 px-3 overflow-hidden`}
                >
                  <span
                    className={`absolute ${
                      isFromMe ? "bg-white" : "bg-green-500"
                    } left-0 inset-y-0 w-[3px] h-full`}
                  ></span>
                  <p className="font-vazirBold text-xs break-words text-start line-clamp-1 text-ellipsis">
                    {replayedTo?.username}
                  </p>
                  <p className="font-thin break-words line-clamp-1 text-left text-xs whitespace-pre-wrap">
                    {replayedTo?.message || "رسالة صوتية"}
                  </p>
                </div>
              )}

            {/* الرسائل الصوتية - لا تعرض إذا كانت مكالمة */}
            {voiceDataProp && !isCallData(fileData) && fileData?.type !== "call" && (
              <div className="flex items-center gap-3 bg-inherit w-full mt-2">
                <VoiceMessagePlayer
                  _id={_id}
                  voiceDataProp={voiceDataProp}
                  msgData={msgData}
                  isFromMe={isFromMe}
                  myId={myId}
                  roomID={roomID}
                />
              </div>
            )}

            {/* الملفات */}
            {fileData && (
              <div className="mt-2">
                {(() => {
                  // ✅ رسائل المكالمات - التحقق المباشر
                  if (isCallData(fileData)) {
                    const { callType, callStatus, duration } = fileData as any;

                    const formatDuration = (seconds: number) => {
                      if (seconds < 60) return `${seconds} ثانية`;
                      const minutes = Math.floor(seconds / 60);
                      const secs = seconds % 60;
                      return secs > 0 ? `${minutes} دقيقة و ${secs} ثانية` : `${minutes} دقيقة`;
                    };

                    return (
                      <div className={`flex items-center gap-3 p-3 rounded-lg ${
                        callStatus === 'missed' ? 'bg-red-500/20' : 
                        callStatus === 'rejected' ? 'bg-orange-500/20' : 
                        'bg-green-500/20'
                      }`}>
                        <div className="text-2xl">
                          {callType === 'video' ? (
                            <MdVideocam className={
                              callStatus === 'missed' ? 'text-red-500' : 
                              callStatus === 'rejected' ? 'text-orange-500' : 
                              'text-green-500'
                            } />
                          ) : (
                            <MdCall className={
                              callStatus === 'missed' ? 'text-red-500' : 
                              callStatus === 'rejected' ? 'text-orange-500' : 
                              'text-green-500'
                            } />
                          )}
                        </div>
                        <div className="flex-1">
                          <p className="font-vazirBold text-sm">
                            {callType === 'video' ? 'مكالمة فيديو' : 'مكالمة صوتية'}
                          </p>
                          <p className="text-xs text-darkGray">
                            {callStatus === 'ended' && duration ? formatDuration(duration) : 
                             callStatus === 'missed' ? 'مكالمة فائتة' :
                             callStatus === 'rejected' ? 'مكالمة مرفوضة' :
                             callStatus === 'cancelled' ? 'مكالمة ملغاة' : 
                             'لم يتم الرد'}
                          </p>
                        </div>
                        {callStatus === 'ended' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              // إعادة الاتصال بنفس النوع
                              const buttonSelector = `[data-call-button="${callType}"]`;
                              const callButton = document.querySelector(buttonSelector);
                              if (callButton) {
                                (callButton as HTMLElement).click();
                              }
                            }}
                            className="size-10 rounded-full bg-green-500 hover:bg-green-600 flex items-center justify-center transition-all"
                            title="إعادة الاتصال"
                          >
                            {callType === 'video' ? <MdVideocam size={20} /> : <MdCall size={20} />}
                          </button>
                        )}
                      </div>
                    );
                  }

                  const mediaType = getMediaType(fileData);
                  
                  // عرض شريط التقدم إذا كان الرفع قيد التنفيذ
                  if (status === "pending" && msgData.uploadProgress !== undefined) {
                    return (
                      <div className="relative max-w-xs">
                        {/* معاينة الملف أثناء الرفع */}
                        {mediaType === "image" && fileData.url && (
                          <div className="relative">
                            <Image
                              src={fileData.url}
                              alt="جاري الرفع..."
                              width={300}
                              height={300}
                              className="rounded-lg object-cover max-h-80 opacity-50"
                              loading="lazy"
                            />
                            <div className="absolute inset-0 bg-black/40 rounded-lg flex flex-col items-center justify-center gap-2">
                              <div className="w-3/4 bg-gray-700 rounded-full h-2 overflow-hidden">
                                <div
                                  className="bg-gradient-to-r from-lightBlue to-green-500 h-full transition-all duration-300 rounded-full"
                                  style={{ width: `${msgData.uploadProgress}%` }}
                                />
                              </div>
                              <p className="text-white text-xs">
                                {msgData.uploadProgress}%
                              </p>
                            </div>
                          </div>
                        )}
                        {mediaType !== "image" && (
                          <div className="p-4 bg-gradient-to-r from-blue-500/20 to-cyan-500/20 rounded-lg">
                            <div className="flex items-center gap-3 mb-3">
                              <FileIcon name={fileData.name || ""} type={fileData.type || ""} />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate text-white">
                                  {fileData.name || "ملف"}
                                </p>
                                <p className="text-xs text-gray-400">
                                  جاري الرفع...
                                </p>
                              </div>
                            </div>
                            <div className="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
                              <div
                                className="bg-gradient-to-r from-lightBlue to-green-500 h-full transition-all duration-300 rounded-full"
                                style={{ width: `${msgData.uploadProgress}%` }}
                              />
                            </div>
                            <p className="text-white text-xs text-center mt-1">
                              {msgData.uploadProgress}%
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  }
                  
                  switch (mediaType) {
                    case "image":
                      return fileData.url ? (
                        <div
                          className="relative max-w-xs group cursor-pointer"
                          onClick={(e) => {
                            e.stopPropagation();
                            modalSetter({ imageViewerUrl: fileData.url });
                          }}
                        >
                          <Image
                            src={fileData.url}
                            alt="صورة"
                            width={300}
                            height={300}
                            className="rounded-lg object-cover transition-all group-hover:opacity-90 max-h-80"
                            loading="lazy"
                            unoptimized={fileData.url.includes("cloudinary")}
                          />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all rounded-lg flex items-center justify-center">
                            <div className="opacity-0 group-hover:opacity-100 transition-all text-white text-sm bg-black/70 px-3 py-2 rounded-full">
                              عرض بالحجم الكامل
                            </div>
                          </div>
                        </div>
                      ) : null;

                    case "video":
                      return fileData.url ? (
                        <div className="max-w-xs">
                          <video
                            src={fileData.url}
                            controls
                            className="w-full rounded-lg max-h-80"
                            preload="metadata"
                          />
                        </div>
                      ) : null;

                    case "audio":
                      return fileData.url ? (
                        <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-lg max-w-xs">
                          <MdAudiotrack className="size-12 text-purple-400 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate text-white">
                              {fileData.name || "ملف صوتي"}
                            </p>
                            <p className="text-xs text-gray-400">
                              {fileData.size ? formatFileSize(fileData.size) : "0 B"} • ملف صوتي
                            </p>
                            <audio
                              src={fileData.url}
                              controls
                              className="w-full mt-2 h-8"
                              preload="metadata"
                            />
                          </div>
                        </div>
                      ) : null;

                    default:
                      return fileData.url ? (
                        <div
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!fileData.url) {
                              console.error("File URL is missing!");
                              return;
                            }
                            
                            // تحميل الملف مباشرة بدون فتح رابط Cloudinary
                            const downloadFile = async () => {
                              try {
                                const response = await fetch(fileData.url!);
                                const blob = await response.blob();
                                const url = window.URL.createObjectURL(blob);
                                const link = document.createElement('a');
                                link.href = url;
                                link.download = fileData.name || 'file';
                                document.body.appendChild(link);
                                link.click();
                                document.body.removeChild(link);
                                window.URL.revokeObjectURL(url);
                              } catch (error) {
                                console.error('Error downloading file:', error);
                                // في حالة الفشل، استخدم الطريقة البديلة
                                window.open(fileData.url!, '_blank');
                              }
                            };
                            
                            downloadFile();
                          }}
                          className="flex items-center gap-3 p-4 bg-gradient-to-r from-blue-500/20 to-cyan-500/20 rounded-lg hover:from-blue-500/30 hover:to-cyan-500/30 transition-all max-w-xs group cursor-pointer"
                        >
                          <FileIcon name={fileData.name || ""} type={fileData.type || ""} />

                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate text-white">
                              {fileData.name || "ملف"}
                            </p>
                            <p className="text-xs text-gray-400">
                              {fileData.size ? formatFileSize(fileData.size) : "0 B"} • انقر للتحميل
                            </p>
                          </div>

                          <div className="opacity-60 group-hover:opacity-100 transition-all">
                            <span className="text-lightBlue text-lg">⬇</span>
                          </div>
                        </div>
                      ) : null;
                  }
                })()}
              </div>
            )}

            {/* النص */}
            {message &&
              message.trim() &&
              (!fileData ||
                (fileData &&
                  message !== fileData.name &&
                  message.trim() !== fileData.name)) && (
                <p
                  dir="auto"
                  className="text-white break-all whitespace-pre-wrap mt-2"
                >
                  {message}
                </p>
              )}
          </div>

          {/* الوقت + الحالة */}
          <span
            className={`flex items-end justify-end gap-1.5 absolute bottom-0 right-1 w-full text-sm ${
              isFromMe ? "text-[#B7D9F3]" : "text-darkGray"
            } text-right`}
          >
            {isChannel && (
              <div className="flex items-end text-[10px]">
                <IoEye size={14} className="mb-[1.2px] mr-[2px]" />
                {seen.length > 0 ? seen.length : ""}
              </div>
            )}
            {msgData?.pinnedAt && <TiPin data-aos="zoom-in" className="size-4" />}
            <p
              className={`whitespace-nowrap text-[10px] ${!isFromMe && "pr-1"}`}
            >
              {isEdited && "مُعدّل "} {messageTime}
            </p>
            {isFromMe && !isChannel && (
              <>
                {status === "pending" && (
                  <IoTimeOutline className="size-4 mb-0.5" />
                )}
                {status === "failed" && (
                  <TbExclamationCircle className="size-4 mb-0.5 text-red-500" />
                )}
                {status !== "pending" &&
                  status !== "failed" &&
                  (seen?.length ? (
                    <Image
                      src="/shapes/seen.svg"
                      width={15}
                      height={15}
                      className="size-4 mb-0.5 duration-500"
                      alt="seen"
                    />
                  ) : (
                    <IoMdCheckmark
                      width={15}
                      height={15}
                      className="size-4 mb-0.5 rounded-full bg-center duration-500"
                    />
                  ))}
              </>
            )}
          </span>
        </div>

        {canMessageAction && (
          <MessageActions isFromMe={isFromMe} msgData={msgData} />
        )}
      </div>
    </>
  );
});

Message.displayName = "Message";

export default Message;
