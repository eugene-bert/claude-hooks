import { readFileSync, openSync, writeSync, closeSync } from "fs";
import { execSync } from "child_process";
import { createHash } from "crypto";

const PALETTE = [
  { name: "red",     r: 255, g: 80,  b: 80  },
  { name: "blue",    r: 80,  g: 140, b: 255 },
  { name: "green",   r: 80,  g: 220, b: 100 },
  { name: "yellow",  r: 240, g: 200, b: 60  },
  { name: "magenta", r: 220, g: 80,  b: 200 },
  { name: "cyan",    r: 60,  g: 220, b: 220 },
  { name: "orange",  r: 255, g: 140, b: 50  },
  { name: "violet",  r: 150, g: 100, b: 255 },
  { name: "teal",    r: 60,  g: 200, b: 180 },
  { name: "coral",   r: 255, g: 120, b: 100 },
];

function loadDotEnv(): void {
  const envFile = `${process.env.HOME}/.claude/hooks/.env`;
  try {
    const lines = readFileSync(envFile, "utf8").split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const idx = trimmed.indexOf("=");
      if (idx === -1) continue;
      process.env[trimmed.slice(0, idx).trim()] ??= trimmed.slice(idx + 1).trim();
    }
  } catch {}
}

function hashToIndex(s: string): number {
  const hash = createHash("md5").update(s).digest();
  return hash.readUInt32BE(0) % PALETTE.length;
}

function projectName(cwd: string): string {
  const home = process.env.HOME ?? "";
  if (home && (cwd === home || cwd === home + "/")) return "~";
  const segments = cwd.replace(home, "~").split("/").filter(Boolean);
  return segments.pop() ?? "session";
}

function detectTerminal(): string {
  const explicit = process.env.SESSION_COLOR_TERMINAL;
  if (explicit && explicit !== "auto") return explicit.toLowerCase();
  if (process.env.TERM_PROGRAM === "iTerm.app") return "iterm2";
  return "basic";
}

function findPty(): string | null {
  let pid = process.ppid;
  for (let i = 0; i < 10; i++) {
    try {
      const info = execSync(`ps -o tty=,ppid= -p ${pid}`, {
        encoding: "utf8",
        stdio: ["pipe", "pipe", "pipe"],
      }).trim();
      const [tty, ppid] = info.split(/\s+/);
      if (tty && tty !== "??" && tty !== "?") return `/dev/${tty}`;
      if (!ppid || ppid === "0" || ppid === "1") break;
      pid = Number(ppid);
    } catch { break; }
  }
  return null;
}

function writePty(pty: string, data: string): void {
  let fd: number;
  try {
    fd = openSync(pty, "w");
  } catch {
    return;
  }
  try {
    writeSync(fd, data);
  } finally {
    closeSync(fd);
  }
}

function main(): void {
  loadDotEnv();

  if (process.env.SESSION_COLOR_ENABLED === "false") process.exit(0);

  const cwd = process.cwd();
  const name = projectName(cwd);
  const terminal = detectTerminal();

  if (terminal === "none") process.exit(0);

  const colorIndex = hashToIndex(cwd);
  const color = PALETTE[colorIndex];

  const pty = findPty();

  if (!pty) {
    process.stdout.write("OK");
    process.exit(0);
  }

  if (terminal === "iterm2") {
    const tabSeq =
      `\x1b]6;1;bg;red;brightness;${color.r}\x07` +
      `\x1b]6;1;bg;green;brightness;${color.g}\x07` +
      `\x1b]6;1;bg;blue;brightness;${color.b}\x07`;
    writePty(pty, tabSeq);

    if (process.env.SESSION_COLOR_BG !== "false") {
      const strength = parseFloat(process.env.SESSION_COLOR_BG_STRENGTH ?? "0.12");
      const mix = (base: number, c: number) => Math.round(base + (c - base) * strength);
      const bg = { r: mix(30, color.r), g: mix(30, color.g), b: mix(46, color.b) };
      const hex = (n: number) => n.toString(16).padStart(2, "0");
      writePty(pty, `\x1b]1337;SetColors=bg=${hex(bg.r)}${hex(bg.g)}${hex(bg.b)}\x07`);
    }

    if (process.env.SESSION_COLOR_BADGE === "true") {
      const encoded = Buffer.from(name).toString("base64");
      writePty(pty, `\x1b]1337;SetBadgeFormat=${encoded}\x07`);
    }
  }

  if (process.env.SESSION_COLOR_TITLE !== "false") {
    writePty(pty, `\x1b]0;claude: ${name}\x07`);
  }

  process.stdout.write("OK");
}

main();
