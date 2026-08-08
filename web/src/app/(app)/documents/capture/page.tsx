import { notFound } from 'next/navigation'
import { getProperty } from '@/lib/actions/property'
import { uploadDocument, processDocument } from '@/lib/actions/documents'
import { DocumentCapture } from '@/components/document/document-capture'

export const dynamic = 'force-dynamic'

export default async function DocumentCapturePage({
  searchParams,
}: {
  searchParams: Promise<{ propertyId?: string }>
}) {
  const { propertyId } = await searchParams
  let property: { id: string; nickname: string } | null = null
  if (propertyId) {
    const loaded = await getProperty(propertyId)
    if (!loaded) notFound()
    property = { id: loaded.id, nickname: loaded.nickname }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Scan bill</h1>
      <DocumentCapture property={property} uploadDocument={uploadDocument} processDocument={processDocument} />
    </div>
  )
}
