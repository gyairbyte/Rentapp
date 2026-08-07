import Link from 'next/link'

export const dynamic = 'force-dynamic'

const actions = [
  { href: '/properties/new', label: 'Add property', description: 'Create a new rental property.' },
  { href: '/obligations/new', label: 'Add bill / obligation', description: 'Record a payable or receivable obligation.' },
  { href: '/obligations', label: 'Record payment', description: 'Find an obligation and record a payment.' },
  { href: '/recurring/new', label: 'Add recurring obligation', description: 'Set up monthly rent, quarterly water, etc.' },
  { href: '/parties/new', label: 'Add party / provider', description: 'Add a tenant, utility, contractor, or authority.' },
  { href: '/documents/new', label: 'Scan / upload document', description: 'Store a photo or PDF for future review.', comingSoon: true },
  { href: '/obligations/new?category=contractor_invoice', label: 'Add repair / task', description: 'Repair/work order tracking is a future feature.', comingSoon: true },
]

export default function AddPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Add</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {actions.map((action) => (
          <Link
            key={action.href}
            href={action.href}
            className={`rounded-lg border p-4 hover:border-foreground/50 transition-colors ${
              action.comingSoon ? 'opacity-70' : ''
            }`}
          >
            <div className="font-semibold">{action.label}</div>
            <p className="text-sm text-foreground/70 mt-1">{action.description}</p>
            {action.comingSoon && <span className="text-xs text-foreground/50 mt-2 inline-block">Placeholder</span>}
          </Link>
        ))}
      </div>
    </div>
  )
}
