import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import VoucherPortal from './components/VoucherPortal'
import VoucherDetail from './components/VoucherDetail'
import './App.css'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<VoucherPortal />} />
        <Route path="/voucher/:id" element={<VoucherDetail />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App