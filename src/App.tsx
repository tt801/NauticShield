import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { VesselDataProvider } from '@/context/VesselDataProvider'
import Layout from '@/components/Layout'
import Dashboard    from '@/pages/Dashboard'
import Devices      from '@/pages/Devices'
import Alerts       from '@/pages/Alerts'
import Zones        from '@/pages/Zones'
import Report       from '@/pages/Report'
import GuestNetwork from '@/pages/GuestNetwork'
import Voyage       from '@/pages/Voyage'
import Cyber        from '@/pages/Cyber'

export default function App() {
  return (
    <VesselDataProvider>
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/"              element={<Dashboard />} />
          <Route path="/devices"       element={<Devices />} />
          <Route path="/alerts"        element={<Alerts />} />
          <Route path="/zones"         element={<Zones />} />
          <Route path="/report"        element={<Report />} />
          <Route path="/guest-network" element={<GuestNetwork />} />
          <Route path="/voyage"        element={<Voyage />} />
          <Route path="/cyber"         element={<Cyber />} />
          <Route path="*"              element={<Dashboard />} />
        </Routes>
      </Layout>
    </BrowserRouter>
    </VesselDataProvider>
  )
}
