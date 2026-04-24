"use client";
import Room from "@/models/room";
import User from "@/models/user";
import useGlobalStore from "@/stores/globalStore";
import useUserStore, { UserStoreUpdater } from "@/stores/userStore";
import useSockets from "@/stores/useSockets";
import { toaster } from "@/utils";
import { uploadToCloudinary } from "@/utils/file/CloudinaryUpload";
import Image from "next/image";
import {
  Dispatch,
  ChangeEvent,
  SetStateAction,
  useEffect,
  useState,
  useCallback,
  useRef,
} from "react";
import { BsEmojiSmile } from "react-icons/bs";
import { FaRegKeyboard } from "react-icons/fa6";
import { TbCameraPlus } from "react-icons/tb";
import Loading from "../modules/ui/Loading";
import RoomCard from "./RoomCard";
import EmojiPicker from "../modules/EmojiPicker";
// 🔥 تم إزالة: import ProfileGradients from "../modules/ProfileGradients";

interface EditInfoProps {
  selectedRoomData: Room; // 🔥 تغيير من any
  roomData: User & Room;
  submitChanges: boolean;
  setSubmitChanges: Dispatch<SetStateAction<boolean>>;
  setCanSubmit: Dispatch<SetStateAction<boolean>>;
  myData: User & UserStoreUpdater;
}

const EditInfo = ({
  roomData,
  selectedRoomData,
  submitChanges,
  setSubmitChanges,
  setCanSubmit,
  myData,
}: EditInfoProps) => {
  const { avatar = "", name = "", _id: roomID, type } = roomData;
  const [roomImage, setRoomImage] = useState<string | null>(avatar);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [members, setMembers] = useState<User[]>([]);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [updatedRoomName, setUpdatedRoomName] = useState(name);
  const [isEmojiOpen, setIsEmojiOpen] = useState(false);
  const [imageLoadError, setImageLoadError] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  
  const inputRef = useRef<HTMLInputElement | null>(null);
  const { setter, onlineUsers, selectedRoom } = useGlobalStore(
    (state) => state
  );
  const socket = useSockets().rooms;

  const getImgUrl = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const imgFile = e.target.files?.[0];
    if (imgFile) {
      const fileReader = new FileReader();
      fileReader.onload = (ev) => {
        setRoomImage(ev.target?.result as string);
        setImageLoadError(false);
      };
      fileReader.readAsDataURL(imgFile);
      setImageFile(imgFile);
    }
  }, []);

  useEffect(() => {
    setImageLoadError(false);
  }, [roomImage]);

  const handleEmojiClick = useCallback((e: { emoji: string }) => {
    setUpdatedRoomName((prev) => prev + e.emoji);
  }, []);

  const submitInfo = useCallback(async () => {
    const socket = useSockets.getState().rooms;
    try {
      setIsLoading(true);
      let uploadedImageUrl = roomImage;

      // إذا كان هناك ملف صورة جديد، قم برفعه إلى Cloudinary
      if (imageFile) {
        const uploadResult = await uploadToCloudinary(
          imageFile,
          (progress) => {
            setUploadProgress(Math.round(progress));
          }
        );

        if (uploadResult.success && uploadResult.url) {
          uploadedImageUrl = uploadResult.url;
        } else {
          throw new Error(uploadResult.error || "فشل رفع الصورة");
        }
      }

      socket?.emit("updateRoomData", {
        roomID,
        name: updatedRoomName.trim(),
        avatar: uploadedImageUrl,
      });
      socket?.off("updateRoomData");
      socket?.once("updateRoomData", ({ _id, name, avatar }: { _id: string; name: string; avatar: string }) => {
        useUserStore.getState().setter((prev) => ({
          ...prev,
          rooms: prev.rooms.map((room) =>
            room._id === _id ? { ...room, name, avatar } : room
          ),
        }));
        useGlobalStore.getState().setter({
          selectedRoom: { ...selectedRoomData, name, avatar },
        });
        setSubmitChanges(false);
        setter({ rightBarRoute: "/" });
        setIsLoading(false);
        setUploadProgress(0);
        toaster("success", "تم تحديث معلومات " + (type === "group" ? "المجموعة" : "القناة") + " بنجاح");
      });
    } catch (error) {
      console.error(error);
      setIsLoading(false);
      setUploadProgress(0);
      toaster("error", "فشل رفع الصورة، حاول مرة أخرى");
    }
  }, [
    imageFile,
    roomID,
    roomImage,
    selectedRoomData,
    setSubmitChanges,
    setter,
    updatedRoomName,
    type,
  ]);

  useEffect(() => {
    if (submitChanges) {
      submitInfo();
    }
  }, [submitChanges, submitInfo]);

  useEffect(() => {
    if (
      (updatedRoomName.trim() !== name.trim() || roomImage !== avatar) &&
      updatedRoomName.trim() !== ""
    ) {
      setCanSubmit(true);
    } else {
      setCanSubmit(false);
    }
  }, [avatar, name, roomImage, setCanSubmit, updatedRoomName]);

  const isUserOnline = (id: string) => {
    return onlineUsers.some((data) => {
      if (data.userID === id) return true;
    });
  };

  useEffect(() => {
    if (!socket || !roomID) return;
    setIsLoading(true);
    socket.emit("getRoomMembers", { roomID });

    socket.once("getRoomMembers", (participants) => {
      setMembers(participants);
      setIsLoading(false);
    });

    return () => {
      socket.off("getRoomMembers");
    };
  }, [roomID, socket]);

  return (
    <div className="relative h-full">
      <div className="flex items-center gap-3 w-full mt-2 p-4">
        <div className="relative">
          {roomImage && !imageLoadError ? (
            <Image
              src={roomImage}
              onClick={() => !isLoading && setRoomImage(null)}
              className="cursor-pointer object-cover shrink-0 size-13 rounded-full"
              width={60}
              height={60}
              alt=""
              onError={() => setImageLoadError(true)}
              onLoad={() => setImageLoadError(false)}
              unoptimized={roomImage.includes('cloudinary')}
            />
          ) : !roomImage || imageLoadError ? (
            <label htmlFor="imgUpload" className={`cursor-pointer ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}>
              <input
                type="file"
                className="hidden"
                id="imgUpload"
                accept="image/*"
                onChange={getImgUrl}
                disabled={isLoading}
              />
              <TbCameraPlus className="flex-center bg-darkBlue rounded-full size-13 p-3.5" />
            </label>
          ) : null}
          
          {/* مؤشر التحميل */}
          {isLoading && uploadProgress > 0 && (
            <div className="absolute inset-0 bg-black/70 flex-center flex-col gap-1 rounded-full z-10">
              <Loading classNames="text-white" size="sm" />
              <span className="text-white text-xs font-bold">
                {uploadProgress}%
              </span>
            </div>
          )}
        </div>

        <div
          className={`flex items-center gap-3 border-b-1 ${
            !updatedRoomName.trim() ? "border-red-500" : "border-darkBlue"
          } w-full`}
        >
          <input
            dir="auto"
            type="text"
            ref={inputRef}
            value={updatedRoomName}
            onChange={(e) => setUpdatedRoomName(e.target.value)}
            className="w-full p-2 bg-inherit outline-hidden"
            placeholder={type === "group" ? "أدخل اسم المجموعة" : "أدخل اسم القناة"}
          />
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
        </div>
      </div>
      {selectedRoom?.type === "group" && (
        <div className="flex flex-col">
          <div className="h-2 bg-black"></div>
          <span className="text-sm p-2 text-darkBlue">الأعضاء</span>
          <div className="flex flex-col">
            {isLoading ? (
              <Loading classNames="mx-auto" />
            ) : (
              members.length > 0 &&
              members.map((member) => (
                <RoomCard
                  key={member._id}
                  {...member}
                  myData={myData}
                  isOnline={isUserOnline(member._id)}
                  setSubscribers={setMembers}
                />
              ))
            )}
          </div>
        </div>
      )}
      {isEmojiOpen && (
        <EmojiPicker
          isEmojiOpen={isEmojiOpen}
          handleEmojiClick={handleEmojiClick}
          style={{ position: "absolute", bottom: 0 }}
        />
      )}
    </div>
  );
};

export default EditInfo;