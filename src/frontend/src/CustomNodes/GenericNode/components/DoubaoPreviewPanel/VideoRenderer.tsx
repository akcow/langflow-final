import { useCallback, useRef } from 'react';
import ForwardedIconComponent from '@/components/common/genericIconComponent';

type VideoRendererProps = {
  videoUrl?: string;
  poster?: string;
  duration?: string;
};

const VideoRenderer = ({ videoUrl, poster, duration }: VideoRendererProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  const handleFullscreen = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (videoRef.current) {
      if (videoRef.current.requestFullscreen) {
        videoRef.current.requestFullscreen();
      }
    }
  }, []);

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
    <div className="group relative overflow-hidden rounded-lg transition-transform hover:scale-[1.02]">
      <video
        ref={videoRef}
        src={videoUrl}
        poster={poster}
        className="max-h-48 w-full rounded-lg object-cover"
        preload="metadata"
        muted
        loop
      />
      <div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all group-hover:bg-black/20 group-hover:opacity-100">
        <div className="rounded-full bg-white/90 p-3 shadow-lg">
          <ForwardedIconComponent name="Play" className="h-6 w-6 text-gray-800" />
        </div>
      </div>
      <button
        onClick={handleFullscreen}
        className="absolute bottom-2 right-2 rounded-full bg-black/60 p-2 opacity-0 transition-all hover:bg-black/80 group-hover:opacity-100"
        title="全屏播放"
      >
        <ForwardedIconComponent name="Maximize2" className="h-3 w-3 text-white" />
      </button>
      {duration && (
        <div className="absolute bottom-2 left-2 rounded bg-black/60 px-2 py-1 text-xs text-white">
          时长：{duration}
        </div>
      )}
    </div>
  );
};

export default VideoRenderer;
