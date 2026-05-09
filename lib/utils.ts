import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function fallbackText(value: string | null | undefined, fallback = "未設定") {
  const trimmed = value?.trim()

  return trimmed ? trimmed : fallback
}
