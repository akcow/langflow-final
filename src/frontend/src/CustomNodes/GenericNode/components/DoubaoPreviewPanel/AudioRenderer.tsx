import { useCallback, useState, useRef, useEffect } from 'react';
import ForwardedIconComponent from '@/components/common/genericIconComponent';

type AudioRendererProps = {
  audioData?: string;
  audioType?: string;
  downloadUrl?: string;
  fileName?: string;
};

const AudioRenderer = ({ audioData, audioType, downloadUrl, fileName }: AudioRendererProps) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);

  const audioUrl = audioData
    ? `data:audio/${audioType || 'mp3'};base64,${audioData}`
    : downloadUrl;

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateTime = () => setCurrentTime(audio.currentTime);
    const updateDuration = () => setDuration(audio.duration);
    const handleEnded = () => setIsPlaying(false);

    audio.addEventListener('timeupdate', updateTime);
    audio.addEventListener('loadedmetadata', updateDuration);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', updateTime);
      audio.removeEventListener('loadedmetadata', updateDuration);
      audio.removeEventListener('ended', handleEnded);
    };
  }, []);

  const togglePlayPause = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  }, [isPlaying]);

  const handleDownload = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (!audioUrl || !fileName) return;

    const link = document.createElement('a');
    link.href = audioUrl;
    link.download = fileName;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [audioUrl, fileName]);

  const handleSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  }, []);

  const formatTime = (time: number) => {
    if (isNaN(time)) return '0:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
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
    <div className="bg-rose-50/40 rounded-lg p-3">
      <audio ref={audioRef} src={audioUrl} preload="metadata" />

      <div className="flex items-center gap-3">
        <button
          onClick={togglePlayPause}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-500 text-white transition-all hover:bg-rose-600 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:ring-offset-2"
          aria-label={isPlaying ? '暂停' : '播放'}
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
              value={currentTime}
              onChange={handleSeek}
              className="flex-1 h-1 cursor-pointer appearance-none rounded-full bg-gray-300 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-rose-500"
            />
            <span className="text-xs text-gray-600">{formatTime(duration)}</span>
          </div>
        </div>

        {downloadUrl && fileName && (
          <button
            onClick={handleDownload}
            className="flex h-8 items-center justify-center rounded-md bg-rose-100 px-3 py-1 text-rose-600 transition-all hover:bg-rose-200 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:ring-offset-1"
            title="下载音频"
          >
            <ForwardedIconComponent name="Download" className="h-3 w-3" />
            <span className="ml-1 text-xs">下载音频</span>
          </button>
        )}
      </div>
    </div>
  );
};

export default AudioRenderer;