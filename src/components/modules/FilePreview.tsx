import Image from "next/image";
import { IoMdClose } from "react-icons/io";
import { RiSendPlaneFill } from "react-icons/ri";
import { MdAttachFile, MdPictureAsPdf, MdDescription } from "react-icons/md";
import { BsFileEarmarkText, BsFileEarmarkZip } from "react-icons/bs";
import { useState } from "react";

interface FilePreviewProps {
  file: File;
  previewUrl: string | null;
  text: string;
  setText: (text: string) => void;
  onSend: () => void;
  onCancel: () => void;
  isUploading: boolean;
  uploadProgress: number;
}

const FilePreview = ({
  file,
  previewUrl,
  text,
  setText,
  onSend,
  onCancel,
  isUploading,
  uploadProgress,
}: FilePreviewProps) => {
  const [imageLoaded, setImageLoaded] = useState(false);

  const getFileIcon = () => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext === 'pdf') return <MdPictureAsPdf className="size-16 text-red-500" />;
    if (['doc', 'docx'].includes(ext || '')) return <MdDescription className="size-16 text-blue-500" />;
    if (['txt', 'rtf'].includes(ext || '')) return <BsFileEarmarkText className="size-16 text-green-500" />;
    if (['zip', 'rar', '7z'].includes(ext || '')) return <BsFileEarmarkZip className="size-16 text-orange-500" />;
    return <MdAttachFile className="size-16 text-lightBlue" />;
  };

  const formatFileSize = (bytes: number) => {
    const sizes = ['B', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 B';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <div className="fixed inset-0 bg-black/95 z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-gradient-to-r from-darkBlue to-lightBlue">
        <button
          onClick={onCancel}
          className="text-white p-2 hover:bg-white/10 rounded-full transition-all"
          disabled={isUploading}
        >
          <IoMdClose className="size-6" />
        </button>
        <div className="text-center text-white">
          <h3 className="font-bold">معاينة الملف</h3>
          <p className="text-sm opacity-80">{file.name}</p>
        </div>
        <div className="w-10"></div>
      </div>

      {/* Progress Bar */}
      {isUploading && (
        <div className="px-4 py-2 bg-darkBlue/50">
          <div className="w-full bg-gray-700 rounded-full h-2">
            <div
              className="bg-gradient-to-r from-lightBlue to-green-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
          <p className="text-xs text-white text-center mt-1">
            جاري الرفع... {uploadProgress}%
          </p>
        </div>
      )}

      {/* Preview Content */}
      <div className="flex-1 overflow-auto flex items-center justify-center p-4">
        <div className="max-w-4xl w-full">
          {file.type.startsWith('image/') && previewUrl ? (
            <div className="relative">
              {!imageLoaded && (
                <div className="bg-gray-800 animate-pulse h-96 rounded-lg flex items-center justify-center">
                  <span className="text-gray-400">جاري التحميل...</span>
                </div>
              )}
              <Image
                src={previewUrl}
                alt="Preview"
                width={800}
                height={600}
                className={`w-full h-auto object-contain rounded-lg shadow-2xl ${
                  imageLoaded ? 'block' : 'hidden'
                }`}
                onLoad={() => setImageLoaded(true)}
                priority
              />
            </div>
          ) : file.type.startsWith('video/') && previewUrl ? (
            <video
              src={previewUrl}
              controls
              className="w-full max-h-96 rounded-lg shadow-2xl"
              preload="metadata"
            />
          ) : file.type.startsWith('audio/') && previewUrl ? (
            <div className="bg-gradient-to-br from-purple-900 to-blue-900 p-8 rounded-xl shadow-2xl max-w-md mx-auto">
              <div className="text-center mb-6">
                <div className="w-20 h-20 bg-purple-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-3xl">🎵</span>
                </div>
                <h3 className="text-white font-bold text-lg truncate">{file.name}</h3>
                <p className="text-purple-200 text-sm">{formatFileSize(file.size)}</p>
              </div>
              <audio
                src={previewUrl}
                controls
                className="w-full"
                preload="metadata"
              />
            </div>
          ) : (
            // Other file types
            <div className="bg-gradient-to-br from-darkBlue to-gray-800 p-8 rounded-xl shadow-2xl max-w-md mx-auto text-center">
              <div className="mb-6">
                {getFileIcon()}
              </div>
              <h3 className="text-white font-bold text-lg mb-2 break-all">
                {file.name}
              </h3>
              <p className="text-gray-300 text-sm mb-4">
                {formatFileSize(file.size)}
              </p>
              <div className="bg-white/10 rounded-lg p-3">
                <p className="text-white/80 text-xs">
                  سيتم رفع هذا الملف وإرساله كمرفق
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Caption Input */}
      <div className="bg-leftBarBg p-4 border-t border-gray-700">
        {isUploading ? (
          <div className="text-center text-white/60">
            <p>جاري رفع الملف، يرجى الانتظار...</p>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="أضف تعليقاً (اختياري)..."
              className="flex-1 bg-chatBg text-white rounded-full px-4 py-3 text-sm outline-none border border-gray-600 focus:border-lightBlue transition-colors"
              disabled={isUploading}
              autoFocus
            />
            <button
              onClick={onSend}
              disabled={isUploading}
              className="bg-gradient-to-r from-lightBlue to-blue-600 text-white p-3 rounded-full hover:from-blue-600 hover:to-lightBlue transition-all transform hover:scale-105 disabled:opacity-50 disabled:transform-none"
            >
              <RiSendPlaneFill className="size-5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default FilePreview;
