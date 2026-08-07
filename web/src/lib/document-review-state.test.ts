import { describe, it, expect } from 'vitest'
import { getDocumentReviewState } from './document-review-state'

function doc(processing_status: string, processing_error: string | null) {
  return { processing_status, processing_error }
}

describe('getDocumentReviewState', () => {
  it('reports a failed document with a processing run as retryable', () => {
    const state = getDocumentReviewState(doc('failed', 'OpenAI schema error'), { id: 'run-1' }, false)
    expect(state.kind).toBe('failed')
    expect(state.showRetry).toBe(true)
    expect(state.userMessage).toBe('Document processing could not be completed. Please retry later.')
  })

  it('reports a failed document without a processing run as retryable', () => {
    const state = getDocumentReviewState(doc('failed', 'OpenAI schema error'), null, false)
    expect(state.kind).toBe('failed')
    expect(state.showRetry).toBe(true)
  })

  it('hides raw processing_error in production', () => {
    const state = getDocumentReviewState(doc('failed', 'OpenAI 400: missing evidence'), { id: 'run-1' }, false)
    expect(state.technicalDetails).toBeUndefined()
    expect(state.userMessage).not.toContain('OpenAI')
    expect(state.userMessage).not.toContain('evidence')
  })

  it('exposes raw processing_error in development only', () => {
    const state = getDocumentReviewState(doc('failed', 'OpenAI 400: missing evidence'), { id: 'run-1' }, true)
    expect(state.technicalDetails).toBe('OpenAI 400: missing evidence')
  })

  it('does not return the misleading image-quality message for provider/schema/API failures', () => {
    const state = getDocumentReviewState(doc('failed', '400 Invalid schema'), { id: 'run-1' }, false)
    expect(state.userMessage).not.toContain('upload')
    expect(state.userMessage).not.toContain('clearer')
    expect(state.userMessage).not.toContain('PDF')
  })

  it('reports a processed document as ready for review', () => {
    const state = getDocumentReviewState(doc('processed', null), { id: 'run-1' }, false)
    expect(state.kind).toBe('ready')
    expect(state.showRetry).toBe(false)
  })

  it('reports a still-processing document', () => {
    const state = getDocumentReviewState(doc('processing', null), { id: 'run-1' }, false)
    expect(state.kind).toBe('processing')
    expect(state.showRetry).toBe(false)
    expect(state.userMessage).toContain('Processing')
  })
})
