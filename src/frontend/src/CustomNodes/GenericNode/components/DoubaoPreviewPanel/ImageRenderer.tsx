import { useCallback, useState, useRef } from 'react';
import ForwardedIconComponent from '@/components/common/genericIconComponent';

type ImageRendererProps = {
  src: string;
  size?: string;
  onError?: (error: Error) => void;
  onMeta?: (meta: any) => void;
  meta?: Record<string, any>;
};

const ImageRenderer = ({ src, size, onError, onMeta, meta }: ImageRendererProps) => {
  const [imageError, setImageError] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  const handleImageError = useCallback((error: React.SyntheticEvent<HTMLImageElement>) => {
    console.error('Image load error:', error);
    setImageError(true);
    onError?.(new Error('Failed to load image'));
  }, [onError]);

  const handleImageLoad = useCallback(() => {
    setImageError(false);
    if (imgRef.current && onMeta) {
      onMeta({
        width: imgRef.current.naturalWidth,
        height: imgRef.current.naturalHeight,
        aspectRatio: imgRef.current.naturalWidth / imgRef.current.naturalHeight,
      });
    }
  }, [onMeta]);

  if (imageError) {
    return (
      <div className="flex aspect-[16/9] items-center justify-center rounded-lg bg-red-50 text-red-600">
        <div className="text-center">
          <ForwardedIconComponent name="ImageOff" className="mx-auto h-8 w-8" />
          <p className="mt-2 text-xs">图片加载失败</p>
        </div>
      </div>
    );
  }

  return (
    <div className="group relative overflow-hidden rounded-lg transition-transform hover:scale-[1.02]">
      <img
        ref={imgRef}
        src={src}
        alt="Generated image"
        className="max-h-48 w-full rounded-lg object-cover"
        onError={handleImageError}
        onLoad={handleImageLoad}
        loading="lazy"
      />
      <div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all group-hover:bg-black/20 group-hover:opacity-100">
        <div className="rounded-full bg-white/90 p-2 shadow-lg">
          <ForwardedIconComponent name="ZoomIn" className="h-4 w-4 text-gray-800" />
        </div>
      </div>
      {size && (
        <div className="absolute bottom-2 left-2 rounded bg-black/60 px-2 py-1 text-xs text-white">
          {size}
        </div>
      )}
    </div>
  );
};

export default ImageRenderer;
