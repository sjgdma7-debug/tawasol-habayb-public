"use client";
import useAudio from "@/stores/audioStore";
import { toaster } from "@/utils";
import { useEffect, useRef, useMemo } from "react";

interface AudioFile {
  _id: string;
  src?: string;
  downloaded: boolean;
  isDownloading: boolean;
}

const AudioManager = () => {
  const { isPlaying, setter, voiceData, downloadedAudios, setAudioElement } = useAudio(
    (state) => state
  );
  const audioRef = useRef<HTMLAudioElement>(new Audio());
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    setAudioElement(audioRef.current);
  }, [setAudioElement]);

  const isVoiceFileReadyToPlay = useMemo(() => {
    return downloadedAudios.some(
      (audio: { _id: string; downloaded: boolean; isDownloading: boolean }) =>
        audio._id === voiceData?._id && !audio.isDownloading && audio.downloaded
    );
  }, [downloadedAudios, voiceData?._id]);

  useEffect(() => {
    if (!isPlaying && audioRef.current) {
      audioRef.current.pause();
    }
  }, [isPlaying]);

  useEffect(() => {
    if (!audioRef.current) return;

    const audio = audioRef.current;

    if (voiceData && audio.src !== voiceData.src) {
      audio.pause();
      audio.currentTime = 0;
      audio.src = voiceData.src;
      audio.load();
    }

    if (isPlaying && isVoiceFileReadyToPlay) {
      audio.play();
    } else if (!isPlaying && !audio.paused) {
      audio.pause();
    }

    const handleCanPlayThrough = () => {
      setter((prev: { downloadedAudios: AudioFile[]; isPlaying: boolean }) => ({
        downloadedAudios: prev.downloadedAudios.map((audio: AudioFile) =>
          audio._id === voiceData?._id
            ? { ...audio, downloaded: true, isDownloading: false }
            : audio
        ),
        isPlaying: true,
      }));
    };

    const handleError = (e: ErrorEvent) => {
      console.error("Audio load error:", e, "Audio src:", audio.src);
      
      // Check if the error is due to invalid URL or network issue
      let errorMessage = "فشل تحميل الملف الصوتي";
      
      if (audio.error) {
        switch (audio.error.code) {
          case MediaError.MEDIA_ERR_ABORTED:
            errorMessage = "تم إلغاء تحميل الملف الصوتي";
            break;
          case MediaError.MEDIA_ERR_NETWORK:
            errorMessage = "خطأ في الشبكة! تحقق من اتصال الإنترنت";
            break;
          case MediaError.MEDIA_ERR_DECODE:
            errorMessage = "الملف الصوتي تالف أو غير مدعوم";
            break;
          case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
            errorMessage = "نوع الملف الصوتي غير مدعوم";
            break;
          default:
            errorMessage = "فشل تحميل الملف الصوتي";
        }
      }
      
      toaster("error", errorMessage);

      setter({
        downloadedAudios: downloadedAudios.filter(
          (audio: {
            _id: string;
            downloaded: boolean;
            isDownloading: boolean;
          }) => audio._id !== voiceData?._id
        ),
        isPlaying: false,
        voiceData: null,
      });
    };

    audio.addEventListener("canplaythrough", handleCanPlayThrough);
    audio.addEventListener("error", handleError);

    return () => {
      audio.removeEventListener("canplaythrough", handleCanPlayThrough);
      audio.removeEventListener("error", handleError);
    };
  }, [isPlaying, isVoiceFileReadyToPlay, voiceData, setter, downloadedAudios]);



  useEffect(() => {
    if (!audioRef.current) return;
    const audio = audioRef.current;

    const updateProgress = () => {
      if (!audio.duration) return;
      setter({ currentTime: Math.floor(audio.currentTime) });

      if (!audio.paused) {
        animationFrameRef.current = requestAnimationFrame(updateProgress);
      }
    };

    if (isPlaying) {
      animationFrameRef.current = requestAnimationFrame(updateProgress);
    } else if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isPlaying, setter]);

  return null;
};

export default AudioManager;
