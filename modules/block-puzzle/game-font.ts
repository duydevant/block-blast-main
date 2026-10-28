import localFont from "next/font/local"

/** Font của màn chơi: Inter (OFL, xem public/fonts/inter-OFL.txt), dùng bản variable để có nét đậm cho số điểm. */
export const gameFont = localFont({
  src: "../../public/fonts/inter.ttf",
  weight: "100 900",
  display: "swap",
})
