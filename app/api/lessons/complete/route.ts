import { completeLessonRequestSchema } from "@/modules/lessons/lesson-completion-types"
import { handleJsonRoute, readJsonBody, requireUid } from "@/server/http/authenticated-json-route"
import { completeLesson } from "@/server/lessons/complete-lesson"

/** Qua một bài học kỹ thuật: `{ slug, actions }` → server replay kiểm mục tiêu → `{ coins, alreadyDone }`. */
export async function POST(request: Request) {
  return handleJsonRoute(async () => {
    const uid = await requireUid(request)
    return completeLesson(uid, await readJsonBody(request, completeLessonRequestSchema, 8 * 1024))
  })
}
