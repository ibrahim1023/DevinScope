import { existsSync, statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { delimiter, dirname, join, resolve } from "node:path";

/**
 * Centralized platform/path handling (ADR-0002, spec §32).
 * No Devin-specific path knowledge lives here — only home-dir, XDG,
 * project-root and PATH mechanics. Devin locations live in adapters.
 */
export interface PlatformPaths {
  homeDir(): string;
  /** ~/.config/devin (XDG) or %APPDATA%\devin on Windows. */
  devinUserConfigDir(): string;
  /** ~/.codeium — channel-scoped legacy skill locations. */
  codeiumChannelsDir(): string;
  /** ~/.local/share/devin — local state (plugin cache, logs). */
  devinLocalStateDir(): string;
  /** Walk up from `start` for a `.git` or `.jj` directory. */
  findProjectRoot(start: string): string | null;
  /** Cross-platform PATH lookup. */
  executableExists(command: string): boolean;
  /** Read a UTF-8 file; null when missing or unreadable. */
  readFile(absPath: string): Promise<string | null>;
}

/** Normalize to forward slashes — output and goldens are posix-style on every platform. */
export function toPosixPath(p: string): string {
  return p.replaceAll("\\", "/");
}

export function createPlatform(overrides?: { homeDir?: string }): PlatformPaths {
  const home = overrides?.homeDir ?? homedir();
  // An explicit homeDir override (tests, DEVINSCOPE_HOME) simulates an XDG
  // layout under that home on every platform, keeping runs hermetic.
  const forced = overrides?.homeDir !== undefined;
  const isWindows = process.platform === "win32" && !forced;

  const devinUserConfigDir = () =>
    isWindows
      ? join(process.env.APPDATA ?? join(home, "AppData", "Roaming"), "devin")
      : join(home, ".config", "devin");

  return {
    homeDir: () => home,
    devinUserConfigDir,
    codeiumChannelsDir: () => join(home, ".codeium"),
    devinLocalStateDir: () =>
      isWindows
        ? join(process.env.LOCALAPPDATA ?? join(home, "AppData", "Local"), "devin")
        : join(home, ".local", "share", "devin"),
    // note: with a forced homeDir (tests), isWindows is false → XDG layout

    findProjectRoot(start: string): string | null {
      let dir = resolve(start);
      for (;;) {
        if (existsSync(join(dir, ".git")) || existsSync(join(dir, ".jj"))) {
          return dir;
        }
        const parent = dirname(dir);
        if (parent === dir) return null;
        dir = parent;
      }
    },

    executableExists(command: string): boolean {
      if (command.includes("/") || command.includes("\\")) {
        return existsSync(command);
      }
      const pathEnv = process.env.PATH ?? "";
      const exts =
        isWindows && process.env.PATHEXT
          ? process.env.PATHEXT.split(";")
          : [""];
      for (const dir of pathEnv.split(delimiter)) {
        if (!dir) continue;
        for (const ext of exts) {
          const candidate = join(dir, command + ext);
          try {
            if (existsSync(candidate) && statSync(candidate).isFile()) {
              return true;
            }
          } catch {
            // unreadable entry — keep scanning
          }
        }
      }
      return false;
    },

    async readFile(absPath: string): Promise<string | null> {
      try {
        return await readFile(absPath, "utf8");
      } catch {
        return null;
      }
    },
  };
}
