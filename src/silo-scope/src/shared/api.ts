export interface RendererApi {
  isDesktop: boolean;
  platform: NodeJS.Platform;
  versions: {
    electron: string;
    chrome: string;
  };
  window: {
    minimize: () => Promise<void>;
    maximize: () => Promise<void>;
    close: () => Promise<void>;
    isMaximized: () => Promise<boolean>;
    onStateChange: (
      callback: (state: { isMaximized: boolean }) => void,
    ) => () => void;
  };
}
