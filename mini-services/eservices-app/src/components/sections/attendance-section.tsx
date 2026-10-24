'use client'

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import {
  Users,
  Plus,
  ChevronLeft,
  ChevronRight,
  Edit3,
  Trash2,
  Loader2,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Clock,
  X,
  CalendarCheck,
  BarChart3,
  UserMinus,
  Briefcase,
  CalendarDays,
  IndianRupee,
  Settings as SettingsIcon,
  List,
  ChevronsUpDown,
  Save,
} from 'lucide-react'
import { notify } from '@/lib/notification-store'
import { useAuth } from '@/components/auth-provider'
import ReadOnlyBanner from '@/components/read-only-banner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Progress } from '@/components/ui/progress'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

// --- Types ---
interface StaffProfile {
  id: string
  name: string
  designation: string
  department: string
  dailyWageRate: number
  attendance: AttendanceRecord[]
  stats: StaffStats
  createdAt: string
}

interface StaffStats {
  total: number
  present: number
  absent: number
  leave: number
  halfday: number
  holiday: number
}

interface AttendanceRecord {
  id: string
  profileId: string
  date: string
  status: string
  createdAt: string
}

interface AttendanceSectionProps {
  onRefreshData: () => void
  dataVersion?: number
}

type AttendanceStatus = 'present' | 'absent' | 'leave' | 'holiday' | 'halfday' | ''

const STATUS_OPTIONS: {
  value: AttendanceStatus
  label: string
  color: string
  bgColor: string
  borderColor: string
  emoji: string
}[] = [
  { value: 'present', label: 'Present', color: 'text-green-700', bgColor: 'bg-green-50', borderColor: 'border-green-300 hover:border-green-500', emoji: '✅' },
  { value: 'absent', label: 'Absent', color: 'text-red-700', bgColor: 'bg-red-50', borderColor: 'border-red-300 hover:border-red-500', emoji: '❌' },
  { value: 'leave', label: 'Leave', color: 'text-yellow-700', bgColor: 'bg-yellow-50', borderColor: 'border-yellow-300 hover:border-yellow-500', emoji: '🏖️' },
  { value: 'holiday', label: 'Holiday', color: 'text-gray-700', bgColor: 'bg-gray-50', borderColor: 'border-gray-300 hover:border-gray-400', emoji: '🎉' },
  { value: 'halfday', label: 'Half Day', color: 'text-amber-700', bgColor: 'bg-amber-50', borderColor: 'border-amber-300 hover:border-amber-500', emoji: '⏰' },
  { value: '', label: 'Clear', color: 'text-muted-foreground', bgColor: 'bg-muted/30', borderColor: 'border-muted-foreground/30 hover:border-muted-foreground', emoji: '🚫' },
]

const STATUS_ICON_MAP: Record<string, React.ReactNode> = {
  present: <span className="text-[10px] leading-none">✅</span>,
  absent: <span className="text-[10px] leading-none">❌</span>,
  leave: <span className="text-[10px] leading-none">🏖️</span>,
  holiday: <span className="text-[10px] leading-none">🎉</span>,
  halfday: <span className="text-[10px] leading-none">⏰</span>,
}

// Avatar color palette
const AVATAR_COLORS = [
  'from-emerald-400 to-emerald-600',
  'from-teal-400 to-teal-600',
  'from-cyan-400 to-cyan-600',
  'from-amber-400 to-amber-600',
  'from-orange-400 to-orange-600',
  'from-rose-400 to-rose-600',
  'from-violet-400 to-violet-600',
  'from-fuchsia-400 to-fuchsia-600',
]

function getAvatarColor(index: number): string {
  return AVATAR_COLORS[index % AVATAR_COLORS.length]
}

function getAttendancePercentage(stats: StaffStats): number {
  const workingDays = stats.total - stats.holiday
  if (workingDays === 0) return 0
  return Math.round(((stats.present + stats.halfday * 0.5) / workingDays) * 100)
}

// --- Format date in Indian format ---
function formatDateIndian(dateStr: string): string {
  if (!dateStr) return ''
  const parts = dateStr.split('-')
  if (parts.length !== 3) return dateStr
  return `${parts[2]}/${parts[1]}/${parts[0]}`
}

function getDayCellBg(status: string, isToday: boolean): string {
  if (isToday) {
    switch (status) {
      case 'present': return 'bg-green-500 text-white hover:bg-green-600 ring-2 ring-green-500 ring-offset-2'
      case 'absent': return 'bg-red-500 text-white hover:bg-red-600 ring-2 ring-green-500 ring-offset-2'
      case 'leave': return 'bg-amber-400 text-amber-900 hover:bg-amber-500 ring-2 ring-green-500 ring-offset-2'
      case 'holiday': return 'bg-gray-300 text-gray-700 hover:bg-gray-400 ring-2 ring-green-500 ring-offset-2'
      case 'halfday': return 'bg-amber-500 text-white hover:bg-amber-600 ring-2 ring-green-500 ring-offset-2'
      default: return 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 ring-2 ring-green-500 ring-offset-2 hover:bg-green-200 dark:hover:bg-green-900/50'
    }
  }
  switch (status) {
    case 'present': return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50'
    case 'absent': return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50'
    case 'leave': return 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-900/50'
    case 'holiday': return 'bg-gray-100 dark:bg-gray-900/30 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-900/50'
    case 'halfday': return 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-900/50'
    default: return 'bg-card text-card-foreground hover:bg-accent'
  }
}

// --- Component ---
export default function AttendanceSection({ onRefreshData, dataVersion }: AttendanceSectionProps) {
  const { token, hasPermission } = useAuth()
  const authHeaders: Record<string, string> = token ? { 'Authorization': `Bearer ${token}` } : {}
  const canAccess = hasPermission('staff', 'access')
  const canCreate = hasPermission('staff', 'create')
  const canEdit = hasPermission('staff', 'edit')
  const canDelete = hasPermission('staff', 'delete')
  const noAccess = !canAccess
  const isReadOnly = !canAccess || (!canCreate && !canEdit && !canDelete)

  const [staffList, setStaffList] = useState<StaffProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedStaff, setSelectedStaff] = useState<StaffProfile | null>(null)

  // Calendar
  const today = new Date()
  const [currentMonth, setCurrentMonth] = useState(today.getMonth())
  const [currentYear, setCurrentYear] = useState(today.getFullYear())

  // Attendance data for selected staff
  const [attendanceData, setAttendanceData] = useState<AttendanceRecord[]>([])
  const [attendanceLoading, setAttendanceLoading] = useState(false)

  // Add Staff dialog
  const [addStaffOpen, setAddStaffOpen] = useState(false)
  const [newStaff, setNewStaff] = useState({ name: '', designation: '', department: '', dailyWageRate: 500 })
  const [submittingStaff, setSubmittingStaff] = useState(false)

  // Edit Staff dialog
  const [editStaffOpen, setEditStaffOpen] = useState(false)
  const [editingStaff, setEditingStaff] = useState<StaffProfile | null>(null)
  const [editForm, setEditForm] = useState({ name: '', designation: '', department: '', dailyWageRate: 500 })
  const [updatingStaff, setUpdatingStaff] = useState(false)

  // Delete confirmation
  const [deleteStaffOpen, setDeleteStaffOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Status dialog
  const [statusDialogOpen, setStatusDialogOpen] = useState(false)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [statusSubmitting, setStatusSubmitting] = useState(false)

  // Reset month confirmation
  const [resetMonthOpen, setResetMonthOpen] = useState(false)
  const [resettingMonth, setResettingMonth] = useState(false)

  // Mark all present loading
  const [markingAll, setMarkingAll] = useState(false)

  // Quick Toggle state
  const [quickToggleMode, setQuickToggleMode] = useState(false)
  const [quickToggleSaving, setQuickToggleSaving] = useState<string | null>(null)

  // Salary settings state
  const [defaultWageRate, setDefaultWageRate] = useState<number>(500)
  const [showSalarySettings, setShowSalarySettings] = useState(false)
  const [applyingRate, setApplyingRate] = useState(false)
  const [savingDefaultRate, setSavingDefaultRate] = useState(false)

  // Ref to track selected staff ID without causing re-fetch loop
  const selectedStaffIdRef = useRef<string | null>(null)

  // --- Load default wage rate from settings ---
  useEffect(() => {
    const loadDefaultRate = async () => {
      try {
        const res = await fetch('/api/settings', { headers: authHeaders })
        if (res.ok) {
          const settings = await res.json()
          if (settings.defaultDailyWageRate !== undefined && settings.defaultDailyWageRate !== null) {
            setDefaultWageRate(settings.defaultDailyWageRate)
          }
        }
      } catch (err) {
        console.error('Failed to load default wage rate:', err)
      }
    }
    loadDefaultRate()
  }, [])

  // --- Fetch staff ---
  const fetchStaff = useCallback(async (silent?: boolean) => {
    try {
      if (!silent) setLoading(true)
      const res = await fetch('/api/staff', { headers: authHeaders })
      if (res.ok) {
        const data = await res.json()
        setStaffList(data)
        // Re-select if the selected staff still exists (use ref to avoid dependency loop)
        if (selectedStaffIdRef.current) {
          const updated = data.find((s: StaffProfile) => s.id === selectedStaffIdRef.current)
          if (updated) setSelectedStaff(updated)
          else setSelectedStaff(null)
        }
      }
    } catch (err) {
      console.error('Failed to fetch staff:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchStaff()
  }, [fetchStaff])

  // Re-fetch data when dataVersion changes (sync from other tabs/devices)
  const prevDataVersion = useRef(dataVersion)
  useEffect(() => {
    if (dataVersion !== undefined && dataVersion !== prevDataVersion.current) {
      prevDataVersion.current = dataVersion
      fetchStaff(true)  // silent=true for background sync
    }
  }, [dataVersion, fetchStaff])

  // --- Fetch attendance for selected staff & month ---
  const fetchAttendance = useCallback(async () => {
    if (!selectedStaff) return
    try {
      setAttendanceLoading(true)
      const month = String(currentMonth + 1).padStart(2, '0')
      const res = await fetch(
        `/api/attendance?profileId=${selectedStaff.id}&month=${month}&year=${currentYear}`,
        { headers: authHeaders }
      )
      if (res.ok) {
        const data = await res.json()
        setAttendanceData(data)
      }
    } catch (err) {
      console.error('Failed to fetch attendance:', err)
    } finally {
      setAttendanceLoading(false)
    }
  }, [selectedStaff, currentMonth, currentYear])

  useEffect(() => {
    fetchAttendance()
  }, [fetchAttendance])

  // --- Calendar helpers ---
  const monthName = new Date(currentYear, currentMonth).toLocaleString('default', { month: 'long' })

  const calendarDays = useMemo(() => {
    const firstDay = new Date(currentYear, currentMonth, 1).getDay()
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate()
    const days: (number | null)[] = []

    for (let i = 0; i < firstDay; i++) days.push(null)
    for (let i = 1; i <= daysInMonth; i++) days.push(i)

    return days
  }, [currentMonth, currentYear])

  const attendanceMap = useMemo(() => {
    const map: Record<string, AttendanceRecord> = {}
    attendanceData.forEach((r) => {
      map[r.date] = r
    })
    return map
  }, [attendanceData])

  const monthStats = useMemo(() => {
    const counts = { present: 0, absent: 0, leave: 0, holiday: 0, halfday: 0 }
    attendanceData.forEach((r) => {
      if (r.status in counts) {
        counts[r.status as keyof typeof counts]++
      }
    })
    return counts
  }, [attendanceData])

  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

  // Compute today's present count across all staff
  const todayPresentCount = useMemo(() => {
    return staffList.filter((s) => {
      const todayRecord = s.attendance?.find((a) => a.date === todayStr)
      return todayRecord?.status === 'present'
    }).length
  }, [staffList, todayStr])

  // --- Handlers ---
  const handleSelectStaff = (staff: StaffProfile) => {
    selectedStaffIdRef.current = staff.id
    setSelectedStaff(staff)
  }

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11)
      setCurrentYear((y) => y - 1)
    } else {
      setCurrentMonth((m) => m - 1)
    }
  }

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0)
      setCurrentYear((y) => y + 1)
    } else {
      setCurrentMonth((m) => m + 1)
    }
  }

  const handleDayClick = (day: number) => {
    const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    setSelectedDate(dateStr)
    setStatusDialogOpen(true)
  }

  // Create staff
  const handleCreateStaff = async () => {
    if (!newStaff.name.trim()) return
    try {
      setSubmittingStaff(true)
      const res = await fetch('/api/staff', {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify(newStaff),
      })
      if (res.ok) {
        notify({ type: 'success', title: 'Success', message: 'Staff member added successfully' })
        setAddStaffOpen(false)
        setNewStaff({ name: '', designation: '', department: '', dailyWageRate: defaultWageRate })
        fetchStaff()
        onRefreshData()
      } else {
        notify({ type: 'error', title: 'Error', message: 'Failed to add staff member. Please try again.' })
      }
    } catch (err) {
      console.error('Failed to create staff:', err)
      notify({ type: 'error', title: 'Error', message: 'Failed to add staff member' })
    } finally {
      setSubmittingStaff(false)
    }
  }

  // Update staff
  const handleUpdateStaff = async () => {
    if (!editingStaff || !editForm.name.trim()) return
    try {
      setUpdatingStaff(true)
      const res = await fetch(`/api/staff/${editingStaff.id}`, {
        method: 'PUT',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      })
      if (res.ok) {
        notify({ type: 'success', title: 'Success', message: 'Staff member updated successfully' })
        setEditStaffOpen(false)
        setEditingStaff(null)
        fetchStaff()
        onRefreshData()
      }
    } catch (err) {
      console.error('Failed to update staff:', err)
      notify({ type: 'error', title: 'Error', message: 'Failed to update staff member' })
    } finally {
      setUpdatingStaff(false)
    }
  }

  const openEditDialog = (staff: StaffProfile) => {
    setEditingStaff(staff)
    setEditForm({ name: staff.name, designation: staff.designation, department: staff.department, dailyWageRate: staff.dailyWageRate || 500 })
    setEditStaffOpen(true)
  }

  // Delete staff
  const handleDeleteStaff = async () => {
    if (!selectedStaff) return
    try {
      setDeleting(true)
      const res = await fetch(`/api/staff/${selectedStaff.id}`, {
        method: 'DELETE',
        headers: authHeaders,
      })
      if (res.ok) {
        notify({ type: 'success', title: 'Success', message: 'Staff member deleted successfully' })
        setDeleteStaffOpen(false)
        selectedStaffIdRef.current = null
        setSelectedStaff(null)
        setAttendanceData([])
        fetchStaff()
        onRefreshData()
      } else {
        notify({ type: 'error', title: 'Error', message: 'Failed to delete staff member. Please try again.' })
      }
    } catch (err) {
      console.error('Failed to delete staff:', err)
      notify({ type: 'error', title: 'Error', message: 'Failed to delete staff member' })
    } finally {
      setDeleting(false)
    }
  }

  // Set attendance status
  const handleSetStatus = async (status: AttendanceStatus) => {
    if (!selectedStaff || !selectedDate) return
    try {
      setStatusSubmitting(true)
      const res = await fetch('/api/attendance', {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profileId: selectedStaff.id,
          date: selectedDate,
          status,
        }),
      })
      if (res.ok) {
        notify({ type: 'success', title: 'Status Updated', message: 'Attendance status changed' })
        setStatusDialogOpen(false)
        fetchAttendance()
        fetchStaff()
        onRefreshData()
      } else {
        notify({ type: 'error', title: 'Error', message: 'Failed to update attendance status' })
      }
    } catch (err) {
      console.error('Failed to set attendance:', err)
      notify({ type: 'error', title: 'Error', message: 'Failed to update attendance status' })
    } finally {
      setStatusSubmitting(false)
    }
  }

  // Mark all working days as present
  const handleMarkAllPresent = async () => {
    if (!selectedStaff) return
    try {
      setMarkingAll(true)
      const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate()

      for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
        // Skip future dates
        if (new Date(dateStr) > today) continue
        // Skip holidays (keep existing)
        const existing = attendanceMap[dateStr]
        if (existing?.status === 'holiday') continue

        await fetch('/api/attendance', {
          method: 'POST',
          headers: { ...authHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            profileId: selectedStaff.id,
            date: dateStr,
            status: 'present',
          }),
        })
      }

      notify({ type: 'success', title: 'All Present', message: 'All staff marked as present' })
      fetchAttendance()
      fetchStaff()
      onRefreshData()
    } catch (err) {
      console.error('Failed to mark all present:', err)
      notify({ type: 'error', title: 'Error', message: 'Failed to mark all present' })
    } finally {
      setMarkingAll(false)
    }
  }

  // Reset month
  const handleResetMonth = async () => {
    if (!selectedStaff) return
    try {
      setResettingMonth(true)
      const month = String(currentMonth + 1).padStart(2, '0')
      const prefix = `${currentYear}-${month}`
      const monthRecords = attendanceData.filter((r) => r.date.startsWith(prefix))

      for (const record of monthRecords) {
        await fetch('/api/attendance', {
          method: 'POST',
          headers: { ...authHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            profileId: selectedStaff.id,
            date: record.date,
            status: '',
          }),
        })
      }

      setResetMonthOpen(false)
      notify({ type: 'success', title: 'Month Reset', message: 'Attendance data reset successfully' })
      fetchAttendance()
      fetchStaff()
      onRefreshData()
    } catch (err) {
      console.error('Failed to reset month:', err)
      notify({ type: 'error', title: 'Error', message: 'Failed to reset attendance' })
    } finally {
      setResettingMonth(false)
    }
  }

  // Quick Toggle: change attendance status for today for any staff member
  const handleQuickToggleStatus = async (staffId: string, currentStatus: string) => {
    const statusCycle: Record<string, AttendanceStatus> = {
      '': 'present',
      'present': 'absent',
      'absent': 'leave',
      'leave': '',
    }
    const newStatus = statusCycle[currentStatus] ?? 'present'
    setQuickToggleSaving(staffId)
    try {
      const res = await fetch('/api/attendance', {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profileId: staffId,
          date: todayStr,
          status: newStatus,
        }),
      })
      if (res.ok) {
        notify({ type: 'success', title: 'Status Updated', message: 'Attendance toggled' })
        fetchStaff()
        if (selectedStaff && selectedStaff.id === staffId) {
          fetchAttendance()
        }
        onRefreshData()
      } else {
        notify({ type: 'error', title: 'Error', message: 'Failed to toggle attendance' })
      }
    } catch (err) {
      console.error('Failed to toggle attendance:', err)
      notify({ type: 'error', title: 'Error', message: 'Failed to toggle attendance' })
    } finally {
      setQuickToggleSaving(null)
    }
  }

  // Save default wage rate to settings
  const saveDefaultRateToSettings = async (rate: number) => {
    try {
      await fetch('/api/settings', {
        method: 'PUT',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ defaultDailyWageRate: rate }),
      })
    } catch (err) {
      console.error('Failed to save default wage rate to settings:', err)
    }
  }

  // Apply default wage rate to all staff
  const handleApplyRateToAll = async () => {
    if (staffList.length === 0) return
    try {
      setApplyingRate(true)
      let successCount = 0
      for (const staff of staffList) {
        const res = await fetch(`/api/staff/${staff.id}`, {
          method: 'PUT',
          headers: { ...authHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: staff.name,
            designation: staff.designation,
            department: staff.department,
            dailyWageRate: defaultWageRate,
          }),
        })
        if (res.ok) successCount++
      }
      if (successCount > 0) {
        // Persist the default rate for next session
        await saveDefaultRateToSettings(defaultWageRate)
        notify({ type: 'success', title: 'Success', message: `Daily wage rate updated to ₹${defaultWageRate}/day for ${successCount} staff member${successCount > 1 ? 's' : ''}` })
        fetchStaff()
        onRefreshData()
      }
    } catch (err) {
      console.error('Failed to apply rate to all:', err)
      notify({ type: 'error', title: 'Error', message: 'Failed to update wage rate for some staff members' })
    } finally {
      setApplyingRate(false)
    }
  }

  const dayOfWeekLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  const selectedDateRecord = selectedDate ? attendanceMap[selectedDate] : null
  const selectedDateStatus = selectedDateRecord?.status || ''

  // Salary estimation — accepts a rate parameter
  const getEstimatedSalary = useCallback((stats: StaffStats, rate: number) => {
    const workingDays = stats.present + stats.halfday * 0.5
    return Math.round(workingDays * rate)
  }, [])

  // Helper: compute month-specific stats from a staff member's attendance array
  const getMonthlyStats = useCallback((staff: StaffProfile, month: number, year: number): StaffStats => {
    const monthPrefix = `${year}-${String(month + 1).padStart(2, '0')}`
    const monthAttendance = staff.attendance?.filter((a) => a.date.startsWith(monthPrefix)) || []
    return {
      total: monthAttendance.length,
      present: monthAttendance.filter((a) => a.status === 'present').length,
      absent: monthAttendance.filter((a) => a.status === 'absent').length,
      leave: monthAttendance.filter((a) => a.status === 'leave').length,
      halfday: monthAttendance.filter((a) => a.status === 'halfday').length,
      holiday: monthAttendance.filter((a) => a.status === 'holiday').length,
    }
  }, [])

  const totalMonthlyPayroll = useMemo(() => {
    return staffList.reduce((sum, s) => {
      const mStats = getMonthlyStats(s, currentMonth, currentYear)
      return sum + getEstimatedSalary(mStats, s.dailyWageRate || 500)
    }, 0)
  }, [staffList, getEstimatedSalary, getMonthlyStats, currentMonth, currentYear])

  // Helper to get today's status for a staff member
  const getTodayStatus = (staff: StaffProfile): string => {
    const todayRecord = staff.attendance?.find((a) => a.date === todayStr)
    return todayRecord?.status || ''
  }

  // Helper to get today's status label
  const getTodayStatusLabel = (status: string): string => {
    switch (status) {
      case 'present': return 'Present'
      case 'absent': return 'Absent'
      case 'leave': return 'Leave'
      case 'halfday': return 'Half Day'
      case 'holiday': return 'Holiday'
      default: return 'Not Set'
    }
  }

  // Helper to get today's status pill style
  const getTodayStatusPill = (status: string): string => {
    switch (status) {
      case 'present': return 'bg-green-100 text-green-700 border-green-200'
      case 'absent': return 'bg-red-100 text-red-700 border-red-200'
      case 'leave': return 'bg-amber-100 text-amber-700 border-amber-200'
      case 'halfday': return 'bg-orange-100 text-orange-700 border-orange-200'
      case 'holiday': return 'bg-gray-100 text-gray-600 border-gray-200'
      default: return 'bg-muted/50 text-muted-foreground border-muted-foreground/20'
    }
  }

  return (
    <div className="space-y-4">
      {isReadOnly && <ReadOnlyBanner module="Staff & Attendance" noAccess={noAccess} />}
      {/* ── Gradient Header Banner ── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-green-600 via-emerald-600 to-teal-600 p-5 md:p-6 text-white shadow-lg shadow-green-600/20">
        {/* Background decoration */}
        <div className="pointer-events-none absolute -right-8 -top-8 size-36 rounded-full bg-white/10" />
        <div className="pointer-events-none absolute -bottom-6 -left-6 size-28 rounded-full bg-white/5" />
        <div className="pointer-events-none absolute right-24 top-2 size-14 rounded-full bg-white/5" />

        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-xl md:text-2xl font-bold tracking-tight flex items-center gap-2">
              <Users className="size-6" />
              Staff & Attendance
            </h2>
            <p className="text-green-100 text-sm mt-1">
              Manage employee profiles and track daily attendance
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-3 rounded-xl bg-white/15 backdrop-blur-sm px-4 py-2.5">
              <div className="text-center">
                <p className="text-2xl font-bold leading-none">{staffList.length}</p>
                <p className="text-[10px] text-green-100 mt-0.5 font-medium">Total Staff</p>
              </div>
              <div className="w-px h-8 bg-white/20" />
              <div className="text-center">
                <p className="text-2xl font-bold leading-none text-green-200">{todayPresentCount}</p>
                <p className="text-[10px] text-green-100 mt-0.5 font-medium">Present Today</p>
              </div>
            </div>
            <Button
              onClick={() => {
                setNewStaff({ name: '', designation: '', department: '', dailyWageRate: defaultWageRate })
                setAddStaffOpen(true)
              }}
              variant="outline"
              size="sm"
              className="border-white/30 text-white hover:bg-white/10 hover:text-white bg-transparent gap-1.5"
              disabled={!canCreate}
            >
              <Plus className="size-4" />
              Add Staff
            </Button>
          </div>
        </div>
      </div>

      {/* Salary Summary Section */}
      {!loading && staffList.length > 0 && (
        <Card className="overflow-hidden border-0 shadow-sm">
          <div className="h-1 bg-gradient-to-r from-emerald-400 to-teal-500" />
          <CardHeader className="pb-0 pt-4 px-4 sm:px-6">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <IndianRupee className="size-4 text-emerald-600" />
                Monthly Payroll Estimate
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs gap-1 text-muted-foreground hover:text-foreground"
                onClick={() => setShowSalarySettings(!showSalarySettings)}
              >
                <SettingsIcon className="size-3.5" />
                Settings
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-4">
            {showSalarySettings && (
              <div className="mb-4 p-3 rounded-lg bg-muted/50 border space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-end gap-3">
                  <div className="flex-1">
                    <Label className="text-xs font-medium text-muted-foreground block mb-1.5">Default Daily Wage Rate</Label>
                    <div className="flex items-center gap-1">
                      <span className="text-sm text-muted-foreground font-medium">₹</span>
                      <Input
                        type="number"
                        min={0}
                        value={defaultWageRate}
                        onChange={(e) => setDefaultWageRate(Math.max(0, parseInt(e.target.value) || 0))}
                        className="h-8 w-28"
                      />
                      <span className="text-xs text-muted-foreground">/ day</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        setSavingDefaultRate(true)
                        await saveDefaultRateToSettings(defaultWageRate)
                        notify({ type: 'success', title: 'Success', message: 'Default wage rate saved' })
                        setSavingDefaultRate(false)
                      }}
                      disabled={savingDefaultRate}
                      className="gap-1.5"
                    >
                      {savingDefaultRate ? (
                        <>
                          <Loader2 className="size-3.5 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="size-3.5" />
                          Save Rate
                        </>
                      )}
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleApplyRateToAll}
                      disabled={applyingRate || staffList.length === 0}
                      className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                      {applyingRate ? (
                        <>
                          <Loader2 className="size-3.5 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="size-3.5" />
                          Apply to All
                        </>
                      )}
                    </Button>
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  <span className="font-medium">Save Rate</span> remembers this rate for next time.
                  <span className="font-medium ml-1">Apply to All</span> updates all {staffList.length} staff to ₹{defaultWageRate}/day and saves.
                </p>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="text-center p-4 rounded-xl bg-emerald-50 border border-emerald-100">
                <IndianRupee className="size-6 text-emerald-500 mx-auto mb-1" />
                <p className="text-2xl font-bold text-emerald-700">
                  ₹{totalMonthlyPayroll.toLocaleString('en-IN')}
                </p>
                <p className="text-xs text-emerald-600 font-medium">Total Monthly Payroll</p>
                <p className="text-[10px] text-muted-foreground mt-1">
                  Based on individual rates × present days
                </p>
              </div>
              <div className="text-center p-4 rounded-xl bg-amber-50 border border-amber-100">
                <Briefcase className="size-6 text-amber-500 mx-auto mb-1" />
                <p className="text-2xl font-bold text-amber-700">
                  {staffList.length}
                </p>
                <p className="text-xs text-amber-600 font-medium">Active Staff</p>
                <p className="text-[10px] text-muted-foreground mt-1">
                  Avg ₹{staffList.length > 0 ? Math.round(totalMonthlyPayroll / staffList.length).toLocaleString('en-IN') : 0} per person
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Toggle Mode */}
      {!loading && staffList.length > 0 && (
        <Card className="overflow-hidden border-0 shadow-sm">
          <div className="h-1 bg-gradient-to-r from-cyan-400 to-emerald-500" />
          <CardHeader className="pb-0 pt-4 px-4 sm:px-6">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <ChevronsUpDown className="size-4 text-cyan-600" />
                Quick Toggle — Today&apos;s Attendance
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                className={`text-xs gap-1 ${quickToggleMode ? 'text-cyan-600 bg-cyan-50 dark:bg-cyan-900/20 dark:text-cyan-400' : 'text-muted-foreground hover:text-foreground'}`}
                onClick={() => setQuickToggleMode(!quickToggleMode)}
              >
                <List className="size-3.5" />
                {quickToggleMode ? 'Hide List' : 'Show List'}
              </Button>
            </div>
          </CardHeader>
          {quickToggleMode && (
            <CardContent className="p-4">
              <div className="space-y-1 max-h-64 overflow-y-auto">
                {staffList.map((staff, index) => {
                  const todayRecord = staff.attendance?.find((a) => a.date === todayStr)
                  const currentStatus = todayRecord?.status || ''
                  const isSaving = quickToggleSaving === staff.id

                  const getStatusBadge = (status: string) => {
                    switch (status) {
                      case 'present': return 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400'
                      case 'absent': return 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400'
                      case 'leave': return 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400'
                      default: return 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
                    }
                  }

                  const getStatusLabel = (status: string) => {
                    switch (status) {
                      case 'present': return 'Present'
                      case 'absent': return 'Absent'
                      case 'leave': return 'Leave'
                      default: return 'Not Set'
                    }
                  }

                  return (
                    <div
                      key={staff.id}
                      className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-muted/50 transition-colors group"
                    >
                      <div className={`flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white bg-gradient-to-br ${getAvatarColor(index)}`}>
                        {staff.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{staff.name}</p>
                        {staff.designation && (
                          <p className="text-[11px] text-muted-foreground">{staff.designation}</p>
                        )}
                      </div>
                      <button
                        onClick={() => !isSaving && canEdit && handleQuickToggleStatus(staff.id, currentStatus)}
                        disabled={isSaving || !canEdit}
                        className={`shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition-all duration-150 active:scale-95 ${getStatusBadge(currentStatus)} ${isSaving || !canEdit ? 'opacity-60' : 'hover:opacity-80 cursor-pointer'}`}
                      >
                        {isSaving ? (
                          <Loader2 className="size-3 animate-spin" />
                        ) : (
                          <span>{STATUS_ICON_MAP[currentStatus] || STATUS_ICON_MAP['']}</span>
                        )}
                        {getStatusLabel(currentStatus)}
                      </button>
                    </div>
                  )
                })}
              </div>
              <p className="text-[10px] text-muted-foreground mt-2 text-center">
                Click a status badge to cycle: Not Set → Present → Absent → Leave → Not Set
              </p>
            </CardContent>
          )}
        </Card>
      )}

      {/* Staff Profiles Grid — Enhanced Cards */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-56 rounded-xl" />
          ))}
        </div>
      ) : staffList.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 px-4">
          <div className="w-full max-w-xs mx-auto flex flex-col items-center gap-4 p-8 rounded-2xl border-2 border-dashed border-muted-foreground/15 bg-gradient-to-b from-muted/20 to-transparent">
            <svg width="120" height="120" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg" className="opacity-30 mb-1">
              <circle cx="60" cy="40" r="20" stroke="currentColor" strokeWidth="2" fill="none" />
              <path d="M25 105 C25 75 40 60 60 60 C80 60 95 75 95 105" stroke="currentColor" strokeWidth="2" fill="none" />
              <circle cx="30" cy="45" r="10" stroke="currentColor" strokeWidth="1.5" fill="none" opacity="0.4" />
              <circle cx="90" cy="45" r="10" stroke="currentColor" strokeWidth="1.5" fill="none" opacity="0.4" />
            </svg>
            <p className="text-sm font-medium text-muted-foreground">No staff members yet</p>
            <p className="text-xs text-muted-foreground/70 text-center">Click &quot;Add Staff&quot; to create your first entry and start tracking attendance</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {staffList.map((staff, index) => {
            const pct = getAttendancePercentage(staff.stats)
            const todayStatus = getTodayStatus(staff)
            const individualRate = staff.dailyWageRate || 500
            const monthlyStats = getMonthlyStats(staff, currentMonth, currentYear)
            const estimatedSalary = getEstimatedSalary(monthlyStats, individualRate)

            return (
              <Card
                key={staff.id}
                className={`cursor-pointer transition-all duration-200 py-0 gap-0 overflow-hidden border-0 shadow-sm hover:shadow-lg hover:scale-[1.02] hover:-translate-y-0.5 ${
                  selectedStaff?.id === staff.id
                    ? 'ring-2 ring-[#4CAF50] shadow-lg shadow-green-600/10'
                    : ''
                }`}
                onClick={() => handleSelectStaff(staff)}
              >
                {/* Colored gradient top strip */}
                <div className={`h-2 bg-gradient-to-r ${getAvatarColor(index)}`} />

                <CardContent className="p-4 pt-3">
                  {/* Top: Avatar + Info + Actions */}
                  <div className="flex items-start gap-3">
                    <div className={`flex size-12 shrink-0 items-center justify-center rounded-xl text-lg font-bold text-white shadow-md bg-gradient-to-br ${getAvatarColor(index)}`}>
                      {staff.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-bold text-base truncate leading-tight">{staff.name}</p>
                          {staff.designation && (
                            <p className="text-xs font-semibold text-muted-foreground mt-0.5 flex items-center gap-1">
                              <Briefcase className="size-3" />
                              {staff.designation}
                            </p>
                          )}
                        </div>
                        <div className="flex gap-0.5 shrink-0">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7"
                            onClick={(e) => {
                              e.stopPropagation()
                              openEditDialog(staff)
                            }}
                            disabled={!canEdit}
                          >
                            <Edit3 className="size-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7 text-muted-foreground hover:text-red-600"
                            onClick={(e) => {
                              e.stopPropagation()
                              selectedStaffIdRef.current = staff.id
                              setSelectedStaff(staff)
                              setDeleteStaffOpen(true)
                            }}
                            disabled={!canDelete}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </div>
                      {staff.department && (
                        <p className="text-[11px] text-muted-foreground mt-0.5">{staff.department}</p>
                      )}
                    </div>
                  </div>

                  {/* Today's status pill + Wage rate + Salary badge */}
                  <div className="flex items-center justify-between mt-3 gap-2">
                    <div className="flex items-center gap-2">
                      {/* Today's Status Indicator */}
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${getTodayStatusPill(todayStatus)}`}>
                        <span className="text-[9px]">{STATUS_ICON_MAP[todayStatus] || '—'}</span>
                        {getTodayStatusLabel(todayStatus)}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        ₹{individualRate}/day
                      </span>
                    </div>
                    <Badge variant="secondary" className="text-[10px] bg-emerald-100 text-emerald-700 font-semibold border-0">
                      💰 ₹{estimatedSalary.toLocaleString('en-IN')}
                    </Badge>
                  </div>

                  {/* Attendance stats row with icons */}
                  <div className="flex items-center gap-3 mt-3">
                    <div className="flex items-center gap-1 text-[11px] text-green-600">
                      <CheckCircle2 className="size-3.5" />
                      <span className="font-semibold">{staff.stats.present}</span>
                    </div>
                    <div className="flex items-center gap-1 text-[11px] text-red-500">
                      <XCircle className="size-3.5" />
                      <span className="font-semibold">{staff.stats.absent}</span>
                    </div>
                    <div className="flex items-center gap-1 text-[11px] text-amber-600">
                      <UserMinus className="size-3.5" />
                      <span className="font-semibold">{staff.stats.leave}</span>
                    </div>
                    <div className="flex items-center gap-1 text-[11px] text-orange-500">
                      <Clock className="size-3.5" />
                      <span className="font-semibold">{staff.stats.halfday}</span>
                    </div>
                  </div>

                  {/* Dynamic attendance progress bar */}
                  <div className="mt-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] text-muted-foreground font-medium">Attendance</span>
                      <span className={`text-[10px] font-bold ${pct >= 75 ? 'text-green-600' : pct >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
                        {pct}%
                      </span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          pct >= 75 ? 'bg-green-500' : pct >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${Math.min(pct, 100)}%` }}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Selected Staff Calendar Section */}
      {selectedStaff && (
        <>
          <Separator />

          {/* Staff Header */}
          <Card className="overflow-hidden border-0 shadow-md">
            <div className="h-1.5 bg-gradient-to-r from-emerald-400 to-emerald-600" />
            <CardContent className="p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <div
                  className={`flex size-14 shrink-0 items-center justify-center rounded-full text-xl font-bold text-white shadow-md bg-gradient-to-br ${getAvatarColor(staffList.findIndex(s => s.id === selectedStaff.id))}`}
                >
                  {selectedStaff.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-semibold">{selectedStaff.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    {selectedStaff.designation}
                    {selectedStaff.department ? ` • ${selectedStaff.department}` : ''}
                  </p>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs gap-1.5 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 border-emerald-200"
                    onClick={handleMarkAllPresent}
                    disabled={markingAll || !canEdit}
                  >
                    {markingAll ? <Loader2 className="size-3.5 animate-spin" /> : <CalendarCheck className="size-3.5" />}
                    Mark All Present
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs gap-1.5 text-red-600 hover:text-red-700 hover:bg-red-50"
                    onClick={() => setResetMonthOpen(true)}
                    disabled={!canEdit}
                  >
                    <RotateCcw className="size-3.5" />
                    Reset {monthName}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Month Navigation */}
          <div className="flex items-center justify-center gap-2 sm:gap-4">
            <Button variant="outline" size="icon" onClick={handlePrevMonth} className="rounded-full">
              <ChevronLeft className="size-4" />
            </Button>
            <h3 className="text-base font-semibold min-w-[160px] text-center flex items-center gap-2">
              <CalendarDays className="size-4 text-muted-foreground" />
              {monthName} {currentYear}
            </h3>
            <Button variant="outline" size="icon" onClick={handleNextMonth} className="rounded-full">
              <ChevronRight className="size-4" />
            </Button>
            {(currentMonth !== today.getMonth() || currentYear !== today.getFullYear()) && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setCurrentMonth(today.getMonth())
                  setCurrentYear(today.getFullYear())
                }}
                className="rounded-full text-xs gap-1 text-emerald-600 border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700"
              >
                Today
              </Button>
            )}
          </div>

          {/* Calendar Grid */}
          <Card className="py-0 gap-0 overflow-hidden border-0 shadow-sm inner-shadow">
            <CardContent className="p-2 sm:p-4">
              {attendanceLoading ? (
                <div className="grid grid-cols-7 gap-1 sm:gap-2">
                  {Array.from({ length: 42 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 sm:h-14 rounded-xl" />
                  ))}
                </div>
              ) : (
                <>
                  {/* Day headers */}
                  <div className="grid grid-cols-7 gap-1 sm:gap-2 mb-1">
                    {dayOfWeekLabels.map((day) => (
                      <div
                        key={day}
                        className="text-center text-xs font-semibold text-muted-foreground py-1"
                      >
                        {day}
                      </div>
                    ))}
                  </div>
                  {/* Calendar days */}
                  <div className="grid grid-cols-7 gap-1 sm:gap-2">
                    {calendarDays.map((day, idx) => {
                      if (day === null) {
                        return <div key={`empty-${idx}`} className="h-12 sm:h-14" />
                      }

                      const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                      const record = attendanceMap[dateStr]
                      const status = record?.status || ''
                      const isToday = dateStr === todayStr
                      const cellBg = getDayCellBg(status, isToday)

                      return (
                        <button
                          key={day}
                          className={`h-12 sm:h-14 rounded-xl text-sm font-medium flex flex-col items-center justify-center gap-0.5 transition-all ${cellBg}`}
                          onClick={() => canEdit && handleDayClick(day)}
                          disabled={!canEdit}
                        >
                          <span className="text-xs sm:text-sm leading-none">{day}</span>
                          {status && (
                            <span className="sm:hidden">
                              {STATUS_ICON_MAP[status]}
                            </span>
                          )}
                          {isToday && (
                            <span className="text-[8px] font-bold leading-none opacity-80">TODAY</span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Attendance Summary */}
          <Card className="overflow-hidden border-0 shadow-sm">
            <CardHeader className="pb-0 pt-4 px-4 sm:px-6">
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="size-4" />
                Monthly Summary — {monthName} {currentYear}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              {/* Attendance percentage bar */}
              {(() => {
                const totalRecorded = monthStats.present + monthStats.absent + monthStats.leave + monthStats.halfday
                const pctVal = totalRecorded > 0 ? Math.round(((monthStats.present + monthStats.halfday * 0.5) / totalRecorded) * 100) : 0
                const barColor = pctVal >= 75 ? 'bg-green-500' : pctVal >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                return (
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs text-muted-foreground font-medium">Attendance Rate</span>
                      <span className={`text-xs font-bold ${pctVal >= 75 ? 'text-green-600' : pctVal >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
                        {pctVal}%
                      </span>
                    </div>
                    <Progress value={pctVal} className="h-2.5" />
                  </div>
                )
              })()}

              {/* Total Hours This Month */}
              {(() => {
                const totalMinutes = monthStats.present * 8 * 60 + monthStats.halfday * 4 * 60
                const hours = Math.floor(totalMinutes / 60)
                const mins = totalMinutes % 60
                const targetHours = 160
                const percentage = Math.min(Math.round((hours / targetHours) * 100), 150)

                let barGradient = ''
                let textColor = ''
                let bgColor = ''
                let borderColor = ''
                if (percentage < 80) {
                  barGradient = 'bg-gradient-to-r from-green-400 to-green-500'
                  textColor = 'text-green-700'
                  bgColor = 'bg-green-50'
                  borderColor = 'border-green-100'
                } else if (percentage <= 100) {
                  barGradient = 'bg-gradient-to-r from-amber-400 to-amber-500'
                  textColor = 'text-amber-700'
                  bgColor = 'bg-amber-50'
                  borderColor = 'border-amber-100'
                } else {
                  barGradient = 'bg-gradient-to-r from-red-400 to-red-500'
                  textColor = 'text-red-700'
                  bgColor = 'bg-red-50'
                  borderColor = 'border-red-100'
                }

                const statusLabel = percentage < 80 ? 'On Track' : percentage <= 100 ? 'Near Target' : 'Over Target'
                const statusDotColor = percentage < 80 ? 'bg-green-500' : percentage <= 100 ? 'bg-amber-500' : 'bg-red-500'

                return (
                  <div className={`rounded-xl p-4 border ${bgColor} ${borderColor} mb-4`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Clock className={`size-4 ${textColor}`} />
                        <span className="text-sm font-semibold">Total Hours This Month</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className={`inline-block size-2 rounded-full ${statusDotColor}`} />
                        <span className={`text-xs font-medium ${textColor}`}>{statusLabel}</span>
                      </div>
                    </div>
                    <p className={`text-3xl font-bold ${textColor} mb-1 tabular-nums`}>
                      {hours} hrs {mins > 0 ? `${mins} mins` : ''}
                    </p>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[11px] text-muted-foreground">
                        Target: {targetHours} hrs/month ({percentage}%)
                      </span>
                      <span className={`text-xs font-bold ${textColor}`}>
                        {percentage}%
                      </span>
                    </div>
                    <div className="w-full h-3 rounded-full bg-white/60 dark:bg-gray-700/50 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ease-out ${barGradient}`}
                        style={{ width: `${Math.min(percentage, 100)}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1.5">
                      {hours}h present × 8h + {monthStats.halfday} half-days × 4h = {hours}h {mins > 0 ? `${mins}m` : ''}
                    </p>
                  </div>
                )
              })()}

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <div className="text-center p-3 rounded-xl bg-green-50 border border-green-100">
                  <CheckCircle2 className="size-5 text-green-500 mx-auto mb-1" />
                  <p className="text-2xl font-bold text-green-600">{monthStats.present}</p>
                  <p className="text-xs text-green-700 font-medium">Present</p>
                </div>
                <div className="text-center p-3 rounded-xl bg-red-50 border border-red-100">
                  <XCircle className="size-5 text-red-500 mx-auto mb-1" />
                  <p className="text-2xl font-bold text-red-600">{monthStats.absent}</p>
                  <p className="text-xs text-red-700 font-medium">Absent</p>
                </div>
                <div className="text-center p-3 rounded-xl bg-yellow-50 border border-yellow-100">
                  <UserMinus className="size-5 text-yellow-500 mx-auto mb-1" />
                  <p className="text-2xl font-bold text-yellow-600">{monthStats.leave}</p>
                  <p className="text-xs text-yellow-700 font-medium">Leave</p>
                </div>
                <div className="text-center p-3 rounded-xl bg-gray-50 border border-gray-200">
                  <Clock className="size-5 text-gray-400 mx-auto mb-1" />
                  <p className="text-2xl font-bold text-gray-600">{monthStats.holiday}</p>
                  <p className="text-xs text-gray-700 font-medium">Holiday</p>
                </div>
                <div className="text-center p-3 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-800 col-span-2 sm:col-span-1">
                  <Clock className="size-5 text-amber-400 mx-auto mb-1" />
                  <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{monthStats.halfday}</p>
                  <p className="text-xs text-amber-700 dark:text-amber-400 font-medium">Half Day</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Add Staff Dialog */}
      <Dialog open={addStaffOpen} onOpenChange={setAddStaffOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Staff Member</DialogTitle>
            <DialogDescription>Create a new staff profile</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="staff-name">Name *</Label>
              <Input
                id="staff-name"
                placeholder="Enter name"
                value={newStaff.name}
                onChange={(e) => setNewStaff({ ...newStaff, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="staff-designation">Designation</Label>
              <Input
                id="staff-designation"
                placeholder="Enter designation"
                value={newStaff.designation}
                onChange={(e) => setNewStaff({ ...newStaff, designation: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="staff-department">Department</Label>
              <Input
                id="staff-department"
                placeholder="Enter department"
                value={newStaff.department}
                onChange={(e) => setNewStaff({ ...newStaff, department: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="staff-wage">Daily Wage Rate (₹)</Label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground font-medium">₹</span>
                <Input
                  id="staff-wage"
                  type="number"
                  min={0}
                  placeholder="500"
                  value={newStaff.dailyWageRate}
                  onChange={(e) => setNewStaff({ ...newStaff, dailyWageRate: Math.max(0, parseInt(e.target.value) || 0) })}
                />
                <span className="text-xs text-muted-foreground">/ day</span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddStaffOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateStaff}
              disabled={submittingStaff || !newStaff.name.trim()}
              style={{ backgroundColor: '#4CAF50', color: 'white' }}
            >
              {submittingStaff && <Loader2 className="size-4 animate-spin" />}
              Add Staff
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Staff Dialog */}
      <Dialog open={editStaffOpen} onOpenChange={setEditStaffOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Staff Member</DialogTitle>
            <DialogDescription>Update staff profile information</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Name *</Label>
              <Input
                id="edit-name"
                placeholder="Enter name"
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-designation">Designation</Label>
              <Input
                id="edit-designation"
                placeholder="Enter designation"
                value={editForm.designation}
                onChange={(e) => setEditForm({ ...editForm, designation: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-department">Department</Label>
              <Input
                id="edit-department"
                placeholder="Enter department"
                value={editForm.department}
                onChange={(e) => setEditForm({ ...editForm, department: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-wage">Daily Wage Rate (₹)</Label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground font-medium">₹</span>
                <Input
                  id="edit-wage"
                  type="number"
                  min={0}
                  placeholder="500"
                  value={editForm.dailyWageRate}
                  onChange={(e) => setEditForm({ ...editForm, dailyWageRate: Math.max(0, parseInt(e.target.value) || 0) })}
                />
                <span className="text-xs text-muted-foreground">/ day</span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditStaffOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleUpdateStaff}
              disabled={updatingStaff || !editForm.name.trim()}
              style={{ backgroundColor: '#4CAF50', color: 'white' }}
            >
              {updatingStaff && <Loader2 className="size-4 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Status Dialog - Larger clickable cards with preview */}
      <Dialog open={statusDialogOpen} onOpenChange={setStatusDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Set Attendance Status</DialogTitle>
            <DialogDescription className="flex items-center gap-1.5">
              <CalendarDays className="size-3.5" />
              {selectedDate ? formatDateIndian(selectedDate) : ''} — {selectedStaff?.name}
            </DialogDescription>
          </DialogHeader>

          {/* Current status preview */}
          <div className="flex items-center justify-center py-2">
            <div className="text-center">
              <p className="text-xs text-muted-foreground mb-1">Current Status</p>
              <div
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium ${
                  selectedDateStatus
                    ? (() => {
                        const opt = STATUS_OPTIONS.find(o => o.value === selectedDateStatus)
                        return opt ? `${opt.bgColor} ${opt.color} ${opt.borderColor} border` : 'bg-muted text-muted-foreground border'
                      })()
                    : 'bg-muted/30 text-muted-foreground border border-muted-foreground/30'
                }`}
              >
                {selectedDateStatus
                  ? STATUS_OPTIONS.find(o => o.value === selectedDateStatus)?.emoji
                  : '—'}
                <span>{selectedDateStatus
                  ? STATUS_OPTIONS.find(o => o.value === selectedDateStatus)?.label
                  : 'Not Set'}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 py-2">
            {STATUS_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                className={`flex items-center gap-2.5 p-4 rounded-xl border-2 transition-all ${opt.bgColor} ${opt.color} ${opt.borderColor} hover:scale-[1.02] active:scale-[0.98]`}
                onClick={() => handleSetStatus(opt.value)}
                disabled={statusSubmitting}
              >
                <span className="text-xl">{opt.emoji}</span>
                <span className="text-sm font-semibold">{opt.label}</span>
              </button>
            ))}
          </div>
          {statusSubmitting && (
            <div className="flex items-center justify-center py-2">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Staff Confirmation */}
      <AlertDialog open={deleteStaffOpen} onOpenChange={setDeleteStaffOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Staff Member</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{selectedStaff?.name}</strong> and all their
              attendance records? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteStaff}
              disabled={deleting}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              {deleting && <Loader2 className="size-4 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reset Month Confirmation */}
      <AlertDialog open={resetMonthOpen} onOpenChange={setResetMonthOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset Month</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to clear all attendance records for{' '}
              <strong>{selectedStaff?.name}</strong> in <strong>{monthName} {currentYear}</strong>?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={resettingMonth}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleResetMonth}
              disabled={resettingMonth}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              {resettingMonth && <Loader2 className="size-4 animate-spin" />}
              Reset Month
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
