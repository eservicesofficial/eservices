/**
 * Auto-Sync Utility — Keeps all IDs, Settings, and Business data permanently in sync
 *
 * This module ensures:
 * 1. Every Unit has a corresponding Settings record (auto-created with synced data)
 * 2. Unit business details (name, address, phone, email, gstNumber) are always mirrored in Settings
 * 3. IdCounter entries exist for all category prefixes
 * 4. SuperAdmin is always seeded with default credentials
 * 5. Default settings are applied based on business category
 */

import { db } from './db';
import { hashPassword } from './auth';
import { getCategoryTemplate } from './category-templates';

// ====== DEFAULT SUPER ADMIN CREDENTIALS ======
export const DEFAULT_SUPER_ADMIN = {
  email: 'jiotechnologist@gmail.com',
  password: '741504',
  name: 'Sarkar',
  securityQuestion: 'What is your name?',
  securityAnswer: 'sarkar',
};

// ====== CATEGORY PREFIXES (Client ID generation) ======
export const CATEGORY_PREFIXES: Record<string, string> = {
  bakery: 'BK',
  food: 'FD',
  clothing: 'CL',
  general: 'GN',
  pharmacy: 'PH',
  electronics: 'EL',
  custom: 'CU',
};

// ====== DEFAULT SETTINGS PER CATEGORY ======
const CATEGORY_DEFAULTS: Record<string, {
  enableGst?: boolean;
  gstRate?: number;
  gstFullMode?: boolean;
  gstSimpleMode?: boolean;
  enableDelivery?: boolean;
  deliveryCharge?: number;
  billAutoGenerate?: boolean;
  billPrefix?: string;
  billStartNumber?: number;
}> = {
  bakery: {
    enableGst: true,
    gstRate: 5,
    gstSimpleMode: true,
    enableDelivery: true,
    deliveryCharge: 20,
    billAutoGenerate: true,
    billPrefix: 'BK',
    billStartNumber: 1001,
  },
  food: {
    enableGst: true,
    gstRate: 5,
    gstSimpleMode: true,
    enableDelivery: true,
    deliveryCharge: 30,
    billAutoGenerate: true,
    billPrefix: 'FD',
    billStartNumber: 1001,
  },
  clothing: {
    enableGst: true,
    gstRate: 18,
    gstFullMode: true,
    enableDelivery: false,
    deliveryCharge: 0,
    billAutoGenerate: true,
    billPrefix: 'CL',
    billStartNumber: 1001,
  },
  general: {
    enableGst: true,
    gstRate: 18,
    gstSimpleMode: true,
    enableDelivery: false,
    deliveryCharge: 0,
    billAutoGenerate: true,
    billPrefix: 'GN',
    billStartNumber: 1001,
  },
  pharmacy: {
    enableGst: true,
    gstRate: 12,
    gstSimpleMode: true,
    enableDelivery: true,
    deliveryCharge: 25,
    billAutoGenerate: true,
    billPrefix: 'PH',
    billStartNumber: 1001,
  },
  electronics: {
    enableGst: true,
    gstRate: 18,
    gstFullMode: true,
    enableDelivery: true,
    deliveryCharge: 50,
    billAutoGenerate: true,
    billPrefix: 'EL',
    billStartNumber: 1001,
  },
  custom: {
    enableGst: false,
    gstRate: 18,
    gstSimpleMode: true,
    enableDelivery: false,
    deliveryCharge: 0,
    billAutoGenerate: true,
    billPrefix: 'CU',
    billStartNumber: 1001,
  },
};

/**
 * Get category-specific default settings
 */
export function getCategoryDefaults(category: string) {
  return CATEGORY_DEFAULTS[category.toLowerCase()] || CATEGORY_DEFAULTS.custom;
}

/**
 * Ensure SuperAdmin exists in the database.
 * Called on app startup. Only creates if none exists.
 */
export async function ensureSuperAdmin(): Promise<{ created: boolean; email: string }> {
  const count = await db.superAdmin.count();
  if (count === 0) {
    const hashedPassword = await hashPassword(DEFAULT_SUPER_ADMIN.password);
    await db.superAdmin.create({
      data: {
        email: DEFAULT_SUPER_ADMIN.email,
        password: hashedPassword,
        name: DEFAULT_SUPER_ADMIN.name,
        securityQuestion: DEFAULT_SUPER_ADMIN.securityQuestion,
        securityAnswer: DEFAULT_SUPER_ADMIN.securityAnswer,
        isActive: true,
      },
    });
    console.log('[Sync] Default SuperAdmin created:', DEFAULT_SUPER_ADMIN.email);
    return { created: true, email: DEFAULT_SUPER_ADMIN.email };
  }
  return { created: false, email: '' };
}

/**
 * Ensure all IdCounter entries exist for every category prefix.
 * Called on app startup. Only creates missing counters.
 */
export async function ensureIdCounters(): Promise<string[]> {
  const created: string[] = [];
  for (const prefix of Object.values(CATEGORY_PREFIXES)) {
    const existing = await db.idCounter.findUnique({ where: { prefix } });
    if (!existing) {
      await db.idCounter.create({ data: { prefix, lastNumber: 0 } });
      created.push(prefix);
      console.log(`[Sync] IdCounter created: ${prefix}`);
    }
  }
  return created;
}

/**
 * Ensure every Unit has a corresponding Settings record.
 * ONLY creates missing Settings — does NOT overwrite existing user data.
 * 
 * IMPORTANT: When recreating a missing Settings row, we do NOT apply
 * category defaults (e.g., gstRate, billPrefix). Category defaults are
 * only applied at business CREATION time (POST /api/super-admin/businesses).
 * If a Settings row goes missing and gets recreated here, we use only
 * the Unit's business identity data (name, address, phone, email, gstNumber)
 * and let Prisma schema defaults handle the rest. This prevents the bug
 * where custom settings get overwritten with category defaults every time
 * the login page loads and triggers /api/init.
 */
export async function ensureSettingsSync(): Promise<{ created: number; synced: number }> {
  let created = 0;
  const synced = 0; // No longer doing bidirectional sync to prevent data revert

  const units = await db.unit.findMany();
  for (const unit of units) {
    const existingSettings = await db.settings.findUnique({ where: { unitCode: unit.code } });

    if (!existingSettings) {
      // Create Settings using Unit business data + Prisma schema defaults only.
      // Do NOT apply categoryDefaults here — those are only for business creation time.
      // This prevents custom settings from being overwritten with defaults.
      await db.settings.create({
        data: {
          unitCode: unit.code,
          shopName: unit.name,
          shopAddress: unit.address || '',
          shopPhone: unit.phone || '',
          shopEmail: unit.email || '',
          gstNumber: unit.gstNumber || '',
        },
      });
      created++;
      console.log(`[Sync] Settings created for unit: ${unit.code} (${unit.name})`);
    }
    // NOTE: We NO LONGER sync existing Settings back to Unit or vice versa.
    // That is handled by the API endpoints when data is explicitly saved.
  }

  return { created, synced };
}

/**
 * Ensure every Unit has category features and custom item fields.
 * Creates missing entries AND removes features that belong to a different category
 * (e.g., if category was changed from GENERAL to FOOD, removes GENERAL features
 * and adds FOOD features).
 *
 * This runs on app startup to auto-provision businesses and fix category mismatches.
 */
export async function ensureCategoryFeatures(): Promise<{ featuresCreated: number; fieldsCreated: number; featuresRemoved: number; fieldsRemoved: number }> {
  let featuresCreated = 0;
  let fieldsCreated = 0;
  let featuresRemoved = 0;
  let fieldsRemoved = 0;

  // Build a master map of all feature keys per category template
  const categoryFeatureKeys: Record<string, Set<string>> = {};
  const categoryFieldKeys: Record<string, Set<string>> = {};
  for (const tmpl of (await import('./category-templates')).CATEGORY_TEMPLATES) {
    categoryFeatureKeys[tmpl.value.toLowerCase()] = new Set(tmpl.features.map((f) => f.key));
    categoryFieldKeys[tmpl.value.toLowerCase()] = new Set(tmpl.itemFields.map((f) => f.key));
  }

  const units = await db.unit.findMany();
  for (const unit of units) {
    const category = unit.category?.toLowerCase();
    if (!category) continue;

    const template = getCategoryTemplate(category);
    if (!template) continue;

    const validFeatureKeys = categoryFeatureKeys[category] || new Set<string>();
    const validFieldKeys = categoryFieldKeys[category] || new Set<string>();

    // Get existing features for this unit
    const existingFeatures = await db.businessFeature.findMany({ where: { unitCode: unit.code } });
    const existingFeatureKeys = new Set(existingFeatures.map((f) => f.key));

    // Remove features that don't belong to this category (category was likely changed)
    const wrongFeatures = existingFeatures.filter((f) => !validFeatureKeys.has(f.key));
    if (wrongFeatures.length > 0) {
      await db.businessFeature.deleteMany({
        where: {
          unitCode: unit.code,
          key: { in: wrongFeatures.map((f) => f.key) },
        },
      });
      featuresRemoved += wrongFeatures.length;
      console.log(`[Sync] Removed ${wrongFeatures.length} wrong-category features from ${unit.code}: ${wrongFeatures.map(f => f.key).join(', ')}`);
    }

    // Create missing features from template
    const missingFeatures = template.features.filter((f) => !existingFeatureKeys.has(f.key));
    if (missingFeatures.length > 0) {
      await db.businessFeature.createMany({
        data: missingFeatures.map((f) => ({
          unitCode: unit.code,
          key: f.key,
          label: f.label,
          module: f.module,
          description: f.description,
          enabled: true,
        })),
      });
      featuresCreated += missingFeatures.length;
    }

    // Get existing custom fields for this unit
    const existingFields = await db.customItemField.findMany({ where: { unitCode: unit.code } });
    const existingFieldKeys = new Set(existingFields.map((f) => f.key));

    // Remove custom fields that don't belong to this category
    const wrongFields = existingFields.filter((f) => !validFieldKeys.has(f.key));
    if (wrongFields.length > 0) {
      await db.customItemField.deleteMany({
        where: {
          unitCode: unit.code,
          key: { in: wrongFields.map((f) => f.key) },
        },
      });
      fieldsRemoved += wrongFields.length;
      console.log(`[Sync] Removed ${wrongFields.length} wrong-category fields from ${unit.code}: ${wrongFields.map(f => f.key).join(', ')}`);
    }

    // Create missing custom fields
    const missingFields = template.itemFields.filter((f) => !existingFieldKeys.has(f.key));
    if (missingFields.length > 0) {
      await db.customItemField.createMany({
        data: missingFields.map((f) => ({
          unitCode: unit.code,
          key: f.key,
          label: f.label,
          fieldType: f.fieldType,
          options: JSON.stringify(f.options ?? []),
          required: f.required,
          sortOrder: f.sortOrder,
          visible: true,
        })),
      });
      fieldsCreated += missingFields.length;
    }
  }

  if (featuresCreated > 0 || fieldsCreated > 0 || featuresRemoved > 0 || fieldsRemoved > 0) {
    console.log(`[Sync] Category features auto-provisioned: +${featuresCreated} features, +${fieldsCreated} fields, -${featuresRemoved} features, -${fieldsRemoved} fields`);
  }

  return { featuresCreated, fieldsCreated, featuresRemoved, fieldsRemoved };
}

/**
 * Full initialization — run on app startup.
 * Ensures SuperAdmin, IdCounters, Settings, and Category Features are all properly set up.
 */
export async function fullSync(): Promise<{
  superAdmin: { created: boolean; email: string };
  idCounters: string[];
  settings: { created: number; synced: number };
  categoryFeatures: { featuresCreated: number; fieldsCreated: number; featuresRemoved: number; fieldsRemoved: number };
}> {
  console.log('[Sync] Running full auto-sync...');

  const superAdmin = await ensureSuperAdmin();
  const idCounters = await ensureIdCounters();
  const settings = await ensureSettingsSync();
  const categoryFeatures = await ensureCategoryFeatures();

  console.log(`[Sync] Complete — SA: ${superAdmin.created ? 'created' : 'exists'}, Counters: ${idCounters.length} new, Settings: ${settings.created} created, ${settings.synced} synced, Features: +${categoryFeatures.featuresCreated}/-${categoryFeatures.featuresRemoved}, Fields: +${categoryFeatures.fieldsCreated}/-${categoryFeatures.fieldsRemoved}`);

  return { superAdmin, idCounters, settings, categoryFeatures };
}
