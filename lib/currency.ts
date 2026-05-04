import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

let _cache: Promise<string> | null = null

export function useCurrency(): string {
  const [currency, setCurrency] = useState('DH')
  useEffect(() => {
    if (!_cache) {
      _cache = Promise.resolve(
        createClient().from('settings').select('value').eq('key', 'currency').single()
      ).then(({ data }) => data?.value || 'DH').catch(() => 'DH')
    }
    _cache.then(setCurrency)
  }, [])
  return currency
}
