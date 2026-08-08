import { describe, it, expect } from 'vitest'
import { getImageTargetDimensions, getOrientationMatrix } from './image-capture'

describe('getImageTargetDimensions', () => {
  it('scales a large landscape image down to the max dimension', () => {
    const result = getImageTargetDimensions(4000, 3000, 1, 1920)
    expect(result.width).toBe(1920)
    expect(result.height).toBe(1440)
    expect(result.rotated).toBe(false)
  })

  it('scales a large portrait image down to the max dimension', () => {
    const result = getImageTargetDimensions(3000, 4000, 1, 1920)
    expect(result.width).toBe(1440)
    expect(result.height).toBe(1920)
    expect(result.rotated).toBe(false)
  })

  it('swaps dimensions for a 90-degree rotated image before scaling', () => {
    // Orientation 6 rotates 90 CW, so a 4000x3000 photo becomes 3000x4000 in output space.
    const result = getImageTargetDimensions(4000, 3000, 6, 1920)
    expect(result.width).toBe(1440)
    expect(result.height).toBe(1920)
    expect(result.rotated).toBe(true)
  })

  it('leaves a small image unchanged', () => {
    const result = getImageTargetDimensions(800, 600, 1, 1920)
    expect(result.width).toBe(800)
    expect(result.height).toBe(600)
    expect(result.rotated).toBe(false)
  })
})

describe('getOrientationMatrix', () => {
  it('produces a simple scale matrix for normal orientation', () => {
    const matrix = getOrientationMatrix(1, 4000, 3000, 1920, 1440)
    expect(matrix).toEqual([1920 / 4000, 0, 0, 1440 / 3000, 0, 0])
  })

  it('maps a 90-degree rotated source into the target rectangle', () => {
    const matrix = getOrientationMatrix(6, 4000, 3000, 1440, 1920)
    // Source (0,0) -> (targetWidth, 0)
    const [a, b, c, d, e, f] = matrix
    expect(e).toBe(1440)
    expect(f).toBe(0)
    // Source (srcW, 0) -> (targetWidth, targetHeight)
    const x = a * 4000 + c * 0 + e
    const y = b * 4000 + d * 0 + f
    expect(Math.round(x)).toBe(1440)
    expect(Math.round(y)).toBe(1920)
    // Source (0, srcH) -> (0, 0)
    const x2 = a * 0 + c * 3000 + e
    const y2 = b * 0 + d * 3000 + f
    expect(Math.round(x2)).toBe(0)
    expect(Math.round(y2)).toBe(0)
  })

  it('maps a 270-degree rotated source into the target rectangle', () => {
    const matrix = getOrientationMatrix(8, 4000, 3000, 1440, 1920)
    const [a, b, c, d, e, f] = matrix
    // Source (0,0) -> (0, targetHeight)
    expect(Math.round(a * 0 + c * 0 + e)).toBe(0)
    expect(Math.round(b * 0 + d * 0 + f)).toBe(1920)
    // Source (srcW, 0) -> (0, 0)
    expect(Math.round(a * 4000 + c * 0 + e)).toBe(0)
    expect(Math.round(b * 4000 + d * 0 + f)).toBe(0)
    // Source (0, srcH) -> (targetWidth, targetHeight)
    expect(Math.round(a * 0 + c * 3000 + e)).toBe(1440)
    expect(Math.round(b * 0 + d * 3000 + f)).toBe(1920)
  })

  it('flips and scales a horizontally mirrored image', () => {
    const matrix = getOrientationMatrix(2, 4000, 3000, 1920, 1440)
    const [a, b, c, d, e, f] = matrix
    // Source (0,0) -> (targetWidth, 0)
    expect(Math.round(a * 0 + c * 0 + e)).toBe(1920)
    expect(Math.round(b * 0 + d * 0 + f)).toBe(0)
    // Source (srcW, 0) -> (0, 0)
    expect(Math.round(a * 4000 + c * 0 + e)).toBe(0)
    expect(Math.round(b * 4000 + d * 0 + f)).toBe(0)
  })
})
