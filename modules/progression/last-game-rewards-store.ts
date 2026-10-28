import { create } from "zustand"

import type { GameRewards } from "@/modules/player-profile/player-profile-types"

interface LastGameRewardsStore {
  /** Phần thưởng server trả cho ván vừa nộp, kèm gameId để hộp hết ván chỉ hiện đúng ván của nó. */
  gameId: string | null
  rewards: GameRewards | null
  setRewards: (gameId: string, rewards: GameRewards) => void
}

export const useLastGameRewardsStore = create<LastGameRewardsStore>()((set) => ({
  gameId: null,
  rewards: null,
  setRewards: (gameId, rewards) => set({ gameId, rewards }),
}))
