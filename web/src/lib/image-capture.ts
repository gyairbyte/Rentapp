'use client'

import * as exifr from 'exifr'

const MAX_IMAGE_DIMENSION = 1920
const OUTPUT_QUALITY = 0.92
const OUTPUT_TYPE = 'image/jpeg'

export type PreparedFile = {
  file: File
  originalFile: File
  resized: boolean
  normalized: boolean
}

function getOutputFilename(originalName: string, mimeType: string): string {
  const extension = mimeType === 'image/png' ? 'png' : 'jpg'
  const base = originalName.replace(/\.[^/.]+$/, '') || 'capture'
  return `${base}.${extension}`.replace(/[^a-zA-Z0-9_.-]/g, '_')
}

async function blobToFile(blob: Blob, name: string, type: string): Promise<File> {
  return new File([blob], name, { type })
}

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function revokeImageUrl(url: string | undefined) {
  if (url && typeof URL !== 'undefined' && URL.revokeObjectURL) {
    URL.revokeObjectURL(url)
  }
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    let url: string | undefined

    const cleanup = () => {
      img.onload = null
      img.onerror = null
      revokeImageUrl(url)
    }

    img.onload = () => {
      cleanup()
      resolve(img)
    }
    img.onerror = () => {
      cleanup()
      reject(new Error('Could not load image'))
    }

    if (typeof URL !== 'undefined' && URL.createObjectURL) {
      url = URL.createObjectURL(file)
      img.src = url
    } else {
      // Fallback for environments without Blob URLs (tests / older runtimes).
      readFileAsDataUrl(file)
        .then((dataUrl) => {
          url = dataUrl
          img.src = dataUrl
        })
        .catch(reject)
    }
  })
}

export function getImageTargetDimensions(
  naturalWidth: number,
  naturalHeight: number,
  orientation: number,
  maxDimension: number,
): { width: number; height: number; rotated: boolean } {
  const rotated = orientation > 4 && orientation < 9
  const baseWidth = rotated ? naturalHeight : naturalWidth
  const baseHeight = rotated ? naturalWidth : naturalHeight

  if (baseWidth <= maxDimension && baseHeight <= maxDimension) {
    return { width: baseWidth, height: baseHeight, rotated }
  }

  const ratio = Math.min(maxDimension / baseWidth, maxDimension / baseHeight)
  return {
    width: Math.round(baseWidth * ratio),
    height: Math.round(baseHeight * ratio),
    rotated,
  }
}

export function getOrientationMatrix(
  orientation: number,
  srcWidth: number,
  srcHeight: number,
  targetWidth: number,
  targetHeight: number,
): [number, number, number, number, number, number] {
  const sx = targetWidth / srcWidth
  const sy = targetHeight / srcHeight
  const sxR = targetWidth / srcHeight
  const syR = targetHeight / srcWidth

  switch (orientation) {
    case 2:
      return [-sx, 0, 0, sy, targetWidth, 0]
    case 3:
      return [-sx, 0, 0, -sy, targetWidth, targetHeight]
    case 4:
      return [sx, 0, 0, -sy, 0, targetHeight]
    case 5:
      return [0, syR, sxR, 0, 0, 0]
    case 6:
      return [0, syR, -sxR, 0, targetWidth, 0]
    case 7:
      return [0, -syR, -sxR, 0, targetWidth, targetHeight]
    case 8:
      return [0, -syR, sxR, 0, 0, targetHeight]
    case 1:
    default:
      return [sx, 0, 0, sy, 0, 0]
  }
}

export async function prepareImageFile(file: File): Promise<PreparedFile> {
  // Pass PDFs through unchanged.
  if (file.type === 'application/pdf') {
    return { file, originalFile: file, resized: false, normalized: false }
  }

  // HEIC/HEIF capture on the web is not reliably supported by canvas decoding.
  // Most mobile browsers convert camera captures to JPEG automatically.
  if (file.type === 'image/heic' || file.type === 'image/heif') {
    throw new Error('HEIC/HEIF images are not supported. Please choose a JPEG, PNG, WebP, or PDF.')
  }

  // Reject clearly unsupported image types before trying to draw.
  if (!file.type.startsWith('image/')) {
    throw new Error('Unsupported file type. Use JPEG, PNG, WebP, or PDF.')
  }

  const orientation = (await exifr.orientation(file).catch(() => 1)) ?? 1
  const img = await loadImage(file)

  const { width: targetWidth, height: targetHeight, rotated } = getImageTargetDimensions(
    img.naturalWidth,
    img.naturalHeight,
    orientation,
    MAX_IMAGE_DIMENSION,
  )

  const resized = rotated
    ? img.naturalHeight > targetWidth || img.naturalWidth > targetHeight
    : img.naturalWidth > targetWidth || img.naturalHeight > targetHeight

  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not prepare image for upload')

  canvas.width = targetWidth
  canvas.height = targetHeight

  // Single-pass orientation-and-scale draw; no full-resolution intermediate canvas.
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  const matrix = getOrientationMatrix(orientation, img.naturalWidth, img.naturalHeight, targetWidth, targetHeight)
  ctx.setTransform(...matrix)
  ctx.drawImage(img, 0, 0)

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Could not encode image'))),
      OUTPUT_TYPE,
      OUTPUT_QUALITY,
    )
  })

  const outputFile = await blobToFile(blob, getOutputFilename(file.name, OUTPUT_TYPE), OUTPUT_TYPE)

  return {
    file: outputFile,
    originalFile: file,
    resized,
    normalized: true,
  }
}
