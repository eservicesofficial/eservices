'use client'

import React from 'react'
import { Crown, Phone, Search, SortAsc, SortDesc, UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { fmtCur, relTime, FILTER_TABS, TAG_COLORS, STATUS_BADGE } from './customer-folio-helpers'
import type { Customer, CustomerTagAssignment } from './customer-folio-types'

// ─── Props ───
interface CustomerSidebarProps {
  customers: Customer[]
  loading: boolean
  search: string
  setSearch: (v: string) => void
  filter: string
  setFilter: (v: string) => void
  sort: string
  setSort: (v: string) => void
  selectedId: string | null
  canCreate: boolean
  onAddCustomer: () => void
  onSelectCustomer: (id: string) => void
}

export function CustomerFolioSidebar({
  customers, loading, search, setSearch, filter, setFilter, sort, setSort,
  selectedId, canCreate, onAddCustomer, onSelectCustomer,
}: CustomerSidebarProps) {
  const totalOutstanding = customers.reduce((s, c) => s + (c.balance > 0 ? c.balance : 0), 0)
  const activeCount = customers.filter(c => c.status === 'Active').length
  const dueCount = customers.filter(c => c.status === 'Active' && c.balance > 0).length

  return (
    <div className="w-[280px] shrink-0 border-r border-slate-200 dark:border-slate-700 flex flex-col bg-white dark:bg-slate-900 overflow-hidden">
      {/* Search */}
      <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800 shrink-0">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 size-3.5 text-slate-400 dark:text-slate-500" />
          <Input placeholder="Search guests..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-8 text-xs" />
        </div>
      </div>

      {/* Filter tabs */}
      <div className="px-2 py-1.5 border-b border-slate-100 dark:border-slate-800 shrink-0 overflow-x-auto">
        <div className="flex items-center gap-1">
          {FILTER_TABS.map(tab => (
            <button key={tab} onClick={() => setFilter(tab)} className={`px-2 py-1 text-[10px] font-medium whitespace-nowrap rounded transition-all ${filter === tab ? 'bg-emerald-600 text-white' : 'text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
              {tab}
              {tab === 'All' && <span className="ml-0.5 opacity-60">({customers.length})</span>}
              {tab === 'Due' && <span className="ml-0.5 opacity-60">({dueCount})</span>}
            </button>
          ))}
        </div>
      </div>

      {/* Sort + Add */}
      <div className="px-3 py-1.5 border-b border-slate-100 dark:border-slate-800 shrink-0 flex items-center justify-between">
        <Select value={sort} onValueChange={setSort}>
          <SelectTrigger className="w-[100px] h-7 text-[10px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="newest"><SortDesc className="size-2.5 inline mr-1" />Newest</SelectItem>
            <SelectItem value="oldest"><SortAsc className="size-2.5 inline mr-1" />Oldest</SelectItem>
            <SelectItem value="name">A-Z</SelectItem>
          </SelectContent>
        </Select>
        {canCreate && (
          <Button size="sm" className="h-7 gap-1 text-[10px] bg-emerald-600 hover:bg-emerald-700 text-white" onClick={onAddCustomer}>
            <UserPlus className="size-3" />Add
          </Button>
        )}
      </div>

      {/* Customer Profile List */}
      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="p-2 space-y-2">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="flex items-center gap-2.5 p-2">
                <Skeleton className="h-9 w-9 rounded-full" />
                <div className="flex-1 space-y-1">
                  <Skeleton className="h-3 w-28" />
                  <Skeleton className="h-2 w-20" />
                </div>
              </div>
            ))}
          </div>
        )}
        {!loading && customers.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 px-4">
            <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-3">
              <span className="text-lg text-slate-300 dark:text-slate-600">👤</span>
            </div>
            <p className="text-xs font-semibold text-slate-400 dark:text-slate-500">No customers</p>
            <p className="text-[10px] text-slate-300 dark:text-slate-600 mt-0.5">Add one or change filters</p>
          </div>
        )}
        {!loading && customers.length > 0 && (
          <div className="p-1.5 space-y-0.5">
            {customers.map(c => (
              <div
                key={c.id}
                onClick={() => onSelectCustomer(c.id)}
                className={`flex items-center gap-2.5 p-2 rounded-lg cursor-pointer transition-all group active:scale-[0.99] ${
                  selectedId === c.id
                    ? 'bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800'
                    : 'hover:bg-slate-50 dark:hover:bg-slate-800/50 border border-transparent'
                }`}
              >
                {/* Avatar */}
                <div className="relative shrink-0">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                    selectedId === c.id
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-300 group-hover:bg-slate-300 dark:group-hover:bg-slate-600'
                  }`}>
                    {c.fullName.charAt(0).toUpperCase()}
                  </div>
                  {/* VIP crown */}
                  {c.tags?.length > 0 && c.tags.some((t: CustomerTagAssignment) => t.tagName === 'VIP') && (
                    <div className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-yellow-400 flex items-center justify-center">
                      <Crown className="size-2 text-yellow-900" />
                    </div>
                  )}
                  {/* Status dot */}
                  <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 ${
                    selectedId === c.id ? 'border-emerald-50 dark:border-emerald-900/20' : 'border-white dark:border-slate-900'
                  } ${c.status === 'Active' ? 'bg-green-500' : c.status === 'Settled' ? 'bg-teal-500' : 'bg-slate-400'}`} />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className={`text-xs font-semibold truncate ${selectedId === c.id ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-700 dark:text-slate-200'}`}>
                      {c.fullName}
                    </span>
                    <span className={`text-[8px] px-1 py-0.5 rounded font-medium ${STATUS_BADGE[c.status] || STATUS_BADGE.Active}`}>
                      {c.status === 'CheckedOut' ? 'Out' : c.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono truncate">{c.customerId}</span>
                    {c.mobile && (
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 flex items-center gap-0.5 truncate">
                        <Phone className="size-2.5 shrink-0" />
                        {c.mobile}
                      </span>
                    )}
                  </div>
                  {c.tags?.length > 0 && (
                    <div className="flex items-center gap-0.5 mt-1">
                      {c.tags.slice(0, 2).map(t => (
                        <span key={t.id} className={`text-[7px] px-1 py-0.5 rounded-full font-medium ${TAG_COLORS[t.tagName] || TAG_COLORS.Regular}`}>{t.tagName}</span>
                      ))}
                      {c.tags.length > 2 && <span className="text-[7px] text-slate-400">+{c.tags.length - 2}</span>}
                    </div>
                  )}
                </div>

                {/* Balance */}
                <div className="text-right shrink-0">
                  <div className={`text-[11px] font-bold tabular-nums ${
                    c.balance > 0 ? 'text-red-600 dark:text-red-400' :
                    c.balance < 0 ? 'text-green-600 dark:text-green-400' :
                    'text-slate-300 dark:text-slate-600'
                  }`}>
                    {c.balance > 0 ? '+' : ''}{fmtCur(c.balance)}
                  </div>
                  {c.lastTxnDate && (
                    <div className="text-[8px] text-slate-300 dark:text-slate-600">{relTime(c.lastTxnDate)}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer summary */}
      <div className="border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-3 py-1.5 shrink-0">
        <div className="flex items-center justify-between text-[10px]">
          <div className="flex items-center gap-2">
            <span className="text-slate-500 dark:text-slate-400"><strong className="text-slate-700 dark:text-slate-200">{customers.length}</strong></span>
            <span className="text-green-600 dark:text-green-400"><strong>{activeCount}</strong></span>
            <span className="text-red-500 dark:text-red-400"><strong>{dueCount}</strong></span>
          </div>
          <span className="text-red-600 dark:text-red-400 font-bold tabular-nums">{fmtCur(totalOutstanding)}</span>
        </div>
      </div>
    </div>
  )
}
