'use client'

import React from 'react'
import {
  FileText,
  History,
  Settings,
  Wallet,
  BookOpen,
  Users,
  Calculator,
  Package,
  BarChart3,
  Lock,
  LayoutDashboard,
  UtensilsCrossed,
} from 'lucide-react'
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
} from '@/components/ui/sidebar'
import { useAuth } from '@/components/auth-provider'
import { useFeature } from '@/hooks/use-feature'

export type PageId = 'dashboard' | 'new-bill' | 'bill-history' | 'cash-manager' | 'khata' | 'attendance' | 'calculator' | 'item-management' | 'reports' | 'settings' | 'table-management'

export interface NavItem {
  id: PageId
  label: string
  icon: React.ElementType
  group: 'main' | 'tools' | 'system'
  permissionModule?: string
}

const allNavItems: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, group: 'main' },
  { id: 'new-bill', label: 'New Bill', icon: FileText, group: 'main', permissionModule: 'billing' },
  { id: 'bill-history', label: 'Bill History', icon: History, group: 'main', permissionModule: 'billing' },
  { id: 'cash-manager', label: 'Cash Manager', icon: Wallet, group: 'tools', permissionModule: 'cashManager' },
  { id: 'khata', label: 'Customer Folio', icon: BookOpen, group: 'tools', permissionModule: 'khata' },
  { id: 'attendance', label: 'Staff & Attendance', icon: Users, group: 'tools', permissionModule: 'staff' },
  { id: 'calculator', label: 'Calculator', icon: Calculator, group: 'tools', permissionModule: 'calculator' },
  { id: 'item-management', label: 'Item Management', icon: Package, group: 'tools', permissionModule: 'inventory' },
  { id: 'table-management', label: 'Table Management', icon: UtensilsCrossed, group: 'tools', permissionModule: 'inventory' },
  { id: 'reports', label: 'Reports', icon: BarChart3, group: 'tools', permissionModule: 'reports' },
  { id: 'settings', label: 'Settings', icon: Settings, group: 'system', permissionModule: 'settings' },
]

export default function AppSidebar({ activePage, onNavigate }: { activePage: PageId; onNavigate: (id: PageId) => void }) {
  const { currentUser, hasPermission } = useAuth()
  const { category, isFeatureEnabled } = useFeature()

  const visibleItems = allNavItems.filter((i) => {
    if (i.id === 'table-management' && !isFeatureEnabled('tableManagement')) return false
    return true
  })

  const mainItems = visibleItems.filter((i) => i.group === 'main')
  const toolItems = visibleItems.filter((i) => i.group === 'tools')
  const systemItems = visibleItems.filter((i) => i.group === 'system')

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" className="hover:bg-sidebar-accent/50" tooltip="Eservices">
              <div className="flex size-8 items-center justify-center rounded-lg overflow-hidden shadow-sm shrink-0">
                <img src="/icon-192.png" alt="Eservices" className="w-full h-full object-cover rounded-lg" />
              </div>
              <div className="flex flex-col gap-0.5 leading-none group-data-[collapsible=icon]:hidden">
                <span className="font-bold text-sidebar-foreground">Eservices</span>
                <span className="text-[10px] text-sidebar-foreground/60">
                  {currentUser?.name || 'POS'}
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarSeparator />

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainItems.map((item) => {
                const isReadOnlyNav = item.permissionModule && item.permissionModule !== 'calculator' && !hasPermission(item.permissionModule, 'access')
                return (
                <SidebarMenuItem key={item.id}>
                  <SidebarMenuButton
                    tooltip={isReadOnlyNav ? `${item.label} (View Only)` : item.label}
                    isActive={activePage === item.id}
                    onClick={() => onNavigate(item.id)}
                  >
                    <item.icon className="size-4" />
                    <span className="flex items-center gap-1.5">{item.label}{isReadOnlyNav && <Lock className="size-3 text-amber-500" />}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Modules</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {toolItems.map((item) => {
                const isReadOnlyNav = item.permissionModule && item.permissionModule !== 'calculator' && !hasPermission(item.permissionModule, 'access')
                return (
                <SidebarMenuItem key={item.id}>
                  <SidebarMenuButton
                    tooltip={isReadOnlyNav ? `${item.label} (View Only)` : item.label}
                    isActive={activePage === item.id}
                    onClick={() => onNavigate(item.id)}
                  >
                    <item.icon className="size-4" />
                    <span className="flex items-center gap-1.5">{item.label}{isReadOnlyNav && <Lock className="size-3 text-amber-500" />}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>System</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {systemItems.map((item) => {
                const isReadOnlyNav = item.permissionModule && !hasPermission(item.permissionModule, 'access')
                return (
                <SidebarMenuItem key={item.id}>
                  <SidebarMenuButton
                    tooltip={isReadOnlyNav ? `${item.label} (View Only)` : item.label}
                    isActive={activePage === item.id}
                    onClick={() => onNavigate(item.id)}
                  >
                    <item.icon className="size-4" />
                    <span className="flex items-center gap-1.5">{item.label}{isReadOnlyNav && <Lock className="size-3 text-amber-500" />}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarRail />
    </Sidebar>
  )
}
