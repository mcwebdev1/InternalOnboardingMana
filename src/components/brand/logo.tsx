import Image from "next/image"

type BrandLogoProps = {
  size?: number
  className?: string
}

export function BrandLogo({ size = 40, className }: BrandLogoProps) {
  return (
    <Image
      src="/brand/logo.png"
      alt="Mana"
      width={size}
      height={size}
      className={`rounded-full ${className ?? ""}`}
      priority
    />
  )
}
