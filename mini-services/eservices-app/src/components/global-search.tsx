'use client'

import React, { useEffect, useState, useCallback } from 'react'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { FileText, Package, BookOpen, Users, Loader2 } from 'lucide-react'
import { apiFetch } from '@/lib/api'

interface GlobalSearchProps {
  onNavigate: (page: string, id?: string) => void
}

interface InvoiceResult {
  id: string
  invoiceNumber: string
  customerName: string
  date: string
  grandTotal: number
}

interface ItemResult {
  id: string
  name: string
  category: string
  price: number
  quantity: number
}

interface KhataProfileResult {
  id: string
  name: string
  phone: string
  type: string
  balance: number
}

interface StaffResult {
  id: string
  name: string
  designation: string
  department: string
  stats: {
    total: number
    present: number
    absent: number
    leave: number
    halfday: number
    holiday: number
  }
}

export default function GlobalSearch({ onNavigate }: GlobalSearchProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [invoices, setInvoices] = useState<InvoiceResult[]>([])
  const [items, setItems] = useState<ItemResult[]>([])
  const [khataProfiles, setKhataProfiles] = useState<KhataProfileResult[]>([])
  const [staff, setStaff] = useState<StaffResult[]>([])

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [invoicesRes, itemsRes, khataRes, staffRes] = await Promise.all([
        apiFetch('/api/invoices').then((r) => r.json()),
        apiFetch('/api/items').then((r) => r.json()),
        apiFetch('/api/khata/profiles').then((r) => r.json()),
        apiFetch('/api/staff').then((r) => r.json()),
      ])

      setInvoices(Array.isArray(invoicesRes) ? invoicesRes : [])
      setItems(Array.isArray(itemsRes) ? itemsRes : [])
      setKhataProfiles(Array.isArray(khataRes) ? khataRes : [])
      setStaff(Array.isArray(staffRes) ? staffRes : [])
    } catch (error) {
      console.error('Failed to fetch search data:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((prev) => !prev)
      }
    }

    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [])

  const handleOpenChange = useCallback(
    (newOpen: boolean) => {
      setOpen(newOpen)
      if (newOpen) {
        fetchData()
      }
    },
    [fetchData]
  )

  const handleSelect = useCallback(
    (page: string, id?: string) => {
      setOpen(false)
      onNavigate(page, id)
    },
    [onNavigate]
  )

  const hasResults =
    invoices.length > 0 || items.length > 0 || khataProfiles.length > 0 || staff.length > 0

  return (
    <CommandDialog
      open={open}
      onOpenChange={handleOpenChange}
      title="Global Search"
      description="Search invoices, items, khata profiles, and staff across the application"
    >
      <CommandInput
        placeholder="Type a command or search..."
        disabled={loading}
      />
      <CommandList>
        {loading ? (
          <div className="flex flex-col items-center justify-center py-10 gap-3" role="status" aria-label="Loading search results">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Loading results...</p>
          </div>
        ) : hasResults ? (
          <>
            {invoices.length > 0 && (
              <CommandGroup heading="Invoices">
                {invoices.slice(0, 10).map((invoice) => (
                  <CommandItem
                    key={invoice.id}
                    value={`invoice ${invoice.invoiceNumber} ${invoice.customerName}`}
                    onSelect={() => handleSelect('bill-history', invoice.id)}
                    className="cursor-pointer"
                  >
                    <FileText className="mr-2 h-4 w-4 shrink-0 text-amber-500" aria-hidden="true" />
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="font-medium truncate">
                        #{invoice.invoiceNumber}
                      </span>
                      <span className="text-xs text-muted-foreground truncate">
                        {invoice.customerName} &middot; ₹{invoice.grandTotal?.toLocaleString('en-IN') ?? '0'}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0 ml-2">
                      {invoice.date}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {items.length > 0 && (
              <CommandGroup heading="Items">
                {items.slice(0, 10).map((item) => (
                  <CommandItem
                    key={item.id}
                    value={`item ${item.name} ${item.category}`}
                    onSelect={() => handleSelect('item-management', item.id)}
                    className="cursor-pointer"
                  >
                    <Package className="mr-2 h-4 w-4 shrink-0 text-emerald-500" aria-hidden="true" />
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="font-medium truncate">{item.name}</span>
                      <span className="text-xs text-muted-foreground truncate">
                        {item.category} &middot; Stock: {item.quantity}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0 ml-2">
                      ₹{item.price?.toLocaleString('en-IN') ?? '0'}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {khataProfiles.length > 0 && (
              <CommandGroup heading="Khata Profiles">
                {khataProfiles.slice(0, 10).map((profile) => (
                  <CommandItem
                    key={profile.id}
                    value={`khata ${profile.name} ${profile.phone} ${profile.type}`}
                    onSelect={() => handleSelect('khata', profile.id)}
                    className="cursor-pointer"
                  >
                    <BookOpen className="mr-2 h-4 w-4 shrink-0 text-violet-500" aria-hidden="true" />
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="font-medium truncate">{profile.name}</span>
                      <span className="text-xs text-muted-foreground truncate">
                        {profile.type} {profile.phone ? `· ${profile.phone}` : ''}
                      </span>
                    </div>
                    <span
                      className={`text-xs font-medium shrink-0 ml-2 ${
                        (profile.balance ?? 0) > 0
                          ? 'text-red-500'
                          : (profile.balance ?? 0) < 0
                            ? 'text-green-500'
                            : 'text-muted-foreground'
                      }`}
                    >
                      ₹{(profile.balance ?? 0).toLocaleString('en-IN')}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {staff.length > 0 && (
              <CommandGroup heading="Staff">
                {staff.slice(0, 10).map((member) => (
                  <CommandItem
                    key={member.id}
                    value={`staff ${member.name} ${member.designation} ${member.department}`}
                    onSelect={() => handleSelect('attendance', member.id)}
                    className="cursor-pointer"
                  >
                    <Users className="mr-2 h-4 w-4 shrink-0 text-emerald-500" aria-hidden="true" />
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="font-medium truncate">{member.name}</span>
                      <span className="text-xs text-muted-foreground truncate">
                        {member.designation}
                        {member.department ? ` · ${member.department}` : ''}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0 ml-2">
                      {member.stats?.present ?? 0}d present
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </>
        ) : (
          <CommandEmpty>No results found.</CommandEmpty>
        )}
      </CommandList>
    </CommandDialog>
  )
}
