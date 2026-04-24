import LineSeparator from "@/components/modules/LineSeparator";
import MenuItem from "@/components/leftBar/menu/MenuItem";
import useGlobalStore from "@/stores/globalStore";
import useUserStore from "@/stores/userStore";
import useSockets from "@/stores/useSockets";
import { copyText, toaster } from "@/utils";
import Image from "next/image";
import { CgProfile } from "react-icons/cg";
import { CiBookmark } from "react-icons/ci";
import { FiUserPlus } from "react-icons/fi";
import { IoCallOutline, IoSettingsOutline } from "react-icons/io5";
import { LuUsers } from "react-icons/lu";
import { RiUser3Line } from "react-icons/ri";
import { HiOutlineSpeakerphone } from "react-icons/hi";
import { MdOutlineLockClock } from "react-icons/md";
import { useState } from "react";

interface Props {
  updateRoute: (route: string) => void;
  closeMenu: () => void;
  isOpen: boolean;
}

const Main = ({ closeMenu, updateRoute, isOpen }: Props) => {
  const { name, avatar, lastName, rooms, phone } = useUserStore(
    (state) => state
  );
  const socket = useSockets((state) => state.rooms);
  const { setter } = useGlobalStore((state) => state);
  const [imageLoadError, setImageLoadError] = useState(false);

  const copyInviteLink = async () => {
    await copyText("قريباً");
    toaster("success", "تم نسخ رابط الدعوة!");
    closeMenu();
  };

  const openProfile = () => {
    closeMenu();
    updateRoute("settings");
    setter({
      showCreateRoomBtn: false,
      selectedRoom: null,
      isRoomDetailsShown: false,
    });
  };

  const createNewGroup = () => {
    setter({
      selectedRoom: null,
      isRoomDetailsShown: false,
      createRoomType: "group",
    });
    closeMenu();
  };

  const createNewChannel = () => {
    setter({
      selectedRoom: null,
      isRoomDetailsShown: false,
      createRoomType: "channel",
    });
    closeMenu();
  };

  const openSavedMessages = () => {
    const savedMessageRoomID = rooms.find(
      (room) => room.type == "private" && room.participants.length == 1
    )?._id;
    socket?.emit("joining", savedMessageRoomID);
    closeMenu();
  };

  return (
    <nav
      className={`fixed ${
        isOpen ? "left-0" : "-left-full"
      } max-h-screen h-full overflow-auto duration-300 transition-all inset-y-0 z-9999 bg-leftBarBg text-white w-[80%] max-w-80 md:max-w-72 lg:max-w-80`}
    >
      <div className="flex flex-col pt-4 px-4 gap-4 bg-chatBg chatBackground pb-2">
        {avatar && !imageLoadError ? (
          <Image
            className={`size-15 bg-center object-cover rounded-full cursor-pointer`}
            width={60}
            onClick={openProfile}
            height={60}
            quality={100}
            src={avatar}
            alt=""
            unoptimized={avatar.includes('cloudinary')}
            onError={() => setImageLoadError(true)}
            onLoad={() => setImageLoadError(false)}
          />
        ) : (
          <div
            onClick={openProfile}
            className="size-15 shrink-0 bg-darkBlue rounded-full flex-center text-bold text-center text-white cursor-pointer text-lg"
          >
            {name?.length && name[0]}
          </div>
        )}

        <div>
          <p className=" font-vazirBold text-base">{name + " " + lastName}</p>
          <p className="text-darkGray text-xs pt-1">
            +98{" "}
            {phone
              .toString()
              .split("")
              .map((str, index) => {
                if (index < 7) {
                  return str + ((index + 1) % 3 === 0 ? " " : "");
                } else {
                  return str;
                }
              })}
          </p>
        </div>
      </div>

      <div>
        <MenuItem
          icon={<CgProfile />}
          title="ملفي الشخصي"
          onClick={openProfile}
        />

        <LineSeparator />

        <MenuItem
          icon={<LuUsers />}
          title="مجموعة جديدة"
          onClick={createNewGroup}
        />

        <MenuItem
          icon={<HiOutlineSpeakerphone />}
          title="قناة جديدة"
          onClick={createNewChannel}
        />

        <LineSeparator />

        <div className="flex item-center relative">
          <MenuItem
            icon={<RiUser3Line />}
            title="جهات الاتصال"
            onClick={() => {
              closeMenu();
            }}
          />
          <span className="flex items-center gap-1 text-xs text-gray-400 absolute right-3 top-4">
            <MdOutlineLockClock fill="teal" size={15} />
            <span>قريباً!</span>
          </span>
        </div>

        <MenuItem
          icon={<IoCallOutline />}
          title="المكالمات"
          onClick={() => {
            updateRoute("callHistory");
            closeMenu();
          }}
        />

        <MenuItem
          icon={<CiBookmark />}
          title="الرسائل المحفوظة"
          onClick={openSavedMessages}
        />

        <MenuItem
          icon={<IoSettingsOutline />}
          title="الإعدادات"
          onClick={openProfile}
        />

        <LineSeparator />

        <MenuItem
          icon={<FiUserPlus />}
          title="دعوة الأصدقاء"
          onClick={copyInviteLink}
        />
      </div>
    </nav>
  );
};

export default Main;
