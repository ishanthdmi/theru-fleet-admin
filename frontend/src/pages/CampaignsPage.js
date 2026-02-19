import { useEffect, useState, useRef } from 'react'
import { DashboardLayout } from '@/components/DashboardLayout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { campaignAPI, clientAPI, deviceAPI, analyticsAPI } from '@/lib/api'
import { toast } from 'sonner'
import { Plus, Megaphone, Calendar, Target, Upload, Video, Trash2, Eye, Play, Pause, CheckCircle, Clock, XCircle } from 'lucide-react'
import { Progress } from '@/components/ui/progress'

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState([])
  const [clients, setClients] = useState([])
  const [devices, setDevices] = useState([])
  const [campaignStats, setCampaignStats] = useState({})
  const [loading, setLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isAdDialogOpen, setIsAdDialogOpen] = useState(false)
  const [selectedCampaign, setSelectedCampaign] = useState(null)
  const [campaignAds, setCampaignAds] = useState([])
  const [uploadProgress, setUploadProgress] = useState(0)
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef(null)

  const [formData, setFormData] = useState({
    client_id: '',
    name: '',
    start_date: '',
    end_date: ''
  })

  const [adFormData, setAdFormData] = useState({
    file: null,
    duration: 30
  })

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const [campaignsRes, clientsRes, devicesRes, statsRes] = await Promise.all([
        campaignAPI.list(),
        clientAPI.list(),
        deviceAPI.list(),
        analyticsAPI.campaigns()
      ])
      setCampaigns(campaignsRes.data || [])
      setClients(clientsRes.data || [])
      setDevices(devicesRes.data || [])
      
      // Create stats map
      const statsMap = {}
      ;(statsRes.data || []).forEach(s => {
        statsMap[s.campaign_id] = s
      })
      setCampaignStats(statsMap)
    } catch (error) {
      console.error('Failed to load data:', error)
      toast.error('Failed to load campaigns')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      await campaignAPI.create(formData)
      toast.success('Campaign created successfully!')
      setIsDialogOpen(false)
      setFormData({ client_id: '', name: '', start_date: '', end_date: '' })
      loadData()
    } catch (error) {
      console.error('Create campaign error:', error)
      toast.error('Failed to create campaign')
    }
  }

  const handleStatusChange = async (campaignId, newStatus) => {
    try {
      await campaignAPI.updateStatus(campaignId, newStatus)
      toast.success(`Campaign ${newStatus.toLowerCase()}!`)
      loadData()
    } catch (error) {
      toast.error('Failed to update status')
    }
  }

  const openAdManager = async (campaign) => {
    setSelectedCampaign(campaign)
    setIsAdDialogOpen(true)
    loadCampaignAds(campaign.id)
  }

  const loadCampaignAds = async (campaignId) => {
    try {
      const response = await campaignAPI.getAds(campaignId)
      setCampaignAds(response.data || [])
    } catch (error) {
      console.error('Failed to load ads:', error)
      setCampaignAds([])
    }
  }

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0]
    if (file) {
      if (!file.type.startsWith('video/')) {
        toast.error('Please select a video file')
        return
      }
      if (file.size > 100 * 1024 * 1024) { // 100MB limit
        toast.error('File size must be less than 100MB')
        return
      }
      setAdFormData({ ...adFormData, file })
    }
  }

  const handleUploadAd = async () => {
    if (!adFormData.file || !selectedCampaign) {
      toast.error('Please select a video file')
      return
    }

    setIsUploading(true)
    setUploadProgress(10)

    try {
      // Simulate progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 10, 90))
      }, 500)

      await campaignAPI.uploadAd(selectedCampaign.id, adFormData.file, adFormData.duration)
      
      clearInterval(progressInterval)
      setUploadProgress(100)
      
      toast.success('Video uploaded successfully!')
      setAdFormData({ file: null, duration: 30 })
      if (fileInputRef.current) fileInputRef.current.value = ''
      loadCampaignAds(selectedCampaign.id)
      loadData() // Refresh main data
    } catch (error) {
      console.error('Upload error:', error)
      toast.error('Failed to upload video')
    } finally {
      setIsUploading(false)
      setUploadProgress(0)
    }
  }

  const handleDeleteAd = async (adId) => {
    if (!confirm('Are you sure you want to delete this ad?')) return

    try {
      await campaignAPI.deleteAd(adId)
      toast.success('Ad deleted')
      loadCampaignAds(selectedCampaign.id)
    } catch (error) {
      toast.error('Failed to delete ad')
    }
  }

  const getStatusIcon = (status) => {
    switch (status?.toLowerCase()) {
      case 'active': return <CheckCircle className="w-4 h-4 text-green-400" />
      case 'scheduled': return <Clock className="w-4 h-4 text-blue-400" />
      case 'paused': return <Pause className="w-4 h-4 text-yellow-400" />
      case 'completed': return <XCircle className="w-4 h-4 text-slate-400" />
      default: return <Clock className="w-4 h-4 text-slate-400" />
    }
  }

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'active': return 'bg-green-900/30 text-green-400 border-green-800'
      case 'scheduled': return 'bg-blue-900/30 text-blue-400 border-blue-800'
      case 'paused': return 'bg-yellow-900/30 text-yellow-400 border-yellow-800'
      case 'completed': return 'bg-slate-900/30 text-slate-400 border-slate-700'
      default: return 'bg-slate-900/30 text-slate-400 border-slate-700'
    }
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
      <div className="space-y-8" data-testid="campaigns-page">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-black text-slate-100 tracking-tight" style={{ fontFamily: 'Chivo, sans-serif' }}>
              Campaign Control
            </h1>
            <p className="text-slate-400 mt-2">Create campaigns and upload ad videos</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-500/20">
                <Plus className="w-4 h-4 mr-2" />
                New Campaign
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-slate-900 border-slate-800 max-w-lg">
              <DialogHeader>
                <DialogTitle className="text-slate-100">Create New Campaign</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="text-sm text-slate-400">Client / Advertiser</label>
                  <Select 
                    value={formData.client_id} 
                    onValueChange={(value) => setFormData({ ...formData, client_id: value })}
                  >
                    <SelectTrigger className="bg-slate-950 border-slate-800 text-slate-200">
                      <SelectValue placeholder="Select client" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-slate-800">
                      {clients.map((client) => (
                        <SelectItem key={client.id} value={client.id} className="text-slate-200">
                          {client.name || client.company_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm text-slate-400">Campaign Name</label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="bg-slate-950 border-slate-800 text-slate-200"
                    placeholder="Summer Sale 2026"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-slate-400">Start Date</label>
                    <Input
                      type="date"
                      value={formData.start_date}
                      onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                      className="bg-slate-950 border-slate-800 text-slate-200"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-sm text-slate-400">End Date</label>
                    <Input
                      type="date"
                      value={formData.end_date}
                      onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                      className="bg-slate-950 border-slate-800 text-slate-200"
                      required
                    />
                  </div>
                </div>
                <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-500">
                  Create Campaign
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Campaigns Grid */}
        <div className="grid grid-cols-1 gap-4">
          {campaigns.length === 0 ? (
            <Card className="bg-slate-900 border-slate-800">
              <CardContent className="p-12 text-center">
                <Megaphone className="w-12 h-12 text-slate-700 mx-auto mb-4" />
                <p className="text-slate-400">No campaigns created yet</p>
                <p className="text-sm text-slate-500 mt-1">Click "New Campaign" to get started</p>
              </CardContent>
            </Card>
          ) : (
            campaigns.map((campaign) => {
              const stats = campaignStats[campaign.id] || {}
              return (
                <Card key={campaign.id} className="bg-slate-900 border-slate-800 hover:border-slate-700 transition-colors">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-4 flex-1">
                        <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
                          <Megaphone className="w-6 h-6 text-blue-400" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-lg font-bold text-slate-100" style={{ fontFamily: 'Chivo, sans-serif' }}>
                              {campaign.name}
                            </h3>
                            <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(campaign.status)}`}>
                              {getStatusIcon(campaign.status)}
                              {campaign.status?.toUpperCase() || 'SCHEDULED'}
                            </span>
                          </div>
                          
                          {/* Stats Row */}
                          <div className="flex items-center gap-6 mt-3 flex-wrap">
                            <div className="flex items-center gap-2">
                              <Calendar className="w-4 h-4 text-slate-500" />
                              <span className="text-sm text-slate-400">
                                {campaign.start_date} → {campaign.end_date}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Eye className="w-4 h-4 text-slate-500" />
                              <span className="text-sm text-slate-400">
                                {(stats.total_impressions || 0).toLocaleString()} impressions
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Target className="w-4 h-4 text-slate-500" />
                              <span className="text-sm text-slate-400">
                                {stats.unique_devices || 0} devices
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      {/* Action Buttons */}
                      <div className="flex items-center gap-2">
                        {campaign.status?.toLowerCase() === 'active' ? (
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="border-yellow-800 text-yellow-400 hover:bg-yellow-900/20"
                            onClick={() => handleStatusChange(campaign.id, 'PAUSED')}
                          >
                            <Pause className="w-4 h-4 mr-1" /> Pause
                          </Button>
                        ) : (
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="border-green-800 text-green-400 hover:bg-green-900/20"
                            onClick={() => handleStatusChange(campaign.id, 'ACTIVE')}
                          >
                            <Play className="w-4 h-4 mr-1" /> Activate
                          </Button>
                        )}
                        <Button 
                          size="sm" 
                          className="bg-blue-600 hover:bg-blue-500"
                          onClick={() => openAdManager(campaign)}
                        >
                          <Video className="w-4 h-4 mr-1" /> Manage Ads
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })
          )}
        </div>

        {/* Ad Manager Dialog */}
        <Dialog open={isAdDialogOpen} onOpenChange={setIsAdDialogOpen}>
          <DialogContent className="bg-slate-900 border-slate-800 max-w-3xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-slate-100 flex items-center gap-2">
                <Video className="w-5 h-5 text-blue-400" />
                Manage Ads - {selectedCampaign?.name}
              </DialogTitle>
            </DialogHeader>
            
            <Tabs defaultValue="upload" className="mt-4">
              <TabsList className="bg-slate-950 border border-slate-800">
                <TabsTrigger value="upload" className="data-[state=active]:bg-blue-600">
                  <Upload className="w-4 h-4 mr-2" /> Upload Video
                </TabsTrigger>
                <TabsTrigger value="list" className="data-[state=active]:bg-blue-600">
                  <Video className="w-4 h-4 mr-2" /> Current Ads ({campaignAds.length})
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="upload" className="mt-4 space-y-4">
                <div className="border-2 border-dashed border-slate-700 rounded-lg p-8 text-center">
                  <Upload className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                  <p className="text-slate-400 mb-4">
                    {adFormData.file ? adFormData.file.name : 'Select a video file to upload'}
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="video/*"
                    onChange={handleFileSelect}
                    className="hidden"
                    id="video-upload"
                  />
                  <Button 
                    variant="outline" 
                    className="border-slate-700"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Choose File
                  </Button>
                </div>
                
                {adFormData.file && (
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm text-slate-400">Duration (seconds)</label>
                      <Input
                        type="number"
                        value={adFormData.duration}
                        onChange={(e) => setAdFormData({ ...adFormData, duration: parseInt(e.target.value) })}
                        className="bg-slate-950 border-slate-800 text-slate-200 w-32"
                        min={5}
                        max={120}
                      />
                    </div>
                    
                    {isUploading && (
                      <div className="space-y-2">
                        <Progress value={uploadProgress} className="h-2" />
                        <p className="text-sm text-slate-500 text-center">{uploadProgress}% uploading...</p>
                      </div>
                    )}
                    
                    <Button 
                      className="w-full bg-green-600 hover:bg-green-500"
                      onClick={handleUploadAd}
                      disabled={isUploading}
                    >
                      {isUploading ? 'Uploading...' : 'Upload to Cloudflare R2'}
                    </Button>
                  </div>
                )}
              </TabsContent>
              
              <TabsContent value="list" className="mt-4">
                <div className="space-y-3">
                  {campaignAds.length === 0 ? (
                    <div className="text-center py-8 text-slate-500">
                      No ads uploaded yet
                    </div>
                  ) : (
                    campaignAds.map((ad) => (
                      <div key={ad.id} className="flex items-center justify-between p-4 bg-slate-950 rounded-lg border border-slate-800">
                        <div className="flex items-center gap-4">
                          <div className="p-2 bg-slate-900 rounded">
                            <Video className="w-5 h-5 text-blue-400" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-slate-200">
                              {ad.file_name || 'Video Ad'}
                            </p>
                            <p className="text-xs text-slate-500">
                              {ad.duration || ad.duration_seconds}s • Uploaded {new Date(ad.created_at).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <a 
                            href={ad.file_url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="p-2 hover:bg-slate-800 rounded"
                          >
                            <Play className="w-4 h-4 text-slate-400" />
                          </a>
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            className="text-red-400 hover:text-red-300 hover:bg-red-900/20"
                            onClick={() => handleDeleteAd(ad.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  )
}
