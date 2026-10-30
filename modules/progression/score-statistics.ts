/** Hàm thống kê thuần dùng chung (phong độ thử thách ngày, phong độ Vô tận). */

/** Trung vị (chẵn → trung bình 2 số giữa), làm tròn. Mảng rỗng → 0. */
export function median(values: readonly number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return Math.round(sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2)
}
