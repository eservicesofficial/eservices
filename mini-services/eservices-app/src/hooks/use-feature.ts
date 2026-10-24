/**
 * useFeature hook — Check if a business feature is enabled
 *
 * Usage:
 *   const { isFeatureEnabled, features, loading } = useFeature();
 *   if (isFeatureEnabled('weightBasedSelling')) { ... }
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/components/auth-provider';

interface FeatureData {
  id: string;
  key: string;
  label: string;
  module: string;
  description: string;
  enabled: boolean;
}

interface FeatureState {
  features: FeatureData[];
  featureMap: Record<string, boolean>;
  grouped: Record<string, FeatureData[]>;
  category: string;
  loading: boolean;
  refresh: () => void;
  isFeatureEnabled: (key: string) => boolean;
}

export function useFeature(): FeatureState {
  const { token, isAuthenticated } = useAuth();
  const [features, setFeatures] = useState<FeatureData[]>([]);
  const [featureMap, setFeatureMap] = useState<Record<string, boolean>>({});
  const [grouped, setGrouped] = useState<Record<string, FeatureData[]>>({});
  const [category, setCategory] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchFeatures = useCallback(async () => {
    if (!token || !isAuthenticated) {
      setFeatures([]);
      setFeatureMap({});
      setGrouped({});
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/features', {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      if (res.ok) {
        const data = await res.json();
        setFeatures(data.features || []);
        setFeatureMap(data.featureMap || {});
        setGrouped(data.grouped || {});
        setCategory(data.category || '');
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [token, isAuthenticated]);

  useEffect(() => { fetchFeatures(); }, [fetchFeatures]);

  const isFeatureEnabled = useCallback((key: string): boolean => {
    return featureMap[key] === true;
  }, [featureMap]);

  return { features, featureMap, grouped, category, loading, refresh: fetchFeatures, isFeatureEnabled };
}
