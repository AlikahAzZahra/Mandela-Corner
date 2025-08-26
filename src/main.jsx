
import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css'
import App from './App.jsx'; // Mengimpor komponen App.jsx

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App /> {/* Merender komponen App */}
  </React.StrictMode>
);
