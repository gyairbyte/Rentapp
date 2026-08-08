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

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

function normalizeOrientation(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  orientation: number,
): void {
  const width = img.naturalWidth
  const height = img.naturalHeight

  const rotated = orientation > 4 && orientation < 9
  canvas.width = rotated ? height : width
  canvas.height = rotated ? width : height

  // reset transform before applying
  ctx.setTransform(1, 0, 0, 1, 0, 0)

  switch (orientation) {
    case 1:
      ctx.drawImage(img, 0, 0, width, height, 0, 0, width, height)
      break
    case 2:
      ctx.translate(width, 0)
      ctx.scale(-1, 1)
      ctx.drawImage(img, 0, 0)
      break
    case 3:
      ctx.translate(width, height)
      ctx.rotate(Math.PI)
      ctx.drawImage(img, 0, 0)
      break
    case 4:
      ctx.translate(0, height)
      ctx.scale(1, -1)
      ctx.drawImage(img, 0, 0)
      break
    case 5:
      ctx.translate(0, 0)
      ctx.transform(0, 1, 1, 0, 0, 0)
      ctx.drawImage(img, 0, 0)
      break
    case 6:
      ctx.translate(0, 0)
      ctx.transform(0, 1, -1, 0, height, 0)
      ctx.drawImage(img, 0, 0)
      break
    case 7:
      ctx.translate(0, 0)
      ctx.transform(0, -1, -1, 0, height, width)
      ctx.drawImage(img, 0, 0)
      break
    case 8:
      ctx.translate(0, 0)
      ctx.transform(0, -1, 1, 0, 0, width)
      ctx.drawImage(img, 0, 0)
      break
    default:
      ctx.drawImage(img, 0, 0)
  }
}

function scaleDimensions(width: number, height: number, maxDimension: number): { width: number; height: number } {
  if (width <= maxDimension && height <= maxDimension) return { width, height }
  const ratio = Math.min(maxDimension / width, maxDimension / height)
  return { width: Math.round(width * ratio), height: Math.round(height * ratio) }
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

  const orientation = await exifr.orientation(file).catch(() => 1) ?? 1
  const dataUrl = await readFileAsDataUrl(file)
  const img = await loadImage(dataUrl)

  const rotated = orientation > 4 && orientation < 9
  const rawWidth = rotated ? img.naturalHeight : img.naturalWidth
  const rawHeight = rotated ? img.naturalWidth : img.naturalHeight

  const { width, height } = scaleDimensions(rawWidth, rawHeight, MAX_IMAGE_DIMENSION)
  const resized = width !== rawWidth || height !== rawHeight

  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not prepare image for upload')

  canvas.width = width
  canvas.height = height

  // Normalize orientation and draw into the (possibly resized) canvas.
  // For orientations that swap axes, we first decode into a full-resolution
  // oriented canvas, then scale down if needed.
  const orientedCanvas = document.createElement('canvas')
  const orientedCtx = orientedCanvas.getContext('2d')
  if (!orientedCtx) throw new Error('Could not prepare image for upload')

  normalizeOrientation(orientedCanvas, orientedCtx, img, orientation)

  // Draw the oriented image scaled into the target canvas.
  ctx.drawImage(orientedCanvas, 0, 0, orientedCanvas.width, orientedCanvas.height, 0, 0, width, height)

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
