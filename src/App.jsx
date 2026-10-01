import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ThemeProvider } from './context/ThemeContext'
import { AuthProvider } from './context/AuthContext'
import VoucherPortal from './components/VoucherPortal'
import VoucherDetail from './components/VoucherDetail'
import UserProfile from './components/UserProfile'
import './App.css'

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<VoucherPortal />} />
            <Route path="/voucher/:id" element={<VoucherDetail />} />
            <Route path="/profile" element={<UserProfile />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  )
}

export default App