import { BrowserRouter, Routes, Route } from 'react-router-dom'
import MainPage from './pages/main/MainPage.jsx'
import Service from './pages/main/Service.jsx'
import PrivacyPolicy from './pages/main/PrivacyPolicy.jsx'
import SchoolPage from './pages/main/SchoolPage.jsx'
import Login from './pages/main/Login.jsx'
import ResetPassword from './pages/main/ResetPassword.jsx'
import StudentHome from './pages/main/StudentHome.jsx'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<MainPage />} />
        <Route path="/privacy" element={<PrivacyPolicy />} />
        <Route path="/resetpassword" element={<ResetPassword />} />
        <Route path="/login" element={<Login />} />
        <Route path="/schoolpage" element={<SchoolPage />} />
        <Route path="/service" element={<Service />} />
        <Route path="/studenthome" element={<StudentHome />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
