import { useCallback, useState, useRef, useEffect } from "react";
import ForwardedIconComponent from "@/components/common/genericIconComponent";

type AudioRendererProps = {
  audioUrl?: string;
};

const AudioRenderer = ({ audioUrl }: AudioRendererProps) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateTime = () => setCurrentTime(audio.currentTime);
    const updateDuration = () => setDuration(audio.duration || 0);
    const handleEnded = () => setIsPlaying(false);

    audio.addEventListener("timeupdate", updateTime);
    audio.addEventListener("loadedmetadata", updateDuration);
    audio.addEventListener("ended", handleEnded);

    return () => {
      audio.removeEventListener("timeupdate", updateTime);
      audio.removeEventListener("loadedmetadata", updateDuration);
      audio.removeEventListener("ended", handleEnded);
    };
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(audio.duration || 0);
    audio.pause();
    audio.currentTime = 0;
  }, [audioUrl]);

  const togglePlayPause = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
      return;
    }

    audio
      .play()
      .then(() => setIsPlaying(true))
      .catch((error) => {
        console.error("Failed to play audio:", error);
      });
  }, [isPlaying]);

  const handleSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    const audio = audioRef.current;
    if (audio) {
      audio.currentTime = newTime;
      setCurrentTime(newTime);
    }
  }, []);

  const formatTime = (time: number) => {
    if (!Number.isFinite(time)) return "0:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60)
      .toString()
      .padStart(2, "0");
    return `${minutes}:${seconds}`;
  };

  if (!audioUrl) {
    return (
      <div className="flex items-center justify-center rounded-lg bg-gray-100 p-4 text-gray-500">
        <div className="text-center">
          <ForwardedIconComponent name="VolumeX" className="mx-auto h-6 w-6" />
          <p className="mt-2 text-xs">音频不可用</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg bg-rose-50/40 p-3">
      <audio ref={audioRef} src={audioUrl} preload="metadata" />

      <div className="flex items-center gap-3">
        <button
          onClick={togglePlayPause}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-500 text-white transition-all hover:bg-rose-600 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:ring-offset-2"
          aria-label={isPlaying ? "暂停" : "播放"}
        >
          {isPlaying ? (
            <ForwardedIconComponent name="Pause" className="h-4 w-4" />
          ) : (
            <ForwardedIconComponent name="Play" className="h-4 w-4" />
          )}
        </button>

        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-600">{formatTime(currentTime)}</span>
            <input
              type="range"
              min="0"
              max={duration || 0}
              step="0.1"
              value={currentTime}
              onChange={handleSeek}
              className="flex-1 h-1 cursor-pointer appearance-none rounded-full bg-gray-300 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-rose-500"
            />
            <span className="text-xs text-gray-600">{formatTime(duration)}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AudioRenderer;
