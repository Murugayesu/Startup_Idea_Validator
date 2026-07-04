import { useEffect, useState, useCallback } from 'react'
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

    if (runData) setStatus(runData.status as RunStatus)
    setIsLoading(false)
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
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(eventsChannel)
      supabase.removeChannel(runChannel)
    }
  }, [runId, fetchInitialData])

  return { events, status, isLoading }
}
