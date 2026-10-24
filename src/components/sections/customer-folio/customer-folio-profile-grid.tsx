'use client'

import React from 'react'
import { BarChart3, Calendar, Crown, Phone, Search, SortAsc, SortDesc, UserPlus, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { fmtCur, FILTER_TABS, TAG_COLORS, STATUS_BADGE } from './customer-folio-helpers'
import type { Customer, CustomerTagAssignment } from './customer-folio-types'

// ─── Props ───
interface ProfileGridProps {
  customers: Customer[]
  loading: boolean
  search: string
  setSearch: (v: string) => void
  filter: string
  setFilter: (v: string) => void
  sort: string
  setSort: (v: string) => void
  canCreate: boolean
  onAddCustomer: () => void
  onSelectCustomer: (id: string) => void
  onReports?: () => void
}

export function CustomerFolioProfileGrid({
  customers, loading, search, setSearch, filter, setFilter, sort, setSort,
  canCreate, onAddCustomer, onSelectCustomer, onReports,
}: ProfileGridProps) {
  const today = new Date().toISOString().split('T')[0]
  const [checkoutDateFrom, setCheckoutDateFrom] = React.useState(today)
  const [checkoutDateTo, setCheckoutDateTo] = React.useState(today)

  // Filter checkout customers by date range when on Checkout tab
  const displayedCustomers = React.useMemo(() => {
    if (filter !== 'Checkout') return customers
    if (!checkoutDateFrom && !checkoutDateTo) return customers
    return customers.filter(c => {
      if (!c.updatedAt) return false
      const customerDate = c.updatedAt.split('T')[0]
      if (checkoutDateFrom && customerDate < checkoutDateFrom) return false
      if (checkoutDateTo && customerDate > checkoutDateTo) return false
      return true
    })
  }, [customers, filter, checkoutDateFrom, checkoutDateTo])

  const totalOutstanding = customers.reduce((s, c) => s + (c.balance > 0 ? c.balance : 0), 0)
  const activeCount = customers.filter(c => c.status === 'Active').length
  const dueCount = customers.filter(c => c.status === 'Active' && c.balance > 0).length

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* ── Search & Filter Bar ── */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 px-4 py-3 shrink-0">
        <div className="flex items-center gap-3 flex-wrap">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-2.5 size-4 text-slate-400" />
            <Input placeholder="Search customers by name, phone, ID..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10 h-9 text-sm bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700" />
          </div>
          {/* Checkout Date Range Filter */}
          {filter === 'Checkout' && (
            <div className="flex items-center gap-2">
              <div className="relative">
                <Calendar className="absolute left-3 top-2.5 size-4 text-slate-400" />
                <Input
                  type="date"
                  value={checkoutDateFrom}
                  onChange={e => setCheckoutDateFrom(e.target.value)}
                  className="pl-10 h-9 text-xs w-[150px] bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                />
              </div>
              <span className="text-xs text-slate-400 font-medium">→</span>
              <div className="relative">
                <Calendar className="absolute left-3 top-2.5 size-4 text-slate-400" />
                <Input
                  type="date"
                  value={checkoutDateTo}
                  onChange={e => setCheckoutDateTo(e.target.value)}
                  className="pl-10 h-9 text-xs w-[150px] bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                />
              </div>
            </div>
          )}
          {/* Sort */}
          <Select value={sort} onValueChange={setSort}>
            <SelectTrigger className="w-[130px] h-9 text-xs">
              <SelectValue placeholder="Sort" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest"><SortDesc className="size-3.5 inline mr-1.5" />Newest First</SelectItem>
              <SelectItem value="oldest"><SortAsc className="size-3.5 inline mr-1.5" />Oldest First</SelectItem>
              <SelectItem value="name">A-Z Name</SelectItem>
            </SelectContent>
          </Select>
          {/* Add Customer */}
          {canCreate && (
            <Button className="h-9 gap-2 text-xs bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm" onClick={onAddCustomer}>
              <UserPlus className="size-3.5" />Add Customer
            </Button>
          )}
          {/* Reports Button */}
          {onReports && (
            <Button
              variant="outline"
              className="h-9 gap-2 text-xs border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              onClick={onReports}
            >
              <BarChart3 className="size-3.5" />Reports
            </Button>
          )}
        </div>

        {/* Filter tabs */}
        <div className="flex items-center gap-1.5 mt-2.5 overflow-x-auto">
          {FILTER_TABS.map(tab => (
            <button key={tab} onClick={() => setFilter(tab)} className={`px-3 py-1.5 text-xs font-medium whitespace-nowrap rounded-lg transition-all ${
              filter === tab
                ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/20'
                : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700'
            }`}>
              {tab}
              {tab === 'All' && <span className="ml-1.5 opacity-70">({customers.length})</span>}
              {tab === 'Due' && <span className="ml-1.5 opacity-70">({dueCount})</span>}
              {tab === 'Active' && <span className="ml-1.5 opacity-70">({activeCount})</span>}
              {tab === 'Checkout' && <span className="ml-1.5 opacity-70">({displayedCustomers.length})</span>}
            </button>
          ))}
        </div>
      </div>

      {/* ── Stats Bar ── */}
      <div className="bg-slate-50 dark:bg-slate-800/40 border-b border-slate-200 dark:border-slate-700 px-4 py-2 shrink-0">
        <div className="flex items-center gap-6 text-xs">
          <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
            <Users className="size-3.5" />
            <span className="font-semibold">{customers.length}</span>
            <span className="text-slate-400 dark:text-slate-500">Total</span>
          </div>
          <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="font-semibold">{activeCount}</span>
            <span className="text-emerald-500/70">Active</span>
          </div>
          <div className="flex items-center gap-1.5 text-red-600 dark:text-red-400">
            <span className="w-2 h-2 rounded-full bg-red-500" />
            <span className="font-semibold">{dueCount}</span>
            <span className="text-red-500/70">Due</span>
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            <span className="text-slate-500 dark:text-slate-400">Outstanding:</span>
            <span className="font-bold text-red-600 dark:text-red-400">{fmtCur(totalOutstanding)}</span>
          </div>
        </div>
      </div>

      {/* ── Customer Profile Cards Grid ── */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="rounded-xl border border-slate-200 dark:border-slate-700 p-4">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-12 w-12 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
                <div className="mt-3 space-y-2">
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-2/3" />
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && displayedCustomers.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-20 h-20 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
              <span className="text-3xl font-bold text-slate-300 dark:text-slate-600">👤</span>
            </div>
            <h3 className="text-base font-bold text-slate-700 dark:text-slate-300 mb-1">No Customers Found</h3>
            <p className="text-sm text-slate-400 dark:text-slate-500">Add a new customer or change your search filters</p>
            {canCreate && (
              <Button onClick={onAddCustomer} className="mt-4 gap-2 bg-emerald-600 hover:bg-emerald-700 text-white">
                <UserPlus className="size-4" />Add New Customer
              </Button>
            )}
          </div>
        )}

        {!loading && displayedCustomers.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {displayedCustomers.map(c => (
              <div
                key={c.id}
                onClick={() => onSelectCustomer(c.id)}
                className="group rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 p-4 cursor-pointer hover:border-emerald-300 dark:hover:border-emerald-700 hover:shadow-md hover:shadow-emerald-600/5 transition-all active:scale-[0.99]"
              >
                {/* Profile Header */}
                <div className="flex items-start gap-3">
                  {/* Avatar */}
                  <div className="relative shrink-0">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center text-white text-base font-bold shadow-sm shadow-emerald-600/20">
                      {c.fullName.charAt(0).toUpperCase()}
                    </div>
                    {/* VIP crown */}
                    {c.tags?.length > 0 && c.tags.some((t: CustomerTagAssignment) => t.tagName === 'VIP') && (
                      <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-yellow-400 flex items-center justify-center shadow-sm">
                        <Crown className="size-2.5 text-yellow-900" />
                      </div>
                    )}
                    {/* Status dot */}
                    <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white dark:border-slate-800 ${
                      c.status === 'Active' ? 'bg-green-500' : c.status === 'Settled' ? 'bg-teal-500' : 'bg-slate-400'
                    }`} />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate group-hover:text-emerald-700 dark:group-hover:text-emerald-300 transition-colors">
                      {c.fullName}
                    </h4>
                    <p className="text-xs text-slate-400 dark:text-slate-500 font-mono mt-0.5">{c.customerId}</p>
                    {c.mobile && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1">
                        <Phone className="size-3" />
                        {c.mobile}
                      </p>
                    )}
                  </div>
                </div>

                {/* Tags & Status */}
                <div className="flex items-center gap-1.5 mt-3">
                  <span className={`text-[10px] px-2 py-0.5 rounded-md font-semibold ${STATUS_BADGE[c.status] || STATUS_BADGE.Active}`}>
                    {c.status === 'CheckedOut' ? 'Checked Out' : c.status}
                  </span>
                  {c.tags?.length > 0 && c.tags.slice(0, 3).map(t => (
                    <span key={t.id} className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium border ${TAG_COLORS[t.tagName] || TAG_COLORS.Regular}`}>
                      {t.tagName}
                    </span>
                  ))}
                  {c.tags && c.tags.length > 3 && (
                    <span className="text-[9px] text-slate-400 dark:text-slate-500">+{c.tags.length - 3}</span>
                  )}
                </div>

                {/* Balance */}
                <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700/50 flex items-center justify-between">
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium uppercase tracking-wider">Balance</span>
                  <span className={`text-sm font-bold tabular-nums ${
                    c.balance > 0 ? 'text-red-600 dark:text-red-400' :
                    c.balance < 0 ? 'text-green-600 dark:text-green-400' :
                    'text-slate-400 dark:text-slate-500'
                  }`}>
                    {c.balance > 0 ? '+' : ''}{fmtCur(c.balance)}
                  </span>
                </div>

                {/* Last Transaction */}
                {c.lastTxnDate && (
                  <div className="mt-1.5 flex items-center justify-between">
                    <span className="text-[10px] text-slate-400 dark:text-slate-500">Last activity</span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400">{c.lastTxnDate ? new Date(c.lastTxnDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '—'}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
