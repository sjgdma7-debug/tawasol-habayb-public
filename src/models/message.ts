import User from "./user";

interface FileAttachment {
  name?: string;
  type: string;
  size?: number;
  url?: string;
  public_id?: string;
  resource_type?: 'image' | 'video' | 'raw' | 'audio';
  format?: string;
  duration?: number;
  width?: number;
  height?: number;
  bytes?: number;
  uploadProgress?: number;
  isUploading?: boolean;
  uploadError?: string;
  // Call-specific fields
  callType?: 'voice' | 'video';
  callStatus?: 'initiated' | 'ringing' | 'accepted' | 'rejected' | 'missed' | 'ended' | 'failed' | 'cancelled';
  callId?: string;
}

export default interface Message {
  tempId?: string;
  _id: string;
  message: string;
  sender: User;
  isEdited: boolean;
  seen: string[];
  readTime: Date | null;
  replays: string[];
  pinnedAt: string | null;
  voiceData: { src: string; duration: number; playedBy: string[] } | null;
  replayedTo: { message: string; msgID: string; username: string } | null;
  roomID: string;
  hideFor: string[];
  createdAt: string;
  updatedAt: string;
  status?: "pending" | "sent" | "failed";
  uploadProgress?: number;
  fileData?: FileAttachment | null;
}
