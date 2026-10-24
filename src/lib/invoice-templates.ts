// ─── Invoice Template Definitions ───
// Each template defines CSS overrides for the print invoice system

export interface InvoiceCustomizations {
  headerBgColor?: string
  headerTextColor?: string
  accentColor?: string
  fontFamily?: string
  titleStyle?: string
  logoPosition?: 'left' | 'center' | 'right'
  borderWidth?: number
  borderColor?: string
  borderRadius?: number
  showAmountInWords?: boolean
  showDeclaration?: boolean
  footerText?: string
  signatureLabel1?: string
  signatureLabel2?: string
}

export interface InvoiceTemplate {
  id: string
  name: string
  description: string
  preview: string // emoji/icon representation
  customizations: InvoiceCustomizations
  cssOverrides: string // Additional CSS to inject
}

const DEFAULT_CUSTOMIZATIONS: InvoiceCustomizations = {
  headerBgColor: '#ffffff',
  headerTextColor: '#16a34a',
  accentColor: '#16a34a',
  fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
  titleStyle: 'uppercase',
  logoPosition: 'left',
  borderWidth: 1.5,
  borderColor: '#d1d5db',
  borderRadius: 0,
  showAmountInWords: true,
  showDeclaration: true,
  footerText: 'Powered by Eservices',
  signatureLabel1: 'Customer Signature',
  signatureLabel2: 'Authorized Signature',
}

export const INVOICE_TEMPLATES: InvoiceTemplate[] = [
  {
    id: 'modern',
    name: 'Modern Professional',
    description: 'Clean white header with green accents, flex layout with logo',
    preview: '📐',
    customizations: { ...DEFAULT_CUSTOMIZATIONS },
    cssOverrides: '',
  },
  {
    id: 'classic',
    name: 'Classic Green',
    description: 'Traditional green gradient header with centered layout',
    preview: '🏛️',
    customizations: {
      ...DEFAULT_CUSTOMIZATIONS,
      headerBgColor: 'linear-gradient(135deg, #059669 0%, #10b981 40%, #34d399 100%)',
      headerTextColor: '#ffffff',
      logoPosition: 'center',
      borderRadius: 0,
    },
    cssOverrides: `
.inv-header{padding:16px 20px 14px;text-align:center;${''/* bg/color set via JS */}display:block}
.inv-header::after{height:3px;background:linear-gradient(90deg,#fbbf24,#f59e0b,#fbbf24)}
.inv-header .header-logo{margin-bottom:6px}
.inv-header .header-logo img{max-width:70px;max-height:50px;object-fit:contain;border-radius:4px}
.inv-header .header-info{text-align:center}
.inv-header .biz-name{font-size:20px;font-weight:800;letter-spacing:1px;text-shadow:0 1px 2px rgba(0,0,0,0.15)}
.inv-header .biz-subtitle{font-size:11px;color:rgba(255,255,255,0.9)}
.inv-header .biz-address{font-size:10px;color:rgba(255,255,255,0.85)}
.inv-header .biz-contact{font-size:10px;color:rgba(255,255,255,0.85)}
.inv-header .biz-gstin{font-size:10px;font-weight:700;background:rgba(0,0,0,0.15);color:#fff}
`,
  },
  {
    id: 'minimal',
    name: 'Minimal Clean',
    description: 'Ultra-clean design with thin borders, no background colors',
    preview: '✨',
    customizations: {
      ...DEFAULT_CUSTOMIZATIONS,
      headerBgColor: '#ffffff',
      headerTextColor: '#111111',
      accentColor: '#374151',
      borderWidth: 0.5,
      borderColor: '#e5e7eb',
      borderRadius: 6,
    },
    cssOverrides: `
.inv-wrap{border:0.5px solid #e5e7eb;border-radius:6px;box-shadow:none}
.inv-header{border-bottom:1px solid #e5e7eb}
.inv-header::after{display:none}
.inv-title-section{background:transparent;border-bottom:1px solid #e5e7eb}
.inv-title-section .doc-title{color:#111;font-weight:700;letter-spacing:2px}
.inv-title-section .title-underline{display:none}
.inv-txn-table th{background:#f9fafb;color:#374151;border-color:#e5e7eb}
.inv-txn-table td{border-color:#f0f0f0}
.inv-calcs .inv-calc-divider-thick{border-color:#374151}
.inv-calc-row.inv-grand-row .calc-label{color:#111}
.inv-calc-row.inv-grand-row .calc-value{color:#111}
.inv-footer-section .amount-words{border-left-color:#374151;background:#f9fafb}
.inv-footer-section .footer-col h4{border-bottom-color:#374151;color:#111}
.inv-bottom-bar{background:#fff}
.inv-gst-section th{background:#f9fafb}
`,
  },
  {
    id: 'bold',
    name: 'Bold Corporate',
    description: 'Dark header with strong typography and thick borders',
    preview: '💼',
    customizations: {
      ...DEFAULT_CUSTOMIZATIONS,
      headerBgColor: '#1f2937',
      headerTextColor: '#ffffff',
      accentColor: '#f59e0b',
      borderWidth: 2,
      borderColor: '#374151',
      borderRadius: 0,
    },
    cssOverrides: `
.inv-wrap{border:2px solid #374151;box-shadow:0 0 0 4px #fff}
.inv-header{padding:20px 24px;border-bottom:3px solid #f59e0b}
.inv-header::after{display:none}
.inv-header .header-logo img{max-width:90px;max-height:70px}
.inv-header .biz-name{font-size:22px;letter-spacing:2px}
.inv-header .biz-gstin{background:rgba(245,158,11,0.2);color:#fbbf24;border:1px solid rgba(245,158,11,0.3)}
.inv-title-section{background:#f9fafb;border-bottom:2px solid #374151}
.inv-title-section .doc-title{color:#1f2937;font-size:16px;letter-spacing:5px}
.inv-title-section .title-underline{background:linear-gradient(90deg,transparent,#f59e0b,transparent);height:2px;width:300px}
.inv-cust-section td{border-color:#d1d5db}
.inv-cust-section .lbl{background:#f3f4f6;color:#1f2937}
.inv-txn-table th{background:#1f2937;border-color:#1f2937}
.inv-txn-table td{border-color:#e5e7eb}
.inv-calcs .inv-calc-divider-thick{border-color:#1f2937;border-width:4px}
.inv-calc-row.inv-grand-row .calc-label{color:#1f2937}
.inv-calc-row.inv-grand-row .calc-value{color:#1f2937}
.inv-footer-section .amount-words{border-left-color:#f59e0b;background:#fffbeb}
.inv-footer-section .footer-col h4{border-bottom-color:#f59e0b;color:#1f2937}
.inv-bottom-bar{border-top:2px solid #374151}
.inv-legal{border-top:1px solid #d1d5db;background:#f9fafb}
`,
  },
  {
    id: 'elegant',
    name: 'Elegant Serif',
    description: 'Refined look with serif fonts and subtle gold accents',
    preview: '📜',
    customizations: {
      ...DEFAULT_CUSTOMIZATIONS,
      headerBgColor: '#ffffff',
      headerTextColor: '#78350f',
      accentColor: '#b45309',
      fontFamily: "'Georgia', 'Times New Roman', serif",
      borderWidth: 1,
      borderColor: '#d4a574',
      borderRadius: 4,
    },
    cssOverrides: `
@page{size:A4;margin:10mm 12mm}
body{font-family:'Georgia','Times New Roman',serif}
.inv-wrap{border:1px solid #d4a574;border-radius:4px}
.inv-header{padding:20px 24px;border-bottom:2px solid #b45309}
.inv-header::after{height:2px;background:linear-gradient(90deg,transparent,#d4a574,#b45309,#d4a574,transparent)}
.inv-header .biz-name{font-family:'Georgia',serif;font-size:22px;color:#78350f;font-style:italic;letter-spacing:1px}
.inv-header .biz-gstin{background:#fef3c7;color:#92400e;border:1px solid #fcd34d}
.inv-title-section{background:#fffbeb;border-bottom:1px solid #d4a574}
.inv-title-section .doc-title{color:#78350f;font-family:'Georgia',serif;letter-spacing:3px;font-style:italic}
.inv-title-section .title-underline{background:linear-gradient(90deg,transparent,#b45309,transparent);height:1px;width:260px}
.inv-cust-section .lbl{background:#fef3c7;color:#78350f}
.inv-txn-table th{background:linear-gradient(180deg,#92400e,#78350f);border-color:#78350f;font-family:'Georgia',serif}
.inv-txn-table td{border-color:#fde68a}
.inv-txn-table tr:nth-child(even) td{background:#fffbeb}
.inv-calcs .inv-calc-divider-thick{border-color:#b45309}
.inv-calc-row.inv-grand-row .calc-label{color:#78350f;font-family:'Georgia',serif}
.inv-calc-row.inv-grand-row .calc-value{color:#78350f}
.inv-footer-section .amount-words{border-left-color:#b45309;background:#fffbeb;color:#78350f}
.inv-footer-section .footer-col h4{border-bottom-color:#b45309;color:#78350f;font-family:'Georgia',serif}
.inv-bottom-bar .sig-line{border-color:#78350f}
`,
  },
]

export function getTemplateById(id: string): InvoiceTemplate {
  return INVOICE_TEMPLATES.find(t => t.id === id) || INVOICE_TEMPLATES[0]
}

export function getTemplateCSS(templateId: string, customizations?: InvoiceCustomizations): string {
  const template = getTemplateById(templateId)
  const merged = { ...template.customizations, ...customizations }

  let dynamicCSS = ''

  // Header background
  if (merged.headerBgColor?.includes('gradient')) {
    dynamicCSS += `.inv-header{background:${merged.headerBgColor};color:${merged.headerTextColor}}`
  } else if (merged.headerBgColor) {
    dynamicCSS += `.inv-header{background:${merged.headerBgColor}}`
    // For non-gradient, set text color via classes
    if (merged.headerTextColor === '#ffffff' || merged.headerTextColor === '#fff') {
      dynamicCSS += `.inv-header,.inv-header .biz-name,.inv-header .biz-address,.inv-header .biz-contact{color:${merged.headerTextColor}}`
      dynamicCSS += `.inv-header .biz-subtitle{color:rgba(255,255,255,0.9)}`
      if (merged.accentColor) {
        dynamicCSS += `.inv-header .biz-gstin{color:#fff;background:rgba(0,0,0,0.15)}`
      }
    } else {
      dynamicCSS += `.inv-header .biz-name{color:${merged.headerTextColor || merged.accentColor}}`
      dynamicCSS += `.inv-header .biz-gstin{color:${merged.accentColor};background:#f0fdf4}`
    }
  }

  // Accent color for title section
  if (merged.accentColor) {
    dynamicCSS += `.inv-title-section .doc-title{color:${merged.accentColor}}`
    dynamicCSS += `.inv-title-section .title-underline{background:linear-gradient(90deg,transparent,${merged.accentColor},transparent)}`
  }

  // Font family
  if (merged.fontFamily) {
    dynamicCSS += `body{font-family:${merged.fontFamily}}`
  }

  // Border
  if (merged.borderWidth !== undefined) {
    dynamicCSS += `.inv-wrap{border-width:${merged.borderWidth}px}`
  }
  if (merged.borderColor) {
    dynamicCSS += `.inv-wrap{border-color:${merged.borderColor}}`
  }
  if (merged.borderRadius !== undefined) {
    dynamicCSS += `.inv-wrap{border-radius:${merged.borderRadius}px}`
  }

  // Hide amount in words
  if (merged.showAmountInWords === false) {
    dynamicCSS += `.inv-footer-section .amount-words{display:none}`
  }

  // Hide declaration
  if (merged.showDeclaration === false) {
    dynamicCSS += `.inv-bottom-bar .state-info .declaration{display:none}`
  }

  // Logo position
  if (merged.logoPosition === 'center') {
    dynamicCSS += `.inv-header{justify-content:center;text-align:center}.inv-header .header-info{text-align:center}`
  } else if (merged.logoPosition === 'right') {
    dynamicCSS += `.inv-header{flex-direction:row-reverse}`
  }

  // Signature labels
  if (merged.signatureLabel1) {
    // This needs to be handled in the HTML, not CSS
  }

  return dynamicCSS + '\n' + template.cssOverrides
}