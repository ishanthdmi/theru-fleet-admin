import { useEffect, useState } from 'react'
import { DashboardLayout } from '@/components/DashboardLayout'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { clientAPI, campaignAPI, analyticsAPI } from '@/lib/api'
import { toast } from 'sonner'
import { Plus, Building2, Phone, User, Eye, Megaphone } from 'lucide-react'

export default function ClientsPage() {
  const [clients, setClients] = useState([])
  const [campaigns, setCampaigns] = useState([])
  const [campaignStats, setCampaignStats] = useState({})
  const [loading, setLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [formData, setFormData] = useState({ 
    name: '', 
    contact_person: '', 
    phone: '' 
  })

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const [clientsRes, campaignsRes, statsRes] = await Promise.all([
        clientAPI.list(),
        campaignAPI.list(),
        analyticsAPI.campaigns()
      ])
      setClients(clientsRes.data || [])
      setCampaigns(campaignsRes.data || [])
      
      // Create stats map by client
      const statsMap = {}
      ;(statsRes.data || []).forEach(s => {
        const clientId = s.client_id
        if (!statsMap[clientId]) {
          statsMap[clientId] = { impressions: 0, campaigns: 0 }
        }
        statsMap[clientId].impressions += s.total_impressions || 0
        statsMap[clientId].campaigns += 1
      })
      setCampaignStats(statsMap)
    } catch (error) {
      console.error('Failed to load clients:', error)
      toast.error('Failed to load clients')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      await clientAPI.create({
        company_name: formData.name,
        name: formData.name,
        contact_person: formData.contact_person,
        phone: formData.phone
      })
      toast.success('Client added successfully')
      setIsDialogOpen(false)
      setFormData({ name: '', contact_person: '', phone: '' })
      loadData()
    } catch (error) {
      console.error('Create client error:', error)
      toast.error('Failed to add client')
    }
  }

  // Calculate revenue per client
  const RATE_PER_IMPRESSION = 0.10
  const getClientRevenue = (clientId) => {
    const stats = campaignStats[clientId] || {}
    return (stats.impressions || 0) * RATE_PER_IMPRESSION
  }

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
      <div className="space-y-8" data-testid="clients-page">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-black text-slate-100 tracking-tight" style={{ fontFamily: 'Chivo, sans-serif' }}>
              Client Management
            </h1>
            <p className="text-slate-400 mt-2">Manage advertisers and their accounts</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-500/20">
                <Plus className="w-4 h-4 mr-2" />
                Add Client
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-slate-900 border-slate-800">
              <DialogHeader>
                <DialogTitle className="text-slate-100">Add New Client</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="text-sm text-slate-400">Company Name</label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="bg-slate-950 border-slate-800 text-slate-200"
                    placeholder="Acme Corporation"
                    required
                  />
                </div>
                <div>
                  <label className="text-sm text-slate-400">Contact Person</label>
                  <Input
                    value={formData.contact_person}
                    onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                    className="bg-slate-950 border-slate-800 text-slate-200"
                    placeholder="John Doe"
                  />
                </div>
                <div>
                  <label className="text-sm text-slate-400">Phone</label>
                  <Input
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="bg-slate-950 border-slate-800 text-slate-200"
                    placeholder="+91 98765 43210"
                  />
                </div>
                <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-500">
                  Add Client
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-slate-900 border-slate-800">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 bg-blue-900/30 rounded-lg">
                <Building2 className="w-6 h-6 text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-100">{clients.length}</p>
                <p className="text-sm text-slate-500">Total Clients</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-slate-900 border-slate-800">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 bg-green-900/30 rounded-lg">
                <Megaphone className="w-6 h-6 text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-green-400">{campaigns.length}</p>
                <p className="text-sm text-slate-500">Total Campaigns</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-slate-900 border-slate-800">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 bg-yellow-900/30 rounded-lg">
                <Eye className="w-6 h-6 text-yellow-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-yellow-400">
                  ₹{Object.values(campaignStats).reduce((sum, s) => sum + (s.impressions || 0), 0) * RATE_PER_IMPRESSION}
                </p>
                <p className="text-sm text-slate-500">Total Revenue</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Clients Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {clients.length === 0 ? (
            <Card className="bg-slate-900 border-slate-800 col-span-full">
              <CardContent className="p-12 text-center">
                <Building2 className="w-12 h-12 text-slate-700 mx-auto mb-4" />
                <p className="text-slate-400">No clients registered yet</p>
                <p className="text-sm text-slate-500 mt-1">Click "Add Client" to register your first client</p>
              </CardContent>
            </Card>
          ) : (
            clients.map((client) => {
              const clientCampaigns = campaigns.filter(c => c.client_id === client.id)
              const stats = campaignStats[client.id] || {}
              const revenue = getClientRevenue(client.id)
              
              return (
                <Card key={client.id} className="bg-slate-900 border-slate-800 hover:border-slate-700 transition-colors">
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
                        <Building2 className="w-6 h-6 text-blue-400" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-lg font-bold text-slate-100 mb-2" style={{ fontFamily: 'Chivo, sans-serif' }}>
                          {client.name || client.company_name}
                        </h3>
                        
                        {client.contact_person && (
                          <div className="flex items-center gap-2 text-sm text-slate-400 mb-1">
                            <User className="w-4 h-4" />
                            <span>{client.contact_person}</span>
                          </div>
                        )}
                        
                        {client.phone && (
                          <div className="flex items-center gap-2 text-sm text-slate-400 mb-3">
                            <Phone className="w-4 h-4" />
                            <span>{client.phone}</span>
                          </div>
                        )}
                        
                        {/* Stats */}
                        <div className="flex items-center gap-4 mt-4 pt-4 border-t border-slate-800">
                          <div className="text-center">
                            <p className="text-lg font-bold text-slate-200">{clientCampaigns.length}</p>
                            <p className="text-xs text-slate-500">Campaigns</p>
                          </div>
                          <div className="text-center">
                            <p className="text-lg font-bold text-slate-200">{(stats.impressions || 0).toLocaleString()}</p>
                            <p className="text-xs text-slate-500">Impressions</p>
                          </div>
                          <div className="text-center">
                            <p className="text-lg font-bold text-yellow-400">₹{revenue.toFixed(0)}</p>
                            <p className="text-xs text-slate-500">Revenue</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}
