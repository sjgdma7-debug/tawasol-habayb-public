"use client";
import useGlobalStore from "@/stores/globalStore";
import { Suspense, lazy, useMemo, useState } from "react";
import EditInfo from "./EditInfo";
import { IoArrowBackOutline, IoClose } from "react-icons/io5";
import { MdDone, MdEdit } from "react-icons/md";
import useUserStore from "@/stores/userStore";
import Loading from "../modules/ui/Loading";
import Room from "@/models/room";
import User from "@/models/user";
import AddMembers from "./AddMembers";
import AddSubscribers from "./AddSubscribers";
const RoomDetails = lazy(() => import("@/components/rightBar/RoomDetails"));

const RightBar = () => {
  const [submitChanges, setSubmitChanges] = useState(false);
  const [canSubmit, setCanSubmit] = useState(false);
  const {
    setter,
    isRoomDetailsShown,
    selectedRoom,
    shouldCloseAll,
    RoomDetailsData,
    rightBarRoute,
  } = useGlobalStore((state) => state);
  const selectedRoomData: Room | User | null = RoomDetailsData ?? selectedRoom;
  const { participants, type, _id: roomID } = (selectedRoomData as Room) || {};
  const myData = useUserStore((state) => state);

  const roomData = useMemo(() => {
    if (type === "private") {
      return (
        participants?.find((data: string | User) => {
          if (typeof data === "string") return data !== myData._id;
          return data?._id !== myData._id;
        }) ||
        participants?.find((data: string | User) => {
          if (typeof data === "string") return data === myData._id;
          return data?._id === myData._id;
        }) ||
        selectedRoomData
      );
    }
    return selectedRoomData || null;
  }, [myData._id, participants, selectedRoomData, type]);

  const activeRoute = useMemo(() => {
    switch (rightBarRoute) {
      case "/edit-info":
        return (
          <EditInfo
            key={`${roomID}-edit-info`}
            selectedRoomData={selectedRoomData as Room}
            roomData={roomData as User & Room}
            submitChanges={submitChanges}
            setSubmitChanges={setSubmitChanges}
            setCanSubmit={setCanSubmit}
            myData={myData}
          />
        );
      case "/add-members":
      case "/add-channel-members":
        return (
          <AddMembers
            setCanSubmit={setCanSubmit}
            submitChanges={submitChanges}
            setSubmitChanges={setSubmitChanges}
            roomData={selectedRoomData as Room}
          />
        );
      case "/add-subscribers":
      case "/administrators":
        return (
          <AddSubscribers
            setCanSubmit={setCanSubmit}
            submitChanges={submitChanges}
            setSubmitChanges={setSubmitChanges}
            roomData={selectedRoomData as Room}
            myData={myData}
          />
        );
      default:
        return (
          <RoomDetails
            key={`${roomID}-room-details`}
            selectedRoomData={selectedRoomData as Room}
            myData={myData}
            roomData={roomData as User & Room}
          />
        );
    }
  }, [
    myData,
    rightBarRoute,
    roomData,
    roomID,
    selectedRoomData,
    submitChanges,
  ]);

  const closeRoomDetails = () => {
    if (shouldCloseAll) {
      return setter({
        isRoomDetailsShown: false,
        RoomDetailsData: null,
        shouldCloseAll: false, // reset the value to default
      });
    }

    if (RoomDetailsData) {
      setter({ RoomDetailsData: null });
    } else {
      setter({ isRoomDetailsShown: false });
    }
  };

  // Helper functions for header rendering
  const renderHeaderLeft = () => {
    if (rightBarRoute === "/") {
      return (
        <IoClose onClick={closeRoomDetails} className="size-5 cursor-pointer" />
      );
    }

    const handleBack = () => {
      if (rightBarRoute === "/add-channel-members") {
        setter({ rightBarRoute: "/add-subscribers" });
      } else {
        setter({ rightBarRoute: "/" });
      }
    };

    const getHeaderTitle = () => {
      switch (rightBarRoute) {
        case "/add-members":
          return "إضافة أعضاء";
        case "/add-subscribers":
          return "المشتركين";
        case "/add-channel-members":
          return "إضافة مشتركين";
        case "/administrators":
          return "المسؤولون";
        default:
          return "تعديل";
      }
    };

    return (
      <div className="flex gap-6">
        <IoArrowBackOutline
          onClick={handleBack}
          className="size-6 cursor-pointer"
        />
        <div>{getHeaderTitle()}</div>
      </div>
    );
  };

  const renderHeaderRight = () => {
    if (
      rightBarRoute === "/edit-info" ||
      rightBarRoute === "/add-members" ||
      rightBarRoute === "/add-channel-members"
    ) {
      return submitChanges ? (
        <Loading />
      ) : (
        canSubmit && (
          <MdDone
            onClick={() => setSubmitChanges(true)}
            className="size-6 cursor-pointer"
          />
        )
      );
    } else if (
      rightBarRoute === "/" &&
      (roomData as Room)?.admins?.includes(myData._id)
    ) {
      return (
        <MdEdit
          className="size-5 text-gray-400 cursor-pointer"
          onClick={() => setter({ rightBarRoute: "/edit-info" })}
        />
      );
    }
    return null;
  };

  if (!(RoomDetailsData || selectedRoomData)) return null;

  return (
    <Suspense>
      <div
        className={`fixed flex flex-col xl:static h-dvh w-full xl:w-[25%] md:w-[35%] transition-all duration-300 bg-leftBarBg text-white z-50 ${
          isRoomDetailsShown ? "xl:flex right-0" : "xl:hidden -right-full"
        }`}
      >
        <div
          className={`flex items-center justify-between w-full p-3 ${
            rightBarRoute === "/" ? "chatBackground" : "bg-leftBarBg"
          }`}
        >
          {renderHeaderLeft()}
          {renderHeaderRight()}
        </div>
        {activeRoute}
      </div>
    </Suspense>
  );
};

export default RightBar;
