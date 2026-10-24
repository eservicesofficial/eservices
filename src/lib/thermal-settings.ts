export interface ThermalConfig {
  paperWidth: '58mm' | '80mm';
  fontSize: string;
  textWeight: number;
  lineHeight: number;
  printDpi: number;
  printQuality: number;
  dithering: string;
  alignment: 'left' | 'center';
  showLogo: boolean;
  logo: string;
  paperPxWidth: number;
  autoCutLines: number;
}

const DEFAULT_CONFIG: ThermalConfig = {
  paperWidth: '80mm',
  fontSize: '11px',
  textWeight: 400,
  lineHeight: 1.3,
  printDpi: 203,
  printQuality: 1,
  dithering: 'None',
  alignment: 'center',
  showLogo: false,
  logo: '',
  paperPxWidth: 302,
  autoCutLines: 3,
};

function buildConfig(t: Record<string, unknown>): ThermalConfig {
  const fontSizeMap: Record<string, string> = { small: '9px', medium: '11px', large: '13px', xlarge: '15px' };
  const weightMap: Record<string, number> = { Bold: 700, Normal: 400, Light: 300 };
  const qualityMap: Record<string, number> = { Dark: 1, Normal: 0.8, Light: 0.55 };

  const paperWidth = (t.paperWidth === '58mm' ? '58mm' : '80mm') as '58mm' | '80mm';
  const paperPxWidth = paperWidth === '80mm' ? 302 : 224;

  let resolvedFontSize = '11px';
  const rawFontSize = t.fontSize;
  if (typeof rawFontSize === 'string') {
    resolvedFontSize = fontSizeMap[rawFontSize] || rawFontSize;
  } else if (typeof rawFontSize === 'number') {
    resolvedFontSize = `${rawFontSize}px`;
  }

  let resolvedWeight = 400;
  const rawWeight = t.textWeight;
  if (typeof rawWeight === 'string') {
    resolvedWeight = weightMap[rawWeight] || 400;
  } else if (typeof rawWeight === 'number') {
    resolvedWeight = rawWeight;
  }

  let resolvedQuality = 1;
  const rawQuality = t.printQuality;
  if (typeof rawQuality === 'string') {
    resolvedQuality = qualityMap[rawQuality] ?? 1;
  } else if (typeof rawQuality === 'number') {
    resolvedQuality = rawQuality;
  }

  return {
    paperWidth,
    fontSize: resolvedFontSize,
    textWeight: resolvedWeight,
    lineHeight: typeof t.lineHeight === 'number' ? t.lineHeight : 1.3,
    printDpi: typeof t.printDpi === 'number' ? t.printDpi : 203,
    printQuality: resolvedQuality,
    dithering: typeof t.dithering === 'string' ? t.dithering : 'None',
    alignment: t.textAlignment === 'left' ? 'left' : 'center',
    showLogo: !!t.showLogo,
    logo: typeof t.logo === 'string' ? t.logo : '',
    paperPxWidth,
    autoCutLines: typeof t.autoCutLines === 'number' ? t.autoCutLines : 3,
  };
}

function mapDbToBuildConfig(db: Record<string, unknown>): Record<string, unknown> {
  return {
    paperWidth: db.thermalPaperWidth,
    fontSize: db.thermalFontSize,
    textWeight: db.thermalTextWeight,
    lineHeight: db.thermalLineHeight,
    printDpi: db.thermalDpi,
    printQuality: db.thermalPrintQuality,
    dithering: db.thermalDithering,
    textAlignment: db.thermalAlignment,
    showLogo: db.thermalShowLogo,
    logo: db.thermalLogo,
  };
}

export function getThermalSettings(): ThermalConfig {
  try {
    const raw = localStorage.getItem('fp_thermal_settings');
    if (raw) {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      if (parsed && typeof parsed === 'object') {
        return buildConfig(parsed);
      }
    }
  } catch { /* ignore */ }
  return DEFAULT_CONFIG;
}

export async function fetchThermalSettings(): Promise<ThermalConfig> {
  try {
    const res = await fetch('/api/settings');
    if (!res.ok) throw new Error(`Settings fetch failed: ${res.status}`);
    const db = (await res.json()) as Record<string, unknown>;
    const mapped = mapDbToBuildConfig(db);

    // Load localStorage as primary source (user's latest edits)
    let local: Record<string, unknown> = {};
    try {
      const raw = localStorage.getItem('fp_thermal_settings');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') local = parsed;
      }
    } catch { /* ignore */ }

    // Merge: localStorage overrides DB (latest user changes take priority)
    const merged: Record<string, unknown> = { ...mapped };
    for (const [key, value] of Object.entries(local)) {
      if (value !== undefined && value !== null) {
        merged[key] = value;
      }
    }

    // Update localStorage with merged result
    localStorage.setItem('fp_thermal_settings', JSON.stringify(merged));
    return buildConfig(merged);
  } catch {
    return getThermalSettings();
  }
}

/* ═══════════════════════════════════════════════════════════════
   Rich HTML Thermal Receipt Builder
   ═══════════════════════════════════════════════════════════════ */

export interface ThermalReceiptData {
  shopName: string;
  shopAddress: string;
  shopPhone: string;
  shopGst: string;
  shopGstState: string;
  showGst: boolean;
  invoiceNumber: string;
  date: string;
  orderType: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  items: { name: string; qty: number; rate: number; total: number }[];
  subtotal: number;
  cgst: number;
  sgst: number;
  gstRate: number;
  deliveryCharge: number;
  discountAmount: number;
  grandTotal: number;
  paidAmount: number;
  balanceAmount: number;
  paymentMethod: string;
  billStatus: string;
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function fmt(n: number): string {
  return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function buildRichThermalHtml(
  data: ThermalReceiptData,
  config: ThermalConfig,
  title: string,
): string {
  const {
    fontSize, lineHeight, textWeight, printQuality,
    paperPxWidth, paperWidth, showLogo, logo, alignment,
  } = config;

  const opacity = printQuality !== 1 ? printQuality : 1;
  const boldW = Math.min(textWeight + 200, 900);
  const smallFont = `${Math.max(7, (parseInt(fontSize) || 11) - 2)}px`;
  const headAlign = alignment === 'left' ? 'left' : 'center';

  // Logo at top, full width — use negative margins to break out of .r padding
  const logoHtml = showLogo && logo
    ? `<div style="margin:0 -8px 4px -8px;text-align:center;">
        <img src="${esc(logo)}" style="width:100%;max-width:${paperPxWidth}px;max-height:120px;object-fit:contain;display:block;" alt="Logo" />
       </div>`
    : '';

  // GST lines — ONLY show when showGst is explicitly true AND shopGst is non-empty
  // showGst must be the per-bill toggle (not from global settings)
  const gstLines = (data.showGst === true) && data.shopGst
    ? `<div style="font-size:${smallFont};opacity:0.7;margin-top:1px;">${esc('GSTIN: ' + data.shopGst)}</div>
       ${data.shopGstState ? `<div style="font-size:${smallFont};opacity:0.7;">${esc('State: ' + data.shopGstState)}</div>` : ''}`
    : '';

  // Customer info
  const custLines: string[] = [];
  if (data.customerName) custLines.push(`<div class="row"><span>Customer</span><span>${esc(data.customerName)}</span></div>`);
  if (data.customerPhone) custLines.push(`<div class="row"><span>Phone</span><span>${esc(data.customerPhone)}</span></div>`);
  if (data.customerAddress) custLines.push(`<div class="row"><span>Address</span><span>${esc(data.customerAddress)}</span></div>`);

  // Items
  const itemRows = data.items.map(item => {
    const name = item.name.length > 16 ? esc(item.name.substring(0, 16) + '..') : esc(item.name);
    return `<div class="item-row">
      <span class="in">${name}</span>
      <span class="iq">${item.qty}</span>
      <span class="ir">${fmt(item.rate)}</span>
      <span class="it">${fmt(item.total)}</span>
    </div>`;
  }).join('');

  // GST totals — only show when GST is explicitly enabled on this bill
  const gstRows = (data.showGst === true) && (data.cgst > 0 || data.sgst > 0)
    ? `<div class="row sub"><span>CGST ${data.gstRate / 2}%</span><span>${fmt(data.cgst)}</span></div>
       <div class="row sub"><span>SGST ${data.gstRate / 2}%</span><span>${fmt(data.sgst)}</span></div>`
    : '';

  const extraRows = [
    data.deliveryCharge > 0 ? `<div class="row sub"><span>Delivery</span><span>${fmt(data.deliveryCharge)}</span></div>` : '',
    data.discountAmount > 0 ? `<div class="row sub"><span>Discount</span><span>-${fmt(data.discountAmount)}</span></div>` : '',
  ].filter(Boolean).join('');

  // Payment rows
  const payRows: string[] = [];
  if (data.billStatus === 'Balance') {
    payRows.push(`<div class="row sub"><span>Paid</span><span>${fmt(data.paidAmount)}</span></div>`);
    payRows.push(`<div class="row sub"><span>Balance</span><span>${fmt(data.balanceAmount)}</span></div>`);
  }

  // Cut lines
  const cutLines = Array.from({ length: config.autoCutLines }, () => '<div style="height:12px;line-height:1">&nbsp;</div>').join('');

  return `<!DOCTYPE html>
<html><head><title>${esc(title)}</title>
<style>
  @page{size:${paperWidth} auto;margin:0;}
  *{box-sizing:border-box;margin:0;padding:0;}
  html,body{width:${paperWidth};margin:0;padding:0;background:#fff;}
  body{display:flex;justify-content:center;}
  .r{width:${paperPxWidth}px;margin:0 auto;padding:4px 8px;color:#000;background:#fff;
     font-family:'Courier New',Courier,monospace;font-size:${fontSize};
     line-height:${lineHeight};font-weight:${textWeight};
     ${opacity !== 1 ? `opacity:${opacity};` : ''}}
  .ct{text-align:${headAlign};}
  hr{border:none;border-top:1px dashed #888;margin:4px 0;}
  hr.h{border-top:1.5px dashed #555;margin:5px 0;}
  .row{display:flex;justify-content:space-between;padding:1px 0;}
  .itbl{width:100%;margin:3px 0;}
  .ih{display:flex;justify-content:space-between;font-weight:${boldW};
      border-bottom:1px solid #aaa;padding-bottom:2px;margin-bottom:1px;font-size:${smallFont};}
  .item-row{display:flex;justify-content:space-between;padding:0.5px 0;}
  .in{flex:1;overflow:hidden;white-space:nowrap;}
  .iq{width:24px;text-align:center;}
  .ir{width:52px;text-align:right;font-size:${smallFont};}
  .it{width:60px;text-align:right;font-weight:${boldW};}
  .sub{opacity:0.75;}
  .tot{font-weight:${boldW};font-size:${(parseInt(fontSize) || 11) + 1}px;}
  .ft{text-align:center;margin-top:4px;}
  .ftx{font-size:${smallFont};opacity:0.6;}
  @media print{
    html,body{width:${paperWidth};margin:0!important;padding:0!important;}
    body{display:block;}
    @page{margin:0;size:${paperWidth} auto;}
  }
</style></head><body>
<div class="r">
  ${logoHtml}
  <div class="ct">
    <div style="font-weight:${boldW};text-transform:uppercase;letter-spacing:0.5px;font-size:${(parseInt(fontSize) || 11) + 2}px;">
      ${esc(data.shopName || 'Eservices')}
    </div>
    ${data.shopAddress ? `<div style="font-size:${smallFont};opacity:0.65;margin-top:1px;">${esc(data.shopAddress)}</div>` : ''}
    ${data.shopPhone ? `<div style="font-size:${smallFont};opacity:0.65;">Ph: ${esc(data.shopPhone)}</div>` : ''}
    ${gstLines}
  </div>
  <hr class="h" />
  <div class="ct" style="font-weight:${boldW};font-size:${smallFont};letter-spacing:1px;margin-bottom:2px;">
    BILL / INVOICE
  </div>
  <hr class="h" />
  <div class="row"><span>Invoice No</span><span>${esc(data.invoiceNumber)}</span></div>
  <div class="row"><span>Date</span><span>${esc(data.date)}</span></div>
  <div class="row"><span>Type</span><span>${esc(data.orderType)}</span></div>
  ${custLines.join('')}
  <hr />
  <div class="itbl">
    <div class="ih"><span class="in">Item</span><span class="iq">Qty</span><span class="ir">Rate</span><span class="it">Amt</span></div>
    ${itemRows}
  </div>
  <hr />
  <div class="row"><span>Subtotal</span><span>${fmt(data.subtotal)}</span></div>
  ${gstRows}
  ${extraRows}
  <hr class="h" />
  <div class="row tot"><span>TOTAL</span><span>${fmt(data.grandTotal)}</span></div>
  <hr class="h" />
  ${payRows.join('')}
  ${payRows.length ? '<hr />' : ''}
  <div class="ft">
    <div class="ftx">Payment: ${esc(data.paymentMethod)} (${esc(data.billStatus)})</div>
    <div class="ftx" style="margin-top:3px;">Thank You!</div>
    <div class="ftx" style="font-size:${Math.max(6, (parseInt(fontSize) || 11) - 3)}px;opacity:0.4;">Visit Again :)</div>
  </div>
  <hr />
  ${cutLines}
</div>
</body></html>`;
}
