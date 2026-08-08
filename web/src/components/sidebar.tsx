'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { SignOutButton } from './sign-out-button'

const links = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/bills', label: 'Bills' },
  { href: '/inbox', label: 'Inbox' },
  { href: '/properties', label: 'Properties' },
  { href: '/obligations', label: 'Obligations' },
  { href: '/parties', label: 'Parties' },
  { href: '/accounts', label: 'Accounts' },
  { href: '/recurring', label: 'Recurring' },
  { href: '/documents', label: 'Documents' },
  { href: '/add', label: 'Add' },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <div className="flex flex-col h-full p-4 gap-2">
      <div className="font-bold text-xl mb-6">Rentapp</div>
      {links.map((link) => {
        const active = pathname === link.href || pathname.startsWith(`${link.href}/`)
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              active
                ? 'bg-foreground text-background'
                : 'hover:bg-foreground/10'
            }`}
          >
            {link.label}
          </Link>
        )
      })}
      <div className="mt-auto pt-4">
        <SignOutButton />
      </div>
    </div>
  )
}
