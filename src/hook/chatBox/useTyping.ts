import Message from "@/models/message";
import { Dispatch, SetStateAction, useEffect } from "react";
import { DefaultEventsMap } from "socket.io";
import { Socket } from "socket.io-client";

interface useTypingProps {
  rooms: Socket<DefaultEventsMap, DefaultEventsMap> | null;
  roomID: string;
  myName: string;
  setTypings: Dispatch<SetStateAction<string[]>>;
}

const useTyping = ({ rooms, roomID, myName, setTypings }: useTypingProps) => {
  useEffect(() => {
    const handleTyping = (data: Message) => {
      if (data.sender.name !== myName && data.roomID === roomID) {
        setTypings((prev) => [...prev, data.sender.name]);
      }
    };

    const handleStopTyping = (data: Message) => {
      setTypings((prev) =>
        prev.filter((tl) => tl !== data.sender.name && tl !== myName)
      );
    };

    // ✅ معالج حدث userTyping الجديد من AI
    const handleUserTyping = (data: { userId: string; userName: string; isTyping: boolean; isAI?: boolean }) => {
      if (data.userName !== myName) {
        if (data.isTyping) {
          // إضافة اسم المستخدم لقائمة الكاتبين
          setTypings((prev) => {
            if (!prev.includes(data.userName)) {
              return [...prev, data.userName];
            }
            return prev;
          });
        } else {
          // إزالة اسم المستخدم من قائمة الكاتبين
          setTypings((prev) => prev.filter((name) => name !== data.userName));
        }
      }
    };

    rooms?.on("typing", handleTyping);
    rooms?.on("stop-typing", handleStopTyping);
    rooms?.on("userTyping", handleUserTyping); // ✅ حدث جديد

    return () => {
      rooms?.off("typing", handleTyping);
      rooms?.off("stop-typing", handleStopTyping);
      rooms?.off("userTyping", handleUserTyping); // ✅ تنظيف
    };
  }, [rooms, roomID, myName, setTypings]);
};

export default useTyping;
