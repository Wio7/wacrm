"use client"

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { formatCurrency } from '@/lib/currency'
import {
  MessageSquare,
  UserPlus,
  DollarSign,
  Send,
  Home,
  Clock,
  CheckCircle2,
  CalendarCheck,
  Building2,
  TrendingUp,
  Activity,
} from 'lucide-react'

import {
  loadActivity,
  loadConversationsSeries,
  loadMetrics,
  loadPipelineDonut,
  loadResponseTime,
} from '@/lib/dashboard/queries'
import type {
  ActivityItem,
  ConversationsSeriesPoint,
  MetricsBundle,
  PipelineDonutData,
  ResponseTimeSummary,
} from '@/lib/dashboard/types'

import { MetricCard } from '@/components/dashboard/metric-card'
import { SkeletonCard } from '@/components/dashboard/skeleton'
import { QuickActions } from '@/components/dashboard/quick-actions'
import { ConversationsChart } from '@/components/dashboard/conversations-chart'
import { PipelineDonut } from '@/components/dashboard/pipeline-donut'
import { ResponseTimeChart } from '@/components/dashboard/response-time-chart'
import { ActivityFeed } from '@/components/dashboard/activity-feed'

type RangeDays = 7 | 30 | 90

function getGreeting(name?: string | null): string {
  const hour = new Date().getHours()
  let saludo = 'Buenos días'
  if (hour >= 12 && hour < 19) {
    saludo = 'Buenas tardes'
  } else if (hour >= 19 || hour < 6) {
    saludo = 'Buenas noches'
  }
  return name ? `${saludo}, ${name}` : saludo
}

export default function DashboardPage() {
  const { defaultCurrency, profile } = useAuth()
  const firstName = profile?.full_name ? profile.full_name.trim().split(/\s+/)[0] : null
  const [metrics, setMetrics] = useState<MetricsBundle | null>(null)
  const [metricsLoading, setMetricsLoading] = useState(true)

  const [range, setRange] = useState<RangeDays>(30)
  // Keep a cache per range so switching tabs doesn't re-fetch what we
  // already have. Ranges the user hasn't opened yet stay null and
  // trigger a fetch on first view.
  const [series, setSeries] = useState<Record<RangeDays, ConversationsSeriesPoint[] | null>>({
    7: null,
    30: null,
    90: null,
  })
  const [seriesLoading, setSeriesLoading] = useState(true)

  const [pipeline, setPipeline] = useState<PipelineDonutData | null>(null)
  const [pipelineLoading, setPipelineLoading] = useState(true)

  const [responseTime, setResponseTime] = useState<ResponseTimeSummary | null>(null)
  const [responseTimeLoading, setResponseTimeLoading] = useState(true)

  const [activity, setActivity] = useState<ActivityItem[] | null>(null)
  const [activityLoading, setActivityLoading] = useState(true)

  const loadAll = useCallback(() => {
    const db = createClient()

    // Kick everything off in parallel. Each block has its own
    // setState + finally so a slow query doesn't hold up faster
    // sections — each widget shows its own skeleton independently.
    void loadMetrics(db)
      .then((m) => setMetrics(m))
      .catch((err) => console.error('[dashboard] metrics failed:', err))
      .finally(() => setMetricsLoading(false))

    void loadConversationsSeries(db, 30)
      .then((s) => setSeries((prev) => ({ ...prev, 30: s })))
      .catch((err) => console.error('[dashboard] series failed:', err))
      .finally(() => setSeriesLoading(false))

    void loadPipelineDonut(db)
      .then((p) => setPipeline(p))
      .catch((err) => console.error('[dashboard] pipeline failed:', err))
      .finally(() => setPipelineLoading(false))

    void loadResponseTime(db)
      .then((r) => setResponseTime(r))
      .catch((err) => console.error('[dashboard] response time failed:', err))
      .finally(() => setResponseTimeLoading(false))

    // Fetch up to 50 so the biggest page-size option in the feed
    // (50 rows) is already in memory — switching sizes then becomes
    // a pure client-side slice with no extra round trip.
    void loadActivity(db, 50)
      .then((a) => setActivity(a))
      .catch((err) => console.error('[dashboard] activity failed:', err))
      .finally(() => setActivityLoading(false))
  }, [])

  useEffect(() => {
    loadAll()
  }, [loadAll])

  // Range switch handler — kept in an event callback (not an effect)
  // so the setState calls stay out of the react-hooks/set-state-in-effect
  // rule's way. The cached bucket check means switching back to a
  // previously-viewed range is instant and doesn't re-fetch.
  const handleRangeChange = useCallback(
    (r: RangeDays) => {
      setRange(r)
      if (series[r] !== null) return
      setSeriesLoading(true)
      const db = createClient()
      loadConversationsSeries(db, r)
        .then((s) => setSeries((prev) => ({ ...prev, [r]: s })))
        .catch((err) => console.error('[dashboard] series failed:', err))
        .finally(() => setSeriesLoading(false))
    },
    [series],
  )

  return (
    <div className="space-y-6">
      {/* Header with Welcome Greeting */}
      <div className="flex flex-col gap-1.5 border-b border-border/60 pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              {getGreeting(firstName)}
            </h1>
            <span className="text-2xl" role="img" aria-label="Saludo">
              👋
            </span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Analíticas en vivo de conversaciones, contactos, tratos, difusiones y automatizaciones.
          </p>
        </div>
      </div>

      {/* Metric cards */}
      <div className="space-y-3">
        <div className="flex items-center gap-2.5">
          <TrendingUp className="size-4 text-primary" />
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Resumen General
          </h2>
          <div className="flex-1 border-t border-border/60" />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {metricsLoading || !metrics ? (
            Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
          ) : (
            <>
              <MetricCard
                title="Conversaciones Activas"
                value={metrics.activeConversations.current.toLocaleString()}
                icon={MessageSquare}
                delta={{
                  sign: metrics.activeConversations.previous,
                  label: deltaLabel(metrics.activeConversations.previous, 'nuevas hoy vs ayer'),
                }}
              />
              <MetricCard
                title="Nuevos Contactos Hoy"
                value={metrics.newContactsToday.current.toLocaleString()}
                icon={UserPlus}
                delta={{
                  sign:
                    metrics.newContactsToday.current - metrics.newContactsToday.previous,
                  label: deltaLabel(
                    metrics.newContactsToday.current - metrics.newContactsToday.previous,
                    'vs ayer',
                  ),
                }}
              />
              <MetricCard
                title="Valor de Tratos Abiertos"
                value={formatCurrency(metrics.openDealsValue, defaultCurrency)}
                icon={DollarSign}
                subtitle={`${metrics.openDealsCount} ${metrics.openDealsCount === 1 ? 'trato abierto' : 'tratos abiertos'}`}
              />
              <MetricCard
                title="Mensajes Enviados Hoy"
                value={metrics.messagesSentToday.current.toLocaleString()}
                icon={Send}
                delta={{
                  sign:
                    metrics.messagesSentToday.current - metrics.messagesSentToday.previous,
                  label: deltaLabel(
                    metrics.messagesSentToday.current - metrics.messagesSentToday.previous,
                    'vs ayer',
                  ),
                }}
              />
            </>
          )}
        </div>
      </div>

      {/* Real estate KPI row — hidden until the account has projects/units
          set up, so accounts without the real-estate module see no
          change (every count would otherwise render as a false zero). */}
      {metrics?.realEstate &&
        (metrics.realEstate.unitsAvailable +
          metrics.realEstate.unitsReserved +
          metrics.realEstate.unitsSold +
          metrics.realEstate.activeReservations) >
          0 && (
          <div className="space-y-3 pt-1">
            <div className="flex items-center gap-2.5">
              <Building2 className="size-4 text-primary" />
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Métricas Inmobiliarias
              </h2>
              <div className="flex-1 border-t border-border/60" />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <MetricCard
                title="Unidades Disponibles"
                value={metrics.realEstate.unitsAvailable.toLocaleString()}
                icon={Home}
              />
              <MetricCard
                title="Unidades Reservadas"
                value={metrics.realEstate.unitsReserved.toLocaleString()}
                icon={Clock}
              />
              <MetricCard
                title="Unidades Vendidas"
                value={metrics.realEstate.unitsSold.toLocaleString()}
                icon={CheckCircle2}
              />
              <MetricCard
                title="Separaciones Activas"
                value={metrics.realEstate.activeReservations.toLocaleString()}
                icon={CalendarCheck}
              />
            </div>
          </div>
        )}

      {/* Quick actions */}
      <div className="pt-1">
        <QuickActions />
      </div>

      {/* Charts row */}
      {/* items-stretch (the grid default) stretches the two columns to
          match the tallest sibling; adding h-full on each wrapper and
          on the inner panels makes both cards actually fill that
          stretched height so their rounded borders line up. Without
          this, the pipeline card rendered at its natural (shorter)
          height while the line chart drove the row height. */}
      <div className="space-y-3 pt-1">
        <div className="flex items-center gap-2.5">
          <MessageSquare className="size-4 text-primary" />
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Conversaciones y Embudos
          </h2>
          <div className="flex-1 border-t border-border/60" />
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
          <div className="h-full lg:col-span-3">
            <ConversationsChart
              series={series}
              loading={seriesLoading}
              range={range}
              onRangeChange={handleRangeChange}
            />
          </div>
          <div className="h-full lg:col-span-2">
            <PipelineDonut
              data={pipeline}
              loading={pipelineLoading}
              currency={defaultCurrency}
            />
          </div>
        </div>
      </div>

      {/* Operations & Activity */}
      <div className="space-y-4 pt-1">
        <div className="flex items-center gap-2.5">
          <Activity className="size-4 text-primary" />
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Operaciones y Actividad Reciente
          </h2>
          <div className="flex-1 border-t border-border/60" />
        </div>
        <ResponseTimeChart data={responseTime} loading={responseTimeLoading} />
        <ActivityFeed items={activity} loading={activityLoading} />
      </div>
    </div>
  )
}

// ------------------------------------------------------------

function deltaLabel(delta: number, suffix: string): string {
  if (delta === 0) return `Sin cambios ${suffix}`
  const sign = delta > 0 ? '+' : ''
  return `${sign}${delta.toLocaleString()} ${suffix}`
}
