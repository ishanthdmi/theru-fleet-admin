import { useEffect, useState } from 'react'
import { DashboardLayout } from '@/components/DashboardLayout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { analyticsAPI, deviceAPI } from '@/lib/api'
import { Activity, Smartphone, Megaphone, Eye, TrendingUp, DollarSign, Battery, MapPin, Clock } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'

export default function DashboardPage() {
  const [stats, setStats] = useState({
    total_devices: 0,
    online_devices: 0,
    offline_devices: 0,
    total_campaigns: 0,
    total_impressions: 0,
    today_impressions: 0
  })
  const [devices, setDevices] = useState([])
  const [campaignStats, setCampaignStats] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
    // Auto-refresh every 30 seconds
    const interval = setInterval(loadData, 30000)
    return () => clearInterval(interval)
  }, [])

  const loadData = async () => {
    try {
      const [statsRes, devicesRes, campaignsRes] = await Promise.all([
        analyticsAPI.overview(),
        deviceAPI.list(),
        analyticsAPI.campaigns()
      ])
      setStats(statsRes.data)
      setDevices(devicesRes.data || [])
      setCampaignStats(campaignsRes.data || [])
    } catch (error) {
      console.error('Failed to load stats:', error)
    } finally {
      setLoading(false)
    }
  }

  // Calculate revenue (example: ₹0.10 per impression)
  const RATE_PER_IMPRESSION = 0.10
  const totalRevenue = stats.total_impressions * RATE_PER_IMPRESSION
  const todayRevenue = stats.today_impressions * RATE_PER_IMPRESSION

  const kpiCards = [
    {
      title: 'Online Devices',
      value: stats.online_devices,
      subtitle: `of ${stats.total_devices} total`,
      icon: Smartphone,
      color: 'text-green-400',
      bgColor: 'bg-green-900/20'
    },
    {
      title: 'Total Impressions',
      value: stats.total_impressions?.toLocaleString(),
      subtitle: `${stats.today_impressions?.toLocaleString()} today`,
      icon: Eye,
      color: 'text-blue-400',
      bgColor: 'bg-blue-900/20'
    },
    {
      title: 'Total Revenue',
      value: `₹${totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
      subtitle: `₹${todayRevenue.toFixed(2)} today`,
      icon: DollarSign,
      color: 'text-yellow-400',
      bgColor: 'bg-yellow-900/20'
    },
    {
      title: 'Active Campaigns',
      value: stats.total_campaigns,
      subtitle: 'Running now',
      icon: Megaphone,
      color: 'text-purple-400',
      bgColor: 'bg-purple-900/20'
    }
  ]

  // Device status chart data
  const deviceStatusData = [
    { name: 'Online', value: stats.online_devices, color: '#4ade80' },
    { name: 'Offline', value: stats.offline_devices, color: '#f87171' }
  ]

  // Top campaigns by impressions
  const topCampaigns = campaignStats
    .sort((a, b) => (b.total_impressions || 0) - (a.total_impressions || 0))
    .slice(0, 5)

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="space-y-8" data-testid="dashboard-page">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-black text-slate-100 tracking-tight" style={{ fontFamily: 'Chivo, sans-serif' }}>
              Dashboard
            </h1>
            <p className="text-slate-400 mt-2">Real-time fleet and revenue analytics</p>
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Activity className="w-4 h-4 text-green-400 animate-pulse" />
            Live • Auto-refreshing
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {kpiCards.map((kpi, index) => {
            const Icon = kpi.icon
            return (
              <Card key={index} className="bg-slate-900 border-slate-800 hover:border-slate-700 transition-colors">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-slate-400">
                    {kpi.title}
                  </CardTitle>
                  <div className={`p-2 rounded-md ${kpi.bgColor}`}>
                    <Icon className={`w-5 h-5 ${kpi.color}`} />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-black text-slate-100" style={{ fontFamily: 'Chivo, sans-serif' }}>
                    {kpi.value}
                  </div>
                  <p className="text-xs text-slate-500 mt-1">{kpi.subtitle}</p>
                </CardContent>
              </Card>
            )
          })}
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Device Status Pie Chart */}
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader>
              <CardTitle className="text-slate-100 flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-blue-400" />
                Device Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={deviceStatusData}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={70}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {deviceStatusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155' }}
                      labelStyle={{ color: '#94a3b8' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex justify-center gap-6 mt-2">
                {deviceStatusData.map((item) => (
                  <div key={item.name} className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-sm text-slate-400">{item.name}: {item.value}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Top Campaigns Chart */}
          <Card className="bg-slate-900 border-slate-800 lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-slate-100 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-green-400" />
                Top Campaigns by Impressions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-48">
                {topCampaigns.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={topCampaigns} layout="vertical">
                      <XAxis type="number" stroke="#64748b" fontSize={12} />
                      <YAxis 
                        type="category" 
                        dataKey="campaign_name" 
                        stroke="#64748b" 
                        fontSize={12}
                        width={120}
                        tickFormatter={(value) => value.length > 15 ? value.slice(0, 15) + '...' : value}
                      />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155' }}
                        labelStyle={{ color: '#94a3b8' }}
                      />
                      <Bar dataKey="total_impressions" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-slate-500">
                    No campaign data yet
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Live Devices Table */}
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader>
            <CardTitle className="text-slate-100 flex items-center gap-2">
              <Activity className="w-5 h-5 text-green-400" />
              Live Device Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-800">
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Device Code</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Status</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">City</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Last Seen</th>
                  </tr>
                </thead>
                <tbody>
                  {devices.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="text-center py-8 text-slate-500">
                        No devices registered yet
                      </td>
                    </tr>
                  ) : (
                    devices.slice(0, 10).map((device) => (
                      <tr key={device.id} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                        <td className="py-3 px-4">
                          <span className="font-mono text-sm text-slate-200">{device.device_code}</span>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${
                            device.status === 'online' 
                              ? 'bg-green-900/30 text-green-400' 
                              : 'bg-red-900/30 text-red-400'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${
                              device.status === 'online' ? 'bg-green-400' : 'bg-red-400'
                            }`} />
                            {device.status?.toUpperCase() || 'OFFLINE'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-sm text-slate-400">
                          {device.city || '-'}
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-sm text-slate-500 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {device.last_seen 
                              ? new Date(device.last_seen).toLocaleString()
                              : 'Never'
                            }
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}
