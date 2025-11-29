import {
  forwardRef,
  lazy,
  Suspense,
  useMemo,
  useCallback,
  useState,
  useEffect,
} from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import ImageViewer from "@/components/common/ImageViewer";
import { cn } from "@/utils/utils";
import { ForwardedIconComponent } from "@/components/common/genericIconComponent";
import { useDoubaoPreview } from "../../../hooks/use-doubao-preview";

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

// Lazy load renderers to reduce bundle size
const ImagePreview = lazy(() => import("./ImageRenderer"));
const VideoPreview = lazy(() => import("./VideoRenderer"));
const AudioPreview = lazy(() => import("./AudioRenderer"));

type DownloadInfo = {
  source: string;
  fileName: string;
};

const DoubaoPreviewPanel = forwardRef<HTMLDivElement, Props>(
  ({ nodeId, componentName }, forwardedRef) => {
    const { preview, isBuilding } = useDoubaoPreview(nodeId, componentName);

    const kind = useMemo(() => {
      if (preview?.kind) return preview.kind;
      if (componentName && DOUBAO_KIND[componentName]) {
        return DOUBAO_KIND[componentName];
      }
      return "image";
    }, [preview?.kind, componentName]);

    const panelClass = useMemo(() => PANEL_BG[kind], [kind]);

    const [transientBadge, setTransientBadge] = useState<string | null>(null);
    const showTransientBadge = useCallback((label: string) => {
      setTransientBadge(label);
      const timer = window.setTimeout(() => setTransientBadge(null), 3000);
      return () => window.clearTimeout(timer);
    }, []);

    const handleModalError = useCallback(
      (error: Error) => {
        console.error("Modal error:", error);
        showTransientBadge("加载错误");
      },
      [showTransientBadge],
    );

    const [isPreviewModalOpen, setPreviewModalOpen] = useState(false);

    const imagePreview = useMemo(() => {
      if (kind !== "image" || !preview?.payload) return null;
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
          : undefined;
      const imageSource = remoteUrlCandidate || sanitizedDataUrl;
      if (!imageSource) return null;
      const size =
        preview.payload?.width && preview.payload?.height
          ? `${preview.payload.width}×${preview.payload.height}`
          : undefined;
      return {
        imageSource,
        size,
        extension: inferExtensionFromSource(imageSource, "png"),
      };
    }, [kind, preview]);

    const videoPreview = useMemo(() => {
      if (kind !== "video" || !preview?.payload) return null;
      const videoUrl: string | undefined = preview.payload?.video_url;
      if (!videoUrl) return null;
      return {
        videoUrl,
        poster:
          preview.payload?.cover_preview_base64 || preview.payload?.cover_url,
        duration: preview.payload?.duration,
        extension: inferExtensionFromSource(videoUrl, "mp4"),
      };
    }, [kind, preview]);

    const audioPreview = useMemo(() => {
      if (kind !== "audio" || !preview?.payload) return null;
      const audioType: string = preview.payload?.audio_type || "mp3";
      const base64Content = preview.payload?.audio_base64;
      const fallbackUrl =
        preview.payload?.audio_data_url || preview.payload?.audio_url;
      const audioUrl = base64Content
        ? `data:audio/${audioType};base64,${base64Content}`
        : fallbackUrl;
      if (!audioUrl) return null;
      return {
        audioUrl,
        audioType,
      };
    }, [kind, preview]);

    const previewNode = useMemo(() => {
      if (!preview?.available) return null;
      switch (kind) {
        case "video":
          if (!videoPreview) return null;
          return (
            <Suspense
              fallback={<EmptyPreview isBuilding={isBuilding} kind={kind} />}
            >
              <VideoPreview
                videoUrl={videoPreview.videoUrl}
                poster={videoPreview.poster}
                duration={videoPreview.duration}
              />
            </Suspense>
          );
        case "audio":
          if (!audioPreview) return null;
          return (
            <Suspense
              fallback={<EmptyPreview isBuilding={isBuilding} kind={kind} />}
            >
              <AudioPreview audioUrl={audioPreview.audioUrl} />
            </Suspense>
          );
        case "image":
        default:
          if (!imagePreview) return null;
          return (
            <Suspense
              fallback={<EmptyPreview isBuilding={isBuilding} kind={kind} />}
            >
              <ImagePreview
                src={imagePreview.imageSource}
                size={imagePreview.size}
                onError={handleModalError}
                meta={{ model_display_name: preview.payload?.model_display_name }}
                onExpand={() => setPreviewModalOpen(true)}
              />
            </Suspense>
          );
      }
    }, [
      preview,
      kind,
      isBuilding,
      handleModalError,
      imagePreview,
      videoPreview,
      audioPreview,
    ]);

    const hasRenderablePreview = Boolean(preview?.available && previewNode);

    useEffect(() => {
      if (!hasRenderablePreview) {
        setPreviewModalOpen(false);
      }
    }, [hasRenderablePreview]);

    useEffect(() => {
      setPreviewModalOpen(false);
    }, [preview?.token]);

    const downloadInfo = useMemo<DownloadInfo | null>(() => {
      if (!preview?.available) return null;
      switch (kind) {
        case "image":
          if (!imagePreview) return null;
          return {
            source: imagePreview.imageSource,
            fileName: buildFileName(preview.token, imagePreview.extension),
          };
        case "video":
          if (!videoPreview) return null;
          return {
            source: videoPreview.videoUrl,
            fileName: buildFileName(preview.token, videoPreview.extension),
          };
        case "audio":
          if (!audioPreview) return null;
          return {
            source: audioPreview.audioUrl,
            fileName: buildFileName(
              preview.token,
              audioPreview.audioType || "mp3",
            ),
          };
        default:
          return null;
      }
    }, [preview, kind, imagePreview, videoPreview, audioPreview]);

    const handleDownload = useCallback(async () => {
      if (!downloadInfo) return;
      try {
        await downloadPreviewFile(downloadInfo.source, downloadInfo.fileName);
        showTransientBadge("已保存");
      } catch (error) {
        console.error("Failed to save preview:", error);
        showTransientBadge("保存失败");
      }
    }, [downloadInfo, showTransientBadge]);

    const hasError = preview?.error;

    const fallbackContent = (
      <EmptyPreview
        isBuilding={hasError ? false : isBuilding}
        kind={kind}
      />
    );

    const content = hasRenderablePreview && previewNode ? (
      <div className="relative">
        {previewNode}
        {downloadInfo && (
          <button
            onClick={handleDownload}
            className="absolute bottom-3 right-3 flex items-center gap-1 rounded-full bg-white/90 px-3 py-1.5 text-xs font-medium text-gray-800 shadow-lg transition hover:bg-white"
          >
            <ForwardedIconComponent name="Download" className="h-4 w-4" />
            <span>保存结果</span>
          </button>
        )}
      </div>
    ) : (
      fallbackContent
    );

    const timestampLabel =
      hasRenderablePreview && preview?.generated_at
        ? `更新时间 ${formatTimestamp(preview.generated_at)}`
        : null;
    const showExpandButton = hasRenderablePreview && kind !== "image";

    const infoRow =
      timestampLabel || showExpandButton ? (
        <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
          <span>{timestampLabel ?? ""}</span>
          {showExpandButton && (
            <Button
              variant="secondary"
              size="sm"
              ignoreTitleCase
              className="h-8 px-3"
              onClick={() => setPreviewModalOpen(true)}
            >
              <ForwardedIconComponent name="Maximize2" className="h-4 w-4" />
              <span>放大预览</span>
            </Button>
          )}
        </div>
      ) : null;

    const modalContent = useMemo(() => {
      if (!hasRenderablePreview) return null;
      switch (kind) {
        case "video":
          return videoPreview ? (
            <video
              src={videoPreview.videoUrl}
              poster={videoPreview.poster}
              controls
              className="max-h-[65vh] w-full rounded-lg bg-black object-contain"
            />
          ) : null;
        case "audio":
          return audioPreview ? (
            <audio controls src={audioPreview.audioUrl} className="w-full">
              您的浏览器不支持音频播放
            </audio>
          ) : null;
        case "image":
        default:
          return imagePreview ? (
            <div className="h-[65vh] w-full">
              <ImageViewer image={imagePreview.imageSource} />
            </div>
          ) : null;
      }
    }, [hasRenderablePreview, kind, imagePreview, videoPreview, audioPreview]);

    return (
      <>
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
            <div className="flex items-center gap-2">
              {hasError && (
                <Badge variant="destructive" className="text-xs">
                  预览失败
                </Badge>
              )}
              {transientBadge && (
                <Badge variant="secondary" className="text-xs">
                  {transientBadge}
                </Badge>
              )}
            </div>
          </div>
          {infoRow}
          {content}
        </div>

        <Dialog open={isPreviewModalOpen} onOpenChange={setPreviewModalOpen}>
          <DialogContent className="w-[90vw] max-w-3xl" aria-describedby={undefined}>
            <DialogHeader className="flex flex-row items-center justify-between gap-4">
              <DialogTitle className="text-base">生成结果详情</DialogTitle>
              {hasRenderablePreview && downloadInfo && (
                <Button
                  variant="secondary"
                  size="sm"
                  ignoreTitleCase
                  className="h-9 px-4"
                  onClick={handleDownload}
                >
                  <ForwardedIconComponent name="Download" className="h-4 w-4" />
                  <span>保存结果</span>
                </Button>
              )}
            </DialogHeader>
            <div className="max-h-[70vh] overflow-auto rounded-lg bg-muted/40 p-3">
              {modalContent ?? (
                <p className="text-center text-sm text-muted-foreground">
                  暂无可放大的内容
                </p>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </>
    );
  },
);

DoubaoPreviewPanel.displayName = "DoubaoPreviewPanel";

export default DoubaoPreviewPanel;

function inferExtensionFromSource(source: string, fallback: string): string {
  if (!source) return fallback;
  if (source.startsWith("data:")) {
    const match = /^data:(?<mime>[^;]+)/.exec(source);
    const mimeType = match?.groups?.mime;
    if (mimeType) {
      const ext = mimeType.split("/").pop();
      if (ext) return ext.split("+")[0];
    }
    return fallback;
  }

  try {
    const url = new URL(source);
    const pathExt = url.pathname.split(".").pop();
    if (pathExt && pathExt.length <= 5) {
      return pathExt.toLowerCase();
    }
  } catch {
    const match = /\.([a-z0-9]+)(?:[\?#]|$)/i.exec(source);
    if (match?.[1]) {
      return match[1].toLowerCase();
    }
  }

  return fallback;
}

async function downloadPreviewFile(source: string, fileName: string) {
  if (!source) throw new Error("Missing preview source");
  let objectUrl = source;
  let shouldRevoke = false;

  const convertToBlobUrl = async (target: string) => {
    const response = await fetch(target);
    if (!response.ok) {
      throw new Error(`Failed to fetch preview: ${response.status}`);
    }
    const blob = await response.blob();
    return URL.createObjectURL(blob);
  };

  try {
    if (source.startsWith("data:") || source.startsWith("blob:")) {
      objectUrl = await convertToBlobUrl(source);
      shouldRevoke = true;
    } else {
      objectUrl = await convertToBlobUrl(source);
      shouldRevoke = true;
    }
  } catch (error) {
    // Fall back to opening the resource directly if CORS blocks the fetch.
    const link = document.createElement("a");
    link.href = source;
    link.download = fileName;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    return;
  }

  const downloadLink = document.createElement("a");
  downloadLink.href = objectUrl;
  downloadLink.download = fileName;
  document.body.appendChild(downloadLink);
  downloadLink.click();
  document.body.removeChild(downloadLink);

  if (shouldRevoke) {
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 2000);
  }
}

function buildFileName(token?: string, extension?: string) {
  const safeExt = extension?.replace(/[^a-z0-9]/gi, "") || "dat";
  const safeToken = token || "doubao_preview";
  return `${safeToken}.${safeExt}`;
}

function formatTimestamp(timestamp?: string) {
  if (!timestamp) return "";
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return timestamp;
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

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
        isBuilding && "opacity-60",
      )}
    >
      <div className="text-center">
        {isBuilding ? (
          <div className="flex flex-col items-center gap-2">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <span className="text-xs text-muted-foreground">
              构建中，稍后自动更新
            </span>
          </div>
        ) : (
          <span className="text-muted-foreground">暂无生成结果</span>
        )}
      </div>
    </div>
  );
}
