import Image from "next/image";
import React, { useEffect, useRef, useState } from "react";
import { CgClose } from "react-icons/cg";
import { TbDownload } from "react-icons/tb";
import { AiOutlineZoomIn, AiOutlineZoomOut } from "react-icons/ai";

interface ImageViewerProps {
  imageUrl: string;
  onClose: () => void;
}

const ImageViewer = ({ imageUrl, onClose }: ImageViewerProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Zoom control with mouse wheel
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 0.1 : -0.1;
      setScale((prev) => {
        const newScale = prev + delta;
        return newScale < 0.5 ? 0.5 : newScale > 3 ? 3 : newScale;
      });
    };

    container.addEventListener("wheel", handleWheel, { passive: false });
    return () => container.removeEventListener("wheel", handleWheel);
  }, []);

  // Handle mouse drag to move image
  const handleMouseDown = (e: React.MouseEvent) => {
    if (scale > 1) {
      setIsDragging(true);
      setDragStart({
        x: e.clientX - position.x,
        y: e.clientY - position.y,
      });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && scale > 1) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Zoom buttons
  const zoomIn = () => {
    setScale((prev) => (prev < 3 ? prev + 0.2 : 3));
  };

  const zoomOut = () => {
    setScale((prev) => {
      const newScale = prev - 0.2;
      if (newScale <= 1) {
        setPosition({ x: 0, y: 0 }); // Reset position when zooming out to 1x
        return 1;
      }
      return newScale < 0.5 ? 0.5 : newScale;
    });
  };

  const resetZoom = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  // Close on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 bg-black/95 flex items-center justify-center z-50"
      ref={containerRef}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="relative cursor-move"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <Image
          src={imageUrl}
          alt="عرض الصورة"
          className="max-w-[90vw] max-h-[90vh] select-none rounded-lg object-contain"
          width={1200}
          height={800}
          style={{
            transform: `scale(${scale}) translate(${position.x / scale}px, ${
              position.y / scale
            }px)`,
            cursor: scale > 1 ? (isDragging ? "grabbing" : "grab") : "default",
          }}
          draggable={false}
          unoptimized={imageUrl.includes("cloudinary")}
          priority
        />
      </div>

      {/* Control buttons */}
      <div className="absolute top-4 right-4 flex items-center gap-2">
        {/* Zoom controls */}
        <div className="flex items-center gap-1 bg-gray-800/80 backdrop-blur-sm rounded-full p-1">
          <button
            onClick={zoomOut}
            className="p-2 hover:bg-gray-700 rounded-full transition-all"
            title="تصغير"
          >
            <AiOutlineZoomOut className="size-5 text-white" />
          </button>
          <button
            onClick={resetZoom}
            className="px-3 py-2 hover:bg-gray-700 rounded-full transition-all text-white text-sm"
            title="إعادة تعيين"
          >
            {Math.round(scale * 100)}%
          </button>
          <button
            onClick={zoomIn}
            className="p-2 hover:bg-gray-700 rounded-full transition-all"
            title="تكبير"
          >
            <AiOutlineZoomIn className="size-5 text-white" />
          </button>
        </div>

        {/* Download button */}
        <a
          href={imageUrl}
          download
          className="bg-gray-800/80 backdrop-blur-sm rounded-full p-2 cursor-pointer hover:bg-gray-700 focus:outline-none transition-all"
          title="تحميل الصورة"
        >
          <TbDownload className="size-5 text-white" />
        </a>

        {/* Close button */}
        <button
          className="bg-gray-800/80 backdrop-blur-sm rounded-full p-2 cursor-pointer hover:bg-gray-700 focus:outline-none transition-all"
          onClick={onClose}
          title="إغلاق"
        >
          <CgClose className="size-5 text-white" />
        </button>
      </div>

      {/* Instructions */}
      {scale === 1 && (
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-black/70 backdrop-blur-sm text-white text-sm px-4 py-2 rounded-full">
          استخدم عجلة الماوس للتكبير • اضغط للسحب عند التكبير
        </div>
      )}
    </div>
  );
};

export default ImageViewer;
