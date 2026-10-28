import { CHUNKY_BUTTON } from "@/components/game-ui/game-ui-classes"

import { gameFont } from "../game-font"

/** Class Tailwind dùng chung cho mọi panel/nút của màn chơi — đổi bộ nhận diện thì sửa ở đây (và components/game-ui). */
export const GAME_PANEL =
  gameFont.className +
  " rounded-[30px] border-2 border-[#3b3375] bg-[#1e1942] text-white shadow-2xl [&_p]:text-violet-100/80 [&>button]:text-white"

export const PRIMARY_BUTTON = `${CHUNKY_BUTTON.primary} h-14 text-xl`

export const SECONDARY_BUTTON = `${CHUNKY_BUTTON.secondary} h-14 text-xl`

/** Nền toàn màn chơi. */
export const GAME_SURFACE_BACKGROUND = "bg-[#120f29]"
