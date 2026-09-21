import { computerTool, type Computer } from "@openai/agents"
import type { Sandbox } from "@e2b/desktop"
import {
  getOrCreateDesktopSandbox,
  isE2BConfigured,
} from "@/lib/e2b/vm-desktop"

const DESKTOP_DIMENSIONS: [number, number] = [1280, 800]

type DesktopComputerOptions = {
  agentId: string
  userEmail: string
}

function normalizeKey(key: string) {
  const lower = key.toLowerCase()
  if (lower === "return") return "enter"
  if (lower === "arrowup") return "up"
  if (lower === "arrowdown") return "down"
  if (lower === "arrowleft") return "left"
  if (lower === "arrowright") return "right"
  return lower
}

class E2BDesktopComputer implements Computer {
  environment = "browser" as const
  dimensions = DESKTOP_DIMENSIONS
  private desktop: Sandbox | null = null

  constructor(private readonly options: DesktopComputerOptions) {}

  private async getDesktop() {
    if (!this.desktop) {
      this.desktop = await getOrCreateDesktopSandbox(
        this.options.agentId,
        this.options.userEmail
      )
      await this.desktop.launch("google-chrome")
      await this.desktop.wait(1500)
    }

    return this.desktop
  }

  async screenshot() {
    const desktop = await this.getDesktop()
    const bytes = await desktop.screenshot()
    return Buffer.from(bytes).toString("base64")
  }

  async click(x: number, y: number, button: "left" | "right" | "wheel" | "back" | "forward") {
    const desktop = await this.getDesktop()
    if (button === "right") {
      await desktop.rightClick(x, y)
      return
    }
    if (button === "wheel") {
      await desktop.middleClick(x, y)
      return
    }
    await desktop.leftClick(x, y)
  }

  async doubleClick(x: number, y: number) {
    const desktop = await this.getDesktop()
    await desktop.doubleClick(x, y)
  }

  async scroll(x: number, y: number, _scrollX: number, scrollY: number) {
    const desktop = await this.getDesktop()
    await desktop.moveMouse(x, y)
    await desktop.scroll(scrollY > 0 ? "down" : "up", Math.max(1, Math.abs(scrollY)))
  }

  async type(text: string) {
    const desktop = await this.getDesktop()
    await desktop.write(text, { chunkSize: 50, delayInMs: 20 })
  }

  async wait() {
    const desktop = await this.getDesktop()
    await desktop.wait(1000)
  }

  async move(x: number, y: number) {
    const desktop = await this.getDesktop()
    await desktop.moveMouse(x, y)
  }

  async keypress(keys: string[]) {
    const desktop = await this.getDesktop()
    await desktop.press(keys.map(normalizeKey))
  }

  async drag(path: [number, number][]) {
    const desktop = await this.getDesktop()
    if (path.length < 2) return

    await desktop.moveMouse(path[0][0], path[0][1])
    await desktop.mousePress("left")
    for (const [x, y] of path.slice(1)) {
      await desktop.moveMouse(x, y)
    }
    await desktop.mouseRelease("left")
  }
}

export function createDesktopComputerTool(options: DesktopComputerOptions) {
  if (!isE2BConfigured()) return null

  return computerTool({
    name: "computer_use_preview",
    computer: () => new E2BDesktopComputer(options),
    needsApproval: false,
    onSafetyCheck: async ({ pendingSafetyChecks }) => ({
      acknowledgedSafetyChecks: pendingSafetyChecks,
    }),
  })
}
