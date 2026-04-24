"use client";

import { useEffect } from "react";
import LeftBar from "./leftBar/LeftBar";
import MiddleBar from "./middleBar/MiddleBar";
import RightBar from "./rightBar/RightBar";
import VoiceCall from "./calls/VoiceCall";
import VideoCall from "./calls/VideoCall";
import IncomingCall from "./calls/IncomingCall";
import useCallStore from "@/stores/callStore";
import useSockets from "@/stores/useSockets";
import useUserStore from "@/stores/userStore";

// إضافة interface لتعريف نوع البيانات الواردة
interface IncomingCallData {
  from: {
    _id: string;
    name: string;
    lastName: string;
    avatar: string;
    username: string;
  };
  signal: RTCSessionDescriptionInit;
  type: "voice" | "video";
  roomID: string;
  callId?: string;
}

const MainPage = () => {
  const { status, type, incomingCall, receiveCall, isInitiator } = useCallStore();
  const { rooms } = useSockets();
  const { _id: myID, name: myName, lastName: myLastName, avatar: myAvatar, username: myUsername } = useUserStore();

  // ✅ Debug: تتبع تغييرات الحالة بدقة
  useEffect(() => {
    console.log("🔍 MainPage State Changed:", { 
      status, 
      type, 
      isInitiator, 
      hasIncomingCall: !!incomingCall,
      shouldShowVoiceCall: (status === "calling" || status === "ringing" || status === "connected") && type === "voice",
      shouldShowVideoCall: (status === "calling" || status === "ringing" || status === "connected") && type === "video"
    });
    
    // ⚠️ تحذير إذا كانت الحالة غير متوقعة
    if (type && status !== "idle" && status !== "calling" && status !== "ringing" && status !== "connected" && status !== "ended") {
      console.warn("⚠️ Unexpected call status:", status);
    }
  }, [status, type, isInitiator, incomingCall]);

  // Listen for incoming calls
  useEffect(() => {
    if (!rooms) return;

    // استبدال any بنوع محدد
    const handleIncomingCall = ({ from, signal, type, roomID, callId }: IncomingCallData) => {
      console.log("📞 Incoming call received:", { from: from.name, type, roomID, callId });
      
      // Set caller info for store
      useCallStore.setState({
        caller: {
          _id: myID,
          name: myName,
          lastName: myLastName,
          avatar: myAvatar,
          username: myUsername,
        },
        callId: callId || null,
      });

      receiveCall(from, type, roomID, signal, callId);
    };

    rooms.on("call:incoming", handleIncomingCall);

    return () => {
      rooms.off("call:incoming", handleIncomingCall);
    };
  }, [rooms, myID, myName, myLastName, myAvatar, myUsername, receiveCall]);

  return (
    <div className="size-full flex items-center bg-leftBarBg transition-all duration-400 relative overflow-hidden">
      <LeftBar />
      <MiddleBar />
      <RightBar />
      
      {/* Call Components */}
      {incomingCall && <IncomingCall />}
      {/* ✅ عرض VoiceCall/VideoCall أثناء calling, ringing, و connected - لمنع الاختفاء عند المتصل */}
      {type === "voice" && (status === "calling" || status === "ringing" || status === "connected") && <VoiceCall />}
      {type === "video" && (status === "calling" || status === "ringing" || status === "connected") && <VideoCall />}
    </div>
  );
};

export default MainPage;
