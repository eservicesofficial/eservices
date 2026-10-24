/**
 * Business Category Templates
 *
 * When a Super Admin selects a Business Category, the system auto-generates:
 * 1. Category-specific features (BusinessFeature rows)
 * 2. Custom item fields (CustomItemField rows)
 * 3. Category-specific settings defaults (already in sync.ts CATEGORY_DEFAULTS)
 *
 * This file defines the template for each of the 7 supported categories.
 */

// ====== TYPE DEFINITIONS ======

export interface FeatureTemplate {
  key: string;
  label: string;
  module: string; // "inventory" | "billing" | "restaurant" | "manufacturing" | "service" | "general"
  description: string;
}

export interface ItemFieldTemplate {
  key: string;
  label: string;
  fieldType: string; // "text" | "number" | "date" | "select" | "boolean"
  options?: string[]; // For select fields
  required: boolean;
  sortOrder: number;
}

export interface CategoryTemplate {
  value: string; // lowercase key: "bakery", "food", etc.
  label: string; // Display name
  icon: string; // Lucide icon name for UI
  prefix: string; // Client ID prefix: "BK", "FD", etc.
  color: string; // Tailwind color class
  description: string;
  features: FeatureTemplate[];
  itemFields: ItemFieldTemplate[];
}

// ====== CATEGORY TEMPLATES ======

export const CATEGORY_TEMPLATES: CategoryTemplate[] = [
  {
    value: 'bakery',
    label: 'Bakery / Sweets',
    icon: 'Cake',
    prefix: 'BK',
    color: 'amber',
    description: 'Perfect for bakeries, sweet shops, and confectionery businesses with weight-based selling and freshness tracking.',
    features: [
      { key: 'weightBasedSelling', label: 'Weight Based Selling (gram/kg)', module: 'inventory', description: 'Sell items by weight with gram/kg unit support' },
      { key: 'batchNumber', label: 'Batch Number', module: 'inventory', description: 'Track items by batch number for quality control' },
      { key: 'manufacturingDate', label: 'Manufacturing Date', module: 'inventory', description: 'Track when items were manufactured' },
      { key: 'expiryDate', label: 'Expiry Date', module: 'inventory', description: 'Track expiry dates and get alerts for expiring items' },
      { key: 'freshStockIndicator', label: 'Fresh Stock Indicator', module: 'inventory', description: 'Visual indicator for fresh vs aging stock' },
      { key: 'comboItemSupport', label: 'Combo Item Support', module: 'billing', description: 'Create combo packs and bundled items' },
      { key: 'festivalPricing', label: 'Festival / Seasonal Pricing', module: 'billing', description: 'Special pricing for festivals and seasons' },
      { key: 'dailyProductionReport', label: 'Daily Production Report', module: 'manufacturing', description: 'Track daily production output' },
      { key: 'ingredientCostTracking', label: 'Ingredient Cost Tracking', module: 'manufacturing', description: 'Track raw ingredient costs and margins' },
    ],
    itemFields: [
      { key: 'weight', label: 'Weight', fieldType: 'text', required: false, sortOrder: 1 },
      { key: 'unit', label: 'Unit', fieldType: 'select', options: ['gram', 'kg', 'piece', 'dozen', 'box'], required: false, sortOrder: 2 },
      { key: 'batchNo', label: 'Batch No', fieldType: 'text', required: false, sortOrder: 3 },
      { key: 'mfgDate', label: 'MFG Date', fieldType: 'date', required: false, sortOrder: 4 },
      { key: 'expDate', label: 'EXP Date', fieldType: 'date', required: false, sortOrder: 5 },
      { key: 'freshnessStatus', label: 'Freshness Status', fieldType: 'select', options: ['Fresh', 'Day Old', 'Expiring Soon', 'Expired'], required: false, sortOrder: 6 },
    ],
  },
  {
    value: 'food',
    label: 'Food / Restaurant',
    icon: 'UtensilsCrossed',
    prefix: 'FD',
    color: 'red',
    description: 'Complete restaurant management with dine-in, takeaway, delivery, kitchen orders, and table management.',
    features: [
      { key: 'dineInTakeawayDelivery', label: 'Dine-in / Takeaway / Delivery Mode', module: 'billing', description: 'Multiple order modes: dine-in, takeaway, delivery' },
      { key: 'tableManagement', label: 'Table Management', module: 'restaurant', description: 'Manage tables, sections, and seating' },
      { key: 'kot', label: 'Kitchen Order Ticket (KOT)', module: 'restaurant', description: 'Send orders directly to kitchen display/printer' },
      { key: 'waiterAssignment', label: 'Waiter Assignment', module: 'restaurant', description: 'Assign waiters to tables and orders' },
      { key: 'splitBill', label: 'Split Bill', module: 'billing', description: 'Split bills between multiple customers' },
      { key: 'itemCustomization', label: 'Item Customization (addons)', module: 'billing', description: 'Extra cheese, spice level, toppings and addons' },
      { key: 'liveOrderQueue', label: 'Live Order Queue', module: 'restaurant', description: 'Real-time order status queue display' },
      { key: 'tokenSystem', label: 'Token System', module: 'billing', description: 'Issue tokens for order pickup' },
      { key: 'orderStatusTracking', label: 'Order Status Tracking', module: 'restaurant', description: 'Track order from placement to delivery' },
    ],
    itemFields: [
      { key: 'preparationTime', label: 'Preparation Time', fieldType: 'text', required: false, sortOrder: 1 },
      { key: 'kitchenCategory', label: 'Kitchen Category', fieldType: 'select', options: ['Starters', 'Main Course', 'Side Dish', 'Dessert', 'Beverages', 'Specials'], required: false, sortOrder: 2 },
      { key: 'addonOptions', label: 'Addon Options', fieldType: 'text', required: false, sortOrder: 3 },
      { key: 'servingType', label: 'Serving Type', fieldType: 'select', options: ['Dine-in', 'Takeaway', 'Delivery', 'All'], required: false, sortOrder: 4 },
    ],
  },
  {
    value: 'clothing',
    label: 'Clothing / Tailor',
    icon: 'Scissors',
    prefix: 'CL',
    color: 'purple',
    description: 'Fashion retail and tailoring with size/color variants, measurements, stitching orders, and delivery tracking.',
    features: [
      { key: 'sizeVariants', label: 'Size Variants', module: 'inventory', description: 'Manage items in multiple sizes (S, M, L, XL, XXL)' },
      { key: 'colorVariants', label: 'Color Variants', module: 'inventory', description: 'Track items in different colors' },
      { key: 'barcodeByVariant', label: 'Barcode by Variant', module: 'inventory', description: 'Unique barcode for each size-color combination' },
      { key: 'alterationNotes', label: 'Alteration Notes', module: 'service', description: 'Track alteration requests and instructions' },
      { key: 'tailorMeasurement', label: 'Tailor Measurement Storage', module: 'service', description: 'Store customer body measurements' },
      { key: 'stitchingOrderManagement', label: 'Stitching Order Management', module: 'service', description: 'Manage stitching orders from booking to delivery' },
      { key: 'deliveryDateReminder', label: 'Delivery Date Reminder', module: 'service', description: 'Get reminders for upcoming delivery dates' },
      { key: 'trialOrderTracking', label: 'Trial Order Tracking', module: 'service', description: 'Track trial fittings and adjustments' },
    ],
    itemFields: [
      { key: 'size', label: 'Size', fieldType: 'select', options: ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', 'Free Size'], required: false, sortOrder: 1 },
      { key: 'color', label: 'Color', fieldType: 'text', required: false, sortOrder: 2 },
      { key: 'fabricType', label: 'Fabric Type', fieldType: 'select', options: ['Cotton', 'Silk', 'Polyester', 'Linen', 'Wool', 'Denim', 'Blend', 'Other'], required: false, sortOrder: 3 },
      { key: 'measurementNotes', label: 'Measurement Notes', fieldType: 'text', required: false, sortOrder: 4 },
      { key: 'deliveryDate', label: 'Delivery Date', fieldType: 'date', required: false, sortOrder: 5 },
    ],
  },
  {
    value: 'general',
    label: 'General / Retail',
    icon: 'ShoppingCart',
    prefix: 'GN',
    color: 'blue',
    description: 'General retail shop with barcode scanning, supplier management, loyalty points, and GST invoicing.',
    features: [
      { key: 'barcodeScanner', label: 'Barcode Scanner', module: 'inventory', description: 'Scan barcodes for quick billing and inventory' },
      { key: 'supplierManagement', label: 'Supplier Management', module: 'inventory', description: 'Manage suppliers and purchase orders' },
      { key: 'discountEngine', label: 'Discount Engine', module: 'billing', description: 'Flexible discount rules and promotions' },
      { key: 'loyaltyPoints', label: 'Loyalty Points', module: 'billing', description: 'Customer loyalty and reward points system' },
      { key: 'gstInvoice', label: 'GST Invoice', module: 'billing', description: 'Generate GST-compliant invoices' },
      { key: 'retailWholesalePricing', label: 'Retail / Wholesale Pricing', module: 'billing', description: 'Different pricing for retail and wholesale' },
      { key: 'inventoryAlerts', label: 'Inventory Alerts', module: 'inventory', description: 'Low stock alerts and reorder points' },
      { key: 'purchaseOrderTracking', label: 'Purchase Order Tracking', module: 'inventory', description: 'Track purchase orders from suppliers' },
    ],
    itemFields: [
      { key: 'sku', label: 'SKU', fieldType: 'text', required: false, sortOrder: 1 },
      { key: 'supplier', label: 'Supplier', fieldType: 'text', required: false, sortOrder: 2 },
      { key: 'mrp', label: 'MRP', fieldType: 'number', required: false, sortOrder: 3 },
      { key: 'costPrice', label: 'Cost Price', fieldType: 'number', required: false, sortOrder: 4 },
      { key: 'retailPrice', label: 'Retail Price', fieldType: 'number', required: false, sortOrder: 5 },
      { key: 'wholesalePrice', label: 'Wholesale Price', fieldType: 'number', required: false, sortOrder: 6 },
      { key: 'taxClass', label: 'Tax Class', fieldType: 'select', options: ['0%', '5%', '12%', '18%', '28%'], required: false, sortOrder: 7 },
    ],
  },
  {
    value: 'pharmacy',
    label: 'Pharmacy / Medical',
    icon: 'Pill',
    prefix: 'PH',
    color: 'emerald',
    description: 'Pharmacy management with batch tracking, expiry alerts, prescription handling, and generic substitute suggestions.',
    features: [
      { key: 'batchTracking', label: 'Batch Tracking', module: 'inventory', description: 'Track medicine batches with full traceability' },
      { key: 'expiryAlerts', label: 'Expiry Alerts', module: 'inventory', description: 'Get alerts for medicines nearing expiry' },
      { key: 'prescriptionUpload', label: 'Prescription Upload', module: 'billing', description: 'Upload and attach prescriptions to orders' },
      { key: 'saltCompositionSearch', label: 'Salt Composition Search', module: 'inventory', description: 'Search medicines by salt/composition' },
      { key: 'doctorReference', label: 'Doctor Reference', module: 'billing', description: 'Track prescribing doctor information' },
      { key: 'genericSubstitute', label: 'Generic Substitute Suggestion', module: 'inventory', description: 'Suggest generic alternatives for branded medicines' },
      { key: 'restrictedMedicineLock', label: 'Restricted Medicine Lock', module: 'inventory', description: 'Require prescription for restricted medicines' },
      { key: 'medicineScheduleTracking', label: 'Medicine Schedule Tracking', module: 'service', description: 'Track patient medication schedules' },
    ],
    itemFields: [
      { key: 'batchNo', label: 'Batch No', fieldType: 'text', required: false, sortOrder: 1 },
      { key: 'expiryDate', label: 'Expiry Date', fieldType: 'date', required: false, sortOrder: 2 },
      { key: 'composition', label: 'Composition', fieldType: 'text', required: false, sortOrder: 3 },
      { key: 'manufacturer', label: 'Manufacturer', fieldType: 'text', required: false, sortOrder: 4 },
      { key: 'prescriptionRequired', label: 'Prescription Required', fieldType: 'boolean', required: false, sortOrder: 5 },
    ],
  },
  {
    value: 'electronics',
    label: 'Electronics',
    icon: 'Cpu',
    prefix: 'EL',
    color: 'sky',
    description: 'Electronics store with serial/IMEI tracking, warranty management, installation booking, and AMC support.',
    features: [
      { key: 'serialImeiTracking', label: 'Serial / IMEI Tracking', module: 'inventory', description: 'Track individual units by serial or IMEI number' },
      { key: 'warrantyManagement', label: 'Warranty Management', module: 'service', description: 'Track warranty periods and claims' },
      { key: 'installationBooking', label: 'Installation Booking', module: 'service', description: 'Book installation appointments for sold products' },
      { key: 'serviceReminder', label: 'Service Reminder', module: 'service', description: 'Reminders for scheduled services and maintenance' },
      { key: 'amcManagement', label: 'AMC Management', module: 'service', description: 'Annual Maintenance Contract tracking' },
      { key: 'accessoryBundle', label: 'Accessory Bundle Selling', module: 'billing', description: 'Bundle accessories with main products' },
      { key: 'returnReplacementTracking', label: 'Return / Replacement Tracking', module: 'service', description: 'Track returns and replacements with status' },
    ],
    itemFields: [
      { key: 'serialNumber', label: 'Serial Number', fieldType: 'text', required: false, sortOrder: 1 },
      { key: 'imei', label: 'IMEI', fieldType: 'text', required: false, sortOrder: 2 },
      { key: 'warrantyPeriod', label: 'Warranty Period', fieldType: 'select', options: ['No Warranty', '3 Months', '6 Months', '1 Year', '2 Years', '3 Years', '5 Years', 'Lifetime'], required: false, sortOrder: 3 },
      { key: 'brand', label: 'Brand', fieldType: 'text', required: false, sortOrder: 4 },
      { key: 'model', label: 'Model', fieldType: 'text', required: false, sortOrder: 5 },
      { key: 'installationDate', label: 'Installation Date', fieldType: 'date', required: false, sortOrder: 6 },
    ],
  },
  {
    value: 'custom',
    label: 'Custom / Other',
    icon: 'Settings2',
    prefix: 'CU',
    color: 'gray',
    description: 'Fully customizable setup for unique business types. Add your own fields, workflows, and reports.',
    features: [
      { key: 'dynamicCustomFields', label: 'Dynamic Custom Fields', module: 'general', description: 'Add custom fields to items as needed' },
      { key: 'customWorkflow', label: 'Custom Workflow', module: 'general', description: 'Define custom business workflows' },
      { key: 'customInvoiceDesign', label: 'Custom Invoice Design', module: 'billing', description: 'Design invoices to match your brand' },
      { key: 'customPermissions', label: 'Custom Permissions', module: 'general', description: 'Define custom role-based permissions' },
      { key: 'customReports', label: 'Custom Reports', module: 'general', description: 'Create custom report templates' },
    ],
    itemFields: [
      { key: 'customField1', label: 'Custom Field 1', fieldType: 'text', required: false, sortOrder: 1 },
      { key: 'customField2', label: 'Custom Field 2', fieldType: 'text', required: false, sortOrder: 2 },
      { key: 'customField3', label: 'Custom Field 3', fieldType: 'text', required: false, sortOrder: 3 },
    ],
  },
];

// ====== HELPER FUNCTIONS ======

/**
 * Get a category template by its value (case-insensitive)
 */
export function getCategoryTemplate(value: string): CategoryTemplate | undefined {
  return CATEGORY_TEMPLATES.find((c) => c.value.toLowerCase() === value.toLowerCase());
}

/**
 * Get the category label for display
 */
export function getCategoryLabel(value: string): string {
  return getCategoryTemplate(value)?.label ?? value;
}

/**
 * Get the category prefix for client ID generation
 */
export function getCategoryPrefix(value: string): string {
  return getCategoryTemplate(value)?.prefix ?? 'CU';
}

/**
 * Get the category icon name
 */
export function getCategoryIcon(value: string): string {
  return getCategoryTemplate(value)?.icon ?? 'Building2';
}

/**
 * Get the category color
 */
export function getCategoryColor(value: string): string {
  return getCategoryTemplate(value)?.color ?? 'gray';
}

/**
 * Get features for a specific category
 */
export function getCategoryFeatures(value: string): FeatureTemplate[] {
  return getCategoryTemplate(value)?.features ?? [];
}

/**
 * Get item fields for a specific category
 */
export function getCategoryItemFields(value: string): ItemFieldTemplate[] {
  return getCategoryTemplate(value)?.itemFields ?? [];
}

/**
 * Get all category values (for dropdowns)
 */
export function getCategoryValues(): { value: string; label: string; prefix: string; icon: string; color: string }[] {
  return CATEGORY_TEMPLATES.map((c) => ({
    value: c.value,
    label: c.label,
    prefix: c.prefix,
    icon: c.icon,
    color: c.color,
  }));
}
