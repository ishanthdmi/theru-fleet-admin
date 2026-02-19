import { useEffect, useState } from 'react'
import { DashboardLayout } from '@/components/DashboardLayout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { analyticsAPI, campaignAPI, convertToCSV, downloadCSV } from '@/lib/api'
import { toast } from 'sonner'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, AreaChart, Area } from 'recharts'
import { Download, Eye, TrendingUp, DollarSign, Calendar, Filter, FileSpreadsheet } from 'lucide-react'

const RATE_PER_IMPRESSION = 0.10 // ₹0.10 per impression

export default function AnalyticsPage() {
  const [overview, setOverview] = useState({})
  const [campaignStats, setCampaignStats] = useState([])
  const [impressions, setImpressions] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedCampaign, setSelectedCampaign] = useState('')
  const [dateRange, setDateRange] = useState({
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  })

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    loadImpressions()
  }, [selectedCampaign, dateRange])

  const loadData = async () => {
    try {
      const [overviewRes, campaignsRes] = await Promise.all([
        analyticsAPI.overview(),
        analyticsAPI.campaigns()
      ])
      setOverview(overviewRes.data || {})
      setCampaignStats(campaignsRes.data || [])
    } catch (error) {
      console.error('Failed to load analytics:', error)
      toast.error('Failed to load analytics')
    } finally {
      setLoading(false)
    }
  }

  const loadImpressions = async () => {
    try {
      const params = {
        start_date: dateRange.start,
        end_date: dateRange.end,
        limit: 500
      }
      if (selectedCampaign) {
        params.campaign_id = selectedCampaign
      }
      const response = await analyticsAPI.impressions(params)
      setImpressions(response.data || [])
    } catch (error) {
      console.error('Failed to load impressions:', error)
    }
  }

  const handleExportCSV = async () => {
    try {
      toast.info('Preparing export...')
      
      // Get all impressions
      const params = {
        start_date: dateRange.start,
        end_date: dateRange.end,
        limit: 10000
      }
      if (selectedCampaign) {
        params.campaign_id = selectedCampaign
      }
      const data = await analyticsAPI.exportCSV(params)
      
      if (!data || data.length === 0) {
        toast.error('No data to export')
        return
      }

      const fields = [
        { key: 'id', label: 'Impression ID' },
        { key: 'device_id', label: 'Device ID' },
        { key: 'ad_id', label: 'Ad ID' },
        { key: 'played_at', label: 'Played At' }
      ]

      const csv = convertToCSV(data, fields)
      const filename = `impressions_${dateRange.start}_to_${dateRange.end}.csv`
      downloadCSV(csv, filename)
      
      toast.success(`Exported ${data.length} records`)
    } catch (error) {
      console.error('Export failed:', error)
      toast.error('Failed to export data')
    }
  }

  const handleExportCampaignReport = () => {
    try {
      if (campaignStats.length === 0) {
        toast.error('No campaign data to export')
        return
      }

      const dataWithRevenue = campaignStats.map(c => ({
        ...c,
        revenue: ((c.total_impressions || 0) * RATE_PER_IMPRESSION).toFixed(2)
      }))

      const fields = [
        { key: 'campaign_name', label: 'Campaign' },
        { key: 'client_name', label: 'Client' },
        { key: 'status', label: 'Status' },
        { key: 'start_date', label: 'Start Date' },
        { key: 'end_date', label: 'End Date' },
        { key: 'total_impressions', label: 'Impressions' },
        { key: 'unique_devices', label: 'Devices' },
        { key: 'revenue', label: 'Revenue (₹)' }
      ]

      const csv = convertToCSV(dataWithRevenue, fields)
      downloadCSV(csv, `campaign_report_${new Date().toISOString().split('T')[0]}.csv`)
      
      toast.success('Campaign report exported')
    } catch (error) {
      toast.error('Failed to export report')
    }
  }

  // Calculate totals
  const totalRevenue = (overview.total_impressions || 0) * RATE_PER_IMPRESSION
  const todayRevenue = (overview.today_impressions || 0) * RATE_PER_IMPRESSION

  // Prepare chart data
  const campaignChartData = campaignStats
    .sort((a, b) => (b.total_impressions || 0) - (a.total_impressions || 0))
    .slice(0, 8)
    .map(c => ({
      name: c.campaign_name?.substring(0, 20) || 'Unknown',
      impressions: c.total_impressions || 0,
      revenue: ((c.total_impressions || 0) * RATE_PER_IMPRESSION).toFixed(2)
    }))

  // Group impressions by date for trend chart
  const impressionsByDate = impressions.reduce((acc, imp) => {
    const date = imp.played_at?.split('T')[0] || 'Unknown'
    acc[date] = (acc[date] || 0) + 1
    return acc
  }, {})

  const trendData = Object.entries(impressionsByDate)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-14)
    .map(([date, count]) => ({
      date: date.substring(5), // MM-DD format
      impressions: count
    }))

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
      <div className="space-y-8" data-testid="analytics-page">
        {/* Header */}
        <div className="flex flex-col lg:flex-row justify-between gap-4">
          <div>
            <h1 className="text-4xl font-black text-slate-100 tracking-tight" style={{ fontFamily: 'Chivo, sans-serif' }}>
              Revenue Analytics
            </h1>
            <p className="text-slate-400 mt-2">Impression tracking and revenue reports</p>
          </div>
          <div className="flex items-center gap-3">
            <Button 
              variant="outline" 
              className="border-slate-700"
              onClick={handleExportCampaignReport}
            >
              <FileSpreadsheet className="w-4 h-4 mr-2" /> Export Campaigns
            </Button>
            <Button 
              className="bg-green-600 hover:bg-green-500"
              onClick={handleExportCSV}
            >
              <Download className="w-4 h-4 mr-2" /> Export Impressions CSV
            </Button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="bg-slate-900 border-slate-800">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400">Total Impressions</p>
                  <p className="text-3xl font-bold text-slate-100 mt-1">
                    {(overview.total_impressions || 0).toLocaleString()}
                  </p>
                </div>
                <div className="p-3 bg-blue-900/30 rounded-lg">
                  <Eye className="w-6 h-6 text-blue-400" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-slate-900 border-slate-800">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400">Today's Impressions</p>
                  <p className="text-3xl font-bold text-green-400 mt-1">
                    {(overview.today_impressions || 0).toLocaleString()}
                  </p>
                </div>
                <div className="p-3 bg-green-900/30 rounded-lg">
                  <TrendingUp className="w-6 h-6 text-green-400" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-slate-900 border-slate-800">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400">Total Revenue</p>
                  <p className="text-3xl font-bold text-yellow-400 mt-1">
                    ₹{totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="p-3 bg-yellow-900/30 rounded-lg">
                  <DollarSign className="w-6 h-6 text-yellow-400" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-slate-900 border-slate-800">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400">Today's Revenue</p>
                  <p className="text-3xl font-bold text-purple-400 mt-1">
                    ₹{todayRevenue.toFixed(2)}
                  </p>
                </div>
                <div className="p-3 bg-purple-900/30 rounded-lg">
                  <Calendar className="w-6 h-6 text-purple-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-slate-500" />
                <span className="text-sm text-slate-400">Filter:</span>
              </div>
              <div>
                <Select value={selectedCampaign} onValueChange={setSelectedCampaign}>
                  <SelectTrigger className="w-48 bg-slate-950 border-slate-800 text-slate-200">
                    <SelectValue placeholder="All Campaigns" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-800">
                    <SelectItem value="" className="text-slate-200">All Campaigns</SelectItem>
                    {campaignStats.map(c => (
                      <SelectItem key={c.campaign_id} value={c.campaign_id} className="text-slate-200">
                        {c.campaign_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-400">From:</span>
                <Input
                  type="date"
                  value={dateRange.start}
                  onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                  className="w-40 bg-slate-950 border-slate-800 text-slate-200"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-400">To:</span>
                <Input
                  type="date"
                  value={dateRange.end}
                  onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                  className="w-40 bg-slate-950 border-slate-800 text-slate-200"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Impressions Trend */}
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader>
              <CardTitle className="text-slate-100 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-blue-400" />
                Impressions Trend (Last 14 Days)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                {trendData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={trendData}>
                      <defs>
                        <linearGradient id="impressionGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="date" stroke="#64748b" fontSize={12} />
                      <YAxis stroke="#64748b" fontSize={12} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155' }}
                        labelStyle={{ color: '#94a3b8' }}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="impressions" 
                        stroke="#3b82f6" 
                        fillOpacity={1} 
                        fill="url(#impressionGradient)" 
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-slate-500">
                    No impression data for selected period
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Campaign Performance */}
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader>
              <CardTitle className="text-slate-100 flex items-center gap-2">
                <Eye className="w-5 h-5 text-green-400" />
                Campaign Performance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                {campaignChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={campaignChartData} layout="vertical">
                      <XAxis type="number" stroke="#64748b" fontSize={12} />
                      <YAxis 
                        type="category" 
                        dataKey="name" 
                        stroke="#64748b" 
                        fontSize={11}
                        width={100}
                      />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155' }}
                        labelStyle={{ color: '#94a3b8' }}
                        formatter={(value, name) => [
                          name === 'impressions' ? value.toLocaleString() : `₹${value}`,
                          name === 'impressions' ? 'Impressions' : 'Revenue'
                        ]}
                      />
                      <Bar dataKey="impressions" fill="#3b82f6" radius={[0, 4, 4, 0]} />
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

        {/* Campaign Revenue Table */}
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader>
            <CardTitle className="text-slate-100 flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-yellow-400" />
              Revenue by Campaign
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-950">
                  <tr className="border-b border-slate-800">
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Campaign</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Client</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Status</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-slate-400">Impressions</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-slate-400">Devices</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-slate-400">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {campaignStats.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-8 text-slate-500">
                        No campaign data available
                      </td>
                    </tr>
                  ) : (
                    campaignStats.map((campaign) => {
                      const revenue = (campaign.total_impressions || 0) * RATE_PER_IMPRESSION
                      return (
                        <tr key={campaign.campaign_id} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                          <td className="py-3 px-4">
                            <span className="font-medium text-slate-200">{campaign.campaign_name}</span>
                          </td>
                          <td className="py-3 px-4 text-sm text-slate-400">
                            {campaign.client_name || '-'}
                          </td>
                          <td className="py-3 px-4">
                            <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                              campaign.status === 'ACTIVE' 
                                ? 'bg-green-900/30 text-green-400' 
                                : 'bg-slate-800 text-slate-400'
                            }`}>
                              {campaign.status}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <span className="font-mono text-sm text-slate-200">
                              {(campaign.total_impressions || 0).toLocaleString()}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right text-sm text-slate-400">
                            {campaign.unique_devices || 0}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <span className="font-mono text-sm text-yellow-400 font-medium">
                              ₹{revenue.toFixed(2)}
                            </span>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
                {campaignStats.length > 0 && (
                  <tfoot className="bg-slate-950">
                    <tr>
                      <td colSpan={3} className="py-3 px-4 text-sm font-medium text-slate-300">
                        Total
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-sm font-medium text-slate-200">
                        {campaignStats.reduce((sum, c) => sum + (c.total_impressions || 0), 0).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-right text-sm text-slate-400">
                        -
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-sm font-bold text-yellow-400">
                        ₹{totalRevenue.toFixed(2)}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}
