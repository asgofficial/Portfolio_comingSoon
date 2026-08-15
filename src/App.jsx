import ComingSoonPage, { AdminPanel } from './frame2.jsx'

function App() {
  return window.location.pathname.startsWith('/admin') ? <AdminPanel /> : <ComingSoonPage />
}

export default App
