import { notFound } from 'next/navigation'
import { DocumentForm } from '@/components/document/document-form'
import { getDocument, updateDocument } from '@/lib/actions/documents'
import { getPropertyOptions } from '@/lib/actions/property'
import { getAccounts } from '@/lib/actions/account'
import { getParties } from '@/lib/actions/party'
import { getObligations } from '@/lib/actions/obligations'

export const dynamic = 'force-dynamic'

export default async function EditDocumentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [document, properties, accounts, parties, obligations] = await Promise.all([
    getDocument(id),
    getPropertyOptions(),
    getAccounts(),
    getParties(),
    getObligations({ includeResolved: true }),
  ])

  if (!document) notFound()

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Edit document</h1>
      <DocumentForm
        document={document}
        properties={properties}
        accounts={accounts.map((a) => ({ id: a.id, account_type: a.account_type, account_number: a.account_number, property_id: a.property_id }))}
        parties={parties.map((p) => ({ id: p.id, name: p.name, party_type: p.party_type, property_id: p.property_id }))}
        obligations={obligations.map((o) => ({ id: o.id, description: o.description, category: o.category, property_id: o.property_id }))}
        action={updateDocument.bind(null, id)}
      />
    </div>
  )
}
