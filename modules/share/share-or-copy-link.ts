export type ShareOutcome = "shared" | "copied" | "cancelled"

/**
 * Mở bảng chia sẻ của hệ điều hành (kèm ảnh nếu trình duyệt cho phép — Zalo/Messenger trên điện thoại);
 * không có Web Share thì copy "text + link" vào clipboard.
 */
export async function shareOrCopyLink(input: { title: string; text: string; url: string; image?: Blob }): Promise<ShareOutcome> {
  if (typeof navigator.share === "function") {
    const file = input.image && new File([input.image], "block-puzzle-result.png", { type: "image/png" })
    const files = file && navigator.canShare?.({ files: [file] }) ? { files: [file] } : {}
    try {
      await navigator.share({ title: input.title, text: input.text, url: input.url, ...files })
      return "shared"
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return "cancelled"
      // NotAllowedError (iframe, thiếu thao tác người dùng...) → rơi xuống copy link.
    }
  }
  await navigator.clipboard.writeText(`${input.text} ${input.url}`)
  return "copied"
}
