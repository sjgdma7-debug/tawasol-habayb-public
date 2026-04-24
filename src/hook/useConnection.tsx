import Loading from "@/components/modules/ui/Loading";
import Room from "@/models/room";
import User from "@/models/user";
import { GlobalStoreProps } from "@/stores/globalStore";
import { UserStoreUpdater } from "@/stores/userStore";
import { SocketsProps } from "@/stores/useSockets";
import { ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { pendingMessagesService } from "@/utils/pendingMessages";
import { uploadFile as uploadFileWithRetry } from "@/utils";
import { voiceBlobStorage } from "@/utils/voiceBlobStorage";

interface useConnectionProps {
  selectedRoom: Room | null;
  setter: (
    state:
      | Partial<GlobalStoreProps>
      | ((prev: GlobalStoreProps) => Partial<GlobalStoreProps>)
  ) => void;
  userId: string;
  userDataUpdater: (state: Partial<User & UserStoreUpdater>) => void;
  updater: (
    key: keyof SocketsProps,
    value: SocketsProps[keyof SocketsProps]
  ) => void;
}

const useConnection = ({
  selectedRoom,
  setter,
  userId,
  userDataUpdater,
  updater,
}: useConnectionProps) => {
  const socketRef = useRef<Socket | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [isPageLoaded, setIsPageLoaded] = useState<boolean>(false);
  const [status, setStatus] = useState<ReactNode>(
    <span>
      Connecting
      <Loading loading="dots" size="xs" classNames="text-white mt-1.5" />
    </span>
  );

  // تجميع تحديثات الواجهة لتحسين الأداء
  const batchUpdateRef = useRef<{
    timeout: NodeJS.Timeout | null;
    updates: Array<() => void>;
  }>({ timeout: null, updates: [] });

  const batchUpdate = useCallback((updateFn: () => void) => {
    batchUpdateRef.current.updates.push(updateFn);
    
    if (batchUpdateRef.current.timeout) {
      clearTimeout(batchUpdateRef.current.timeout);
    }
    
    batchUpdateRef.current.timeout = setTimeout(() => {
      const updates = [...batchUpdateRef.current.updates];
      batchUpdateRef.current.updates = [];
      
      // تنفيذ جميع التحديثات دفعة واحدة
      updates.forEach(update => update());
      batchUpdateRef.current.timeout = null;
    }, 16); // 16ms ≈ 60fps
  }, []);

  // تحسين معالجة الرسائل المعلقة مع المعالجة المتوازية
  const retryPendingMessagesOptimized = useCallback(async (roomData: Room) => {
    const pendingMessages = pendingMessagesService.getPendingMessages(roomData._id);
    const pendingOnly = pendingMessages.filter(msg => msg.status === "pending");
    
    if (pendingOnly.length === 0) return;

    // معالجة الرسائل بشكل متوازي (الحد الأقصى 3 رسائل في نفس الوقت)
    const CONCURRENT_LIMIT = 3;
    const chunks = [];
    
    for (let i = 0; i < pendingOnly.length; i += CONCURRENT_LIMIT) {
      chunks.push(pendingOnly.slice(i, i + CONCURRENT_LIMIT));
    }

    for (const chunk of chunks) {
      const promises = chunk.map(async (msg) => {
        try {
          let preparedVoiceData = msg.voiceData || null;
          
          // تحضير بيانات الصوت إذا لزم الأمر
          if (preparedVoiceData && (!preparedVoiceData.src || !preparedVoiceData.src.trim())) {
            const blob = await voiceBlobStorage.getBlob(msg.tempId || msg._id);
            if (!blob) return null;
            
            const file = new File([blob], `voice-retry-${Date.now()}.ogg`, {
              type: "audio/ogg",
            });

            const uploadRes = await uploadFileWithRetry(file, (progress) => {
              batchUpdate(() => {
                setter((prev): Partial<GlobalStoreProps> => ({
                  ...prev,
                  selectedRoom: prev.selectedRoom
                    ? {
                        ...prev.selectedRoom,
                        messages: prev.selectedRoom.messages.map((m) =>
                          m._id === msg._id ? { ...m, uploadProgress: progress } : m
                        ),
                      }
                    : prev.selectedRoom,
                }));
              });
            });

            if (!uploadRes.success || !uploadRes.downloadUrl) {
              return null;
            }

            preparedVoiceData = {
              ...preparedVoiceData,
              src: uploadRes.downloadUrl,
            };
          }

          const payload = {
            roomID: roomData._id,
            message: msg.message,
            sender: msg.sender,
            replayData: msg.replayedTo
              ? { targetID: msg.replayedTo.msgID, replayedTo: msg.replayedTo }
              : null,
            tempId: msg._id,
          };
          
          if (preparedVoiceData) {
            Object.assign(payload, { voiceData: preparedVoiceData });
          }

          return new Promise<void>((resolve) => {
            socketRef.current?.emit(
              "newMessage",
              payload,
              (response: { success: boolean; _id: string }) => {
                if (response.success) {
                  batchUpdate(() => {
                    setter((prev): Partial<GlobalStoreProps> => ({
                      ...prev,
                      selectedRoom: prev.selectedRoom
                        ? {
                            ...prev.selectedRoom,
                            messages: prev.selectedRoom.messages.map((m) =>
                              m._id === msg._id
                                ? {
                                    ...m,
                                    _id: response._id,
                                    status: "sent",
                                    uploadProgress: undefined,
                                  }
                                : m
                            ),
                          }
                        : prev.selectedRoom,
                    }));
                  });
                  
                  pendingMessagesService.removePendingMessage(roomData._id, msg._id);
                  voiceBlobStorage.deleteBlob(msg.tempId || msg._id).catch(() => {});
                }
                resolve();
              }
            );
          });
        } catch (error) {
          console.warn("Failed to retry message:", error);
          return null;
        }
      });

      // انتظار المجموعة الحالية قبل المتابعة للمجموعة التالية
      await Promise.allSettled(promises);
    }
  }, [setter, batchUpdate]);

  const setupSocketListeners = useCallback(() => {
    const socket = socketRef.current;
    if (!socket) return;

    let listenersRemaining = 2;
    const handleListenerUpdate = () => {
      listenersRemaining -= 1;
      if (listenersRemaining === 0) {
        setStatus("تواصل حبايب ❤");
      }
    };

    setStatus(
      <>
        Updating
        <Loading loading="dots" size="xs" classNames="text-white mt-1.5" />
      </>
    );

    socket.emit("joining", selectedRoom?._id);

    socket.on("joining", (roomData) => {
      if (roomData) {
        const pendingMessages = pendingMessagesService.getPendingMessages(roomData._id);
        const serverMessages = roomData.messages || [];
        
        // دمج الرسائل وترتيبها
        const allMessages = [...serverMessages, ...pendingMessages]
          .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

        setter(() => ({
          selectedRoom: {
            ...roomData,
            messages: allMessages,
          },
        }));

        // إعادة محاولة الرسائل المعلقة بشكل محسّن
        retryPendingMessagesOptimized(roomData);
      }
      handleListenerUpdate();
    });

    socket.on("getRooms", (fetchedRooms) => {
      setRooms(fetchedRooms);
      userDataUpdater({ rooms: fetchedRooms });
      setIsPageLoaded(true);
      handleListenerUpdate();
    });

    // تحسين تحديث آخر رسالة مع التجميع
    socket.on("lastMsgUpdate", (newMsg) => {
      batchUpdate(() => {
        setRooms((prevRooms) =>
          prevRooms.map((roomData) =>
            roomData._id === newMsg.roomID
              ? { ...roomData, lastMsgData: newMsg }
              : roomData
          )
        );
      });
    });

    socket.on("createRoom", (roomData) => {
      socket.emit("getRooms", userId);
      if (roomData.creator === userId) {
        // تأخير بسيط لضمان تحديث الغرف أولاً
        setTimeout(() => socket.emit("joining", roomData._id), 100);
      }
    });

    socket.on("updateRoomData", (roomData) => {
      socket.emit("getRooms", userId);

      batchUpdate(() => {
        setter((prev) => ({
          ...prev,
          selectedRoom:
            prev.selectedRoom && prev.selectedRoom._id === roomData._id
              ? {
                  ...prev.selectedRoom,
                  name: roomData.name,
                  avatar: roomData.avatar,
                  participants: roomData.participants,
                  admins: roomData.admins,
                }
              : prev.selectedRoom,
        }));
      });
    });

    socket.on("updateOnlineUsers", (onlineUsers) => {
      batchUpdate(() => setter({ onlineUsers }));
    });

    socket.on("updateLastMsgPos", (updatedData) => {
      userDataUpdater({ roomMessageTrack: updatedData });
    });

    socket.on("deleteRoom", (roomID) => {
      socket.emit("getRooms");
      if (roomID === selectedRoom?._id) {
        setter({ selectedRoom: null });
      }
    });

    socket.on("seenMsg", ({ roomID, seenBy, readTime }) => {
      batchUpdate(() => {
        setRooms((prevRooms) =>
          prevRooms.map((room) => {
            if (room._id === roomID) {
              return {
                ...room,
                lastMsgData: {
                  ...room.lastMsgData!,
                  seen: [...new Set([...(room.lastMsgData?.seen || []), seenBy])],
                  readTime,
                },
              };
            }
            return room;
          })
        );
      });
    });

    // تحسين معالجة الاتصال
    socket.on("connect", () => {
      setStatus("تواصل حبايب ❤");
      socket.emit("getRooms", userId);
    });

    // تحسين معالجة قطع الاتصال
    const handleDisconnection = () => {
      setStatus(
        <span>
          Connecting
          <Loading loading="dots" size="xs" classNames="text-white mt-1.5" />
        </span>
      );
    };

    socket.on("disconnect", handleDisconnection);
    socket.on("connect_error", handleDisconnection);
    socket.on("error", handleDisconnection);

    return () => {
      // تنظيف مستمعي الأحداث
      const events = [
        "connect", "disconnect", "connect_error", "error",
        "joining", "getRooms", "createRoom", "updateLastMsgPos",
        "lastMsgUpdate", "updateOnlineUsers", "deleteRoom",
        "seenMsg", "updateRoomData"
      ];
      events.forEach(event => socket.off(event));
    };
  }, [selectedRoom, setter, userDataUpdater, userId, retryPendingMessagesOptimized, batchUpdate]);

  const initializeSocket = useCallback(() => {
    if (!socketRef.current) {
      const newSocket = io(process.env.NEXT_PUBLIC_SOCKET_SERVER_URL, {
        autoConnect: true,
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 10000, // تقليل المهلة الزمنية
        transports: ["websocket"],
        // إضافة تحسينات جديدة
        forceNew: true,
        upgrade: false,
        rememberUpgrade: false,
      });
      
      socketRef.current = newSocket;
      setupSocketListeners();
    }
  }, [setupSocketListeners]);

  useEffect(() => {
    const handleOnline = () => {
      setStatus(
        <span>
          Connecting
          <Loading loading="dots" size="xs" classNames="text-white mt-1.5" />
        </span>
      );
      initializeSocket();
    };

    const handleOffline = () => {
      setStatus(
        <span>
          Connecting
          <Loading loading="dots" size="xs" classNames="text-white mt-1.5" />
        </span>
      );
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    if (!socketRef.current) {
      initializeSocket();
    }

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      
      // تنظيف timeout عند إلغاء المكون
      if (batchUpdateRef.current.timeout) {
        clearTimeout(batchUpdateRef.current.timeout);
      }
    };
  }, [initializeSocket]);

  useEffect(() => {
    if (socketRef.current && rooms.length) {
      updater("rooms", socketRef.current);
      userDataUpdater({ rooms });
    }
  }, [rooms, updater, userDataUpdater]);

  return { status, isPageLoaded, setRooms, socketRef };
};

export default useConnection;
