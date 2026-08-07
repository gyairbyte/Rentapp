import { DocumentForm } from '@/components/document/document-form'
import { createDocument } from '@/lib/actions/documents'
import { getPropertyOptions } from '@/lib/actions/property'

export const dynamic = 'force-dynamic'

export default async function NewDocumentPage({ searchParams }: { searchParams: Promise<{ propertyId?: string }> }) {
  const { propertyId } = await searchParams
  const properties = await getPropertyOptions()

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Upload document</h1>
      <DocumentForm properties={properties} action={createDocument} defaultPropertyId={propertyId} />
    </div>
  )
}
