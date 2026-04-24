"use client";

import useGlobalStore from "@/stores/globalStore";
import useUserStore from "@/stores/userStore";
import useSockets from "@/stores/useSockets";
import React, {
  lazy,
  useEffect,
  useMemo,
  useState,
  useCallback,
  useRef,
  Suspense,
} from "react";
import { BiSearch } from "react-icons/bi";
import { RxHamburgerMenu } from "react-icons/rx";

import ChatCard from "./ChatCard";
import RoomSkeleton from "../modules/ui/RoomSkeleton";
import RoomFolders from "./RoomFolders";
import useConnection from "@/hook/useConnection";
import Message from "@/models/message";
import NotificationPermission from "@/utils/NotificationPermission";
import DoctorCard from "./DoctorCard";

const CreateRoomBtn = lazy(() => import("@/components/leftBar/CreateRoomBtn"));
const LeftBarMenu = lazy(() => import("@/components/leftBar/menu/LeftBarMenu"));
const SearchPage = lazy(() => import("@/components/leftBar/SearchPage"));
const CreateRoom = lazy(() => import("@/components/leftBar/CreateRoom"));

interface Doctor {
  _id: string;
  name: string;
  lastName: string;
  username: string;
  phone: string;
  avatar?: string;
  biography?: string;
  status: "online" | "offline";
}

const LeftBar = () => {
  const [filterBy, setFilterBy] = useState("all");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isLeftBarMenuOpen, setIsLeftBarMenuOpen] = useState(false);
  const [leftBarActiveRoute, setLeftBarActiveRoute] = useState("/");
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loadingDoctors, setLoadingDoctors] = useState(false);
  const ringAudioRef = useRef<HTMLAudioElement>(null);

  const userId = useUserStore((state) => state._id);
  const { updater, rooms: roomsSocket } = useSockets((state) => state);
  const { setter: userDataUpdater, rooms: userRooms } = useUserStore(
    (state) => state
  );

  const {
    selectedRoom,
    setter,
    isRoomDetailsShown,
    createRoomType,
    showCreateRoomBtn,
  } = useGlobalStore((state) => state);
  const interactUser = useRef(false);

  useEffect(() => {
    NotificationPermission();
    const handleContextMenu = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target?.tagName === "TEXTAREA" || target?.tagName === "INPUT") {
        return;
      }
      e.preventDefault();
    };
    document.addEventListener("contextmenu", handleContextMenu);
    
    // ✅ معالج رسائل Service Worker لفتح المحادثة عند النقر على الإشعار
    const handleServiceWorkerMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'OPEN_ROOM') {
        const { roomID } = event.data;
        
        console.log('📬 Service Worker requested to open room:', roomID);
        
        // البحث عن الغرفة في قائمة الغرف
        const targetRoom = userRooms.find((room) => room._id === roomID);
        
        if (targetRoom) {
          // فتح الغرفة
          setter({ 
            selectedRoom: targetRoom,
            isRoomDetailsShown: false 
          });
          
          // إرسال حدث joining
          roomsSocket?.emit('joining', roomID);
          
          console.log('✅ Room opened:', roomID);
        } else {
          console.warn('⚠️ Room not found:', roomID);
          // يمكن هنا إعادة تحميل الغرفة من الخادم
          roomsSocket?.emit('joining', roomID);
        }
      }
    };
    
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', handleServiceWorkerMessage);
    }
    
    return () => {
      document.removeEventListener("contextmenu", handleContextMenu);
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', handleServiceWorkerMessage);
      }
    };
  }, [userRooms, setter, roomsSocket]);

  useEffect(() => {
    document.addEventListener("click", () => (interactUser.current = true));

    return () => {
      document.addEventListener("click", () => (interactUser.current = true));
    };
  }, []);

  const playRingSound = useCallback(() => {
    if (ringAudioRef.current && interactUser.current) {
      ringAudioRef.current.currentTime = 0;
      ringAudioRef.current.play();
    }
  }, []);

  useEffect(() => {
    const handleNewMessage = async (newMsg: Message) => {
      if (newMsg.roomID !== selectedRoom?._id || !selectedRoom?._id) {
        // ✅ إرسال الإشعار سواء كان التطبيق مفتوحاً أم لا
        if (
          "serviceWorker" in navigator &&
          Notification.permission === "granted"
        ) {
          try {
            const registration = await navigator.serviceWorker.ready;
            
            // ✅ تشغيل اهتزاز الجهاز إذا كان مدعوماً
            if ('vibrate' in navigator) {
              navigator.vibrate([200, 100, 200]);
            }
            
            // بناء بيانات الإشعار بدون خصائص غير مدعومة في TypeScript
            const notificationData: NotificationOptions = {
              body: newMsg.message || "لديك رسالة جديدة",
              icon: newMsg.sender.avatar || "/images/favicon.svg",
              badge: "/images/favicon-96x96.png",
              tag: newMsg.roomID, // استخدام roomID كـ tag لتجميع الرسائل
              requireInteraction: false,
              data: {
                url: window.location.origin + `/?roomID=${newMsg.roomID}`,
                roomID: newMsg.roomID,
                senderID: newMsg.sender._id,
                messageID: newMsg._id
              },
              dir: "rtl" as NotificationDirection,
              silent: false
            };
            
            // إرسال الإشعار
            await registration.showNotification(
              newMsg.sender.name || "رسالة جديدة",
              notificationData
            );
            
            console.log('✅ Notification sent:', newMsg.sender.name || "رسالة جديدة");
          } catch (error) {
            console.error('❌ Error showing notification:', error);
          }
        }
        
        // تشغيل صوت التنبيه فقط إذا كان التطبيق مفتوحاً
        if (document.visibilityState === "visible") {
          playRingSound();
        }
      }
    };

    roomsSocket?.on("newMessage", handleNewMessage);

    return () => {
      roomsSocket?.off("newMessage", handleNewMessage);
    };
  }, [playRingSound, roomsSocket, selectedRoom]);

  const { status, isPageLoaded } = useConnection({
    selectedRoom,
    setter,
    userId,
    userDataUpdater,
    updater,
  });

  // جلب البنات عندما يتم اختيار تبويب "بنات"
  useEffect(() => {
    if (filterBy === "bot") {
      fetchDoctors();
    }
  }, [filterBy]);

  const fetchDoctors = async () => {
    try {
      setLoadingDoctors(true);
      const response = await fetch("/api/doctors");
      const data = await response.json();
      
      if (data.success) {
        setDoctors(data.doctors);
      }
    } catch (error) {
      console.error("Error fetching doctors:", error);
    } finally {
      setLoadingDoctors(false);
    }
  };

  // دالة للحصول على معرف المستخدم من participant
  const getUserId = (participant: any): string => {
    if (typeof participant === 'string') {
      return participant;
    }
    return participant?._id || participant?.id || '';
  };

  // النقر على بنت - بنفس منطق SearchResultCard
  const handleDoctorClick = useCallback((doctor: Doctor) => {
    console.log('👨‍⚕️ Clicked on doctor:', doctor.name, doctor._id);
    
    // البحث عن غرفة موجودة - نفس منطق SearchResultCard
    const existingRoom = userRooms.find((room) => {
      return (
        room._id === doctor._id || // For channel & groups
        room.name === userId + "-" + doctor._id || // for private chats
        room.name === doctor._id + "-" + userId // for private chats (reversed order)
      );
    });

    console.log('🔍 Existing room found:', existingRoom ? existingRoom._id : 'none');

    if (existingRoom) {
      // ✅ فتح الغرفة الموجودة مباشرة
      console.log('✅ Opening existing room:', existingRoom._id);
      
      try {
        // ✅ التأكد من أن الغرفة تحتوي على بيانات كاملة لتجنب خطأ undefined
        // إعادة بناء بيانات المشاركين بشكل آمن
        const safeParticipants = (existingRoom.participants || []).map(p => {
          if (typeof p === 'string') {
            // إذا كان المشارك مجرد ID، نبحث عنه في قائمة الغرف
            const foundUser = userRooms
              .flatMap(r => r.participants)
              .find(user => typeof user !== 'string' && user._id === p);
            return foundUser || p;
          }
          return p;
        });

        const safeRoom = {
          ...existingRoom,
          participants: safeParticipants,
          admins: existingRoom.admins || [],
          messages: existingRoom.messages || [],
          _id: existingRoom._id || "",
          name: existingRoom.name || "",
          type: existingRoom.type || "private",
        };
        
        setter({ 
          isRoomDetailsShown: false, 
          selectedRoom: safeRoom 
        });
        
        // إرسال حدث joining
        roomsSocket?.emit("joining", existingRoom._id);
        
      } catch (error) {
        console.error('❌ Error opening existing room:', error);
        alert('حدث خطأ في فتح المحادثة. يرجى المحاولة مرة أخرى.');
      }
      
      return; // ✅ الخروج من الدالة هنا
    } else {
      console.log('➕ Creating new room with doctor');
      // إنشاء كائن User كامل للبنت مع إضافة الخصائص المفقودة
      const myUserData = {
        _id: userId,
        name: useUserStore.getState().name || "",
        lastName: useUserStore.getState().lastName || "",
        username: useUserStore.getState().username || "",
        phone: useUserStore.getState().phone || "",
        avatar: useUserStore.getState().avatar || "",
        biography: useUserStore.getState().biography || "",
        password: "",
        rooms: [],
        role: "user" as const,
        status: "online" as const,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isLogin: true, // إضافة الخاصية المفقودة
        roomMessageTrack: [] // إضافة الخاصية المفقودة
      };

      const doctorAsUser = {
        _id: doctor._id,
        name: doctor.name,
        lastName: doctor.lastName,
        username: doctor.username,
        phone: doctor.phone,
        avatar: doctor.avatar || "",
        biography: doctor.biography || "",
        password: "",
        rooms: [],
        role: "doctor" as const,
        status: doctor.status,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isLogin: false, // إضافة الخاصية المفقودة
        roomMessageTrack: [] // إضافة الخاصية المفقودة
      };

      // استخدام نفس المنطق الموجود في SearchResultCard
      const userRoom = {
        admins: [userId, doctor._id],
        avatar: "",
        createdAt: Date.now().toString(),
        creator: userId,
        link: (Math.random() * 9999999).toString(),
        locations: [],
        medias: [],
        messages: [],
        name: userId + "-" + doctor._id,
        participants: [myUserData, doctorAsUser],
        type: "private" as const,
        updatedAt: Date.now().toString(),
        _id: "",
        lastMsgData: null,
        notSeenCount: 0
      };

      // ✅ إنشاء الغرفة على الخادم أولاً ثم فتحها
      console.log('📤 Emitting createRoom event with data:', {
        name: userRoom.name,
        participants: [userId, doctor._id],
        type: 'private'
      });

      // إرسال طلب إنشاء الغرفة مع بيانات صحيحة
      roomsSocket?.emit("createRoom", { 
        newRoomData: {
          name: userRoom.name,
          type: "private",
          participants: [userId, doctor._id], // ✅ إرسال IDs فقط
          admins: [userId, doctor._id],
          avatar: userRoom.avatar,
          creator: userId,
          link: userRoom.link,
          locations: [],
          medias: [],
          messages: []
        }
      });

      // ✅ الاستماع لحدث إنشاء الغرفة
      const handleRoomCreated = (createdRoom: any) => {
        console.log('✅ Room created successfully:', createdRoom._id);
        
        // تحديث الغرفة بالمعرف الصحيح
        userRoom._id = createdRoom._id;
        
        // فتح الغرفة بعد إنشائها
        setter({ isRoomDetailsShown: false, selectedRoom: userRoom });
        roomsSocket?.emit("joining", createdRoom._id);
        
        // ✅ إزالة المستمع بعد الاستخدام
        roomsSocket?.off("createRoom", handleRoomCreated);
        roomsSocket?.off("createRoomError", handleRoomError);
      };

      // ✅ معالجة الأخطاء
      const handleRoomError = (error: any) => {
        console.error('❌ Failed to create room:', error);
        alert(`فشل إنشاء المحادثة: ${error.error || 'خطأ غير معروف'}`);
        
        // ✅ إزالة المستمعين
        roomsSocket?.off("createRoom", handleRoomCreated);
        roomsSocket?.off("createRoomError", handleRoomError);
      };

      roomsSocket?.once("createRoom", handleRoomCreated);
      roomsSocket?.once("createRoomError", handleRoomError);
    }
  }, [userId, userRooms, setter, roomsSocket]);

  //Sort rooms by filter and last message time
  const sortedRooms = useMemo(() => {
    const filteredRooms =
      filterBy === "all"
        ? userRooms
        : userRooms.filter((room) => room.type === filterBy);

    return filteredRooms.sort((a, b) => {
      const aTime = a?.lastMsgData?.createdAt
        ? new Date(a.lastMsgData.createdAt).getTime()
        : 0;
      const bTime = b?.lastMsgData?.createdAt
        ? new Date(b.lastMsgData.createdAt).getTime()
        : 0;
      return bTime - aTime;
    });
  }, [userRooms, filterBy]);

  const handleOpenLeftBarMenu = useCallback(() => {
    setIsLeftBarMenuOpen(true);
  }, []);

  const handleCloseLeftBarMenu = useCallback(() => {
    setIsLeftBarMenuOpen(false);
  }, []);

  const handleOpenSearch = useCallback(() => {
    setIsSearchOpen(true);
  }, []);

  const handleCloseSearch = useCallback(() => {
    setIsSearchOpen(false);
  }, []);

  const containerClassName = useMemo(() => {
    return `size-full h-dvh ${
      selectedRoom ? "hidden" : ""
    } md:block md:w-[40%] lg:w-[35%] ${
      isRoomDetailsShown ? "xl:w-[25%]" : "xl:w-[30%]"
    } relative border-r border-chatBg/[50%]`;
  }, [selectedRoom, isRoomDetailsShown]);

  return (
    <>
      <div className={containerClassName}>
        <LeftBarMenu
          isOpen={isLeftBarMenuOpen}
          closeMenu={handleCloseLeftBarMenu}
          onRouteChanged={setLeftBarActiveRoute}
        />
        {createRoomType && (
          <Suspense>
            <CreateRoom />
          </Suspense>
        )}
        {isPageLoaded && showCreateRoomBtn && <CreateRoomBtn />}
        {isSearchOpen && <SearchPage closeSearch={handleCloseSearch} />}

        {leftBarActiveRoute !== "/settings" && (
          <div
            data-aos-duration="400"
            data-aos="fade-right"
            id="leftBar-container"
            className="flex-1 bg-leftBarBg h-full relative scroll-w-none overflow-y-auto "
          >
            <div
              className="w-full sticky top-0 bg-leftBarBg border-b border-white/5 h-20 overflow-hidden"
              style={{ zIndex: 1 }}
            >
              <div className="flex items-center justify-between gap-6 mx-3">
                <div className="flex items-center flex-1 gap-5 mt-3 w-full text-white">
                  <RxHamburgerMenu
                    size={20}
                    onClick={handleOpenLeftBarMenu}
                    className="cursor-pointer"
                  />
                  <h1 className="font-vazirBold mt-0.5">{status === "Telegram" ? "تواصل حبايب ❤" : status}</h1>
                </div>
                <BiSearch
                  size={22}
                  onClick={handleOpenSearch}
                  className="cursor-pointer text-white/90 mt-3"
                />
              </div>
              <RoomFolders updateFilterBy={setFilterBy} />
            </div>

            <div
              className="flex flex-col overflow-y-auto overflow-x-hidden scroll-w-none w-full"
              style={{ zIndex: 0 }}
            >
              {filterBy === "bot" ? (
                // عرض بنات
                loadingDoctors ? (
                  <RoomSkeleton />
                ) : doctors.length > 0 ? (
                  <div className="flex flex-col">
                    <div className="px-4 py-3 bg-pink-600/20 border-b border-pink-600/30">
                      <h2 className="text-white font-bold text-center">
                        👩‍🦰 بنات حبايب ({doctors.length})
                      </h2>
                    </div>
                    {doctors.map((doctor) => (
                      <DoctorCard
                        key={doctor._id}
                        doctor={doctor}
                        onClick={() => handleDoctorClick(doctor)}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="text-xl text-white font-bold w-full text-center font-vazirBold pt-20">
                    <div className="flex flex-col items-center gap-4">
                      <span className="text-6xl">👩‍🦰</span>
                      <p>لا يوجد بنات متاحات حالياً</p>
                      <p className="text-sm text-gray-400">
                        سيتم إضافة بنات قريباً
                      </p>
                    </div>
                  </div>
                )
              ) : (
                // عرض المحادثات العادية
                isPageLoaded ? (
                  sortedRooms.length ? (
                    sortedRooms.map((data) => (
                      <ChatCard {...data} key={data?._id} />
                    ))
                  ) : (
                    <div className="text-xl text-white font-bold w-full text-center font-vazirBold pt-20">
                      لا توجد محادثات
                    </div>
                  )
                ) : (
                  <RoomSkeleton />
                )
              )}
            </div>
          </div>
        )}
        <audio
          ref={ringAudioRef}
          className="hidden invisible opacity-0"
          src="/files/new_msg.mp3"
        ></audio>
      </div>
    </>
  );
};

export default LeftBar;
