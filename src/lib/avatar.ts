import type { AddressIdentity, ProfileImage } from './types'
import { optimizeImageUrl } from './formatters'

type AvatarImage = Pick<ProfileImage, 'src'> & {
  width?: number | null
}

function pickAvatarImageUrl(
  images: AvatarImage[] | undefined,
  minWidth: number,
  renderedWidth: number
): string {
  if (!images?.length) return ''
  const sorted = [...images].sort((a, b) => (a.width ?? 0) - (b.width ?? 0))
  const image = sorted.find(i => (i.width ?? 0) >= minWidth) || sorted[sorted.length - 1]
  return image?.src ? optimizeImageUrl(image.src, renderedWidth) : ''
}

export function getIdentityAvatarUrl(
  identity: AddressIdentity | undefined | null,
  minWidth = 32,
  renderedWidth = 24
): string {
  return pickAvatarImageUrl(identity?.profileImages, minWidth, renderedWidth)
    || pickAvatarImageUrl(identity?.icons, minWidth, renderedWidth)
    || pickAvatarImageUrl(identity?.images, minWidth, renderedWidth)
}
