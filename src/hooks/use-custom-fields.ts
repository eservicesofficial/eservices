/**
 * useCustomFields hook — Get custom item fields for the current business
 *
 * Usage:
 *   const { fields, loading } = useCustomFields();
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/components/auth-provider';

export interface CustomFieldData {
  id: string;
  key: string;
  label: string;
  fieldType: string;
  options: string[];
  required: boolean;
  visible: boolean;
  sortOrder: number;
}

interface CustomFieldsState {
  fields: CustomFieldData[];
  loading: boolean;
  refresh: () => void;
}

export function useCustomFields(): CustomFieldsState {
  const { token, isAuthenticated } = useAuth();
  const [fields, setFields] = useState<CustomFieldData[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchFields = useCallback(async () => {
    if (!token || !isAuthenticated) {
      setFields([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/custom-fields', {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      if (res.ok) {
        const data = await res.json();
        setFields(data.fields || []);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [token, isAuthenticated]);

  useEffect(() => { fetchFields(); }, [fetchFields]);

  return { fields, loading, refresh: fetchFields };
}
