'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/client'
import { requireUser } from './helpers'
import { generateObligationsForRule } from './recurring'
import { syncObligationPayments } from './obligations'
import type { Property, Party, Account, RecurringRule, Obligation } from '@/lib/types'

export async function seedDemoData(): Promise<{ success: boolean; message: string }> {
  const user = await requireUser()
  const supabase = createClient()

  const existing = await supabase.from('properties').select('id').eq('user_id', user.id).eq('archived', false).limit(1).single()
  if (existing.data) {
    return { success: false, message: 'Demo data was not created because this account already has properties.' }
  }

  const properties: Property[] = []
  const parties: Party[] = []
  const accounts: Account[] = []
  const recurring: RecurringRule[] = []
  const obligations: Obligation[] = []

  const today = new Date()
  const currentMonth = today.getMonth()
  const currentYear = today.getFullYear()
  const dueThisMonth = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`

  const p1 = await supabase.from('properties').insert({
    user_id: user.id,
    nickname: '123 Main Street',
    street_address: '123 Main Street',
    city: 'Philadelphia',
    state: 'PA',
    zip: '19103',
    property_type: 'single_family',
    active: true,
    archived: false,
  }).select().single()
  if (p1.data) properties.push(p1.data as Property)

  const p2 = await supabase.from('properties').insert({
    user_id: user.id,
    nickname: '78 Walton Ave',
    street_address: '78 Walton Avenue',
    city: 'Philadelphia',
    state: 'PA',
    zip: '19104',
    property_type: 'multi_family',
    active: true,
    archived: false,
  }).select().single()
  if (p2.data) properties.push(p2.data as Property)

  const p3 = await supabase.from('properties').insert({
    user_id: user.id,
    nickname: '45 Oak Street',
    street_address: '45 Oak Street',
    city: 'Pittsburgh',
    state: 'PA',
    zip: '15201',
    property_type: 'townhouse',
    active: true,
    archived: false,
  }).select().single()
  if (p3.data) properties.push(p3.data as Property)

  for (const property of properties) {
    const tenant = await supabase.from('parties').insert({
      user_id: user.id,
      property_id: property.id,
      name: `${property.nickname} Tenant`,
      party_type: 'tenant',
      email: 'tenant@example.com',
      phone: '555-0000',
      notes: null,
    }).select().single()
    if (tenant.data) parties.push(tenant.data as Party)

    const water = await supabase.from('parties').insert({
      user_id: user.id,
      property_id: null,
      name: 'City Water Department',
      party_type: 'utility_provider',
      email: null,
      phone: null,
      notes: null,
    }).select().single()
    if (water.data) parties.push(water.data as Party)

    const waterAccount = await supabase.from('accounts').insert({
      user_id: user.id,
      property_id: property.id,
      party_id: water.data?.id ?? null,
      account_type: 'water',
      account_number: String(Math.floor(100000 + Math.random() * 900000)),
      notes: null,
    }).select().single()
    if (waterAccount.data) accounts.push(waterAccount.data as Account)

    const rentRule = await supabase.from('recurring_rules').insert({
      user_id: user.id,
      property_id: property.id,
      account_id: null,
      party_id: tenant.data?.id ?? null,
      direction: 'receivable',
      category: 'rent',
      description: 'Monthly rent',
      amount: 1800,
      frequency: 'monthly',
      day_of_month: 1,
      start_date: dueThisMonth,
      end_date: null,
      active: true,
      notes: null,
    }).select().single()
    if (rentRule.data) recurring.push(rentRule.data as RecurringRule)

    const waterRule = await supabase.from('recurring_rules').insert({
      user_id: user.id,
      property_id: property.id,
      account_id: waterAccount.data?.id ?? null,
      party_id: water.data?.id ?? null,
      direction: 'payable',
      category: 'water',
      description: 'Quarterly water bill',
      amount: 134.6,
      frequency: 'quarterly',
      day_of_month: 15,
      start_date: dueThisMonth,
      end_date: null,
      active: true,
      notes: null,
    }).select().single()
    if (waterRule.data) recurring.push(waterRule.data as RecurringRule)
  }

  for (const rule of recurring) {
    const count = await generateObligationsForRule(rule)
    if (count > 0) {
      const obs = await supabase.from('obligations').select('*').eq('recurring_rule_id', rule.id).eq('user_id', user.id).returns<Obligation[]>()
      if (obs.data) obligations.push(...obs.data)
    }
  }

  const waterParty = parties.find((p) => p.party_type === 'utility_provider')
  const waterAccount = accounts.find((a) => a.property_id === properties[0]?.id && a.account_type === 'water')
  if (waterParty && waterAccount) {
    const manual = await supabase.from('obligations').insert({
      user_id: user.id,
      property_id: properties[0].id,
      account_id: waterAccount.id,
      party_id: waterParty.id,
      recurring_rule_id: null,
      direction: 'payable',
      category: 'water',
      description: 'Water bill',
      expected_amount: 134.6,
      paid_amount: 0,
      due_date: `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-04`,
      status: 'overdue',
      paid_date: null,
      period_start: null,
      period_end: null,
      notes: null,
    }).select().single()
    if (manual.data) obligations.push(manual.data as Obligation)
  }

  const manualBill = obligations.find(
    (o) => o.property_id === properties[0]?.id && o.category === 'water' && o.due_date.endsWith('-04')
  )
  if (manualBill) {
    await supabase.from('payments').insert({
      user_id: user.id,
      property_id: properties[0].id,
      obligation_id: manualBill.id,
      amount: 50,
      payment_date: `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-05`,
      method: 'check',
      confirmation_reference: null,
      notes: null,
      evidence_document_id: null,
    })
    await syncObligationPayments(manualBill.id)
  }

  const p3Rent = obligations.find((o) => o.property_id === properties[2]?.id && o.category === 'rent')
  if (p3Rent) {
    await supabase.from('payments').insert({
      user_id: user.id,
      property_id: properties[2].id,
      obligation_id: p3Rent.id,
      amount: 1800,
      payment_date: `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`,
      method: 'ach',
      confirmation_reference: null,
      notes: null,
      evidence_document_id: null,
    })
    await syncObligationPayments(p3Rent.id)
  }

  revalidatePath('/', 'layout')

  return {
    success: true,
    message: `Created ${properties.length} properties, ${parties.length} parties, ${accounts.length} accounts, ${recurring.length} recurring rules, and sample obligations/payments.`,
  }
}
