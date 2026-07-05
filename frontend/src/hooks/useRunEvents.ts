import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'

export interface RunEvent {
  id: string
  run_id: string
  agent_name: string | null
  event_type: string
  message: string | null
  created_at: string
}

export type RunStatus = 'pending' | 'running' | 'complete' | 'failed'

interface UseRunEventsReturn {
  events: RunEvent[]
  status: RunStatus | null
  isLoading: boolean
}

export function useRunEvents(runId: string | null): UseRunEventsReturn {
  const [events, setEvents] = useState<RunEvent[]>([])
  const [status, setStatus] = useState<RunStatus | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const lastUpdateRef = useRef<number>(Date.now())

  const fetchInitialData = useCallback(async () => {
    if (!runId) return
    setIsLoading(true)

    // Fetch existing events
    const { data: eventsData } = await supabase
      .from('run_events')
      .select('*')
      .eq('run_id', runId)
      .order('created_at', { ascending: true })

    if (eventsData) setEvents(eventsData)

    // Fetch current run status
    const { data: runData } = await supabase
      .from('validation_runs')
      .select('status')
      .eq('id', runId)
      .single()

    if (runData) {
      setStatus(runData.status as RunStatus)
      lastUpdateRef.current = Date.now()
    }
    setIsLoading(false)
  }, [runId])

  // Silent poll — does NOT set isLoading so the UI doesn't flash
  const pollStatus = useCallback(async () => {
    if (!runId) return
    const [{ data: runData }, { data: eventsData }] = await Promise.all([
      supabase.from('validation_runs').select('status').eq('id', runId).single(),
      supabase.from('run_events').select('*').eq('run_id', runId).order('created_at', { ascending: true }),
    ])
    if (runData?.status) {
      setStatus(runData.status as RunStatus)
      lastUpdateRef.current = Date.now()
    }
    if (eventsData) setEvents(eventsData)
  }, [runId])


  useEffect(() => {
    if (!runId) return

    fetchInitialData()

    // Subscribe to new run_events rows via Supabase Realtime
    const eventsChannel = supabase
      .channel(`run-events-${runId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'run_events',
          filter: `run_id=eq.${runId}`,
        },
        (payload) => {
          setEvents((prev) => [...prev, payload.new as RunEvent])
          lastUpdateRef.current = Date.now()
        }
      )
      .subscribe()

    // Subscribe to validation_runs status changes
    const runChannel = supabase
      .channel(`run-status-${runId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'validation_runs',
          filter: `id=eq.${runId}`,
        },
        (payload) => {
          if (payload.new?.status) {
            setStatus(payload.new.status as RunStatus)
            lastUpdateRef.current = Date.now()
          }
        }
      )
      .subscribe()

    // Polling fallback — kicks in if no Realtime update received in >5 s
    const interval = setInterval(() => {
      if (
        (status === 'pending' || status === 'running') &&
        Date.now() - lastUpdateRef.current > 5000
      ) {
        pollStatus()
      }
    }, 5000)

    return () => {
      supabase.removeChannel(eventsChannel)
      supabase.removeChannel(runChannel)
      clearInterval(interval)
    }
  }, [runId, fetchInitialData, pollStatus, status])

  return { events, status, isLoading }
}
