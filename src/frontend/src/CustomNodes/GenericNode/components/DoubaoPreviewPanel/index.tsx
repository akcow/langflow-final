import { forwardRef, lazy, Suspense, useMemo, useCallback, useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/utils/utils';
import { ForwardedIconComponent } from '@/components/common/genericIconComponent';
import { useDoubaoPreview } from '../../../hooks/use-doubao-preview';

const PANEL_BG = {
  image: "bg-emerald-50 dark:bg-emerald-950/40",
  video: "bg-sky-50 dark:bg-sky-950/40",
  audio: "bg-rose-50 dark:bg-rose-950/40",
};

const DOUBAO_KIND: Record<string, "image" | "video" | "audio"> = {
  DoubaoImageGenerator: "image",
  DoubaoImageEditor: "image",
  DoubaoVideoGenerator: "video",
  DoubaoTTS: "audio",
};

type Props = {
  nodeId: string;
  componentName?: string;
};

function EmptyPreview({
  isBuilding,
  kind,
}: {
  isBuilding: boolean;
  kind: "image" | "video" | "audio";
}) {
  return (
    <div
      className={cn(
        "flex aspect-[16/9] items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/25 text-sm",
        PANEL_BG[kind],
        isBuilding && "opacity-60"
      )}
    >
      <div className="text-center">
        {isBuilding ? (
          <div className="flex flex-col items-center gap-2">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <span className="text-xs text-muted-foreground">构建中，稍后自动更新</span>
          </div>
        ) : (
          <span className="text-muted-foreground">暂无生成结果</span>
        )}
      </div>
    </div>
  );
}

// Lazy load renderers to reduce bundle size
const ImagePreview = lazy(() => import('./ImageRenderer'));
const VideoPreview = lazy(() => import('./VideoRenderer'));
const AudioPreview = lazy(() => import('./AudioRenderer'));

const DoubaoPreviewPanel = forwardRef<HTMLDivElement, Props>(
  ({ nodeId, componentName }, forwardedRef) => {
    const { preview, isBuilding } = useDoubaoPreview(nodeId, componentName);

    const kind = useMemo(() => {
      if (preview?.kind) return preview.kind;
      if (componentName && DOUBAO_KIND[componentName]) {
        return DOUBAO_KIND[componentName];
      }
      return 'image';
    }, [preview?.kind, componentName]);

    const panelClass = useMemo(() => PANEL_BG[kind], [kind]);

    const [hasModalError, setHasModalError] = useState(false);

    const handleModalError = useCallback((error: Error) => {
      console.error('Modal error:', error);
      setHasModalError(true);
      setTimeout(() => setHasModalError(false), 3000);
    }, []);

    const [Component, setComponent] = useState<React.ComponentType<any> | null>(null);
    const [componentProps, setComponentProps] = useState<any>({});
    const [modalMeta, setModalMeta] = useState<any>({});

    useEffect(() => {
      if (!preview?.available) {
        setComponent(null);
        setComponentProps({});
        setModalMeta({});
        return;
      }

      switch (kind) {
        case 'video': {
          const VideoPreviewComp = (
            <Suspense fallback={<EmptyPreview isBuilding={isBuilding} kind={kind} />}>
              <VideoPreview
                poster={preview.payload?.cover_preview_base64}
                videoUrl={preview.payload?.video_url}
                duration={preview.payload?.duration}
              />
            </Suspense>
          );
          setComponent(() => () => VideoPreviewComp);
          setModalMeta({
            type: 'video',
            url: preview.payload?.video_url,
            poster: preview.payload?.cover_preview_base64,
            duration: preview.payload?.duration,
          });
          break;
        }

        case 'audio': {
          const AudioPreviewComp = (
            <Suspense fallback={<EmptyPreview isBuilding={isBuilding} kind={kind} />}>
              <AudioPreview
                audioData={preview.payload?.audio_base64}
                audioType={preview.payload?.audio_type}
                downloadUrl={preview.payload?.audio_data_url}
                fileName={`${preview.token}.${preview.payload?.audio_type || 'mp3'}`}
              />
            </Suspense>
          );
          setComponent(() => () => AudioPreviewComp);
          setModalMeta({});
          break;
        }

        case 'image':
        default: {
          const dataUrlCandidate =
            preview.payload?.image_data_url ||
            preview.payload?.preview_base64 ||
            preview.payload?.preview_data_url;
          const remoteUrlCandidate =
            preview.payload?.image_url ||
            preview.payload?.edited_image_url ||
            preview.payload?.original_image_url;
          const sanitizedDataUrl =
            typeof dataUrlCandidate === "string" &&
            dataUrlCandidate.trim().startsWith("data:image")
              ? dataUrlCandidate.replace(/\s+/g, "")
              : dataUrlCandidate;
          const imageSource = remoteUrlCandidate || sanitizedDataUrl;
          if (!imageSource) {
            setComponent(null);
            setComponentProps({});
            setModalMeta({});
            break;
          }
          const size =
            preview.payload?.width && preview.payload?.height
              ? `${preview.payload.width}×${preview.payload.height}`
              : undefined;
          const ImagePreviewComp = (
            <Suspense fallback={<EmptyPreview isBuilding={isBuilding} kind={kind} />}>
              <ImagePreview
                src={imageSource}
                size={size}
                onError={handleModalError}
                onMeta={(meta) => setModalMeta(meta)}
                meta={{ model_display_name: preview.payload?.model_display_name }}
              />
            </Suspense>
          );
          setComponent(() => () => ImagePreviewComp);
          break;
        }
      }
    }, [preview, kind, isBuilding, handleModalError]);

    const hasError = preview?.error;

    const content = useMemo(() => {
      if (hasError) {
        return (
          <EmptyPreview isBuilding={false} kind={kind} />
        );
      }

      if (!preview?.available || !Component) {
        return <EmptyPreview isBuilding={isBuilding} kind={kind} />;
      }

      return <Component />;
    }, [preview, isBuilding, kind, hasError, Component]);

    return (
      <div
        ref={forwardedRef}
        className={cn("mt-3 rounded-2xl border border-muted p-3 text-sm", panelClass)}
      >
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2 font-medium">
            <ForwardedIconComponent
              name={
                kind === "audio"
                  ? "Waveform"
                  : kind === "video"
                    ? "Clapperboard"
                    : "Image"
              }
              className="h-4 w-4"
            />
            <span>实时预览</span>
          </div>
          {hasError && (
            <Badge variant="destructive" className="text-xs">
              预览失败
            </Badge>
          )}
          {hasModalError && (
            <Badge variant="secondary" className="text-xs">
              加载错误
            </Badge>
          )}
        </div>
        {content}
      </div>
    );
  }
);

DoubaoPreviewPanel.displayName = "DoubaoPreviewPanel";

export default DoubaoPreviewPanel;
