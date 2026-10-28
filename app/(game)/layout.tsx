import { GAME_SURFACE_BACKGROUND } from "@/modules/block-puzzle/components/game-ui-styles"
import { gameFont } from "@/modules/block-puzzle/game-font"

/** Màn chơi chiếm trọn viewport (không header/footer của site). */
export default function GameLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div
      data-game-surface
      className={`${gameFont.className} ${GAME_SURFACE_BACKGROUND} fixed inset-0 flex h-screen w-screen flex-col overflow-hidden overscroll-none text-white supports-[height:100dvh]:h-dvh`}
    >
      <main className="flex min-h-0 flex-1 flex-col">{children}</main>
    </div>
  )
}
