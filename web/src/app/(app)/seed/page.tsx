import { notFound } from 'next/navigation'
import { SeedClient } from './seed-client'

export default function SeedPage() {
  if (process.env.NODE_ENV === 'production') {
    notFound()
  }

  return <SeedClient />
}
