/** Logo 4 khối màu (khớp icon app). */
export function BrandMark({ className = "size-7" }: { className?: string }) {
  return (
    <span aria-hidden="true" className={`grid grid-cols-2 gap-[3px] ${className}`}>
      <span className="rounded-[4px] bg-[#ff6b6b]" />
      <span className="rounded-[4px] bg-[#4ea8ff]" />
      <span className="rounded-[4px] bg-[#9ad94a]" />
      <span className="rounded-[4px] bg-[#c86bfa]" />
    </span>
  )
}
