import { BsEmojiSmile } from "react-icons/bs";
import { IoMdClose } from "react-icons/io";
import { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MdAttachFile, MdModeEditOutline, MdOutlineDone } from "react-icons/md";
import { BsFillReplyFill } from "react-icons/bs";
import VoiceMessageRecorder from "./voice/VoiceMessageRecorder";
import Message from "@/models/message";
import useGlobalStore, { GlobalStoreProps } from "@/stores/globalStore";
import useUserStore from "@/stores/userStore";
import useSockets from "@/stores/useSockets";
import { RiSendPlaneFill } from "react-icons/ri";
import { FaRegKeyboard } from "react-icons/fa6";
import { scrollToMessage, toaster } from "@/utils";
import { uploadToCloudinary, isFileTypeSupported } from "@/utils/file/CloudinaryUpload";
import EmojiPicker from "../modules/EmojiPicker";
import FilePreview from "../modules/FilePreview";
import { v4 as uuidv4 } from "uuid";
import { pendingMessagesService } from "@/utils/pendingMessages";
import { isMobile } from "@/utils/isMobile";


interface Props {
  replayData?: Partial<Message>;
  editData?: Partial<Message>;
  closeReplay: () => void;
  closeEdit: () => void;
}

const MessageInput = ({
  replayData,
  editData,
  closeReplay,
  closeEdit,
}: Props) => {
  const [text, setText] = useState("");
  const typingTimer = useRef<NodeJS.Timeout | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const inputBoxRef = useRef<HTMLDivElement | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isEmojiOpen, setIsEmojiOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedRoom = useGlobalStore((state) => state?.selectedRoom);
  const userRooms = useUserStore((state) => state.rooms);
  const { rooms } = useSockets((state) => state);
  const myData = useUserStore((state) => state);
  const setter = useGlobalStore((state) => state.setter);
  const roomId = selectedRoom?._id;
  
  // التحقق من الحظر
  const isUserBlocked = useMemo(() => {
    if (selectedRoom?.type === 'private') {
      const otherUser = selectedRoom.participants?.find(
        (p) => typeof p !== 'string' && p._id !== myData._id
      );
      if (otherUser && typeof otherUser !== 'string') {
        return myData.blockedUsers?.includes(otherUser._id) || false;
      }
    }
    return false;
  }, [selectedRoom, myData._id, myData.blockedUsers]);

  //Helper function to reset the height of TextArea
  const resetTextAreaHeight = () => {
    if (inputRef.current) {
      inputRef.current.style.height = "24px";
    }
  };

  // Auto-resize TextArea
  const resizeTextArea = useCallback(() => {
    if (inputRef.current) {
      inputRef.current.style.height = "24px";
      inputRef.current.style.height = `${Math.min(
        inputRef.current.scrollHeight,
        100
      )}px`;
      inputRef.current.style.overflow =
        inputRef.current.scrollHeight > inputRef.current.offsetHeight
          ? "auto"
          : "hidden";
    }
  }, []);

  // Clean up after sending or editing a message
  const cleanUpAfterSendingMsg = useCallback(() => {
    resetTextAreaHeight();
    closeReplay();
    closeEdit();
    setText("");
    inputRef.current?.focus();
    if (roomId) localStorage.removeItem(roomId);
  }, [closeReplay, closeEdit, roomId]);

  // Send new message
  const sendWithRetry = useCallback(
    (payload: {
      roomID: string;
      message: string;
      sender: {
        _id: string;
        name: string;
        [key: string]: string | undefined;
      };
      replayData?: {
        targetID: string;
        replayedTo: {
          message: string;
          msgID: string;
          username: string;
        };
      } | null;
      tempId: string;
    }) => {
      const tempId = payload.tempId;

      // Add to pending messages storage
      const pendingMessage = pendingMessagesService.addPendingMessage(
        payload.roomID,
        {
          _id: tempId,
          message: payload.message,
          sender: myData,
          roomID: payload.roomID,
          status: "pending" as const,
          replayedTo: payload.replayData ? payload.replayData.replayedTo : null,
          createdAt: new Date().toISOString(),
          isEdited: false,
          seen: [],
          readTime: null,
          pinnedAt: null,
          hideFor: [],
          updatedAt: new Date().toISOString(),
          replays: [],
          voiceData: null,
          tempId,
        }
      );

      // Add local message to state
      setter(
        (prev: GlobalStoreProps): Partial<GlobalStoreProps> => ({
          selectedRoom: prev.selectedRoom
            ? {
                ...prev.selectedRoom,
                messages: [
                  ...(prev.selectedRoom?.messages ?? []),
                  pendingMessage,
                ],
              }
            : null,
        })
      );

      // Check if online before attempting to send
      if (!navigator.onLine) {
        // Will retry when connection is restored
        return;
      }

      // Set 30-second timeout for failed status
      const timeoutId = setTimeout(() => {
        setter(
          (prev: GlobalStoreProps): Partial<GlobalStoreProps> => ({
            selectedRoom: prev.selectedRoom
              ? {
                  ...prev.selectedRoom,
                  messages: prev.selectedRoom.messages.map((msg) =>
                    msg._id === tempId && msg.status === "pending"
                      ? { ...msg, status: "failed" }
                      : msg
                  ),
                }
              : null,
          })
        );

        // Update pending storage
        const pending = pendingMessagesService.getPendingMessages(
          payload.roomID
        );
        const updated = pending.map((msg) =>
          msg._id === tempId ? { ...msg, status: "failed" as const } : msg
        );
        pendingMessagesService.savePendingMessages(payload.roomID, updated);
      }, 30000); // 30 seconds

      const attemptSend = (attempts: number = 0) => {
        const startTime = Date.now();

        rooms?.emit(
          "newMessage",
          payload,
          (response: { success: boolean; _id: string }) => {
            // Clear the 30-second timeout
            clearTimeout(timeoutId);

            if (response?.success) {
              // Update message with actual _id and status 'sent'
              setter(
                (prev: GlobalStoreProps): Partial<GlobalStoreProps> => ({
                  selectedRoom: prev.selectedRoom
                    ? {
                        ...prev.selectedRoom,
                        messages: prev.selectedRoom.messages.map((msg) =>
                          msg._id === tempId
                            ? { ...msg, _id: response._id, status: "sent" }
                            : msg
                        ),
                      }
                    : null,
                })
              );

              // Remove from pending storage
              pendingMessagesService.removePendingMessage(
                payload.roomID,
                tempId
              );
            } else {
              attempts++;
              const elapsed = Date.now() - startTime;

              if (elapsed < 30000) {
                // 30 seconds timeout
                // Exponential backoff: 1s, 2s, 4s, 8s
                const delay = Math.min(1000 * Math.pow(2, attempts - 1), 8000);
                setTimeout(() => attemptSend(attempts), delay);
              } else {
                // Set to failed after 30 seconds
                setter(
                  (prev: GlobalStoreProps): Partial<GlobalStoreProps> => ({
                    selectedRoom: prev.selectedRoom
                      ? {
                          ...prev.selectedRoom,
                          messages: prev.selectedRoom.messages.map((msg) =>
                            msg._id === tempId
                              ? { ...msg, status: "failed" }
                              : msg
                          ),
                        }
                      : null,
                  })
                );

                // Update pending storage
                const pending = pendingMessagesService.getPendingMessages(
                  payload.roomID
                );
                const updated = pending.map((msg) =>
                  msg._id === tempId
                    ? {
                        ...msg,
                        status: "failed" as const,
                        retryCount: attempts,
                      }
                    : msg
                );
                pendingMessagesService.savePendingMessages(
                  payload.roomID,
                  updated
                );
              }
            }
          }
        );
      };

      attemptSend();
    },
    [rooms, myData, setter]
  );

  const sendMessage = useCallback(() => {
    const isExistingRoom = userRooms.some((room) => room._id === roomId);

    const tempId = uuidv4(); // Generate tempId
    const payload = {
      roomID: roomId,
      message: text.trim().replace(/\n+$/, ""), // Remove only trailing newlines
      sender: myData,
      replayData: replayData
        ? {
            targetID: replayData._id,
            replayedTo: {
              message: replayData.message,
              msgID: replayData._id,
              username: replayData.sender?.name,
            },
          }
        : null,
      tempId: tempId,
    };

    if (isExistingRoom) {
      if (roomId) {
        sendWithRetry({
          message: payload.message,
          sender: {
            _id: payload.sender._id,
            name: payload.sender.name,
          },
          replayData: payload.replayData
            ? {
                targetID: payload.replayData.targetID!,
                replayedTo: {
                  message: payload.replayData.replayedTo.message!,
                  msgID: payload.replayData.replayedTo.msgID!,
                  username: payload.replayData.replayedTo.username!,
                },
              }
            : null,
          tempId: payload.tempId,
          roomID: roomId, // Ensure roomID is defined
        });
      }
    } else {
      rooms?.emit("createRoom", {
        newRoomData: selectedRoom,
        message: { sender: myData, message: text.trim().replace(/\n+$/, "") }, // Remove only trailing newlines
      });
    }
    cleanUpAfterSendingMsg();
  }, [
    roomId,
    userRooms,
    text,
    myData,
    replayData,
    selectedRoom,
    rooms,
    cleanUpAfterSendingMsg,
    sendWithRetry,
  ]);

  // Edit existing message
  const editMessage = useCallback(() => {
    const trimmedText = text.trim();
    if (trimmedText === editData?.message?.trim()) {
      closeEdit();
      return;
    }
    rooms?.emit("editMessage", {
      msgID: editData?._id,
      editedMsg: trimmedText,
      roomID: roomId,
    });
    cleanUpAfterSendingMsg();
  }, [text, editData, rooms, roomId, cleanUpAfterSendingMsg, closeEdit]);

  //Send the "typing" event and stop it after 1500 milliseconds
  const handleIsTyping = useCallback(() => {
    if (typingTimer.current) {
      clearTimeout(typingTimer.current);
    }
    rooms?.emit("typing", { roomID: roomId, sender: myData });
    typingTimer.current = setTimeout(() => {
      rooms?.emit("stop-typing", { roomID: roomId, sender: myData });
    }, 1500);
  }, [rooms, roomId, myData]);

  // Text Change Handler
  const handleTextChange = useCallback(
    (e: ChangeEvent<HTMLTextAreaElement>) => {
      const newText = e.target.value;
      setText(newText);
      resizeTextArea();
      handleIsTyping();
    },
    [handleIsTyping, resizeTextArea]
  );

  // Add emoji to text
  const handleEmojiClick = useCallback((e: { emoji: string }) => {
    setText((prev) => prev + e.emoji);
  }, []);

  // Handle file selection with validation
  const handleFileSelect = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // التحقق من دعم نوع الملف
      const supportCheck = isFileTypeSupported(file);
      if (!supportCheck.supported) {
        toaster("error", supportCheck.error || "نوع الملف غير مدعوم");
        e.target.value = ''; // إعادة تعيين input
        return;
      }

      // التحقق من حجم الملف (10MB كحد أقصى)
      const maxSizeInBytes = 10 * 1024 * 1024;
      if (file.size > maxSizeInBytes) {
        toaster("error", "حجم الملف كبير جداً. الحد الأقصى 10 ميجابايت");
        e.target.value = '';
        return;
      }

      setSelectedFile(file);
      
      // Create preview for images and videos
      if (file.type.startsWith('image/') || file.type.startsWith('video/')) {
        const reader = new FileReader();
        reader.onload = () => {
          setPreviewUrl(reader.result as string);
        };
        reader.readAsDataURL(file);
      } else {
        setPreviewUrl(null);
      }
    }
  }, []);

  // Cancel file upload
  const cancelFileUpload = useCallback(() => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setUploadProgress(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  // Send file message
  const sendFileMessage = useCallback(async () => {
    if (!selectedFile || !roomId) return;

    try {
      setIsUploading(true);
      
      const tempId = uuidv4();
      
      // Create pending message with file info
      const pendingMessage = pendingMessagesService.addPendingMessage(
        roomId,
        {
          _id: tempId,
          message: text.trim(),
          sender: myData,
          roomID: roomId,
          status: "pending" as const,
          replayedTo: replayData ? {
            message: replayData.message || "",
            msgID: replayData._id || "",
            username: replayData.sender?.name || "",
          } : null,
          createdAt: new Date().toISOString(),
          isEdited: false,
          seen: [],
          readTime: null,
          pinnedAt: null,
          hideFor: [],
          updatedAt: new Date().toISOString(),
          replays: [],
          voiceData: null,
          tempId,
          uploadProgress: 0,
          fileData: {
            name: selectedFile.name,
            type: selectedFile.type,
            size: selectedFile.size,
            url: previewUrl || '',
          }
        }
      );

      // Add to UI
      setter(
        (prev: GlobalStoreProps): Partial<GlobalStoreProps> => ({
          selectedRoom: prev.selectedRoom
            ? {
                ...prev.selectedRoom,
                messages: [
                  ...(prev.selectedRoom?.messages ?? []),
                  pendingMessage,
                ],
              }
            : null,
        })
      );

      // Upload file to Cloudinary
      const uploadResult = await uploadToCloudinary(
        selectedFile,
        (progress) => {
          setUploadProgress(progress);
          setter(
            (prev: GlobalStoreProps): Partial<GlobalStoreProps> => ({
              selectedRoom: prev.selectedRoom
                ? {
                    ...prev.selectedRoom,
                    messages: prev.selectedRoom.messages.map((msg) =>
                      msg._id === tempId
                        ? { ...msg, uploadProgress: progress }
                        : msg
                    ),
                  }
                : null,
            })
          );
        }
      );

      if (uploadResult.success && uploadResult.url) {
        // Send message with file URL
        const payload = {
          roomID: roomId,
          message: text.trim() || selectedFile.name,
          sender: myData,
          replayData: replayData && replayData._id && replayData.message && replayData.sender?.name
            ? {
                targetID: replayData._id,
                replayedTo: {
                  message: replayData.message,
                  msgID: replayData._id,
                  username: replayData.sender.name,
                },
              }
            : null,
          tempId: tempId,
          fileData: {
            name: selectedFile.name,
            type: selectedFile.type,
            size: selectedFile.size,
            url: uploadResult.url,
          }
        };

        rooms?.emit(
          "newMessage",
          payload,
          (response: { success: boolean; _id: string }) => {
            if (response?.success) {
              setter(
                (prev: GlobalStoreProps): Partial<GlobalStoreProps> => ({
                  selectedRoom: prev.selectedRoom
                    ? {
                        ...prev.selectedRoom,
                        messages: prev.selectedRoom.messages.map((msg) =>
                          msg._id === tempId
                            ? { ...msg, _id: response._id, status: "sent" }
                            : msg
                        ),
                      }
                    : null,
                })
              );
              pendingMessagesService.removePendingMessage(roomId, tempId);
            } else {
              toaster("error", "فشل إرسال الملف");
            }
          }
        );

        cleanUpAfterSendingMsg();
        cancelFileUpload();
      } else {
        toaster("error", uploadResult.error || "فشل رفع الملف");
        setter(
          (prev: GlobalStoreProps): Partial<GlobalStoreProps> => ({
            selectedRoom: prev.selectedRoom
              ? {
                  ...prev.selectedRoom,
                  messages: prev.selectedRoom.messages.map((msg) =>
                    msg._id === tempId ? { ...msg, status: "failed" } : msg
                  ),
                }
              : null,
          })
        );
      }
    } catch (error) {
      console.error("File send error:", error);
      toaster("error", "حدث خطأ أثناء إرسال الملف");
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  }, [selectedFile, roomId, text, myData, replayData, rooms, setter, cleanUpAfterSendingMsg, cancelFileUpload, previewUrl]);

  //Close keyBoard after open emoji
  useEffect(() => {
    if (isEmojiOpen) {
      document.getElementById("myInputField")?.blur();
    }
  }, [isEmojiOpen]);

  //Updating text in edit mode
  useEffect(() => {
    if (editData?.message) {
      setText(editData.message);
    }
  }, [editData?.message]);

  //Focus on TextArea in Reply or Edit mode
  useEffect(() => {
    if (replayData?._id || editData?._id) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [replayData?._id, editData?._id]);

  //On mount, load draft from localStorage and focus on TextArea
  useEffect(() => {
    resizeTextArea();
    if (roomId) {
      const storedDraft = localStorage.getItem(roomId) || "";
      setText(storedDraft);
    } else {
      setText("");
    }
  }, [roomId, resizeTextArea]);

  // Synchronize text value with localStorage
  useEffect(() => {
    if (roomId) {
      if (text) {
        localStorage.setItem(roomId, text);
      } else {
        localStorage.removeItem(roomId);
      }
    }
  }, [text, roomId]);

  // Setting the ability to send messages in rooms
  const canSendMessage =
    !isUserBlocked &&
    (selectedRoom?.type !== "channel" ||
    selectedRoom.admins.includes(myData._id));

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // On mobile: Enter = newline (like Shift+Enter on desktop)
    // On desktop: Enter = send message, Shift+Enter = newline
    const isMobileDevice = isMobile();

    if (e.key === "Enter") {
      if (isMobileDevice) {
        // On mobile, Enter should go to the next line.
        return;
      } else {
        // in Desktop
        if (!e.shiftKey && text.trim().replace(/\n+$/, "").length) {
          e.preventDefault();
          if (editData) {
            editMessage();
          } else {
            sendMessage();
          }
        }
      }
    }
  };

  const handleCloseReplyEdit = () => {
    setText("");
    closeReplay();
    closeEdit();
  };

  return (
    <div className="sticky bottom-0 w-full flex flex-col justify-center bg-leftBarBg z-20">
      {/* File Preview */}
      {selectedFile && (
        <FilePreview
          file={selectedFile}
          previewUrl={previewUrl}
          text={text}
          setText={setText}
          onSend={sendFileMessage}
          onCancel={cancelFileUpload}
          isUploading={isUploading}
          uploadProgress={uploadProgress}
        />
      )}
      
      <div
        className={`${
          replayData?._id || editData?._id
            ? "opacity-100 h-12 py-1"
            : "opacity-0 h-0"
        } flex justify-between border-b border-chatBg duration-initial transition-all items-center gap-3 px-2 line-clamp-1 text-ellipsis  bg-leftBarBg w-full z-20 cursor-pointer`}
        onClick={() => {
          if (replayData?._id) {
            scrollToMessage(replayData?._id, "smooth", "center");
          }
          if (editData?._id) {
            scrollToMessage(editData?._id, "smooth", "center");
          }
        }}
      >
        <div className="flex items-center gap-3 line-clamp-1 text-ellipsis">
          {editData ? (
            <MdModeEditOutline className="size-6 text-lightBlue min-w-fit" />
          ) : (
            replayData && (
              <BsFillReplyFill className="size-6 text-lightBlue min-w-fit" />
            )
          )}
          <div className="flex flex-col text-left">
            <h4 className="text-lightBlue line-clamp-1 text-sm">
              {replayData
                ? `الرد على ${replayData.sender?.name}`
                : editData?.voiceData
                ? "تعديل التسمية التوضيحية"
                : editData && "تعديل الرسالة"}
            </h4>
            <p className="line-clamp-1 text-xs text-white/60">
              {replayData?.voiceData
                ? "رسالة صوتية"
                : replayData?.message ?? editData?.message}
            </p>
          </div>
        </div>
        <IoMdClose
          data-aos="zoom-in"
          onClick={(e) => {
            e.stopPropagation();
            handleCloseReplyEdit();
          }}
          className="size-7 min-w-fit transition-all cursor-pointer active:bg-red-500/[80%] active:rounded-full p-1"
        />
      </div>

      <div
        className="flex items-center justify-between relative min-h-12 w-full md:px-2 px-3 gap-3 bg-leftBarBg duration-75 transition-all"
        ref={inputBoxRef}
      >
        {canSendMessage ? (
          <>
            {isEmojiOpen ? (
              <FaRegKeyboard
                onClick={() => {
                  setIsEmojiOpen(false);
                  inputRef.current?.focus();
                }}
                className="cursor-pointer size-6 mr-0.5"
              />
            ) : (
              <BsEmojiSmile
                onClick={() => setIsEmojiOpen(true)}
                className="cursor-pointer size-6 mr-0.5"
              />
            )}
            <textarea
              dir="auto"
              autoComplete="offtextarea"
              value={text}
              onChange={handleTextChange}
              onContextMenu={(e) => e.stopPropagation()}
              onClick={() => setIsEmojiOpen(false)}
              onKeyDown={handleKeyDown}
              ref={inputRef}
              className="bg-transparent w-full resize-none outline-none scroll-w-none"
              placeholder="رسالة"
            />
            {!editData && !text.trim().replace(/\n+$/, "") && (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt,.zip"
                  className="hidden"
                  onChange={handleFileSelect}
                />
                <MdAttachFile
                  data-aos="zoom-in"
                  className="size-7 cursor-pointer w-fit rotate-[215deg]"
                  onClick={() => fileInputRef.current?.click()}
                />
              </>
            )}
            {editData?._id ? (
              <button
                className={`p-1 cursor-pointer text-white bg-lightBlue flex-center rounded-full ${
                  !text.trim().replace(/\n+$/, "")
                    ? "opacity-30"
                    : "opacity-100"
                }`}
                onClick={editMessage}
                disabled={!text.trim().replace(/\n+$/, "")}
              >
                <MdOutlineDone data-aos="zoom-in" size={20} />
              </button>
            ) : (
              <>
                {text.trim().replace(/\n+$/, "").length ? (
                  <RiSendPlaneFill
                    data-aos="zoom-in"
                    onClick={sendMessage}
                    className="size-7 cursor-pointer text-lightBlue mr-2 rotate-45"
                  />
                ) : (
                  <VoiceMessageRecorder
                    replayData={replayData}
                    closeEdit={closeEdit}
                    closeReplay={closeReplay}
                  />
                )}
              </>
            )}
          </>
        ) : (
          <div
            className="absolute flex items-center justify-center pt-3 text-center w-full mb-1 text-gray-400"
          >
            {isUserBlocked ? "تم حظر هذا المستخدم" : (isMuted ? "إلغاء الكتم" : "كتم الصوت")}
          </div>
        )}
      </div>

      {isEmojiOpen && (
        <div data-aos="fade-up" data-aos-duration="200">
          <EmojiPicker
            handleEmojiClick={handleEmojiClick}
            isEmojiOpen={isEmojiOpen}
          />
        </div>
      )}
    </div>
  );
};

export default MessageInput;
