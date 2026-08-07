export type DocumentReviewState =
  | { kind: 'processing'; userMessage: string; technicalDetails?: undefined; showRetry: false }
  | { kind: 'failed'; userMessage: string; technicalDetails: string | undefined; showRetry: true }
  | { kind: 'ready'; userMessage: string; technicalDetails?: undefined; showRetry: false }

export function getDocumentReviewState(
  document: { processing_status: string; processing_error: string | null },
  _run: { id: string } | null | undefined,
  isDevelopment: boolean
): DocumentReviewState {
  if (document.processing_status === 'failed') {
    return {
      kind: 'failed',
      userMessage: 'Document processing could not be completed. Please retry later.',
      technicalDetails: isDevelopment ? document.processing_error ?? undefined : undefined,
      showRetry: true,
    }
  }

  if (document.processing_status === 'processed') {
    return { kind: 'ready', userMessage: 'Ready for review', showRetry: false }
  }

  return { kind: 'processing', userMessage: 'Processing… check back in a moment.', showRetry: false }
}
