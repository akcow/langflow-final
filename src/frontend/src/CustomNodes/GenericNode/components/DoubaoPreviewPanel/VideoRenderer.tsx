import { useCallback, useEffect, useRef, useState } from "react";
import ForwardedIconComponent from "@/components/common/genericIconComponent";

type VideoRendererProps = {
  videoUrl?: string;
  poster?: string;
  duration?: string;
};

const VideoRenderer = ({ videoUrl, poster, duration }: VideoRendererProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => setCurrentTime(video.currentTime);
    const handleLoadedMetadata = () =>
      setVideoDuration(video.duration || 0);
    const handleEnded = () => setIsPlaying(false);

    video.addEventListener("timeupdate", handleTimeUpdate);
    video.addEventListener("loadedmetadata", handleLoadedMetadata);
    video.addEventListener("ended", handleEnded);

    return () => {
      video.removeEventListener("timeupdate", handleTimeUpdate);
      video.removeEventListener("loadedmetadata", handleLoadedMetadata);
      video.removeEventListener("ended", handleEnded);
    };
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    setIsPlaying(false);
    setCurrentTime(0);
    setVideoDuration(video.duration || 0);
    video.pause();
    video.currentTime = 0;
  }, [videoUrl]);

  const togglePlayback = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.pause();
      setIsPlaying(false);
      return;
    }

    video
      .play()
      .then(() => setIsPlaying(true))
      .catch((error) => {
        console.error("Failed to play video:", error);
      });
  }, [isPlaying]);

  const handleSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    const video = videoRef.current;
    if (video) {
      video.currentTime = newTime;
      setCurrentTime(newTime);
    }
  }, []);

  const formatTime = (time: number) => {
    if (!Number.isFinite(time)) return "00:00";
    const minutes = Math.floor(time / 60)
      .toString()
      .padStart(2, "0");
    const seconds = Math.floor(time % 60)
      .toString()
      .padStart(2, "0");
    return `${minutes}:${seconds}`;
  };

  if (!videoUrl) {
    return (
      <div className="flex aspect-[16/9] items-center justify-center rounded-lg bg-gray-100 text-gray-500">
        <div className="text-center">
          <ForwardedIconComponent name="VideoOff" className="mx-auto h-8 w-8" />
          <p className="mt-2 text-xs">视频不可用</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-lg bg-black">
      <video
        ref={videoRef}
        src={videoUrl}
        poster={poster}
        className="max-h-48 w-full object-cover"
        preload="metadata"
        playsInline
      />

      <div className="absolute inset-x-0 bottom-0 flex flex-col gap-2 bg-gradient-to-t from-black/80 via-black/30 to-transparent p-3 text-white">
        <div className="flex items-center gap-3">
          <button
            onClick={togglePlayback}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-white transition hover:bg-white/30"
            aria-label={isPlaying ? "暂停" : "播放"}
          >
            {isPlaying ? (
              <ForwardedIconComponent name="Pause" className="h-4 w-4" />
            ) : (
              <ForwardedIconComponent name="Play" className="h-4 w-4" />
            )}
          </button>

          <input
            type="range"
            min="0"
            max={videoDuration || 0}
            step="0.1"
            value={currentTime}
            onChange={handleSeek}
            className="flex-1 h-1 cursor-pointer appearance-none rounded-full bg-white/40 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white"
          />

          <span className="text-xs tabular-nums">
            {formatTime(currentTime)} / {formatTime(videoDuration)}
          </span>
        </div>
        {duration && (
          <div className="text-[11px] text-white/80">预计时长：{duration}</div>
        )}
      </div>
    </div>
  );
};

export default VideoRenderer;
