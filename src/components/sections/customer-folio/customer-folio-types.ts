// ─── Customer Folio Types ───

export interface Customer {
  id: string; unitCode: string; customerId: string; primaryFolioId: string
  fullName: string; mobile: string; whatsapp: string; email: string; address: string
  customerType: string; creditLimit: number; internalNotes: string; status: string
  gstNumber: string; gstAddress: string; panNumber: string; aadhaarNumber: string; companyName: string
  openingBalance: number
  balance: number; totalVisits: number; lastTxnDate: string; tags: CustomerTagAssignment[]
  createdAt: string; updatedAt: string
}

export interface Folio {
  id: string; folioId: string; customerId: string; visitNumber: number
  status: string; lockedAt: string | null; folioNumber?: number
}

export interface LedgerEntry {
  id: string; folioId: string; customerId: string; date: string; docNo: string
  invoiceNo: string; type: string; description: string; debit: number; credit: number
  tax: number; discount: number; balance: number; userId: string; userName: string
  status: string; createdAt: string; paymentMode: string
}

export interface CustomerDocument {
  id: string; customerId: string; type: string; name: string; url: string
  notes: string; fileSize: number; mimeType: string; createdAt: string
}

export interface CustomerNote {
  id: string; customerId: string; type: string; content: string
  isPrivate: boolean; isImportant: boolean; userId: string; userName: string; createdAt: string
}

export interface CustomerTagAssignment {
  id: string; customerId: string; tagName: string
}

export interface CustomerVisit {
  id: string; visitNumber: number; checkInAt: string; checkOutAt: string | null
}

export interface FolioAuditLog {
  id: string; action: string; target: string; details: string
  userId: string; userName: string; ipAddress: string; device: string; createdAt: string
}

export interface Settlement {
  id: string; amount: number; mode: string; reference: string
  description: string; userName: string; createdAt: string
}

export interface CustomerDetail extends Customer {
  folios: Folio[]; ledgerEntries: LedgerEntry[]; documents: CustomerDocument[]
  notes: CustomerNote[]; visits: CustomerVisit[]; settlements: Settlement[]
  auditLogs: FolioAuditLog[]; lifetimeRevenue: number; lifetimePayments: number
  lifetimeRefunds: number; totalBills: number; totalTransactions: number
  lastVisitDate: string; lastCheckoutDate: string; activeFolio: Folio | null
}

// ─── History Types ───
export interface HistoricalFolio {
  id: string; folioId: string; visitNumber: number; status: string
  lockedAt: string | null; createdAt: string; startDate: string; endDate: string
  entryCount: number; totalDebit: number; totalCredit: number; finalBalance: number
  openingBalance: number; closingBalance: number; entries: any[]
}

export interface CheckoutRecord {
  id: string
  checkoutNumber: string
  invoiceNumber: string
  customInvoiceNumber: string
  checkoutDate: string
  checkoutUser: string
  checkoutUserId: string
  remarks: string
  customerName: string
  customerMobile: string
  customerEmail: string
  customerAddress: string
  customerType: string
  customerIdRef: string
  customerGstNumber: string
  customerGstAddress: string
  customerPanNumber: string
  customerCompanyName: string
  folioIds: string[]
  folioNumbers: number[]
  visitNumber: number
  totalCharges: number
  totalPayments: number
  totalTax: number
  totalDiscount: number
  totalSettlements: number
  totalRefunds: number
  openingBalance: number
  closingBalance: number
  outstanding: number
  transactions: any[]
  settlements: any[]
  paymentBreakdown: Record<string, number>
}

export interface CustomerHistory {
  customer: { id: string; customerId: string; fullName: string; status: string }
  checkoutRecords: CheckoutRecord[]
  totalRecords: number
}

// Form types
export interface CustomerForm {
  fullName: string; mobile: string; whatsapp: string; email: string; address: string
  customerType: string; creditLimit: number; internalNotes: string
  gstNumber: string; gstAddress: string; panNumber: string; aadhaarNumber: string; openingBalance: number
}

export interface ChargeForm {
  description: string; amount: string; chargeType: string; tax: string; invoiceNo: string
  taxEnabled: boolean; taxType: 'include' | 'exclude'; selectedItem: string; selectedItemPrice: string
}

export interface PaymentForm {
  amount: string; mode: string; reference: string; description: string
}

export interface RefundForm {
  amount: string; reason: string; description: string; invoiceNo: string
}

export interface TransferForm {
  targetCustomerId: string; targetName: string; amount: string; description: string
}

export interface DiscountForm {
  discountType: string; amount: string; description: string; requiresApproval: boolean
}

export interface DocForm {
  type: string; name: string; url: string; notes: string
}

export interface NoteForm {
  type: string; content: string; isPrivate: boolean; isImportant: boolean
}

export interface SplitAmountForm {
  amount: string; targetFolioId: string
}

// Props for sub-components
export interface FolioSectionProps {
  onRefreshData: () => void; dataVersion?: number
}

export interface AuthContext {
  canAccess: boolean; canCreate: boolean; canEdit: boolean; canDelete: boolean; isAdmin: boolean
}

// Settlement Overview (per-folio breakdown for checkout)
export interface FolioSettlementInfo {
  folioId: string
  folioNumber: number
  folioStatus: string
  totalDebits: number
  totalCredits: number
  outstandingBalance: number
  entryCount: number
  transactions: { id: string; date: string; type: string; description: string; debit: number; credit: number; balance: number }[]
}

export interface CheckoutSettlementData {
  customerId: string
  customerName: string
  totalOutstanding: number
  perFolioOutstanding: number
  creditBalance: number
  openingBalance: number
  unifiedTotalDebits: number
  unifiedTotalCredits: number
  unifiedFinalBalance: number
  folios: FolioSettlementInfo[]
}

// Split Payment
export interface SplitPaymentItem {
  method: string
  amount: number
  reference: string
}

export interface SettlementPayload {
  amount: number
  mode: string
  reference: string
  description: string
  folioId?: string
  autoAllocate?: boolean
  splitPayments?: SplitPaymentItem[]
}