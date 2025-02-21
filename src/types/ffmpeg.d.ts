declare module '@ffmpeg/ffmpeg' {
  export class FFmpeg {
    loaded: boolean;
    load(options: {
      coreURL: string;
      wasmURL: string;
      workerURL?: string;
      log?: boolean;
    }): Promise<void>;
    writeFile(path: string, data: ArrayBuffer | Uint8Array): Promise<void>;
    readFile(path: string): Promise<Uint8Array>;
    exec(args: string[]): Promise<void>;
    listDir(path: string): Promise<Array<{ name: string; size?: number; isDir?: boolean; }>>;
  }
}

declare module '@ffmpeg/util' {
  export function fetchFile(file: File | string | URL): Promise<Uint8Array>;
  export function toBlobURL(url: string, type: string): Promise<string>;
} 