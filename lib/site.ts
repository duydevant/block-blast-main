/** Cấu hình site tĩnh, đọc từ env. Khi project có CMS, thay bằng fetch từ BE. */
export const siteConfig = {
  name: process.env.NEXT_PUBLIC_SITE_NAME || "Block Puzzle",
  url: process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
  description: "Drag blocks onto the 8x8 board, fill rows and columns to clear them, and chain combos for a high score.",
}
