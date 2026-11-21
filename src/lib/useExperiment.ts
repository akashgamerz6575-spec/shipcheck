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
  inExperiment: boolean
  conversionRecorded: boolean
  conversionSent: boolean
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
  const [inExperiment, setInExperiment] = useState(false)
  const [conversionRecorded, setConversionRecorded] = useState(false)
  const [conversionSent, setConversionSent] = useState(false)
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
  }, [experiment])

  const trackAction = useCallback(
    async (action: string, repo: string) => {
      setConversionRecorded(true)
      const sent = await experiment.trackFixCompleted(action, repo)
      setConversionSent(sent)
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
    inExperiment,
    conversionRecorded,
    conversionSent,
    hasKey: hasEnvKey(),
    previewOverride: source === 'preview',
    evaluateScan,
    trackAction,
    resetVisitor,
  }
}
