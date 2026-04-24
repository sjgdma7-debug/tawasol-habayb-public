"use client";

import { useEffect, useRef, useState } from "react";
import useCallStore from "@/stores/callStore";
import useSockets from "@/stores/useSockets";
import SimplePeer from "simple-peer";
import { 
  MdCallEnd, 
  MdMic, 
  MdMicOff, 
  MdVideocam,
  MdVideocamOff,
  MdCameraswitch
} from "react-icons/md";
import Image from "next/image";
import ProfileGradients from "../modules/ProfileGradients";
import { toaster } from "@/utils";

const VideoCall = () => {
  const {
    status,
    receiver,
    caller,
    isInitiator,
    localStream,
    remoteStream,
    isMicMuted,
    isVideoOff,
    callDuration,
    roomID,
    peer,
    setPeer,
    setRemoteStream,
    setStatus,
    toggleMic,
    toggleVideo,
    endCall,
    updateCallDuration,
  } = useCallStore();

  const { rooms } = useSockets();
  const [callTime, setCallTime] = useState("00:00");
  const [isFullScreen, setIsFullScreen] = useState(false);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
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
          type: "video",
          roomID,
        });
      });

      newPeer.on("stream", (stream) => {
        console.log("📹 Remote video stream received");
        setRemoteStream(stream);
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = stream;
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

  // Setup local video stream
  useEffect(() => {
    if (localStream && localVideoRef.current) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  // Setup remote video stream
  useEffect(() => {
    if (remoteStream && remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = remoteStream;
      remoteVideoRef.current.play().catch(err => console.error("Error playing remote video:", err));
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

  const toggleFullScreen = () => {
    setIsFullScreen(!isFullScreen);
  };

  // Switch camera (front/back)
  const switchCamera = async () => {
    try {
      if (!localStream) {
        toaster("error", "لا يوجد بث فيديو نشط");
        return;
      }

      // Get current video track
      const currentVideoTrack = localStream.getVideoTracks()[0];
      if (!currentVideoTrack) {
        toaster("error", "لا يوجد مسار فيديو نشط");
        return;
      }

      // Get all video devices
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === 'videoinput');

      if (videoDevices.length < 2) {
        toaster("info", "لا توجد كاميرا أخرى متاحة");
        return;
      }

      // Get current device ID
      const currentSettings = currentVideoTrack.getSettings();
      const currentDeviceId = currentSettings.deviceId;
      
      // Find next camera
      const currentIndex = videoDevices.findIndex(device => device.deviceId === currentDeviceId);
      const nextIndex = (currentIndex + 1) % videoDevices.length;
      const nextDevice = videoDevices[nextIndex];

      console.log(`🔄 Switching camera from ${currentDeviceId} to ${nextDevice.deviceId}`);

      // Get new video stream with the next camera
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { 
          deviceId: { exact: nextDevice.deviceId },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: true,
      });

      const newVideoTrack = newStream.getVideoTracks()[0];
      
      // ✅ Replace video track in peer connection
      if (peer && (peer as any).peerConnection) {
        const senders = (peer as any).peerConnection.getSenders();
        const videoSender = senders.find((s: RTCRtpSender) => s.track?.kind === 'video');

        if (videoSender && newVideoTrack) {
          await videoSender.replaceTrack(newVideoTrack);
          console.log('✅ Video track replaced in peer connection');
        } else {
          console.warn('⚠️ لم يتم العثور على sender للفيديو أو track جديد');
        }
      } else {
        console.warn('⚠️ لا يوجد اتصال peer نشط، سيتم تحديث الفيديو المحلي فقط');
      }

      // Stop old track
      currentVideoTrack.stop();

      // Update local video with new track + existing audio
      const oldAudioTrack = localStream.getAudioTracks()[0];
      const updatedStream = new MediaStream([newVideoTrack]);
      
      // ✅ احتفظ بالصوت القديم
      if (oldAudioTrack) {
        updatedStream.addTrack(oldAudioTrack);
      }
      
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = updatedStream;
      }

      // Update store
      useCallStore.setState({ localStream: updatedStream });

      toaster("success", "تم تبديل الكاميرا بنجاح");
    } catch (error: any) {
      console.error("❌ Error switching camera:", error);
      toaster("error", `فشل تبديل الكاميرا: ${error.message || 'خطأ غير معروف'}`);
    }
  };

  // ✅ لا نحتاج هذا الشرط لأن MainPage يتحكم بالعرض
  // if (status === "idle") return null;

  return (
    <div className="fixed inset-0 z-50 bg-black flex items-center justify-center">
      {/* Remote Video (Full Screen) */}
      <div className="relative w-full h-full">
        {status === "connected" && remoteStream ? (
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-6">
            {otherUser?.avatar ? (
              <Image
                src={otherUser.avatar}
                alt={otherUser.name}
                width={150}
                height={150}
                className="rounded-full object-cover"
                unoptimized={otherUser.avatar?.includes("cloudinary")}
              />
            ) : (
              <ProfileGradients
                id={otherUser?._id || "default"}
                classNames="size-36 text-6xl flex-center rounded-full"
              >
                {otherUser?.name?.[0]?.toUpperCase() || "U"}
              </ProfileGradients>
            )}
            
            <div className="text-center">
              <h2 className="text-3xl font-vazirBold text-white">
                {otherUser?.name} {otherUser?.lastName}
              </h2>
              <p className="text-gray-400 mt-2 text-xl">
                {status === "calling" && "جاري الاتصال..."}
                {status === "ringing" && "يرن..."}
              </p>
            </div>
            
            {status === "calling" && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="size-48 rounded-full border-4 border-blue-500 animate-ping opacity-20"></div>
              </div>
            )}
          </div>
        )}

        {/* Local Video (Picture in Picture) */}
        <div className="absolute top-4 right-4 w-32 h-44 rounded-lg overflow-hidden shadow-2xl border-2 border-white/20">
          {localStream && !isVideoOff ? (
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover scale-x-[-1]"
            />
          ) : (
            <div className="w-full h-full bg-gray-800 flex items-center justify-center">
              <ProfileGradients
                id="local-user"
                classNames="size-16 text-2xl flex-center rounded-full"
              >
                أنت
              </ProfileGradients>
            </div>
          )}
        </div>

        {/* Call Info Overlay */}
        {status === "connected" && (
          <div className="absolute top-4 left-4 bg-black/50 backdrop-blur-sm px-4 py-2 rounded-full">
            <p className="text-white text-sm font-vazirBold flex items-center gap-2">
              <span className="size-2 bg-green-500 rounded-full animate-pulse"></span>
              {callTime}
            </p>
          </div>
        )}

        {/* User Name Overlay */}
        {status === "connected" && (
          <div className="absolute bottom-24 left-1/2 transform -translate-x-1/2 bg-black/50 backdrop-blur-sm px-6 py-2 rounded-full">
            <p className="text-white text-lg font-vazirBold">
              {otherUser?.name} {otherUser?.lastName}
            </p>
          </div>
        )}

        {/* Controls */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent py-8 px-6">
          <div className="flex items-center justify-center gap-4">
            {/* Mic Toggle */}
            {status === "connected" && (
              <button
                onClick={toggleMic}
                className={`size-14 rounded-full flex items-center justify-center transition-all ${
                  isMicMuted
                    ? "bg-red-500 hover:bg-red-600"
                    : "bg-white/20 hover:bg-white/30 backdrop-blur-sm"
                }`}
              >
                {isMicMuted ? (
                  <MdMicOff className="text-white text-2xl" />
                ) : (
                  <MdMic className="text-white text-2xl" />
                )}
              </button>
            )}

            {/* Video Toggle */}
            {status === "connected" && (
              <button
                onClick={toggleVideo}
                className={`size-14 rounded-full flex items-center justify-center transition-all ${
                  isVideoOff
                    ? "bg-red-500 hover:bg-red-600"
                    : "bg-white/20 hover:bg-white/30 backdrop-blur-sm"
                }`}
              >
                {isVideoOff ? (
                  <MdVideocamOff className="text-white text-2xl" />
                ) : (
                  <MdVideocam className="text-white text-2xl" />
                )}
              </button>
            )}

            {/* End Call */}
            <button
              onClick={handleEndCall}
              className="size-16 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center transition-all shadow-2xl"
            >
              <MdCallEnd className="text-white text-3xl" />
            </button>

            {/* Switch Camera */}
            {status === "connected" && (
              <button
                onClick={switchCamera}
                className="size-14 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-sm flex items-center justify-center transition-all"
                title="تبديل الكاميرا"
              >
                <MdCameraswitch className="text-white text-2xl" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Ringtone */}
      <audio ref={ringtoneRef} src="/files/ringtone.mp3" />
    </div>
  );
};

export default VideoCall;
