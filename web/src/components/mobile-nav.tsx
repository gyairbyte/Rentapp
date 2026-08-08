'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const links = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/bills', label: 'Bills' },
  { href: '/repairs', label: 'Repairs' },
  { href: '/inbox', label: 'Inbox' },
  { href: '/add', label: 'Add' },
  { href: '/properties', label: 'Properties' },
]

export function MobileNav() {
  const pathname = usePathname()

  return (
    <div className="flex justify-around items-center p-2">
      {links.map((link) => {
        const active = pathname === link.href || pathname.startsWith(`${link.href}/`)
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`flex flex-col items-center rounded-md px-2 py-1 text-xs font-medium ${
              active ? 'text-foreground' : 'text-foreground/60'
            }`}
          >
            <span className="text-lg">{link.label[0]}</span>
            <span>{link.label}</span>
          </Link>
        )
      })}
    </div>
  )
}
