"use client";

import { useEffect, useRef, useState } from "react";
import useCallStore from "@/stores/callStore";
import useSockets from "@/stores/useSockets";
import useUserStore from "@/stores/userStore";
import SimplePeer from "simple-peer";
import { MdCall, MdCallEnd, MdVideocam } from "react-icons/md";
import Image from "next/image";
import ProfileGradients from "../modules/ProfileGradients";
import { toaster } from "@/utils";

const IncomingCall = () => {
  const { incomingCall, acceptCall, rejectCall, setPeer, setRemoteStream, setStatus } = useCallStore();
  const { rooms } = useSockets();
  const [isRequesting, setIsRequesting] = useState(false);
  const ringtoneRef = useRef<HTMLAudioElement>(null);

  // Play ringtone
  useEffect(() => {
    const audio = ringtoneRef.current;
    if (incomingCall && audio) {
      audio.loop = true;
      audio.play().catch(console.error);
    }

    return () => {
      if (audio) {
        audio.pause();
        audio.currentTime = 0;
      }
    };
  }, [incomingCall]);

  // Listen for call cancellation
  useEffect(() => {
    if (!rooms) return;

    const handleCallCancelled = () => {
      console.log("📴 Call was cancelled by caller");
      
      // ✅ إيقاف الرنين فوراً عند إلغاء المكالمة
      const audio = ringtoneRef.current;
      if (audio) {
        audio.pause();
        audio.currentTime = 0;
      }
      
      rejectCall(); // Close incoming call popup
    };

    rooms.on("call:cancelled", handleCallCancelled);

    return () => {
      rooms.off("call:cancelled", handleCallCancelled);
    };
  }, [rooms, rejectCall]);

  const handleAccept = async () => {
    if (!incomingCall || !rooms || isRequesting) return;

    setIsRequesting(true);

    try {
      // Request media based on call type
      const constraints: MediaStreamConstraints = {
        audio: true,
        video: incomingCall.type === "video",
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      // Accept the call
      acceptCall(stream);

      // Create peer to answer the call
      const newPeer = new SimplePeer({
        initiator: false,
        trickle: false,
        stream,
        config: {
          iceServers: [
            { urls: "stun:stun.l.google.com:19302" },
            { urls: "stun:stun1.l.google.com:19302" },
          ],
        },
      });

      // Signal the incoming call's signal
      newPeer.signal(incomingCall.signal);

      newPeer.on("signal", (signal) => {
        // Send acceptance signal back
        rooms.emit("call:accept", {
          to: incomingCall.caller._id,
          signal,
          roomID: incomingCall.roomID,
          callId: incomingCall.callId,
        });
      });

      newPeer.on("stream", (remoteStream) => {
        console.log("🎧 Remote stream received in IncomingCall");
        setRemoteStream(remoteStream);
        setStatus("connected");
      });

      newPeer.on("error", (err) => {
        console.error("Peer error:", err);
        toaster("error", "حدث خطأ في الاتصال");
        rejectCall();
      });

      newPeer.on("close", () => {
        console.log("Peer connection closed");
      });

      setPeer(newPeer);
    } catch (error) {
      console.error("Error accepting call:", error);
      toaster("error", "فشل في الوصول إلى الكاميرا/الميكروفون");
      rejectCall();
    } finally {
      setIsRequesting(false);
    }
  };

  const handleReject = () => {
    if (!incomingCall || !rooms) return;

    const currentUser = useUserStore.getState();

    rooms.emit("call:reject", {
      to: incomingCall.caller._id,
      roomID: incomingCall.roomID,
      callId: incomingCall.callId,
      from: currentUser._id,
    });

    rejectCall();
  };

  if (!incomingCall) return null;

  const { caller, type } = incomingCall;

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center">
        <div className="bg-chatBg rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-b from-darkBlue to-lightBlue p-6 text-center">
            <p className="text-white text-sm mb-2">
              {type === "video" ? "مكالمة فيديو واردة" : "مكالمة صوتية واردة"}
            </p>
            
            {/* Avatar */}
            <div className="flex justify-center my-6">
              {caller.avatar ? (
                <div className="relative">
                  <Image
                    src={caller.avatar}
                    alt={caller.name}
                    width={120}
                    height={120}
                    className="rounded-full object-cover border-4 border-white shadow-lg"
                    unoptimized={caller.avatar?.includes("cloudinary")}
                  />
                  <div className="absolute inset-0 rounded-full border-4 border-white animate-ping opacity-20"></div>
                </div>
              ) : (
                <div className="relative">
                  <ProfileGradients
                    id={caller._id}
                    classNames="size-30 text-5xl flex-center rounded-full border-4 border-white shadow-lg"
                  >
                    {caller.name?.[0]?.toUpperCase() || "U"}
                  </ProfileGradients>
                  <div className="absolute inset-0 rounded-full border-4 border-white animate-ping opacity-20"></div>
                </div>
              )}
            </div>

            {/* Caller Info */}
            <h2 className="text-white text-2xl font-vazirBold mb-1">
              {caller.name} {caller.lastName}
            </h2>
            {caller.username && (
              <p className="text-white/80 text-sm">@{caller.username}</p>
            )}
          </div>

          {/* Action Buttons */}
          <div className="p-6 flex items-center justify-center gap-8">
            {/* Reject Button */}
            <button
              onClick={handleReject}
              disabled={isRequesting}
              className="size-16 rounded-full bg-red-500 hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center transition-all shadow-lg group"
            >
              <MdCallEnd className="text-white text-3xl group-hover:scale-110 transition-transform" />
            </button>

            {/* Accept Button */}
            <button
              onClick={handleAccept}
              disabled={isRequesting}
              className="size-20 rounded-full bg-green-500 hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center transition-all shadow-2xl group"
            >
              {isRequesting ? (
                <div className="size-8 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : type === "video" ? (
                <MdVideocam className="text-white text-4xl group-hover:scale-110 transition-transform" />
              ) : (
                <MdCall className="text-white text-4xl group-hover:scale-110 transition-transform" />
              )}
            </button>
          </div>

          {/* Labels */}
          <div className="px-6 pb-6 flex items-center justify-center gap-12 text-sm text-darkGray">
            <span>رفض</span>
            <span className="text-green-500 font-vazirBold">قبول</span>
          </div>
        </div>
      </div>

      {/* Ringtone */}
      <audio ref={ringtoneRef} src="/files/Receiver Call Request Tone.mp3" />
    </>
  );
};

export default IncomingCall;
