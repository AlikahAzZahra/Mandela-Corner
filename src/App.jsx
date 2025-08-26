// client/src/App.jsx
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import MenuPage from './pages/MenuPage';
import AdminPage from './pages/AdminPage'; 
import './App.css';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<MenuPage />} /> 
        <Route path="/menu/:tableNumber" element={<MenuPage />} />
        <Route path="/admin" element={<AdminPage />} />
      </Routes>
    </Router>
  );
}

export default App;
