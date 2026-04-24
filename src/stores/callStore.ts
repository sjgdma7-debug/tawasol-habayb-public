import { create } from "zustand";
import SimplePeer from "simple-peer";

export type CallType = "voice" | "video";
export type CallStatus = "idle" | "calling" | "ringing" | "connected" | "ended";

export interface CallParticipant {
  _id: string;
  name: string;
  lastName?: string;
  avatar?: string;
  username?: string;
}

export interface CallState {
  // Call status
  status: CallStatus;
  type: CallType | null;
  isInitiator: boolean;
  
  // Participants
  caller: CallParticipant | null;
  receiver: CallParticipant | null;
  
  // Room info
  roomID: string | null;
  
  // Call ID for tracking
  callId: string | null;
  
  // WebRTC
  peer: SimplePeer.Instance | null;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  
  // Call controls
  isMicMuted: boolean;
  isVideoOff: boolean;
  isSpeakerOn: boolean;
  
  // Call timing
  callStartTime: number | null;
  callDuration: number;
  
  // Incoming call
  incomingCall: {
    caller: CallParticipant;
    type: CallType;
    roomID: string;
    signal: SimplePeer.SignalData;
    callId?: string;
  } | null;
  
  // Actions
  startCall: (
    receiver: CallParticipant,
    type: CallType,
    roomID: string,
    localStream: MediaStream
  ) => void;
  
  receiveCall: (
    caller: CallParticipant,
    type: CallType,
    roomID: string,
    signal: SimplePeer.SignalData,
    callId?: string
  ) => void;
  
  setCallId: (callId: string | null) => void;
  
  acceptCall: (localStream: MediaStream) => void;
  rejectCall: () => void;
  endCall: () => void;
  
  setPeer: (peer: SimplePeer.Instance | null) => void;
  setRemoteStream: (stream: MediaStream | null) => void;
  setStatus: (status: CallStatus) => void;
  
  toggleMic: () => void;
  toggleVideo: () => void;
  toggleSpeaker: () => void;
  
  updateCallDuration: (duration: number) => void;
  
  reset: () => void;
}

const initialState = {
  status: "idle" as CallStatus,
  type: null,
  isInitiator: false,
  caller: null,
  receiver: null,
  roomID: null,
  callId: null,
  peer: null,
  localStream: null,
  remoteStream: null,
  isMicMuted: false,
  isVideoOff: false,
  isSpeakerOn: false,
  callStartTime: null,
  callDuration: 0,
  incomingCall: null,
};

const useCallStore = create<CallState>((set, get) => ({
  ...initialState,

  startCall: (receiver, type, roomID, localStream) => {
    set({
      status: "calling",
      type,
      isInitiator: true,
      receiver,
      roomID,
      localStream,
      callStartTime: Date.now(),
    });
  },

  receiveCall: (caller, type, roomID, signal, callId) => {
    set({
      status: "ringing",
      incomingCall: {
        caller,
        type,
        roomID,
        signal,
        callId,
      },
    });
  },
  
  setCallId: (callId) => set({ callId }),

  acceptCall: (localStream) => {
    const { incomingCall } = get();
    if (!incomingCall) return;

    set({
      status: "connected",
      type: incomingCall.type,
      isInitiator: false,
      caller: incomingCall.caller,
      roomID: incomingCall.roomID,
      localStream,
      callStartTime: Date.now(),
      incomingCall: null,
    });
  },

  rejectCall: () => {
    const state = get();
    
    // Clean up streams
    if (state.localStream) {
      state.localStream.getTracks().forEach(track => track.stop());
    }
    if (state.remoteStream) {
      state.remoteStream.getTracks().forEach(track => track.stop());
    }
    
    // Close peer connection
    if (state.peer) {
      state.peer.destroy();
    }
    
    set({ ...initialState });
  },

  endCall: () => {
    const state = get();
    
    // Clean up streams
    if (state.localStream) {
      state.localStream.getTracks().forEach(track => track.stop());
    }
    if (state.remoteStream) {
      state.remoteStream.getTracks().forEach(track => track.stop());
    }
    
    // Close peer connection
    if (state.peer) {
      state.peer.destroy();
    }
    
    set({
      ...initialState,
      status: "ended",
    });
    
    // Reset to idle after 2 seconds
    setTimeout(() => {
      set({ status: "idle" });
    }, 2000);
  },

  setPeer: (peer) => set({ peer }),
  
  setRemoteStream: (stream) => set({ remoteStream: stream }),
  
  setStatus: (status) => set({ status }),

  toggleMic: () => {
    const { localStream, isMicMuted } = get();
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = isMicMuted;
        set({ isMicMuted: !isMicMuted });
      }
    }
  },

  toggleVideo: () => {
    const { localStream, isVideoOff } = get();
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = isVideoOff;
        set({ isVideoOff: !isVideoOff });
      }
    }
  },

  toggleSpeaker: () => {
    set((state) => ({ isSpeakerOn: !state.isSpeakerOn }));
  },

  updateCallDuration: (duration) => set({ callDuration: duration }),

  reset: () => {
    const state = get();
    
    // Clean up streams
    if (state.localStream) {
      state.localStream.getTracks().forEach(track => track.stop());
    }
    if (state.remoteStream) {
      state.remoteStream.getTracks().forEach(track => track.stop());
    }
    
    // Close peer connection
    if (state.peer) {
      state.peer.destroy();
    }
    
    set({ ...initialState });
  },
}));

export default useCallStore;
