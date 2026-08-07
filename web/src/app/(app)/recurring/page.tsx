import Link from 'next/link'
import { getRecurringRules, getRecurringRule, generateObligationsForRule } from '@/lib/actions/recurring'
import { getPropertyOptions } from '@/lib/actions/property'
import { FormAction } from '@/components/ui/form-action'

export const dynamic = 'force-dynamic'

type ActionResult = { success: true } | { error: string }

async function generateForRule(id: string): Promise<ActionResult> {
  const rule = await getRecurringRule(id)
  if (!rule) return { error: 'Rule not found' }
  try {
    await generateObligationsForRule(rule)
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : 'Failed to generate obligations' }
  }
  return { success: true }
}

export default async function RecurringPage() {
  const [rules, properties] = await Promise.all([getRecurringRules(), getPropertyOptions()])
  const propertyMap = Object.fromEntries(properties.map((p) => [p.id, p.nickname]))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Recurring obligations</h1>
        <Link href="/recurring/new" className="rounded-md bg-foreground text-background px-4 py-2 text-sm font-medium transition-opacity hover:opacity-90">
          Add recurring
        </Link>
      </div>
      {rules.length === 0 ? (
        <p className="text-foreground/70">No recurring obligations yet.</p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rules.map((rule) => (
            <li key={rule.id} className="rounded-lg border p-4">
              <Link href={`/recurring/${rule.id}`} className="font-semibold hover:underline block">
                {rule.description || rule.category.replace(/_/g, ' ')}
              </Link>
              <p className="text-sm text-foreground/70">
                {propertyMap[rule.property_id] || 'Unknown'} · ${rule.amount.toFixed(2)} · {rule.frequency} (day {rule.day_of_month})
              </p>
              <p className="text-sm text-foreground/70">{rule.active ? 'Active' : 'Inactive'}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link href={`/recurring/${rule.id}/edit`} className="text-sm underline">
                  Edit
                </Link>
                <FormAction
                  action={generateForRule.bind(null, rule.id)}
                  className="contents"
                >
                  <button
                    type="submit"
                    className="text-sm underline"
                  >
                    Generate
                  </button>
                </FormAction>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
