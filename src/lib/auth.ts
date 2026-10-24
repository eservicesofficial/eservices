import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';
import { db } from './db';
import { CATEGORY_PREFIXES } from './sync';

const JWT_SECRET = process.env.JWT_SECRET || 'eservices-pos-multi-unit-secret-key-2024';
if (!process.env.JWT_SECRET) console.warn('[AUTH] WARNING: Using default JWT_SECRET. Set JWT_SECRET env var in production!');
const secret = new TextEncoder().encode(JWT_SECRET);

const SUPER_ADMIN_JWT_SECRET = process.env.SUPER_ADMIN_JWT_SECRET || 'eservices-pos-super-admin-secret-key-2024';
if (!process.env.SUPER_ADMIN_JWT_SECRET) console.warn('[AUTH] WARNING: Using default SUPER_ADMIN_JWT_SECRET. Set SUPER_ADMIN_JWT_SECRET env var in production!');
const superAdminSecret = new TextEncoder().encode(SUPER_ADMIN_JWT_SECRET);

export interface AuthSession {
  unitCode: string;
  unitName: string;
  userId: string;
  loginId: string;
  name: string;
  role: string;
  permissions: Record<string, Record<string, boolean>>;
  mustChangePassword?: boolean;
  isSuperAdmin?: boolean;
}

export interface SuperAdminSession {
  id: string;
  email: string;
  name: string;
  isSuperAdmin: true;
}

export interface Permissions {
  billing: { access: boolean; create: boolean; edit: boolean; delete: boolean };
  reports: { access: boolean; export: boolean };
  inventory: { access: boolean; create: boolean; edit: boolean; delete: boolean };
  cashManager: { access: boolean; create: boolean; edit: boolean; delete: boolean };
  khata: { access: boolean; create: boolean; edit: boolean; delete: boolean };
  customerFolio: { access: boolean; create: boolean; edit: boolean; delete: boolean; forceEdit: boolean; reopenFolio: boolean; removeTransaction: boolean; transferOperation: boolean; checkout: boolean; settlement: boolean; discount: boolean; refund: boolean; viewHistory: boolean; reports: boolean; manageDocuments: boolean; deleteDocuments: boolean };
  staff: { access: boolean; create: boolean; edit: boolean; delete: boolean };
  calculator: { access: boolean };
  settings: { access: boolean; edit: boolean; userManagement: boolean };
  auditLogs: { access: boolean };
}

// Default permissions for each role
export const ROLE_PERMISSIONS: Record<string, Permissions> = {
  Admin: {
    billing: { access: true, create: true, edit: true, delete: true },
    reports: { access: true, export: true },
    inventory: { access: true, create: true, edit: true, delete: true },
    cashManager: { access: true, create: true, edit: true, delete: true },
    khata: { access: true, create: true, edit: true, delete: true },
    customerFolio: { access: true, create: true, edit: true, delete: true, forceEdit: true, reopenFolio: true, removeTransaction: true, transferOperation: true, checkout: true, settlement: true, discount: true, refund: true, viewHistory: true, reports: true, manageDocuments: true, deleteDocuments: true },
    staff: { access: true, create: true, edit: true, delete: true },
    calculator: { access: true },
    settings: { access: true, edit: true, userManagement: true },
    auditLogs: { access: true },
  },
  Manager: {
    billing: { access: true, create: true, edit: true, delete: false },
    reports: { access: true, export: true },
    inventory: { access: true, create: true, edit: true, delete: false },
    cashManager: { access: true, create: true, edit: true, delete: false },
    khata: { access: true, create: true, edit: true, delete: false },
    customerFolio: { access: true, create: true, edit: true, delete: false, forceEdit: false, reopenFolio: true, removeTransaction: false, transferOperation: true, checkout: true, settlement: true, discount: true, refund: true, viewHistory: true, reports: true, manageDocuments: true, deleteDocuments: false },
    staff: { access: true, create: true, edit: true, delete: false },
    calculator: { access: true },
    settings: { access: false, edit: false, userManagement: false },
    auditLogs: { access: false },
  },
  Cashier: {
    billing: { access: true, create: true, edit: true, delete: false },
    reports: { access: false, export: false },
    inventory: { access: true, create: false, edit: false, delete: false },
    cashManager: { access: false, create: false, edit: false, delete: false },
    khata: { access: false, create: false, edit: false, delete: false },
    customerFolio: { access: true, create: true, edit: true, delete: false, forceEdit: false, reopenFolio: false, removeTransaction: false, transferOperation: false, checkout: false, settlement: true, discount: false, refund: false, viewHistory: true, reports: false, manageDocuments: true, deleteDocuments: false },
    staff: { access: false, create: false, edit: false, delete: false },
    calculator: { access: true },
    settings: { access: false, edit: false, userManagement: false },
    auditLogs: { access: false },
  },
  Staff: {
    billing: { access: true, create: false, edit: false, delete: false },
    reports: { access: false, export: false },
    inventory: { access: false, create: false, edit: false, delete: false },
    cashManager: { access: false, create: false, edit: false, delete: false },
    khata: { access: false, create: false, edit: false, delete: false },
    customerFolio: { access: true, create: true, edit: false, delete: false, forceEdit: false, reopenFolio: false, removeTransaction: false, transferOperation: false, checkout: false, settlement: true, discount: false, refund: false, viewHistory: false, reports: false, manageDocuments: false, deleteDocuments: false },
    staff: { access: false, create: false, edit: false, delete: false },
    calculator: { access: true },
    settings: { access: false, edit: false, userManagement: false },
    auditLogs: { access: false },
  },
};

export async function createToken(session: AuthSession): Promise<string> {
  const payload: Record<string, unknown> = {
    unitCode: session.unitCode,
    unitName: session.unitName,
    userId: session.userId,
    loginId: session.loginId,
    name: session.name,
    role: session.role,
    permissions: session.permissions,
  };
  if (session.mustChangePassword !== undefined) {
    payload.mustChangePassword = session.mustChangePassword;
  }
  if (session.isSuperAdmin !== undefined) {
    payload.isSuperAdmin = session.isSuperAdmin;
  }
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('24h')
    .sign(secret);
}

export async function verifyToken(token: string): Promise<AuthSession | null> {
  try {
    const { payload } = await jwtVerify(token, secret);
    return {
      unitCode: payload.unitCode as string,
      unitName: payload.unitName as string,
      userId: payload.userId as string,
      loginId: payload.loginId as string,
      name: payload.name as string,
      role: payload.role as string,
      permissions: (payload.permissions || {}) as Record<string, Record<string, boolean>>,
      mustChangePassword: payload.mustChangePassword as boolean | undefined,
      isSuperAdmin: payload.isSuperAdmin as boolean | undefined,
    };
  } catch {
    return null;
  }
}

export async function getSessionFromRequest(request: Request): Promise<AuthSession | null> {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);

  // Try regular user token first
  const session = await verifyToken(token);
  if (session) return session;

  // Fall back to SuperAdmin token
  const sa = await verifySuperAdminToken(token);
  if (sa) {
    // Create a pseudo-session from SA data with full admin permissions
    return {
      unitCode: 'SUPER',
      unitName: 'System',
      userId: sa.id,
      loginId: sa.email,
      name: sa.name,
      role: 'Admin',
      permissions: {},
      isSuperAdmin: true,
    };
  }

  return null;
}

// ====== SUPER ADMIN TOKEN FUNCTIONS ======

export async function createSuperAdminToken(session: SuperAdminSession): Promise<string> {
  return new SignJWT({
    id: session.id,
    email: session.email,
    name: session.name,
    isSuperAdmin: true,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('24h')
    .sign(superAdminSecret);
}

export async function verifySuperAdminToken(token: string): Promise<SuperAdminSession | null> {
  try {
    const { payload } = await jwtVerify(token, superAdminSecret);
    if (payload.isSuperAdmin !== true) return null;
    return {
      id: payload.id as string,
      email: payload.email as string,
      name: payload.name as string,
      isSuperAdmin: true,
    };
  } catch {
    return null;
  }
}

export async function getSuperAdminFromRequest(request: Request): Promise<SuperAdminSession | null> {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);
  return verifySuperAdminToken(token);
}

// ====== CLIENT ID GENERATION ======

export async function generateClientCode(category: string): Promise<string> {
  const prefix = CATEGORY_PREFIXES[category.toLowerCase()] || 'CU';

  // Use a transaction to atomically increment the counter
  const result = await db.$transaction(async (tx) => {
    // Find or create the IdCounter for this prefix
    let counter = await tx.idCounter.findUnique({
      where: { prefix },
    });

    if (!counter) {
      counter = await tx.idCounter.create({
        data: { prefix, lastNumber: 0 },
      });
    }

    // Increment lastNumber
    const updated = await tx.idCounter.update({
      where: { prefix },
      data: { lastNumber: counter.lastNumber + 1 },
    });

    // Format: prefix + 3-digit zero-padded number
    const code = prefix + String(updated.lastNumber).padStart(3, '0');
    return code;
  });

  return result;
}

// Check if user has a specific permission
export function hasPermission(
  permissions: Record<string, Record<string, boolean>>,
  module: string,
  action: string
): boolean {
  const mod = permissions[module];
  if (!mod) return false;
  return mod[action] === true;
}

// Check if session has a specific permission (Admin and SuperAdmin always pass)
export function sessionHasPermission(session: AuthSession, module: string, action: string): boolean {
  if (session.role === 'Admin') return true;
  if (session.isSuperAdmin) return true;
  return hasPermission(session.permissions, module, action);
}

// Get fresh permissions from DB for a user (real-time, ignores JWT)
// Returns the permissions object, or the role defaults if not found
export async function getFreshPermissions(userId: string): Promise<Record<string, Record<string, boolean>>> {
  try {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { permissions: true, role: true },
    });
    if (!user) return {};
    let perms: Record<string, Record<string, boolean>> = {};
    try {
      perms = JSON.parse(user.permissions || '{}') as Record<string, Record<string, boolean>>;
    } catch {
      perms = {};
    }
    if (Object.keys(perms).length === 0 && user.role) {
      perms = (ROLE_PERMISSIONS[user.role as keyof typeof ROLE_PERMISSIONS] || {}) as unknown as Record<string, Record<string, boolean>>;
    }
    return perms;
  } catch {
    return {};
  }
}

// Check if user has a specific permission using DB (real-time check, not JWT)
// Use this for permission-gated operations to ensure latest permissions are used
export async function hasPermissionFromDB(userId: string, role: string, module: string, action: string): Promise<boolean> {
  if (role === 'Admin') return true;
  const perms = await getFreshPermissions(userId);
  return hasPermission(perms, module, action);
}

// Check if user is Admin
export function isAdmin(role: string): boolean {
  return role === 'Admin';
}

// Check if user is Manager or Admin
export function isAdminOrManager(role: string): boolean {
  return role === 'Admin' || role === 'Manager';
}

// Role hierarchy levels (higher number = more authority)
export const ROLE_LEVELS: Record<string, number> = {
  Admin: 4,
  Manager: 3,
  Cashier: 2,
  Staff: 1,
};

// Check if actor can modify target's system (role, permissions, status)
// Only higher role can modify lower role's system
export function canModifySystem(actorRole: string, targetRole: string): boolean {
  const actorLevel = ROLE_LEVELS[actorRole] || 0;
  const targetLevel = ROLE_LEVELS[targetRole] || 0;
  return actorLevel > targetLevel;
}

// Check if actor can reset target's password without old password
// Admin can reset anyone's, Manager can reset Cashier/Staff only (not Admin)
export function canResetPassword(actorRole: string, targetRole: string): boolean {
  if (actorRole === 'Admin') return true;
  if (actorRole === 'Manager') return (ROLE_LEVELS[targetRole] || 0) < ROLE_LEVELS['Manager'];
  return false;
}

// Log an action to AuditLog
export async function logAction(
  unitCode: string,
  userId: string,
  userName: string,
  role: string,
  action: string,
  target: string = '',
  details: Record<string, unknown> = {},
  request?: Request
): Promise<void> {
  try {
    let ipAddress = '';
    if (request) {
      const forwarded = request.headers.get('x-forwarded-for');
      ipAddress = forwarded?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || '';
    }

    await db.auditLog.create({
      data: {
        unitCode,
        userId,
        userName,
        role,
        action,
        target,
        details: JSON.stringify(details),
        ipAddress,
      },
    });
  } catch {
    // Audit logging should never break the main flow
    console.error('Failed to write audit log');
  }
}

// Get client IP from request
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  return forwarded?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || '';
}

// Hash password using bcryptjs (works in both Node.js and Bun)
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

// Verify password
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
