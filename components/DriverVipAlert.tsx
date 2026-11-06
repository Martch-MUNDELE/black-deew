// BLAC-P3-034 : bandeau d'alerte admin sur le stock VIP embarqué des livreurs.
import { alertMessage, type DriverVipAlertItem } from '@/lib/driver-stock-alert'

export default function DriverVipAlert({ alerts }: { alerts: DriverVipAlertItem[] }) {
  if (!alerts || alerts.length === 0) return null
  return (
    <div
      role="alert"
      data-testid="driver-vip-alert"
      className="mb-4 rounded-lg border border-amber-500/50 bg-amber-500/10 px-4 py-3 text-sm text-amber-200"
    >
      <p className="mb-1 font-semibold">Stock VIP des livreurs</p>
      <ul className="space-y-0.5">
        {alerts.map((a) => (
          <li key={`${a.driver_id}-${a.product_id}`} className={a.level === 'empty' ? 'text-red-300' : undefined}>
            {alertMessage(a)}
          </li>
        ))}
      </ul>
    </div>
  )
}
