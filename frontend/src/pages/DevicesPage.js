import { useEffect, useState } from 'react'
import { DashboardLayout } from '@/components/DashboardLayout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { deviceAPI, driverAPI } from '@/lib/api'
import { toast } from 'sonner'
import { Plus, Smartphone, Battery, Wifi, MapPin, Clock, RefreshCw, Power, Circle, Filter } from 'lucide-react'

export default function DevicesPage() {
  const [devices, setDevices] = useState([])
  const [drivers, setDrivers] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [cityFilter, setCityFilter] = useState('')
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [selectedDevice, setSelectedDevice] = useState(null)
  const [editData, setEditData] = useState({ city: '', driver_id: '' })

  useEffect(() => {
    loadData()
    // Auto-refresh every 30 seconds
    const interval = setInterval(loadData, 30000)
    return () => clearInterval(interval)
  }, [])

  const loadData = async () => {
    try {
      const [devicesRes, driversRes] = await Promise.all([
        deviceAPI.list(),
        driverAPI.list()
      ])
      setDevices(devicesRes.data || [])
      setDrivers(driversRes.data || [])
    } catch (error) {
      console.error('Failed to load devices:', error)
      toast.error('Failed to load devices')
    } finally {
      setLoading(false)
    }
  }

  const openEditDialog = (device) => {
    setSelectedDevice(device)
    setEditData({
      city: device.city || '',
      driver_id: device.driver_id || ''
    })
    setIsEditDialogOpen(true)
  }

  const handleUpdateDevice = async () => {
    if (!selectedDevice) return

    try {
      await deviceAPI.update(selectedDevice.id, editData)
      toast.success('Device updated')
      setIsEditDialogOpen(false)
      loadData()
    } catch (error) {
      toast.error('Failed to update device')
    }
  }

  const handleDeleteDevice = async (deviceId) => {
    if (!confirm('Are you sure you want to delete this device?')) return

    try {
      await deviceAPI.delete(deviceId)
      toast.success('Device deleted')
      loadData()
    } catch (error) {
      toast.error('Failed to delete device')
    }
  }

  // Get unique cities for filter
  const cities = [...new Set(devices.map(d => d.city).filter(Boolean))]

  // Filter devices
  const filteredDevices = devices.filter(device => {
    if (filter === 'online' && device.status !== 'online') return false
    if (filter === 'offline' && device.status === 'online') return false
    if (cityFilter && device.city !== cityFilter) return false
    return true
  })

  // Stats
  const onlineCount = devices.filter(d => d.status === 'online').length
  const offlineCount = devices.length - onlineCount

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
      <div className="space-y-8" data-testid="devices-page">
        {/* Header */}
        <div className="flex flex-col lg:flex-row justify-between gap-4">
          <div>
            <h1 className="text-4xl font-black text-slate-100 tracking-tight" style={{ fontFamily: 'Chivo, sans-serif' }}>
              Device Management
            </h1>
            <p className="text-slate-400 mt-2">Monitor and control fleet tablets in real-time</p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" className="border-slate-700" onClick={loadData}>
              <RefreshCw className="w-4 h-4 mr-2" /> Refresh
            </Button>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-slate-900 border-slate-800">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 bg-slate-950 rounded-lg">
                <Smartphone className="w-6 h-6 text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-100">{devices.length}</p>
                <p className="text-sm text-slate-500">Total Devices</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-slate-900 border-slate-800">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 bg-green-900/30 rounded-lg">
                <Circle className="w-6 h-6 text-green-400 fill-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-green-400">{onlineCount}</p>
                <p className="text-sm text-slate-500">Online</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-slate-900 border-slate-800">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 bg-red-900/30 rounded-lg">
                <Circle className="w-6 h-6 text-red-400 fill-red-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-red-400">{offlineCount}</p>
                <p className="text-sm text-slate-500">Offline</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-500" />
            <span className="text-sm text-slate-400">Filter:</span>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={filter === 'all' ? 'default' : 'outline'}
              className={filter === 'all' ? 'bg-blue-600' : 'border-slate-700'}
              onClick={() => setFilter('all')}
            >
              All ({devices.length})
            </Button>
            <Button
              size="sm"
              variant={filter === 'online' ? 'default' : 'outline'}
              className={filter === 'online' ? 'bg-green-600' : 'border-slate-700'}
              onClick={() => setFilter('online')}
            >
              Online ({onlineCount})
            </Button>
            <Button
              size="sm"
              variant={filter === 'offline' ? 'default' : 'outline'}
              className={filter === 'offline' ? 'bg-red-600' : 'border-slate-700'}
              onClick={() => setFilter('offline')}
            >
              Offline ({offlineCount})
            </Button>
          </div>
          {cities.length > 0 && (
            <Select value={cityFilter || "all"} onValueChange={(v) => setCityFilter(v === "all" ? "" : v)}>
              <SelectTrigger className="w-40 bg-slate-950 border-slate-800 text-slate-200">
                <SelectValue placeholder="All Cities" />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-slate-800">
                <SelectItem value="all" className="text-slate-200">All Cities</SelectItem>
                {cities.map(city => (
                  <SelectItem key={city} value={city} className="text-slate-200">{city}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Devices Table */}
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-950">
                  <tr className="border-b border-slate-800">
                    <th className="text-left py-4 px-6 text-sm font-medium text-slate-400">Device Code</th>
                    <th className="text-left py-4 px-6 text-sm font-medium text-slate-400">Status</th>
                    <th className="text-left py-4 px-6 text-sm font-medium text-slate-400">City</th>
                    <th className="text-left py-4 px-6 text-sm font-medium text-slate-400">Last Seen</th>
                    <th className="text-left py-4 px-6 text-sm font-medium text-slate-400">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDevices.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-12 text-slate-500">
                        <Smartphone className="w-12 h-12 mx-auto mb-4 opacity-30" />
                        <p>No devices found</p>
                      </td>
                    </tr>
                  ) : (
                    filteredDevices.map((device) => (
                      <tr key={device.id} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-slate-950 rounded">
                              <Smartphone className="w-4 h-4 text-blue-400" />
                            </div>
                            <div>
                              <span className="font-mono text-sm text-slate-200 font-medium">
                                {device.device_code}
                              </span>
                              {device.model && (
                                <p className="text-xs text-slate-500">{device.model}</p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-6">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                            device.status === 'online' 
                              ? 'bg-green-900/30 text-green-400 border border-green-800' 
                              : 'bg-red-900/30 text-red-400 border border-red-800'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${
                              device.status === 'online' ? 'bg-green-400 animate-pulse' : 'bg-red-400'
                            }`} />
                            {device.status?.toUpperCase() || 'OFFLINE'}
                          </span>
                        </td>
                        <td className="py-4 px-6">
                          <span className="text-sm text-slate-400">
                            {device.city || <span className="text-slate-600">Not assigned</span>}
                          </span>
                        </td>
                        <td className="py-4 px-6">
                          <span className="text-sm text-slate-500 flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5" />
                            {device.last_seen 
                              ? new Date(device.last_seen).toLocaleString()
                              : 'Never'
                            }
                          </span>
                        </td>
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-2">
                            <Button 
                              size="sm" 
                              variant="outline" 
                              className="border-slate-700 text-slate-400 hover:text-slate-200"
                              onClick={() => openEditDialog(device)}
                            >
                              Edit
                            </Button>
                            <Button 
                              size="sm" 
                              variant="ghost" 
                              className="text-red-400 hover:text-red-300 hover:bg-red-900/20"
                              onClick={() => handleDeleteDevice(device.id)}
                            >
                              Delete
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Edit Device Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="bg-slate-900 border-slate-800">
            <DialogHeader>
              <DialogTitle className="text-slate-100">
                Edit Device - {selectedDevice?.device_code}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div>
                <label className="text-sm text-slate-400">Assign City</label>
                <Input
                  value={editData.city}
                  onChange={(e) => setEditData({ ...editData, city: e.target.value })}
                  className="bg-slate-950 border-slate-800 text-slate-200"
                  placeholder="e.g., Bangalore, Chennai"
                />
              </div>
              <div>
                <label className="text-sm text-slate-400">Assign Driver</label>
                <Select 
                  value={editData.driver_id || "none"} 
                  onValueChange={(value) => setEditData({ ...editData, driver_id: value === "none" ? "" : value })}
                >
                  <SelectTrigger className="bg-slate-950 border-slate-800 text-slate-200">
                    <SelectValue placeholder="Select driver" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-800">
                    <SelectItem value="none" className="text-slate-200">No driver</SelectItem>
                    {drivers.map((driver) => (
                      <SelectItem key={driver.id} value={driver.id} className="text-slate-200">
                        {driver.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button 
                className="w-full bg-blue-600 hover:bg-blue-500"
                onClick={handleUpdateDevice}
              >
                Save Changes
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  )
}
