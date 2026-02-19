import { useEffect, useState } from 'react'
import { DashboardLayout } from '@/components/DashboardLayout'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { driverAPI } from '@/lib/api'
import { toast } from 'sonner'
import { Plus, Users, Phone, User } from 'lucide-react'

export default function DriversPage() {
  const [drivers, setDrivers] = useState([])
  const [loading, setLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [formData, setFormData] = useState({ name: '', phone: '' })

  useEffect(() => {
    loadDrivers()
  }, [])

  const loadDrivers = async () => {
    try {
      const response = await driverAPI.list()
      setDrivers(response.data)
    } catch (error) {
      toast.error('Failed to load drivers')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      await driverAPI.create(formData)
      toast.success('Driver added successfully')
      setIsDialogOpen(false)
      setFormData({ name: '', phone: '' })
      loadDrivers()
    } catch (error) {
      toast.error('Failed to add driver')
    }
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="text-slate-400" data-testid="loading-state">Loading...</div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="space-y-8" data-testid="drivers-page">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-black text-slate-100 tracking-tight" style={{ fontFamily: 'Chivo, sans-serif' }} data-testid="drivers-heading">
              Driver Management
            </h1>
            <p className="text-slate-400 mt-2">Manage fleet drivers and assignments</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-blue-600 hover:bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]" data-testid="add-driver-btn">
                <Plus className="w-4 h-4 mr-2" />
                Add Driver
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-slate-900 border-slate-800" data-testid="add-driver-dialog">
              <DialogHeader>
                <DialogTitle className="text-slate-100">Add New Driver</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="text-sm text-slate-400">Driver Name</label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="bg-slate-950 border-slate-800 text-slate-200"
                    placeholder="Rajesh Kumar"
                    required
                    data-testid="driver-name-input"
                  />
                </div>
                <div>
                  <label className="text-sm text-slate-400">Phone Number</label>
                  <Input
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="bg-slate-950 border-slate-800 text-slate-200"
                    placeholder="+91 98765 43210"
                    required
                    data-testid="driver-phone-input"
                  />
                </div>
                <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-500" data-testid="create-driver-btn">
                  Add Driver
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {drivers.length === 0 ? (
            <Card className="bg-slate-900 border-slate-800 col-span-full" data-testid="no-drivers-card">
              <CardContent className="p-12 text-center">
                <Users className="w-12 h-12 text-slate-700 mx-auto mb-4" />
                <p className="text-slate-400">No drivers registered yet</p>
                <p className="text-sm text-slate-500 mt-1">Click "Add Driver" to register your first driver</p>
              </CardContent>
            </Card>
          ) : (
            drivers.map((driver) => (
              <Card key={driver.id} className="bg-slate-900 border-slate-800 hover:border-slate-700 transition-colors" data-testid={`driver-card-${driver.id}`}>
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
                      <User className="w-6 h-6 text-blue-400" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-slate-100 mb-1" style={{ fontFamily: 'Chivo, sans-serif' }} data-testid={`driver-name-${driver.id}`}>
                        {driver.name}
                      </h3>
                      <div className="flex items-center gap-2 text-sm text-slate-400">
                        <Phone className="w-4 h-4" />
                        <span data-testid={`driver-phone-${driver.id}`}>{driver.phone}</span>
                      </div>
                      <div className="mt-3">
                        <span className={`text-xs font-medium uppercase ${
                          driver.status === 'active' ? 'text-green-400' : 'text-slate-500'
                        }`} data-testid={`driver-status-${driver.id}`}>
                          {driver.status}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}
