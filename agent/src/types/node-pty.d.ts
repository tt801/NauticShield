declare module 'node-pty' {
  export interface IPty {
    write(data: string): void;
    kill(signal?: string): void;
    onData(listener: (data: string) => void): void;
    onExit(listener: (event: { exitCode: number; signal?: number }) => void): void;
  }

  export function spawn(file: string, args: string[], options: {
    name?: string;
    cols?: number;
    rows?: number;
    env?: Record<string, string>;
  }): IPty;
}