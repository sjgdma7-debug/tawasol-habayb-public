"use client";

import { useEffect, useRef, useState } from "react";
import useCallStore from "@/stores/callStore";
import useSockets from "@/stores/useSockets";
import SimplePeer from "simple-peer";
import { 
  MdCallEnd, 
  MdMic, 
  MdMicOff, 
  MdVolumeUp, 
  MdVolumeOff 
} from "react-icons/md";
import Image from "next/image";
import ProfileGradients from "../modules/ProfileGradients";
import { toaster } from "@/utils";

const VoiceCall = () => {
  const {
    status,
    receiver,
    caller,
    isInitiator,
    localStream,
    remoteStream,
    isMicMuted,
    isSpeakerOn,
    callDuration,
    roomID,
    peer,
    setPeer,
    setRemoteStream,
    setStatus,
    toggleMic,
    toggleSpeaker,
    endCall,
    updateCallDuration,
  } = useCallStore();

  const { rooms } = useSockets();
  const [callTime, setCallTime] = useState("00:00");
  const localAudioRef = useRef<HTMLAudioElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const callTimerRef = useRef<NodeJS.Timeout | null>(null);
  const ringtoneRef = useRef<HTMLAudioElement>(null);

  const otherUser = isInitiator ? receiver : caller;

  // Format call duration
  useEffect(() => {
    if (status === "connected") {
      callTimerRef.current = setInterval(() => {
        const duration = Math.floor((Date.now() - (useCallStore.getState().callStartTime || Date.now())) / 1000);
        updateCallDuration(duration);
        
        const minutes = Math.floor(duration / 60);
        const seconds = duration % 60;
        setCallTime(`${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`);
      }, 1000);
    }

    return () => {
      if (callTimerRef.current) {
        clearInterval(callTimerRef.current);
      }
    };
  }, [status, updateCallDuration]);

  // Play ringtone when calling
  useEffect(() => {
    if (status === "calling" && ringtoneRef.current) {
      ringtoneRef.current.loop = true;
      ringtoneRef.current.play().catch(console.error);
    } else if (ringtoneRef.current) {
      ringtoneRef.current.pause();
      ringtoneRef.current.currentTime = 0;
    }
  }, [status]);

  // Setup WebRTC peer connection
  useEffect(() => {
    if (!localStream || !rooms || !roomID) {
      console.warn("⚠️ Missing required data:", { hasLocalStream: !!localStream, hasRooms: !!rooms, hasRoomID: !!roomID });
      return;
    }

    if (isInitiator && status === "calling") {
      // Create peer as initiator
      const newPeer = new SimplePeer({
        initiator: true,
        trickle: false,
        stream: localStream,
        config: {
          iceServers: [
            { urls: "stun:stun.l.google.com:19302" },
            { urls: "stun:stun1.l.google.com:19302" },
          ],
        },
      });

      newPeer.on("signal", (signal) => {
        // Send call initiation signal
        rooms.emit("call:initiate", {
          to: receiver,
          from: {
            _id: useCallStore.getState().caller?._id,
            name: useCallStore.getState().caller?.name,
            lastName: useCallStore.getState().caller?.lastName,
            avatar: useCallStore.getState().caller?.avatar,
          },
          signal,
          type: "voice",
          roomID,
        });
      });

      newPeer.on("stream", (stream) => {
        console.log("🎧 Remote audio stream received");
        setRemoteStream(stream);
        if (remoteAudioRef.current) {
          remoteAudioRef.current.srcObject = stream;
          remoteAudioRef.current.play().catch(err => console.error("Error playing remote audio:", err));
        }
        setStatus("connected");
      });

      newPeer.on("error", (err) => {
        console.error("❌ Peer connection error:", err);
        toaster("error", "فشل الاتصال - حدث خطأ في الاتصال");
        endCall();
      });

      newPeer.on("close", () => {
        console.log("Peer connection closed");
      });

      setPeer(newPeer);

      // Listen for call acceptance
      const handleCallAccepted = ({ signal: answerSignal }: { signal: SimplePeer.SignalData }) => {
        console.log("✅ Call accepted by receiver, signaling...");
        try {
          newPeer.signal(answerSignal);
          setStatus("connected");
        } catch (error) {
          console.error("❌ Error signaling answer:", error);
          toaster("error", "فشل في إكمال الاتصال");
          endCall();
        }
      };

      // ✅ إضافة timeout للمكالمة - إذا لم يرد أحد خلال 60 ثانية
      const callTimeout = setTimeout(() => {
        console.log("⏰ Call timeout - no response after 60 seconds");
        toaster("info", "لم يتم الرد على المكالمة");
        handleEndCall();
      }, 60000); // 60 seconds

      rooms.on("call:accepted", handleCallAccepted);

      return () => {
        clearTimeout(callTimeout);
        rooms.off("call:accepted", handleCallAccepted);
      };
    }
    // ✅ إزالة status من dependencies لمنع إعادة تسجيل الـ listeners عند كل تغيير
  }, [isInitiator, localStream, rooms, roomID, receiver, setPeer, setRemoteStream, setStatus, endCall]);

  // Setup local audio stream
  useEffect(() => {
    if (localStream && localAudioRef.current) {
      localAudioRef.current.srcObject = localStream;
      localAudioRef.current.muted = true; // Mute local audio to prevent echo
    }
  }, [localStream]);

  // Setup remote audio stream
  useEffect(() => {
    if (remoteStream && remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = remoteStream;
      remoteAudioRef.current.play().catch(err => console.error("Error playing remote audio:", err));
    }
  }, [remoteStream]);

  // Listen for call end and status updates
  useEffect(() => {
    if (!rooms) return;

    const handleCallEnded = () => {
      // ✅ إيقاف الرنين فوراً
      if (ringtoneRef.current) {
        ringtoneRef.current.pause();
        ringtoneRef.current.currentTime = 0;
      }
      endCall();
    };

    // ✅ معالج حالة المستخدم غير متصل
    const handleUserOffline = () => {
      toaster("error", "المستخدم غير متصل");
      if (ringtoneRef.current) {
        ringtoneRef.current.pause();
        ringtoneRef.current.currentTime = 0;
      }
      endCall();
    };

    // ✅ معالج تأكيد بدء الرنين
    const handleCallInitiated = ({ status: callStatus }: { status: string }) => {
      if (callStatus === 'ringing') {
        setStatus('ringing');
      }
    };

    rooms.on("call:ended", handleCallEnded);
    rooms.on("call:rejected", handleCallEnded);
    rooms.on("call:cancelled", handleCallEnded);
    rooms.on("call:user-offline", handleUserOffline);
    rooms.on("call:initiated", handleCallInitiated);

    return () => {
      rooms.off("call:ended", handleCallEnded);
      rooms.off("call:rejected", handleCallEnded);
      rooms.off("call:cancelled", handleCallEnded);
      rooms.off("call:user-offline", handleUserOffline);
      rooms.off("call:initiated", handleCallInitiated);
    };
  }, [rooms, endCall, setStatus]);

  const handleEndCall = () => {
    const { callId, caller, status: callStatus } = useCallStore.getState();
    
    if (rooms && roomID) {
      // إذا كانت الحالة "calling" أو "ringing" => إلغاء، وإلا => إنهاء
      const isCancelling = callStatus === "calling" || callStatus === "ringing";
      
      if (isCancelling) {
        rooms.emit("call:cancel", {
          to: otherUser?._id,
          roomID,
          callId,
          from: caller?._id,
        });
      } else {
        rooms.emit("call:end", {
          to: otherUser?._id,
          roomID,
          callId,
          from: caller?._id,
          duration: callDuration,
        });
      }
    }
    endCall();
  };

  // ✅ لا نحتاج هذا الشرط لأن MainPage يتحكم بالعرض
  // if (status === "idle") return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center">
      <div className="w-full max-w-md h-screen flex flex-col items-center justify-between py-12 px-6">
        {/* User Info */}
        <div className="flex flex-col items-center gap-6 mt-12">
          {/* Avatar */}
          <div className="relative">
            {otherUser?.avatar ? (
              <Image
                src={otherUser.avatar}
                alt={otherUser.name}
                width={120}
                height={120}
                className="rounded-full object-cover"
                unoptimized={otherUser.avatar?.includes("cloudinary")}
              />
            ) : (
              <ProfileGradients
                id={otherUser?._id || "default"}
                classNames="size-30 text-5xl flex-center rounded-full"
              >
                {otherUser?.name?.[0]?.toUpperCase() || "U"}
              </ProfileGradients>
            )}
            
            {/* Pulse animation for calling status */}
            {status === "calling" && (
              <div className="absolute inset-0 rounded-full border-4 border-blue-500 animate-ping"></div>
            )}
          </div>

          {/* Name */}
          <div className="text-center">
            <h2 className="text-2xl font-vazirBold text-white">
              {otherUser?.name} {otherUser?.lastName}
            </h2>
            <p className="text-gray-400 mt-2 text-lg">
              {status === "calling" && "جاري الاتصال..."}
              {status === "ringing" && "يرن..."}
              {status === "connected" && callTime}
              {status === "ended" && "انتهت المكالمة"}
            </p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-6 mb-12">
          {/* Mic Toggle */}
          {status === "connected" && (
            <button
              onClick={toggleMic}
              className={`size-16 rounded-full flex items-center justify-center transition-all ${
                isMicMuted
                  ? "bg-red-500 hover:bg-red-600"
                  : "bg-gray-700 hover:bg-gray-600"
              }`}
            >
              {isMicMuted ? (
                <MdMicOff className="text-white text-3xl" />
              ) : (
                <MdMic className="text-white text-3xl" />
              )}
            </button>
          )}

          {/* End Call */}
          <button
            onClick={handleEndCall}
            className="size-20 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center transition-all shadow-lg"
          >
            <MdCallEnd className="text-white text-4xl" />
          </button>

          {/* Speaker Toggle */}
          {status === "connected" && (
            <button
              onClick={toggleSpeaker}
              className={`size-16 rounded-full flex items-center justify-center transition-all ${
                isSpeakerOn
                  ? "bg-blue-500 hover:bg-blue-600"
                  : "bg-gray-700 hover:bg-gray-600"
              }`}
            >
              {isSpeakerOn ? (
                <MdVolumeUp className="text-white text-3xl" />
              ) : (
                <MdVolumeOff className="text-white text-3xl" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Audio elements */}
      <audio ref={localAudioRef} autoPlay muted />
      <audio ref={remoteAudioRef} autoPlay />
      <audio ref={ringtoneRef} src="/files/ringtone.mp3" />
    </div>
  );
};

export default VoiceCall;
