export const PLATFORM_COLORS: Record<string, string> = {
  Mana: "#5CA1F3",
  Iterable: "#EB4B80",
  Zapier: "#EC8F43",
  "Monday.com": "#9533B2",
}

export function getPlatformColor(platform?: string | null) {
  if (!platform) return "#5CA1F3"
  return PLATFORM_COLORS[platform] ?? "#F5C443"
}
