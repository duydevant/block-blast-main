import "server-only"

import { FieldValue } from "firebase-admin/firestore"

import { COINS_PER_LESSON, findLesson } from "@/modules/lessons/lesson-catalog"
import type { CompleteLessonRequest, CompleteLessonResponse } from "@/modules/lessons/lesson-completion-types"
import { verifyLessonActions } from "@/modules/lessons/lesson-rules"
import { getAdminFirestore } from "@/server/firebase/firebase-admin-app"
import { HttpError } from "@/server/http/authenticated-json-route"
import { parseStoredPlayer, USERS_COLLECTION } from "@/server/profile/stored-player-document"

/**
 * Ghi nhận qua bài học: server replay log bằng reducer thật + kiểm mục tiêu; lần đầu +COINS_PER_LESSON xu và thêm
 * slug vào `lessonsDone` (trong transaction → không nhận 2 lần). Tài khoản bị khoá: ghi nhận nhưng không cộng xu.
 */
export async function completeLesson(uid: string, request: CompleteLessonRequest): Promise<CompleteLessonResponse> {
  const found = findLesson(request.slug)
  if (!found) throw new HttpError(404, "unknown-lesson")
  if (!verifyLessonActions(found.lesson, found.index, request.actions)) throw new HttpError(422, "lesson-not-completed")

  const db = getAdminFirestore()
  const userRef = db.collection(USERS_COLLECTION).doc(uid)
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(userRef)
    const stored = parseStoredPlayer(snap.data())
    if (stored.lessonsDone.includes(found.lesson.slug)) return { coins: 0, alreadyDone: true }
    const coins = stored.banned ? 0 : COINS_PER_LESSON
    const stamp = FieldValue.serverTimestamp()
    tx.set(
      userRef,
      {
        lessonsDone: FieldValue.arrayUnion(found.lesson.slug),
        coins: stored.coins + coins,
        updatedAt: stamp,
        // Giống lúc nộp ván đầu: doc chưa có thì tạo đủ field gốc.
        ...(snap.exists ? {} : { displayName: null, createdAt: stamp }),
      },
      { merge: true }
    )
    return { coins, alreadyDone: false }
  })
}
