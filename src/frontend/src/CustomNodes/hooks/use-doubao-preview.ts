import { useCallback } from 'react';
import useFlowStore from '@/stores/flowStore';
import { BuildStatus } from '@/constants/enums';
import type { OutputLogType } from '@/types/api';

// Doubao组件类型映射 - 也在节点渲染时复用
export const DOUBAO_COMPONENTS = new Set<string>([
  'DoubaoImageGenerator',
  'DoubaoImageEditor',
  'DoubaoVideoGenerator',
  'DoubaoTTS'
]);

export const isDoubaoComponent = (componentName?: string): boolean =>
  Boolean(componentName && DOUBAO_COMPONENTS.has(componentName));

// 默认类型映射
const COMPONENT_KIND_MAP: Record<string, 'image' | 'video' | 'audio'> = {
  DoubaoImageGenerator: 'image',
  DoubaoImageEditor: 'image',
  DoubaoVideoGenerator: 'video',
  DoubaoTTS: 'audio',
};

export type DoubaoPreviewDescriptor = {
  token: string;
  kind: 'image' | 'video' | 'audio';
  available: boolean;
  payload: any;
  error?: string;
  generated_at?: string;
};

type UseDoubaoPreviewReturn = {
  preview: DoubaoPreviewDescriptor | null;
  isBuilding: boolean;
  rawMessage: OutputLogType | null;
  lastUpdated?: string;
};

function parsePreviewData(componentName: string | undefined, data: any): DoubaoPreviewDescriptor | null {
  // 优先解析新的doubao_preview格式
  if (data.doubao_preview) {
    const fromData = data.doubao_preview;
    return {
      token: fromData.token,
      kind: fromData.kind,
      generated_at: fromData.generated_at,
      available: Boolean(fromData.available),
      payload: fromData.payload ?? null,
      error: fromData.error,
    };
  }

  // fallback: image nodes returning inline/base64 data
  const inlineImage =
    data.image_data_url ||
    data.preview_base64 ||
    data.preview_data_url ||
    null;
  const remoteImage =
    data.image_url ||
    data.edited_image_url ||
    data.original_image_url ||
    null;
  if (inlineImage || remoteImage) {
    const fallbackKind = componentName ? COMPONENT_KIND_MAP[componentName] : 'image';
    return {
      token: data.preview_token,
      kind: fallbackKind ?? 'image',
      generated_at: data.generated_at,
      available: true,
      payload: {
        image_data_url: inlineImage ?? undefined,
        image_url: remoteImage ?? undefined,
        width: data.width,
        height: data.height,
      },
      error: data.preview_error,
    };
  }

  if (data.audio_base64) {
    return {
      token: data.preview_token,
      kind: 'audio',
      generated_at: data.generated_at,
      available: true,
      payload: {
        audio_base64: data.audio_base64,
        audio_type: data.audio_type,
        sample_rate: data.sample_rate,
      },
      error: data.preview_error,
    };
  }

  return null;
}

export function useDoubaoPreview(nodeId: string, componentName?: string): UseDoubaoPreviewReturn {
  const { flowPool, flowBuildStatus } = useFlowStore();

  const result = useCallback((): UseDoubaoPreviewReturn => {
    const nodeOutputs = flowPool[nodeId];
    if (!nodeOutputs?.length) {
      return {
        preview: null,
        isBuilding: flowBuildStatus[nodeId]?.status === BuildStatus.BUILDING,
        rawMessage: null,
      };
    }

    // 获取最新的输出消息
    const messageData = nodeOutputs[nodeOutputs.length - 1];
    if (!messageData?.data?.outputs) {
      return {
        preview: null,
        isBuilding: flowBuildStatus[nodeId]?.status === BuildStatus.BUILDING,
        rawMessage: messageData,
      };
    }

    // 查找包含doubao数据的输出字段
    const allOutputs = messageData.data.outputs;
    let preview: DoubaoPreviewDescriptor | null = null;
    let rawMessage = messageData;

    // 1. 优先查找新的doubao_preview格式
    for (const [outputKey, outputData] of Object.entries(allOutputs)) {
      if (outputData?.message?.data?.doubao_preview) {
        preview = parsePreviewData(componentName, outputData.message.data);
        rawMessage = outputData as OutputLogType;
        break;
      }
    }

    // 2. fallback到传统字段查找
    if (!preview) {
      for (const [outputKey, outputData] of Object.entries(allOutputs)) {
        const data = outputData?.message?.data;
        if (data) {
          preview = parsePreviewData(componentName, data);
          if (preview) {
            rawMessage = outputData as OutputLogType;
            break;
          }
        }
      }
    }

    return {
      preview,
      isBuilding: flowBuildStatus[nodeId]?.status === BuildStatus.BUILDING,
      rawMessage,
      lastUpdated: preview?.generated_at,
    };
  }, [componentName, nodeId, flowPool, flowBuildStatus]);

  return result();
}

export default useDoubaoPreview;