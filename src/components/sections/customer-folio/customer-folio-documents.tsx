'use client'

import React, { useState, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  FileText, Plus, Trash2, Search, ExternalLink, Eye, StickyNote, X, Lock, Loader2,
  Pencil, Check, User, Clock, File, Shield, MessageSquare, AlertTriangle, Star,
  ChevronDown, ChevronUp, Phone, Mail, Building2, CreditCard, Image, FileSpreadsheet,
  FileCheck, FileCode, Archive, Receipt,
} from 'lucide-react'
import { CustomerDetail, CustomerNote, CustomerDocument } from './customer-folio-types'
import { fmtDate, fmtDateTime, relTime } from './customer-folio-helpers'
import { notify } from '@/lib/notification-store'

const NOTE_TYPES = ['Internal', 'Customer', 'Staff', 'Private', 'Complaint', 'Feedback', 'FollowUp'] as const
const DOC_TYPES = ['Aadhaar', 'PAN', 'GST', 'Agreement', 'Receipt', 'Invoice', 'Contract', 'Photo', 'ID Proof', 'Address Proof', 'Medical', 'Custom'] as const

const NOTE_COLORS: Record<string, string> = {
  Internal: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  Customer: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  Staff: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  Private: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  Complaint: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  Feedback: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  FollowUp: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300',
}

const NOTE_BG: Record<string, string> = {
  Internal: 'bg-slate-50/80 dark:bg-slate-900/40',
  Customer: 'bg-emerald-50/60 dark:bg-emerald-950/20',
  Staff: 'bg-blue-50/60 dark:bg-blue-950/20',
  Private: 'bg-red-50/60 dark:bg-red-950/20',
  Complaint: 'bg-orange-50/60 dark:bg-orange-950/20',
  Feedback: 'bg-purple-50/60 dark:bg-purple-950/20',
  FollowUp: 'bg-cyan-50/60 dark:bg-cyan-950/20',
}

const NOTE_BORDER: Record<string, string> = {
  Internal: 'border-l-slate-400', Customer: 'border-l-emerald-500', Staff: 'border-l-blue-500',
  Private: 'border-l-red-500', Complaint: 'border-l-orange-500', Feedback: 'border-l-purple-500', FollowUp: 'border-l-cyan-500',
}

const NOTE_ICONS: Record<string, React.ElementType> = {
  Internal: MessageSquare, Customer: User, Staff: Shield, Private: Lock,
  Complaint: AlertTriangle, Feedback: Star, FollowUp: Clock,
}

const DOC_COLORS: Record<string, string> = {
  Aadhaar: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  PAN: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  GST: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  Agreement: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  Receipt: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  Invoice: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300',
  Contract: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300',
  Photo: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300',
  'ID Proof': 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
  'Address Proof': 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300',
  Medical: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  Custom: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400',
}

const DOC_ICONS: Record<string, React.ElementType> = {
  Aadhaar: CreditCard, PAN: FileCheck, GST: FileSpreadsheet,
  Agreement: FileText, Receipt: Receipt, Invoice: FileText,
  Contract: File, Photo: Image, 'ID Proof': Shield,
  'Address Proof': Building2, Medical: AlertTriangle, Custom: Archive,
}

const DOC_BORDER: Record<string, string> = {
  Aadhaar: 'border-l-blue-500', PAN: 'border-l-purple-500', GST: 'border-l-orange-500',
  Agreement: 'border-l-emerald-500', Receipt: 'border-l-amber-500', Invoice: 'border-l-cyan-500',
  Contract: 'border-l-rose-500', Photo: 'border-l-pink-500', 'ID Proof': 'border-l-indigo-500',
  'Address Proof': 'border-l-teal-500', Medical: 'border-l-red-500', Custom: 'border-l-slate-400',
}

interface Props {
  detail: CustomerDetail | null; submitting: boolean; isAdmin: boolean
  canManageDocs: boolean; canDeleteDocs: boolean; token: string | null; onRefresh: () => void
  initialTab?: 'notes' | 'docs'
}

export function CustomerFolioNotesDocs({ detail, submitting, isAdmin, canManageDocs, canDeleteDocs, token, onRefresh, initialTab = 'notes' }: Props) {
  const [tab, setTab] = useState<'notes' | 'docs'>(initialTab)
  const [noteSearch, setNoteSearch] = useState('')
  const [noteTypeFilter, setNoteTypeFilter] = useState('All')
  const [docSearch, setDocSearch] = useState('')
  const [docTypeFilter, setDocTypeFilter] = useState('All')
  const [showNoteForm, setShowNoteForm] = useState(false)
  const [showDocForm, setShowDocForm] = useState(false)
  const [addLoading, setAddLoading] = useState(false)
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')

  // Note form
  const [noteType, setNoteType] = useState('Internal')
  const [noteContent, setNoteContent] = useState('')
  const [notePrivate, setNotePrivate] = useState(false)
  const [noteImportant, setNoteImportant] = useState(false)

  // Doc form
  const [docType, setDocType] = useState('Custom')
  const [docName, setDocName] = useState('')
  const [docUrl, setDocUrl] = useState('')
  const [docNotes, setDocNotes] = useState('')
  const [docFileSize, setDocFileSize] = useState('')

  // Expanded note for long content
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set())
  const toggleNoteExpand = (id: string) => {
    setExpandedNotes(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n })
  }

  const authHdrs: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {}

  // Filter notes: hide private from non-admin, apply search/type filter
  const visibleNotes = useMemo(() => {
    let notes = (detail?.notes || [])
    if (!isAdmin) notes = notes.filter(n => !n.isPrivate)
    if (noteTypeFilter !== 'All') notes = notes.filter(n => n.type === noteTypeFilter)
    if (noteSearch) { const q = noteSearch.toLowerCase(); notes = notes.filter(n => n.content.toLowerCase().includes(q) || n.type.toLowerCase().includes(q)) }
    return notes
  }, [detail?.notes, isAdmin, noteTypeFilter, noteSearch])

  const visibleDocs = useMemo(() => {
    let docs = (detail?.documents || [])
    if (docTypeFilter !== 'All') docs = docs.filter(d => d.type === docTypeFilter)
    if (docSearch) { const q = docSearch.toLowerCase(); docs = docs.filter(d => d.name.toLowerCase().includes(q) || d.type.toLowerCase().includes(q) || (d.notes || '').toLowerCase().includes(q)) }
    return docs
  }, [detail?.documents, docTypeFilter, docSearch])

  // Stats
  const noteStats = useMemo(() => {
    const all = detail?.notes || []
    const byType: Record<string, number> = {}
    for (const n of all) { if (!n.isPrivate || isAdmin) byType[n.type] = (byType[n.type] || 0) + 1 }
    return byType
  }, [detail?.notes, isAdmin])

  const docStats = useMemo(() => {
    const all = detail?.documents || []
    const byType: Record<string, number> = {}
    for (const d of all) byType[d.type] = (byType[d.type] || 0) + 1
    return byType
  }, [detail?.documents])

  const resetNoteForm = () => { setNoteType('Internal'); setNoteContent(''); setNotePrivate(false); setNoteImportant(false); setShowNoteForm(false) }
  const resetDocForm = () => { setDocType('Custom'); setDocName(''); setDocUrl(''); setDocNotes(''); setDocFileSize(''); setShowDocForm(false) }

  const addNote = async () => {
    if (!detail?.id || !noteContent.trim()) return
    try {
      setAddLoading(true)
      const res = await fetch(`/api/folio/customers/${detail.id}/notes`, {
        method: 'POST', headers: { ...authHdrs, 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: noteType, content: noteContent.trim(), isPrivate: isAdmin && notePrivate, isImportant: noteImportant })
      })
      if (res.ok) { notify({ type: 'success', title: 'Note added' }); resetNoteForm(); onRefresh() }
      else { const e = await res.json().catch(() => ({})); notify({ type: 'error', title: 'Error', message: (e as any).error || 'Failed to add note' }) }
    } catch { notify({ type: 'error', title: 'Error', message: 'Network error' }) } finally { setAddLoading(false) }
  }

  const updateNote = async (noteId: string) => {
    if (!detail?.id || !editContent.trim()) return
    try {
      setAddLoading(true)
      const res = await fetch(`/api/folio/customers/${detail.id}/notes/${noteId}`, {
        method: 'PUT', headers: { ...authHdrs, 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: editContent.trim() })
      })
      if (res.ok) { notify({ type: 'success', title: 'Note updated' }); setEditingNoteId(null); setEditContent(''); onRefresh() }
      else notify({ type: 'error', title: 'Error', message: 'Failed to update note' })
    } catch { notify({ type: 'error', title: 'Error', message: 'Network error' }) } finally { setAddLoading(false) }
  }

  const addDoc = async () => {
    if (!detail?.id || !docName.trim()) return
    try {
      setAddLoading(true)
      const res = await fetch(`/api/folio/customers/${detail.id}/documents`, {
        method: 'POST', headers: { ...authHdrs, 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: docType, name: docName.trim(), url: docUrl.trim(), notes: docNotes.trim(), fileSize: parseInt(docFileSize) || 0, mimeType: '' })
      })
      if (res.ok) { notify({ type: 'success', title: 'Document added' }); resetDocForm(); onRefresh() }
      else notify({ type: 'error', title: 'Error', message: 'Failed to add document' })
    } catch { notify({ type: 'error', title: 'Error', message: 'Network error' }) } finally { setAddLoading(false) }
  }

  const deleteNote = async (id: string) => {
    if (!detail) return
    try {
      const res = await fetch(`/api/folio/customers/${detail.id}/notes/${id}`, { method: 'DELETE', headers: authHdrs })
      if (res.ok) { notify({ type: 'success', title: 'Deleted' }); onRefresh() }
      else notify({ type: 'error', title: 'Error', message: 'Failed to delete note' })
    } catch { notify({ type: 'error', title: 'Error', message: 'Network error' }) }
  }

  const deleteDoc = async (id: string) => {
    if (!detail) return
    try {
      const res = await fetch(`/api/folio/customers/${detail.id}/documents/${id}`, { method: 'DELETE', headers: authHdrs })
      if (res.ok) { notify({ type: 'success', title: 'Deleted' }); onRefresh() }
      else notify({ type: 'error', title: 'Error', message: 'Failed to delete document' })
    } catch { notify({ type: 'error', title: 'Error', message: 'Network error' }) }
  }

  const fmtSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const totalNotes = detail?.notes ? (isAdmin ? detail.notes.length : detail.notes.filter(n => !n.isPrivate).length) : 0
  const totalDocs = detail?.documents?.length || 0

  return (
    <div className="flex flex-col h-full">
      {/* ── Header Tabs ── */}
      <div className="flex items-center gap-1 p-3 pb-0">
        <button
          onClick={() => setTab('notes')}
          className={`flex items-center gap-2 px-4 py-2 rounded-t-lg text-xs font-semibold transition-all border-b-2 ${
            tab === 'notes'
              ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-300 border-emerald-500'
              : 'text-muted-foreground border-transparent hover:text-foreground hover:bg-muted/50'
          }`}
        >
          <StickyNote className="size-4" />
          Notes
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${tab === 'notes' ? 'bg-emerald-200 dark:bg-emerald-800 text-emerald-800 dark:text-emerald-200' : 'bg-muted text-muted-foreground'}`}>
            {totalNotes}
          </span>
        </button>
        <button
          onClick={() => setTab('docs')}
          className={`flex items-center gap-2 px-4 py-2 rounded-t-lg text-xs font-semibold transition-all border-b-2 ${
            tab === 'docs'
              ? 'bg-blue-50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-300 border-blue-500'
              : 'text-muted-foreground border-transparent hover:text-foreground hover:bg-muted/50'
          }`}
        >
          <FileText className="size-4" />
          Documents
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${tab === 'docs' ? 'bg-blue-200 dark:bg-blue-800 text-blue-800 dark:text-blue-200' : 'bg-muted text-muted-foreground'}`}>
            {totalDocs}
          </span>
        </button>
      </div>

      {/* ── NOTES TAB ── */}
      {tab === 'notes' && (
        <div className="flex-1 min-h-0 flex flex-col p-3 pt-2">
          {/* Type Stats Chips */}
          {Object.keys(noteStats).length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap mb-2">
              {Object.entries(noteStats).map(([type, count]) => (
                <button
                  key={type}
                  onClick={() => setNoteTypeFilter(noteTypeFilter === type ? 'All' : type)}
                  className={`text-[10px] px-2 py-0.5 rounded-full font-medium transition-all border ${
                    noteTypeFilter === type
                      ? `${NOTE_COLORS[type] || 'bg-muted text-muted-foreground'} border-current/20 ring-1 ring-current/20`
                      : 'bg-muted/50 text-muted-foreground border-transparent hover:bg-muted'
                  }`}
                >
                  {type} ({count})
                </button>
              ))}
              {noteTypeFilter !== 'All' && (
                <button onClick={() => setNoteTypeFilter('All')} className="text-[10px] px-1.5 py-0.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                  <X className="size-3 inline" /> Clear
                </button>
              )}
            </div>
          )}

          {/* Search + Add */}
          <div className="flex items-center gap-2 mb-3">
            <div className="relative flex-1 min-w-[160px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              <Input placeholder="Search notes..." className="h-8 pl-8 text-xs" value={noteSearch} onChange={e => setNoteSearch(e.target.value)} />
            </div>
            {(isAdmin || canManageDocs) && (
              <Button size="sm" className="h-8 gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 shrink-0" onClick={() => setShowNoteForm(!showNoteForm)}>
                {showNoteForm ? <X className="size-3.5" /> : <Plus className="size-3.5" />}
                {showNoteForm ? 'Cancel' : 'New Note'}
              </Button>
            )}
          </div>

          {/* Add Note Form */}
          {showNoteForm && (
            <Card className="border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20 mb-3 shadow-sm">
              <CardContent className="p-3 space-y-2.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="min-w-[120px]">
                    <Label className="text-[10px] text-muted-foreground font-medium">Note Type</Label>
                    <Select value={noteType} onValueChange={setNoteType}>
                      <SelectTrigger className="h-8 text-xs mt-0.5"><SelectValue /></SelectTrigger>
                      <SelectContent>{NOTE_TYPES.map(t => <SelectItem key={t} value={t}><span>{t}</span></SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  {isAdmin && (
                    <div className="flex items-center gap-1.5 pt-5">
                      <input type="checkbox" checked={notePrivate} onChange={e => setNotePrivate(e.target.checked)} className="rounded border-slate-300" id="note-private-adv" />
                      <Label htmlFor="note-private-adv" className="text-[11px] flex items-center gap-1 cursor-pointer">
                        <Lock className="size-3 text-red-500" /> Private (Admin only)
                      </Label>
                    </div>
                  )}
                  <div className="flex items-center gap-1.5 pt-5">
                    <input type="checkbox" checked={noteImportant} onChange={e => setNoteImportant(e.target.checked)} className="rounded border-slate-300 accent-amber-500" id="note-important-adv" />
                    <Label htmlFor="note-important-adv" className="text-[11px] flex items-center gap-1 cursor-pointer">
                      <Star className="size-3 text-amber-500" /> Mark as Important
                    </Label>
                  </div>
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground font-medium">Content *</Label>
                  <Textarea value={noteContent} onChange={e => setNoteContent(e.target.value)} rows={3} placeholder="Write your note..." className="text-xs mt-0.5 resize-none" maxLength={2000} />
                  <p className="text-[9px] text-muted-foreground text-right mt-0.5">{noteContent.length}/2000</p>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" size="sm" className="h-7 text-xs" onClick={resetNoteForm}>Discard</Button>
                  <Button size="sm" className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700" disabled={addLoading || !noteContent.trim()} onClick={addNote}>
                    {addLoading ? <Loader2 className="size-3 animate-spin" /> : <Plus className="size-3" />} Add Note
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Notes List */}
          <div className="flex-1 min-h-0 overflow-y-auto space-y-1.5 pr-1">
            {visibleNotes.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-3">
                  <StickyNote className="size-7 opacity-30" />
                </div>
                <p className="text-sm font-medium">No notes found</p>
                <p className="text-xs mt-1">{noteSearch || noteTypeFilter !== 'All' ? 'Try adjusting your filters' : 'Click "New Note" to add one'}</p>
              </div>
            ) : visibleNotes.map((note, idx) => {
              const isEditing = editingNoteId === note.id
              const isExpanded = expandedNotes.has(note.id)
              const isLong = note.content.length > 200
              const NoteIcon = NOTE_ICONS[note.type] || MessageSquare
              return (
                <div
                  key={note.id}
                  className={`border-l-[3px] ${NOTE_BORDER[note.type] || 'border-l-slate-300'} rounded-r-xl p-3 ${NOTE_BG[note.type] || ''} hover:shadow-sm transition-all group`}
                >
                  <div className="flex items-start gap-2.5">
                    {/* Icon */}
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${NOTE_COLORS[note.type] || 'bg-muted text-muted-foreground'}`}>
                      <NoteIcon className="size-3.5" />
                    </div>

                    {/* Content */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-semibold ${NOTE_COLORS[note.type] || ''}`}>{note.type}</span>
                        {note.isPrivate && <Badge variant="outline" className="text-[9px] h-4 px-1.5 text-red-500 border-red-200 dark:border-red-800 gap-0.5"><Lock className="size-2.5" />Private</Badge>}
                        {note.isImportant && <Badge variant="outline" className="text-[9px] h-4 px-1.5 text-amber-600 border-amber-200 dark:border-amber-800 gap-0.5 bg-amber-50 dark:bg-amber-900/20"><Star className="size-2.5" />Important</Badge>}
                      </div>

                      {isEditing ? (
                        <div className="space-y-2">
                          <Textarea value={editContent} onChange={e => setEditContent(e.target.value)} rows={3} className="text-xs resize-none" maxLength={2000} />
                          <div className="flex gap-1.5">
                            <Button size="sm" className="h-6 text-[10px] gap-1 bg-emerald-600 hover:bg-emerald-700" disabled={addLoading || !editContent.trim()} onClick={() => updateNote(note.id)}>
                              <Check className="size-3" />Save
                            </Button>
                            <Button variant="outline" size="sm" className="h-6 text-[10px]" onClick={() => { setEditingNoteId(null); setEditContent('') }}>Cancel</Button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <p className="text-xs text-foreground leading-relaxed break-words">
                            {isLong && !isExpanded ? note.content.slice(0, 200) + '...' : note.content}
                          </p>
                          {isLong && (
                            <button onClick={() => toggleNoteExpand(note.id)} className="text-[10px] text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 mt-0.5 flex items-center gap-0.5 font-medium">
                              {isExpanded ? <><ChevronUp className="size-3" />Show less</> : <><ChevronDown className="size-3" />Show more</>}
                            </button>
                          )}
                        </>
                      )}

                      <div className="flex items-center gap-3 mt-1.5 text-[10px] text-muted-foreground">
                        {note.userName && <span className="flex items-center gap-0.5"><User className="size-2.5" />{note.userName}</span>}
                        <span className="flex items-center gap-0.5"><Clock className="size-2.5" />{relTime(note.createdAt)}</span>
                      </div>
                    </div>

                    {/* Actions */}
                    {!isEditing && (isAdmin || canManageDocs) && (
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        <button
                          onClick={() => { setEditingNoteId(note.id); setEditContent(note.content) }}
                          className="p-1 rounded-md text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors"
                          title="Edit note"
                        >
                          <Pencil className="size-3" />
                        </button>
                        <button
                          onClick={() => deleteNote(note.id)}
                          className="p-1 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                          title="Delete note"
                        >
                          <Trash2 className="size-3" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── DOCUMENTS TAB ── */}
      {tab === 'docs' && (
        <div className="flex-1 min-h-0 flex flex-col p-3 pt-2">
          {/* Type Stats Chips */}
          {Object.keys(docStats).length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap mb-2">
              {Object.entries(docStats).map(([type, count]) => (
                <button
                  key={type}
                  onClick={() => setDocTypeFilter(docTypeFilter === type ? 'All' : type)}
                  className={`text-[10px] px-2 py-0.5 rounded-full font-medium transition-all border ${
                    docTypeFilter === type
                      ? `${DOC_COLORS[type] || 'bg-muted text-muted-foreground'} border-current/20 ring-1 ring-current/20`
                      : 'bg-muted/50 text-muted-foreground border-transparent hover:bg-muted'
                  }`}
                >
                  {type} ({count})
                </button>
              ))}
              {docTypeFilter !== 'All' && (
                <button onClick={() => setDocTypeFilter('All')} className="text-[10px] px-1.5 py-0.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                  <X className="size-3 inline" /> Clear
                </button>
              )}
            </div>
          )}

          {/* Search + Add */}
          <div className="flex items-center gap-2 mb-3">
            <div className="relative flex-1 min-w-[160px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              <Input placeholder="Search documents..." className="h-8 pl-8 text-xs" value={docSearch} onChange={e => setDocSearch(e.target.value)} />
            </div>
            {canManageDocs && (
              <Button size="sm" className="h-8 gap-1.5 text-xs bg-blue-600 hover:bg-blue-700 shrink-0" onClick={() => setShowDocForm(!showDocForm)}>
                {showDocForm ? <X className="size-3.5" /> : <Plus className="size-3.5" />}
                {showDocForm ? 'Cancel' : 'New Document'}
              </Button>
            )}
          </div>

          {/* Add Doc Form */}
          {showDocForm && (
            <Card className="border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20 mb-3 shadow-sm">
              <CardContent className="p-3 space-y-2.5">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-[10px] text-muted-foreground font-medium">Document Type</Label>
                    <Select value={docType} onValueChange={setDocType}>
                      <SelectTrigger className="h-8 text-xs mt-0.5"><SelectValue /></SelectTrigger>
                      <SelectContent>{DOC_TYPES.map(t => <SelectItem key={t} value={t}><span>{t}</span></SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-[10px] text-muted-foreground font-medium">File Size (bytes)</Label>
                    <Input type="number" className="h-8 text-xs mt-0.5" value={docFileSize} onChange={e => setDocFileSize(e.target.value)} placeholder="Optional" />
                  </div>
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground font-medium">Document Name *</Label>
                  <Input className="h-8 text-xs mt-0.5" value={docName} onChange={e => setDocName(e.target.value)} placeholder="e.g. Aadhaar Card - Front" />
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground font-medium">URL / Link</Label>
                  <Input className="h-8 text-xs mt-0.5" value={docUrl} onChange={e => setDocUrl(e.target.value)} placeholder="https://..." />
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground font-medium">Notes</Label>
                  <Textarea value={docNotes} onChange={e => setDocNotes(e.target.value)} rows={2} className="text-xs mt-0.5 resize-none" placeholder="Optional notes about this document..." />
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" size="sm" className="h-7 text-xs" onClick={resetDocForm}>Discard</Button>
                  <Button size="sm" className="h-7 text-xs bg-blue-600 hover:bg-blue-700" disabled={addLoading || !docName.trim()} onClick={addDoc}>
                    {addLoading ? <Loader2 className="size-3 animate-spin" /> : <Plus className="size-3" />} Add Document
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Documents Grid */}
          <div className="flex-1 min-h-0 overflow-y-auto pr-1">
            {visibleDocs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-3">
                  <FileText className="size-7 opacity-30" />
                </div>
                <p className="text-sm font-medium">No documents found</p>
                <p className="text-xs mt-1">{docSearch || docTypeFilter !== 'All' ? 'Try adjusting your filters' : 'Click "New Document" to add one'}</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {visibleDocs.map(doc => {
                  const DocIcon = DOC_ICONS[doc.type] || File
                  return (
                    <div
                      key={doc.id}
                      className={`border-l-[3px] ${DOC_BORDER[doc.type] || 'border-l-slate-300'} rounded-xl p-3 bg-card hover:shadow-md transition-all group border border-border/50`}
                    >
                      <div className="flex items-start gap-2.5">
                        {/* Icon */}
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${DOC_COLORS[doc.type] || 'bg-muted text-muted-foreground'}`}>
                          <DocIcon className="size-4" />
                        </div>

                        {/* Content */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span className={`text-[9px] px-1.5 py-0.5 rounded-md font-semibold ${DOC_COLORS[doc.type] || ''}`}>{doc.type}</span>
                          </div>
                          <p className="text-xs font-medium truncate" title={doc.name}>{doc.name}</p>
                          {doc.notes && <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2" title={doc.notes}>{doc.notes}</p>}

                          {/* Meta */}
                          <div className="flex items-center gap-2 mt-1.5 text-[10px] text-muted-foreground">
                            {doc.url && (
                              <a href={doc.url} target="_blank" rel="noopener" className="flex items-center gap-0.5 text-blue-600 hover:text-blue-700 hover:underline font-medium">
                                <ExternalLink className="size-2.5" />Open
                              </a>
                            )}
                            {doc.fileSize > 0 && <span className="flex items-center gap-0.5"><File className="size-2.5" />{fmtSize(doc.fileSize)}</span>}
                            <span className="flex items-center gap-0.5"><Clock className="size-2.5" />{fmtDate(doc.createdAt)}</span>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                          {doc.url && (
                            <a href={doc.url} target="_blank" rel="noopener" className="p-1.5 rounded-md text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors" title="View document">
                              <Eye className="size-3.5" />
                            </a>
                          )}
                          {(isAdmin || canDeleteDocs) && (
                            <button onClick={() => deleteDoc(doc.id)} className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors" title="Delete document">
                              <Trash2 className="size-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}