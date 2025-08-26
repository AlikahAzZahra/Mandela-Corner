// client/src/pages/TentangKami.jsx
import React from 'react';
import { Link, useParams } from 'react-router-dom'; // PERBAIKAN: Import useParams
import logo from '../assets/logo.jpeg';
import './TentangKami.css';

const TentangKami = () => {
  // Dapatkan nomor meja dari URL
  const { tableNumber } = useParams();

  return (
    <div className="about-us-container">
      <div className="about-us-card">
        <img src={logo} alt="Mandela Corner Logo" className="about-us-logo" />
        <h2 className="about-us-title">Tentang Mandela Corner</h2>
        <p className="about-us-description">
          Mandela Corner adalah sebuah rumah makan yang berlokasi di Bengkulu. 
          Kami menyajikan berbagai menu makanan dan minuman terbaik dengan cita rasa autentik.
        </p>
        <div className="about-us-contact">
          <h3>Hubungi Kami</h3>
          <p><strong>Email:</strong> <a href="mailto:Mandel.cornerbkl@gmail.com">Mandel.cornerbkl@gmail.com</a></p>
          <p><strong>Instagram:</strong> <a href="https://www.instagram.com/mandela_corner" target="_blank" rel="noopener noreferrer">@mandela_corner</a></p>
          <p><strong>WhatsApp:</strong> <a href="https://wa.me/6282123450189" target="_blank" rel="noopener noreferrer">082123450189</a></p>
        </div>
      </div>
      <div className="back-to-menu">
        {/* Menggunakan nomor meja dari useParams untuk navigasi kembali yang spesifik */}
        <Link to={tableNumber ? `/menu/${tableNumber}` : '/'} className="back-to-menu-button">
            Kembali ke Menu
        </Link>
      </div>
    </div>
  );
};

export default TentangKami;
