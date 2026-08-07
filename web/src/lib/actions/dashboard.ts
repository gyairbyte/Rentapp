'use server'

import { createClient } from '@/lib/supabase/client'
import { requireUser } from './helpers'
import { toISODate, addDays, startOfMonth, endOfMonth } from './dates'
import type { Obligation, Property } from '@/lib/types'

export async function getDashboardData() {
  const user = await requireUser()
  const supabase = await createClient()

  const now = new Date()
  const today = toISODate(now)
  const nextWeek = toISODate(addDays(now, 7))
  const nextMonth = toISODate(addDays(now, 30))
  const startOfCurrentMonth = toISODate(startOfMonth(now))
  const endOfCurrentMonth = toISODate(endOfMonth(now))

  const { data: rawObligations, error: obError } = await supabase
    .from('obligations')
    .select('*')
    .eq('user_id', user.id)
    .order('due_date', { ascending: true })
    .returns<Obligation[]>()

  if (obError) throw new Error(obError.message)

  const { data: rawProperties, error: propError } = await supabase
    .from('properties')
    .select('*')
    .eq('user_id', user.id)
    .eq('archived', false)
    .order('nickname', { ascending: true })
    .returns<Property[]>()

  if (propError) throw new Error(propError.message)

  const obligations = (rawObligations ?? []).filter(
    (o) => !['canceled', 'waived'].includes(o.status)
  )

  const inMonth = (dueDate: string) => dueDate >= startOfCurrentMonth && dueDate <= endOfCurrentMonth

  const needsAttention = {
    overdueBills: obligations.filter(
      (o) => o.direction === 'payable' && o.due_date < today && o.paid_amount < o.expected_amount
    ),
    overdueRent: obligations.filter(
      (o) => o.direction === 'receivable' && o.category === 'rent' && o.due_date < today && o.paid_amount < o.expected_amount
    ),
    dueSoon: obligations.filter(
      (o) => o.due_date >= today && o.due_date <= nextWeek && o.paid_amount < o.expected_amount
    ),
  }

  const rentObligations = obligations.filter((o) => o.category === 'rent' && inMonth(o.due_date))
  const thisMonth = {
    rentExpected: rentObligations.reduce((sum, o) => sum + o.expected_amount, 0),
    rentReceived: rentObligations.reduce((sum, o) => sum + o.paid_amount, 0),
    billsDue: obligations
      .filter((o) => o.direction === 'payable' && inMonth(o.due_date))
      .reduce((sum, o) => sum + o.expected_amount, 0),
    billsPaid: obligations
      .filter((o) => o.direction === 'payable' && inMonth(o.due_date))
      .reduce((sum, o) => sum + o.paid_amount, 0),
  }

  const upcoming = obligations
    .filter((o) => o.due_date >= today && o.due_date <= nextMonth && o.paid_amount < o.expected_amount)
    .slice(0, 20)

  const properties = (rawProperties ?? []).map((property) => {
    const propertyObligations = obligations.filter((o) => o.property_id === property.id)
    const rent = propertyObligations.filter((o) => o.category === 'rent' && inMonth(o.due_date))
    const rentExpected = rent.reduce((sum, o) => sum + o.expected_amount, 0)
    const rentReceived = rent.reduce((sum, o) => sum + o.paid_amount, 0)
    const open = propertyObligations.filter((o) => o.paid_amount < o.expected_amount).length

    return {
      ...property,
      rentExpected,
      rentReceived,
      rentOutstanding: rentExpected - rentReceived,
      openObligations: open,
    }
  })

  return {
    needsAttention,
    thisMonth: {
      ...thisMonth,
      rentOutstanding: thisMonth.rentExpected - thisMonth.rentReceived,
      billsOutstanding: thisMonth.billsDue - thisMonth.billsPaid,
    },
    upcoming,
    properties,
  }
}
