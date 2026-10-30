import { describe, expect, it } from "vitest"

import { ARENA_TYPES } from "@/modules/game-modes/arena-catalog"
import { LEADERBOARD_CATEGORIES } from "@/modules/leaderboard/leaderboard-categories"
import { LESSONS } from "@/modules/lessons/lesson-catalog"
import { GAME_HISTORY_MODES } from "@/modules/player-profile/game-history-types"
import { ACHIEVEMENT_CATEGORIES, ACHIEVEMENTS } from "@/modules/progression/achievement-catalog"
import { PLAYER_TIERS } from "@/modules/progression/player-form-rules"
import { LEAGUES } from "@/modules/ranked/rating-rules"

import { dictionaries } from "./i18n"

/** Key ghép từ catalog (`t(\`achievement.${id}\`)`) không được TypeScript kiểm → thiếu key làm sập trang. */
const dynamicKeys = [
  ...ACHIEVEMENTS.flatMap((item) => [`achievement.${item.id}`, `achievement.${item.id}.desc`]),
  ...ACHIEVEMENT_CATEGORIES.map((category) => `achievements.category.${category}`),
  ...GAME_HISTORY_MODES.map((mode) => `history.mode.${mode}`),
  ...PLAYER_TIERS.map((tier) => `tier.${tier.id}`),
  ...LEAGUES.map((league) => `ranked.league.${league.id}`),
  ...["win", "loss", "draw"].map((result) => `ranked.result.${result}`),
  ...ARENA_TYPES.flatMap((type) => [`arena.type.${type}`, `arena.typeHint.${type}`]),
  ...LEADERBOARD_CATEGORIES.flatMap((category) => [`leaderboard.category.${category}`, `leaderboard.categoryHint.${category}`]),
  ...LESSONS.map((lesson) => `lesson.${lesson.slug}.title`),
]

describe("dynamic translation keys", () => {
  it.each(Object.keys(dictionaries))("%s has every catalog-driven key", (locale) => {
    const dictionary = dictionaries[locale as keyof typeof dictionaries] as Record<string, string>
    expect(dynamicKeys.filter((key) => typeof dictionary[key] !== "string")).toEqual([])
  })
})
