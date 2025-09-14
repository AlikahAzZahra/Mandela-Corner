// client/src/pages/MenuPage.jsx - MODERN UI + MOBILE CART BOTTOM FIX
import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import '../styles/MenuPage.css';
import logo from '../assets/logo.jpeg';

/* ===== PaymentMethodModal (UI) ===== */
const PaymentMethodModal = ({ isOpen, onClose, onSelectMethod }) => {
  if (!isOpen) return null;

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div className="payment-method-modal-overlay" onClick={handleBackdropClick}>
      <div className="payment-method-modal">
        <div className="payment-method-header">
          <button onClick={onClose} className="payment-method-close">×</button>
          <h2>Pilih Metode Pembayaran</h2>
        </div>
        <div className="payment-method-content">
          <button
            onClick={() => onSelectMethod('bayar di kasir')}
            className="payment-method-button cash"
          >
            Bayar di Kasir
          </button>
          <button
            onClick={() => onSelectMethod('bayar online')}
            className="payment-method-button online"
          >
            Bayar Online (Midtrans)
          </button>
        </div>
      </div>
    </div>
  );
};

function MenuPage() {
  const { tableNumber } = useParams();
  const [menu, setMenu] = useState([]);
  const [cart, setCart] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [itemSelections, setItemSelections] = useState({});
  const [showOrderSuccessPopup, setShowOrderSuccessPopup] = useState(false);
  const [showPaymentSuccessPopup, setShowPaymentSuccessPopup] = useState(false);
  const [paymentSuccessData, setPaymentSuccessData] = useState(null);
  const [isCartSidebarOpen, setIsCartSidebarOpen] = useState(false);
  const [isPaymentMethodModalOpen, setIsPaymentMethodModalOpen] = useState(false);

  const API_BASE_URL = 'https://let-s-pay-server.vercel.app/api';

  const cleanTableNumber = (tableNum) => {
    if (!tableNum) return tableNum;
    if (tableNum.toLowerCase().startsWith('meja ')) return tableNum.substring(5);
    return tableNum;
  };

  const getTableNumberForAPI = () => {
    if (!tableNumber || tableNumber === 'undefined' || tableNumber === undefined) return '1';
    const cleanedNumber = cleanTableNumber(tableNumber);
    if (!cleanedNumber || cleanedNumber === 'undefined') return '1';
    return String(cleanedNumber);
  };

  const formatPrice = (price) => {
    if (price == null || isNaN(price)) return '0';
    const numPrice = Number(price);
    return new Intl.NumberFormat('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(numPrice);
  };

  const fetchMenu = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`${API_BASE_URL}/menu`, {
        method: 'GET',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' }
      });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status} - ${response.statusText}`);
      const data = await response.json();
      if (!Array.isArray(data)) throw new Error('Data menu tidak valid dari server');
      setMenu(data);
      const initialSelections = {};
      data.forEach(item => { if (item && item.id_menu) initialSelections[item.id_menu] = { spiciness: '', temperature: '' }; });
      setItemSelections(initialSelections);
    } catch (err) {
      setError(`Gagal memuat menu: ${err.message}`);
      setMenu([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchMenu(); }, []);

  useEffect(() => {
    const open = isCartSidebarOpen || isPaymentMethodModalOpen || showOrderSuccessPopup || showPaymentSuccessPopup;
    document.body.classList.toggle('cart-open', open);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = open ? 'hidden' : (prevOverflow || '');
    return () => { document.body.classList.remove('cart-open'); document.body.style.overflow = ''; };
  }, [isCartSidebarOpen, isPaymentMethodModalOpen, showOrderSuccessPopup, showPaymentSuccessPopup]);

  const handleOptionChange = (itemId, optionType, value) => {
    setItemSelections(prev => ({ ...prev, [itemId]: { ...prev[itemId], [optionType]: value } }));
  };

  const findCartItem = (itemId, options) =>
    cart.find(c =>
      c.id_menu === itemId &&
      c.options.spiciness === (options.spiciness || '') &&
      c.options.temperature === (options.temperature || '')
    );

  const addToCart = (itemToAdd) => {
    const optionsForThisItem = itemSelections[itemToAdd.id_menu] || { spiciness: '', temperature: '' };
    if (itemToAdd.category && itemToAdd.category.startsWith('menu mie') && !optionsForThisItem.spiciness) {
      alert('Silakan pilih tingkat kepedasan untuk ' + itemToAdd.name + '!');
      return;
    }
    if (itemToAdd.category && itemToAdd.category.startsWith('minuman') && !optionsForThisItem.temperature) {
      alert('Silakan pilih dingin/tidak dingin untuk ' + itemToAdd.name + '!');
      return;
    }

    setCart(prev => {
      const existingCartItem = findCartItem(itemToAdd.id_menu, optionsForThisItem);
      if (existingCartItem) {
        return prev.map(ci => (ci === existingCartItem ? { ...ci, quantity: ci.quantity + 1 } : ci));
      }
      return [
        ...prev,
        {
          id_menu: itemToAdd.id_menu,
          name: itemToAdd.name,
          price: itemToAdd.price,
          quantity: 1,
          options: { ...optionsForThisItem }
        }
      ];
    });
  };

  const removeFromCart = (itemInCart) => {
    setCart(prev => {
      const existingCartItem = findCartItem(itemInCart.id_menu, itemInCart.options);
      if (existingCartItem) {
        if (existingCartItem.quantity > 1) {
          return prev.map(ci => (ci === existingCartItem ? { ...ci, quantity: ci.quantity - 1 } : ci));
        } else {
          const newCart = prev.filter(ci => ci !== existingCartItem);
          if (newCart.length === 0) setIsCartSidebarOpen(false);
          return newCart;
        }
      }
      return prev;
    });
  };

  const deleteFromCart = (itemInCart) => {
    setCart(prev =>
      prev.filter(ci =>
        !(
          ci.id_menu === itemInCart.id_menu &&
          (ci.options?.spiciness || '') === (itemInCart.options?.spiciness || '') &&
          (ci.options?.temperature || '') === (itemInCart.options?.temperature || '')
        )
      )
    );
  };

  const getTotalItemsInCart = () => cart.reduce((s, i) => s + i.quantity, 0);
  const getTotalPrice = () => cart.reduce((s, i) => s + (i.price * i.quantity), 0);

  const processOrder = async (paymentMethod) => {
    if (getTotalItemsInCart() === 0) { alert('Keranjang belanja kosong! Silakan pilih item terlebih dahulu.'); return; }

    const orderItemsForBackend = cart.map(item => ({
      id_menu: Number(item.id_menu),
      quantity: Number(item.quantity),
      spiciness_level: (item.options?.spiciness && item.options.spiciness !== '') ? String(item.options.spiciness) : null,
      temperature_level: (item.options?.temperature && item.options.temperature !== '') ? String(item.options.temperature) : null
    }));

    const tableNumberForAPI = getTableNumberForAPI();
    if (typeof tableNumberForAPI !== 'string') { alert('Error: Nomor meja harus berupa teks.'); return; }

    const fullOrderPreview = { tableNumber: tableNumberForAPI, items: orderItemsForBackend };
    const checkForBooleans = (obj) => {
      const loop = (o) => {
        Object.entries(o).forEach(([k, v]) => {
          if (typeof v === 'boolean') throw new Error(`Boolean value found in order data at ${k}: ${v}`);
          if (Array.isArray(v)) v.forEach(loop);
          else if (v && typeof v === 'object') loop(v);
        });
      };
      loop(obj);
    };
    try { checkForBooleans(fullOrderPreview); } catch (e) { alert('Terjadi kesalahan dalam data pesanan: ' + e.message); return; }

    if (paymentMethod === 'bayar online') {
      if (typeof window === 'undefined' || !window.snap || typeof window.snap.pay !== 'function') {
        alert('Sistem pembayaran belum siap. Pastikan koneksi internet stabil dan refresh halaman.');
        return;
      }
      try {
        const tempOrderId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const transactionData = {
          order_id: tempOrderId,
          gross_amount: Number(getTotalPrice()),
          item_details: cart.map(item => ({
            id: String(item.id_menu),
            name: String(item.name),
            price: Number(item.price),
            quantity: Number(item.quantity)
          })),
          custom_field1: String(getTableNumberForAPI()),
          custom_field2: JSON.stringify(orderItemsForBackend)
        };
        const midtransResponse = await fetch(`${API_BASE_URL}/midtrans/transaction`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(transactionData)
        });
        if (!midtransResponse.ok) {
          let msg = 'Gagal membuat transaksi Midtrans.'; try {
            const err = await midtransResponse.json(); msg = err.message || err.error || msg;
          } catch { msg = `Server error (${midtransResponse.status})`; }
          throw new Error(msg);
        }
        const midtransData = await midtransResponse.json();
        window.snap.pay(midtransData.token, {
          onSuccess: async (result) => {
            try {
              const orderPayload = {
                tableNumber: String(getTableNumberForAPI()),
                items: orderItemsForBackend,
                payment_status: 'Sudah Bayar',
                payment_method: 'midtrans',
                midtrans_order_id: tempOrderId,
                midtrans_transaction_id: result.transaction_id
              };
              const orderResponse = await fetch(`${API_BASE_URL}/orders`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(orderPayload)
              });
              if (!orderResponse.ok) { alert('Pembayaran berhasil, tetapi terjadi kesalahan saat menyimpan pesanan. Silakan hubungi staff.'); return; }
              const orderData = await orderResponse.json();
              setPaymentSuccessData({
                orderId: orderData.orderId,
                totalAmount: getTotalPrice(),
                transactionId: result.transaction_id,
                paymentType: result.payment_type || 'Online Payment',
                status: 'success'
              });
              setShowPaymentSuccessPopup(true);
              setCart([]);
              const resetSelections = {};
              menu.forEach(item => { resetSelections[item.id_menu] = { spiciness: '', temperature: '' }; });
              setItemSelections(resetSelections);
              setIsCartSidebarOpen(false);
            } catch {
              alert('Pembayaran berhasil, tetapi terjadi kesalahan saat menyimpan pesanan. Silakan hubungi staff.');
            }
          },
          onPending: async (result) => {
            try {
              const orderPayload = {
                tableNumber: String(getTableNumberForAPI()),
                items: orderItemsForBackend,
                payment_status: 'Pending',
                payment_method: 'midtrans',
                midtrans_order_id: tempOrderId,
                midtrans_transaction_id: result.transaction_id
              };
              const orderResponse = await fetch(`${API_BASE_URL}/orders`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(orderPayload)
              });
              if (orderResponse.ok) {
                const orderData = await orderResponse.json();
                setPaymentSuccessData({
                  orderId: orderData.orderId,
                  totalAmount: getTotalPrice(),
                  transactionId: result.transaction_id,
                  paymentType: result.payment_type || 'Online Payment',
                  status: 'pending'
                });
                setShowPaymentSuccessPopup(true);
              }
            } catch {}
            setCart([]);
            const resetSelections = {};
            menu.forEach(item => { resetSelections[item.id_menu] = { spiciness: '', temperature: '' }; });
            setItemSelections(resetSelections);
            setIsCartSidebarOpen(false);
          },
          onError: () => alert('Pembayaran gagal! Silakan coba lagi.'),
          onClose: () => alert('Anda menutup pop-up pembayaran tanpa menyelesaikan transaksi.')
        });
      } catch (error) {
        alert(`Terjadi kesalahan saat memproses pembayaran online: ${error.message}`);
      }
    } else {
      try {
        const orderPayload = {
          tableNumber: String(tableNumberForAPI),
          items: orderItemsForBackend,
          payment_status: 'Belum Bayar',
          payment_method: 'cash'
        };
        const payloadStr = JSON.stringify(orderPayload);
        if (payloadStr.includes('true') || payloadStr.includes('false')) {
          alert('Error: Data mengandung nilai boolean yang tidak diperbolehkan'); return;
        }
        const orderResponse = await fetch(`${API_BASE_URL}/orders`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(orderPayload)
        });
        if (!orderResponse.ok) {
          const errorData = await orderResponse.json();
          throw new Error(errorData.message || errorData.error || 'Terjadi kesalahan saat mengirim pesanan.');
        }
        await orderResponse.json();
        setShowOrderSuccessPopup(true);
        setCart([]);
        const resetSelections = {};
        menu.forEach(item => { resetSelections[item.id_menu] = { spiciness: '', temperature: '' }; });
        setItemSelections(resetSelections);
        setIsCartSidebarOpen(false);
      } catch (error) {
        let errorMessage = error.message;
        if (error.message.includes('operator does not exist')) {
          errorMessage = 'Terjadi kesalahan format data pada server. Silakan coba lagi atau hubungi admin.';
        }
        alert(`Gagal mengirim pesanan: ${errorMessage}`);
        return;
      }
    }
    setIsPaymentMethodModalOpen(false);
  };

  const handlePlaceOrderClick = () => {
    if (getTotalItemsInCart() === 0) { alert('Keranjang belanja kosong! Silakan pilih item terlebih dahulu.'); return; }
    setIsCartSidebarOpen(false);
    setIsPaymentMethodModalOpen(true);
  };

  const handleCloseOrderSuccessPopup = () => setShowOrderSuccessPopup(false);
  const handleClosePaymentSuccessPopup = () => { setShowPaymentSuccessPopup(false); setPaymentSuccessData(null); };
  const closeCartSidebar = () => setIsCartSidebarOpen(false);

  if (loading) {
    return (
      <div className="menu-message">
        <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:'12px'}}>
          <div style={{width:20,height:20,border:'3px solid #e2e8f0',borderTop:'3px solid #667eea',borderRadius:'50%',animation:'spin 1s linear infinite'}}></div>
          Memuat menu...
        </div>
        <style>{`@keyframes spin{0%{transform:rotate(0)}100%{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div className="menu-message menu-error">
        {error}<br />
        <button
          onClick={fetchMenu}
          style={{
            marginTop:'16px',padding:'12px 24px',background:'var(--gradient-primary)',color:'#fff',
            border:'none',borderRadius:'25px',cursor:'pointer',fontWeight:600,transition:'all .3s',
            boxShadow:'0 4px 12px rgba(102,126,234,.3)'
          }}
          onMouseEnter={(e)=>{e.target.style.transform='translateY(-2px)';e.target.style.boxShadow='0 8px 20px rgba(102,126,234,.4)';}}
          onMouseLeave={(e)=>{e.target.style.transform='translateY(0)';e.target.style.boxShadow='0 4px 12px rgba(102,126,234,.3)';}}
        >
          Coba Lagi
        </button>
      </div>
    );
  }

  const kategoriMenu = {};
  menu.forEach(item => {
    const isAvailable = item.is_available === 1 || item.is_available === true;
    if (isAvailable) {
      const categoryKey = item.category;
      if (!kategoriMenu[categoryKey]) kategoriMenu[categoryKey] = [];
      kategoriMenu[categoryKey].push(item);
    }
  });

  const categoriesOrder = [
    'makanan-nasi','makanan-pelengkap','minuman-kopi','minuman-nonkopi',
    'menu mie-banggodrong','menu mie-aceh','menu mie-toping','camilan-manis','camilan-gurih','lain-lain'
  ];

  return (
    <div className="menu-page-container">
      <nav className="main-navbar">
        <div className="navbar-logo-group">
          <img src={logo} alt="Logo Mandela Corner" className="navbar-logo" />
          <div className="navbar-text">
            <span className="navbar-app-name">Mandela Corner</span>
            <span className="navbar-slogan">Pesan makanan & minuman favoritmu!</span>
          </div>
        </div>
        <button className={`cart-toggle-button ${isCartSidebarOpen ? 'hidden' : ''}`} onClick={() => setIsCartSidebarOpen(true)}>
          🛒 Keranjang ({getTotalItemsInCart()})
        </button>
      </nav>

      <div className="main-menu-content">
        <h1 className="menu-page-title">Menu Restoran {tableNumber ? `(${decodeURIComponent(tableNumber)})` : 'Online'}</h1>
        <p className="menu-page-description">Silakan pilih makanan dan minuman Anda. Pembayaran dapat dilakukan di kasir atau online.</p>

        {menu.length === 0 && !loading && !error && (
          <p className="menu-message no-menu-available">Belum ada menu yang tersedia.</p>
        )}

        {categoriesOrder.map(categoryKey => {
          const items = kategoriMenu[categoryKey];
          if (!items || items.length === 0) return null;
          const displayTitle = categoryKey.replace(/-/g, ' ').toUpperCase();

          return (
            <div key={categoryKey}>
              <h2 className="menu-category-title">{displayTitle}</h2>
              <div className="menu-items-grid">
                {items.map(item => {
                  const currentOptions = itemSelections[item.id_menu] || { spiciness: '', temperature: '' };
                  const currentQuantityInCart = findCartItem(item.id_menu, currentOptions)?.quantity || 0;

                  return (
                    <div key={item.id_menu} className="menu-item-card">
                      <img
                        src={item.image_url ? item.image_url : 'https://placehold.co/180x180/667eea/FFFFFF?text=No+Image'}
                        onError={(e)=>{e.target.onerror=null;e.target.src='https://placehold.co/180x180/667eea/FFFFFF?text=No+Image';}}
                        alt={item.name}
                        className="menu-item-image"
                      />
                      <div className="menu-item-content">
                        <h3 className="menu-item-name">{item.name}</h3>
                        <p className="menu-item-description">{item.description || 'Deskripsi tidak tersedia.'}</p>
                        <p className="menu-item-price">Rp {formatPrice(item.price)}</p>

                        {item.category && item.category.startsWith('menu mie') && (
                          <div className="item-options-group">
                            <p className="option-label">Kepedasan:</p>
                            <label>
                              <input type="radio" name={`spiciness-${item.id_menu}`} value="tidak pedas"
                                checked={currentOptions.spiciness === 'tidak pedas'}
                                onChange={() => handleOptionChange(item.id_menu, 'spiciness', 'tidak pedas')} />
                              Tidak Pedas
                            </label>
                            <label>
                              <input type="radio" name={`spiciness-${item.id_menu}`} value="pedas sedang"
                                checked={currentOptions.spiciness === 'pedas sedang'}
                                onChange={() => handleOptionChange(item.id_menu, 'spiciness', 'pedas sedang')} />
                              Pedas Sedang
                            </label>
                            <label>
                              <input type="radio" name={`spiciness-${item.id_menu}`} value="pedas"
                                checked={currentOptions.spiciness === 'pedas'}
                                onChange={() => handleOptionChange(item.id_menu, 'spiciness', 'pedas')} />
                              Pedas
                            </label>
                          </div>
                        )}

                        {item.category && item.category.startsWith('minuman') && (
                          <div className="item-options-group">
                            <p className="option-label">Suhu:</p>
                            <label>
                              <input type="radio" name={`temperature-${item.id_menu}`} value="dingin"
                                checked={currentOptions.temperature === 'dingin'}
                                onChange={() => handleOptionChange(item.id_menu, 'temperature', 'dingin')} />
                              Dingin
                            </label>
                            <label>
                              <input type="radio" name={`temperature-${item.id_menu}`} value="tidak dingin"
                                checked={currentOptions.temperature === 'tidak dingin'}
                                onChange={() => handleOptionChange(item.id_menu, 'temperature', 'tidak dingin')} />
                              Tidak Dingin
                            </label>
                          </div>
                        )}

                        <div className="quantity-control">
                          <button
                            onClick={() => removeFromCart({ id_menu: item.id_menu, options: currentOptions })}
                            disabled={currentQuantityInCart === 0}
                            className="quantity-buttons removees"
                          >
                            −
                          </button>
                          <span className="quantity-display">{currentQuantityInCart}</span>
                          <button onClick={() => addToCart(item)} className="quantity-buttons add">+</button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Sidebar Keranjang */}
      <div className={`cart-sidebar ${isCartSidebarOpen ? 'open' : ''}`}>
        <div className="cart-sidebar-header">
          <h3>🛒 Keranjang Anda ({getTotalItemsInCart()})</h3>
          <button onClick={closeCartSidebar} className="close-sidebar-button">×</button>
        </div>

        <div className="cart-items">
          {cart.length === 0 ? (
            <p className="empty-cart-message">Keranjang Anda kosong.</p>
          ) : (
            cart.map((item, index) => (
              <div key={index} className="cart-item">
                <button onClick={() => deleteFromCart(item)} className="remove-from-cart-button" title="Hapus item">×</button>
                <div className="cart-item-top-row">
                  <div className="cart-item-left">
                    <span className="cart-item-quantity">{item.quantity}x</span>
                    <span className="cart-item-name">{item.name}</span>
                  </div>
                </div>
                <div className="cart-item-price">Rp {formatPrice(item.price * item.quantity)}</div>
                {(item.options.spiciness || item.options.temperature) && (
                  <div className="cart-item-options">
                    {item.options.spiciness && <span className="cart-item-option">{item.options.spiciness}</span>}
                    {item.options.temperature && <span className="cart-item-option">{item.options.temperature}</span>}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* ===== FIX: selalu terlihat di HP ===== */}
        <div className="cart-bottom-section">
          <div className="cart-summary-total">
            <p>Total: <strong>Rp {formatPrice(getTotalPrice())}</strong></p>
          </div>

          <button
            onClick={handlePlaceOrderClick}
            disabled={getTotalItemsInCart() === 0}
            className="place-order-button"
          >
            🛒 Pesan Sekarang
          </button>
        </div>
        {/* ===== end fix ===== */}
      </div>
      {isCartSidebarOpen && <div className="cart-overlay" onClick={closeCartSidebar}></div>}

      {/* Modal Metode Pembayaran */}
      <PaymentMethodModal
        isOpen={isPaymentMethodModalOpen}
        onClose={() => setIsPaymentMethodModalOpen(false)}
        onSelectMethod={processOrder}
      />

      {/* Popup Cash */}
      {showOrderSuccessPopup && (
        <div className="payment-success-overlay">
          <div className="payment-success-content">
            <div className="success-icon">🎉</div>
            <h2 style={{ color: 'var(--success-color)', marginBottom: 20 }}>Pesanan Berhasil Dibuat!</h2>
            <p style={{ fontSize: '1.1em', color: '#555', marginBottom: 20 }}>
              Pesanan Anda telah kami terima dan sedang diproses. Silakan lakukan pembayaran di kasir.
            </p>
            <button onClick={setShowOrderSuccessPopup.bind(null, false)} className="success-button">OK, Mengerti</button>
          </div>
        </div>
      )}

      {/* Popup Online (success/pending) */}
      {showPaymentSuccessPopup && paymentSuccessData && (
        <div className="payment-success-overlay">
          <div className="payment-success-content">
            {paymentSuccessData.status === 'pending' ? (
              <>
                <div className="pending-icon">⏳</div>
                <h2 style={{ color: 'var(--warning-color)', marginBottom: 20 }}>Pembayaran Sedang Diproses!</h2>
                <p style={{ fontSize: '1.1em', color: '#555', marginBottom: 15 }}>
                  Pembayaran Anda sedang dalam proses verifikasi.
                </p>
                <div className="success-details pending">
                  <p><strong>ID Pesanan:</strong> #{paymentSuccessData.orderId}</p>
                  <p><strong>Total:</strong> Rp {formatPrice(paymentSuccessData.totalAmount)}</p>
                  <p><strong>Metode:</strong> {paymentSuccessData.paymentType}</p>
                  <p><strong>ID Transaksi:</strong> {paymentSuccessData.transactionId}</p>
                </div>
                <p style={{ fontSize: '.95em', color: '#6c757d', marginBottom: 20 }}>
                  Kami akan memproses pesanan Anda setelah pembayaran dikonfirmasi. Terima kasih atas kesabaran Anda!
                </p>
                <button onClick={() => setShowPaymentSuccessPopup(false)} className="success-button pending">OK, Mengerti</button>
              </>
            ) : (
              <>
                <div className="success-icon">🎉</div>
                <h2 style={{ color: 'var(--success-color)', marginBottom: 20 }}>Pembayaran Berhasil!</h2>
                <p style={{ fontSize: '1.1em', color: '#555', marginBottom: 15 }}>
                  Terima kasih! Pembayaran Anda telah berhasil dan pesanan sedang diproses.
                </p>
                <div className="success-details">
                  <p><strong>ID Pesanan:</strong> #{paymentSuccessData.orderId}</p>
                  <p><strong>Total Dibayar:</strong> Rp {formatPrice(paymentSuccessData.totalAmount)}</p>
                  <p><strong>Metode:</strong> {paymentSuccessData.paymentType}</p>
                  <p><strong>ID Transaksi:</strong> {paymentSuccessData.transactionId}</p>
                </div>
                <p style={{ fontSize: '.95em', color: '#6c757d', marginBottom: 20 }}>
                  Pesanan Anda akan segera disiapkan. Silakan menunggu di tempat duduk Anda.
                </p>
                <button onClick={() => setShowPaymentSuccessPopup(false)} className="success-button">OK, Mengerti</button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default MenuPage;
