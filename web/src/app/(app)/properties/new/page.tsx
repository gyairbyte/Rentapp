import { PropertyForm } from '@/components/property/property-form'
import { createProperty } from '@/lib/actions/property'

export const dynamic = 'force-dynamic'

export default function NewPropertyPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Add property</h1>
      <PropertyForm action={createProperty} />
    </div>
  )
}
