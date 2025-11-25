import { render, screen } from '@testing-library/react';
import DoubaoPreviewPanel from '../index';
import { useDoubaoPreview } from '../../../../hooks/use-doubao-preview';

// Mock the Doubao preview hook so we can control panel states in isolation
jest.mock('../../../../hooks/use-doubao-preview', () => {
  const mock = jest.fn();
  return {
    __esModule: true,
    useDoubaoPreview: mock,
    default: mock,
  };
});

describe('DoubaoPreviewPanel', () => {
  const mockNodeId = 'test-node-id';
  const mockComponentName = 'DoubaoImageGenerator';

  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
  });

  test('renders empty preview state when no data available', () => {
    // Mock the hook to return no preview data
    (useDoubaoPreview as jest.Mock).mockReturnValue({
      preview: null,
      isBuilding: false,
      rawMessage: null,
      lastUpdated: undefined,
    });

    render(
      <DoubaoPreviewPanel
        nodeId={mockNodeId}
        componentName={mockComponentName}
      />
    );

    expect(screen.getByText('暂无生成结果')).toBeInTheDocument();
  });

  test('renders building state when isBuilding is true', () => {
    // Mock the hook to return building state
    (useDoubaoPreview as jest.Mock).mockReturnValue({
      preview: null,
      isBuilding: true,
      rawMessage: null,
      lastUpdated: undefined,
    });

    render(
      <DoubaoPreviewPanel
        nodeId={mockNodeId}
        componentName={mockComponentName}
      />
    );

    expect(screen.getByText('构建中，稍后自动更新')).toBeInTheDocument();
  });

  test('renders error state when preview has error', () => {
    // Mock the hook to return error state
    (useDoubaoPreview as jest.Mock).mockReturnValue({
      preview: {
        kind: 'image',
        available: false,
        error: 'API Error: Failed to generate image',
        token: 'test-token',
      },
      isBuilding: false,
      rawMessage: null,
      lastUpdated: undefined,
    });

    render(
      <DoubaoPreviewPanel
        nodeId={mockNodeId}
        componentName={mockComponentName}
      />
    );

    expect(screen.getByText('预览失败')).toBeInTheDocument();
  });

  test('renders image preview when image data is available', () => {
    const mockImagePreview = {
      kind: 'image' as const,
      available: true,
      payload: {
        image_data_url: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
        width: 512,
        height: 512,
      },
      token: 'test-token',
    };

    (useDoubaoPreview as jest.Mock).mockReturnValue({
      preview: mockImagePreview,
      isBuilding: false,
      rawMessage: null,
      lastUpdated: undefined,
    });

    render(
      <DoubaoPreviewPanel
        nodeId={mockNodeId}
        componentName={mockComponentName}
      />
    );

    expect(screen.getByText('实时预览')).toBeInTheDocument();
    expect(screen.getByText('点击放大')).toBeInTheDocument();
    expect(screen.getByText('512×512')).toBeInTheDocument();
  });

  test('renders video preview when video data is available', () => {
    const mockVideoPreview = {
      kind: 'video' as const,
      available: true,
      payload: {
        video_url: 'https://example.com/video.mp4',
        cover_preview_base64: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
        duration: '00:10',
      },
      token: 'test-token',
    };

    (useDoubaoPreview as jest.Mock).mockReturnValue({
      preview: mockVideoPreview,
      isBuilding: false,
      rawMessage: null,
      lastUpdated: undefined,
    });

    render(
      <DoubaoPreviewPanel
        nodeId={mockNodeId}
        componentName={'DoubaoVideoGenerator'}
      />
    );

    expect(screen.getByText('实时预览')).toBeInTheDocument();
    expect(screen.getByText('时长：00:10')).toBeInTheDocument();
    expect(screen.getByText('查看大图')).toBeInTheDocument();
  });

  test('renders audio preview when audio data is available', () => {
    const mockAudioPreview = {
      kind: 'audio' as const,
      available: true,
      payload: {
        audio_base64: 'UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=',
        audio_type: 'mp3',
      },
      token: 'test-token',
    };

    (useDoubaoPreview as jest.Mock).mockReturnValue({
      preview: mockAudioPreview,
      isBuilding: false,
      rawMessage: null,
      lastUpdated: undefined,
    });

    render(
      <DoubaoPreviewPanel
        nodeId={mockNodeId}
        componentName={'DoubaoTTS'}
      />
    );

    expect(screen.getByText('实时预览')).toBeInTheDocument();
    expect(screen.getByText('下载音频')).toBeInTheDocument();
  });
});
