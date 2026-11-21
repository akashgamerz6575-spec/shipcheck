import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ShipCheckExperiment,
  getOrCreateVisitorId,
  hasEnvKey,
  readPreviewOverride,
  regenerateVisitorId,
  type SdkStatus,
  type Variant,
  type VariantSource,
} from './flagsmith'

export interface ExperimentHook {
  visitorId: string
  sdkStatus: SdkStatus
  variant: Variant
  source: VariantSource
  exposureRecorded: boolean
  exposureTimestamp: string | null
  inExperiment: boolean
  conversionRecorded: boolean
  conversionSent: boolean
  conversionTimestamp: string | null
  hasKey: boolean
  previewOverride: boolean
  evaluateScan: () => Promise<void>
  trackAction: (action: string, repo: string) => Promise<void>
  resetVisitor: () => void
}

/**
 * React binding for the Flagsmith experiment. Keeps the SDK client outside of
 * render, and exposes the exact telemetry the Inspector drawer displays.
 */
export function useShipCheckExperiment(): ExperimentHook {
  const [visitorId] = useState<string>(() => getOrCreateVisitorId())
  const [sdkStatus, setSdkStatus] = useState<SdkStatus>('loading')
  const [variant, setVariant] = useState<Variant>(() => readPreviewOverride() ?? 'control')
  const [source, setSource] = useState<VariantSource>(() =>
    readPreviewOverride() ? 'preview' : 'fallback',
  )
  const [exposureRecorded, setExposureRecorded] = useState(false)
  const [exposureTimestamp, setExposureTimestamp] = useState<string | null>(null)
  const [inExperiment, setInExperiment] = useState(false)
  const [conversionRecorded, setConversionRecorded] = useState(false)
  const [conversionSent, setConversionSent] = useState(false)
  const [conversionTimestamp, setConversionTimestamp] = useState<string | null>(null)
  const experimentRef = useRef<ShipCheckExperiment | null>(null)

  const experiment = useMemo(() => {
    const instance = new ShipCheckExperiment(visitorId)
    experimentRef.current = instance
    return instance
  }, [visitorId])

  useEffect(() => {
    let cancelled = false
    void experiment.init().then((status) => {
      if (!cancelled) setSdkStatus(status)
    })
    return () => {
      cancelled = true
    }
  }, [experiment])

  useEffect(() => {
    const flush = () => experiment.flushOnExit()
    window.addEventListener('pagehide', flush)
    window.addEventListener('beforeunload', flush)
    return () => {
      window.removeEventListener('pagehide', flush)
      window.removeEventListener('beforeunload', flush)
    }
  }, [experiment])

  const evaluateScan = useCallback(async () => {
    const result = await experiment.evaluate()
    setVariant(result.variant)
    setSource(result.source)
    setExposureRecorded(result.exposureRecorded)
    setInExperiment(result.inExperiment)
    if (result.exposureRecorded || result.inExperiment) {
      setExposureTimestamp(new Date().toLocaleTimeString())
    }
  }, [experiment])

  const trackAction = useCallback(
    async (action: string, repo: string) => {
      setConversionRecorded(true)
      const now = new Date().toLocaleTimeString()
      const sent = await experiment.trackFixCompleted(action, repo)
      setConversionSent(sent)
      setConversionTimestamp(now)
    },
    [experiment],
  )

  const resetVisitor = useCallback(() => {
    regenerateVisitorId()
    window.location.reload()
  }, [])

  return {
    visitorId,
    sdkStatus,
    variant,
    source,
    exposureRecorded,
    exposureTimestamp,
    inExperiment,
    conversionRecorded,
    conversionSent,
    conversionTimestamp,
    hasKey: hasEnvKey(),
    previewOverride: source === 'preview',
    evaluateScan,
    trackAction,
    resetVisitor,
  }
}
