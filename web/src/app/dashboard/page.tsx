import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default function DashboardPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <p className="text-foreground/70">
        Ticket 001 foundation is in place: auth, responsive shell, and property
        CRUD.
      </p>
      <Link
        href="/properties"
        className="inline-block rounded-md bg-foreground text-background px-4 py-2 text-sm font-medium transition-opacity hover:opacity-90"
      >
        View properties
      </Link>
    </div>
  )
}
