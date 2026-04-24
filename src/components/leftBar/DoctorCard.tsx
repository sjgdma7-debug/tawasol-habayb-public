"use client";

import { useEffect, useState } from "react";
import useGlobalStore from "@/stores/globalStore";

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

interface DoctorCardProps {
  doctor: Doctor;
  onClick: () => void;
}

const DoctorCard = ({ doctor, onClick }: DoctorCardProps) => {
  return (
    <div
      onClick={onClick}
      className="flex items-center gap-4 p-4 hover:bg-gray-700/30 cursor-pointer transition-colors border-b border-gray-700/50"
    >
      {/* Avatar */}
      <div className="relative">
        {doctor.avatar ? (
          <img
            src={doctor.avatar}
            alt={doctor.name}
            className="w-14 h-14 rounded-full object-cover"
          />
        ) : (
          <div className="w-14 h-14 rounded-full bg-pink-600 flex items-center justify-center text-white text-xl font-bold">
            {doctor.name.charAt(0)}
          </div>
        )}
        {/* Online indicator */}
        {doctor.status === "online" && (
          <div className="absolute bottom-0 right-0 w-4 h-4 bg-green-500 rounded-full border-2 border-leftBarBg"></div>
        )}
      </div>

      {/* Doctor Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="text-white font-semibold truncate">
            {doctor.name} {doctor.lastName}
          </h3>
          <span className="text-xs text-pink-400">💖</span>
        </div>
        <p className="text-gray-400 text-sm truncate">
          {doctor.biography || `@${doctor.username}`}
        </p>
      </div>

      {/* Status badge */}
      <div className="flex flex-col items-end gap-1">
        <span
          className={`text-xs px-2 py-1 rounded-full ${
            doctor.status === "online"
              ? "bg-green-600/20 text-green-400"
              : "bg-gray-600/20 text-gray-400"
          }`}
        >
          {doctor.status === "online" ? "متصل" : "غير متصل"}
        </span>
      </div>
    </div>
  );
};

export default DoctorCard;
