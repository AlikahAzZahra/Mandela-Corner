// client/src/pages/MenuPage.jsx — Stable, Clean UI (no logic change)
import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import '../styles/MenuPage.css';
import logo from '../assets/logo.jpeg';

/* Payment Method Modal (UI only) */
const PaymentMethodModal = ({ isOpen, onClose, onSelectMethod }) => {
  if (!isOpen) return null;
  const backdrop = (e) => { if (e.target === e.currentTarget) onClose(); };
  return (
    <div className="pm-overlay" onClick={backdrop}>
      <div className="pm-card">
        <button className="pm-close" onClick={onClose}>×</button>
        <h2 className="pm-title">Pilih Metode Pembayaran</h2>
        <div className="pm-actions">
          <button className="pm-btn pm-cash" onClick={() => onSelectMethod('bayar di kasir')}>
            <span className="pm-ic">🏪</span> Bayar di Kasir
          </button>
          <button className="pm-btn pm-online" onClick={() => onSelectMethod('bayar online')}>
            <span className="pm-ic">💳</span> Bayar Online (Midtrans)
          </button>
        </div>
      </div>
    </div>
  );
};

function MenuPage() {
  const { tableNumber } = useParams();

  const [menu, setMenu] = useState([]);
  // Cart: [{ id_menu, name, price, quantity, options: { spiciness, temperature } }]
  const [cart, setCart] = useState([]);
  const [itemSelections, setItemSelections] = useState({});

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [isCartSidebarOpen, setIsCartSidebarOpen] = useState(false);
  const [isPaymentMethodModalOpen, setIsPaymentMethodModalOpen] = useState(false);

  const [showOrderSuccessPopup, setShowOrderSuccessPopup] = useState(false);
  const [showPaymentSuccessPopup, setShowPaymentSuccessPopup] = useState(false);
  const [paymentSuccessData, setPaymentSuccessData] = useState(null);

  const API_BASE_URL = 'https://let-s-pay-server.vercel.app/api';

  // Helpers
  const cleanTableNumber = (tableNum) => {
    if (!tableNum) return tableNum;
    if (tableNum.toLowerCase().startsWith('meja ')) return tableNum.substring(5);
    return tableNum;
  };
  const getTableNumberForAPI = () => {
    if (!tableNumber || tableNumber === 'undefined' || tableNumber === undefined) return '1';
    const cleaned = cleanTableNumber(tableNumber);
    if (!cleaned || cleaned === 'undefined') return '1';
    return String(cleaned);
  };
  const formatPrice = (price) =>
    new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(Number(price || 0));

  // Fetch menu
  const fetchMenu = async () => {
    try {
      setLoading(true); setError(null);
      const r = await fetch(`${API_BASE_URL}/menu`, { headers: { Accept: 'application/json' } });
      if (!r.ok) throw new Error(`HTTP ${r.status} - ${r.statusText}`);
      const data = await r.json();
      if (!Array.isArray(data)) throw new Error('Data menu tidak valid dari server');
      setMenu(data);
      const init = {};
      data.forEach((it) => { if (it?.id_menu) init[it.id_menu] = { spiciness: '', temperature: '' }; });
      setItemSelections(init);
    } catch (e) {
      setError(`Gagal memuat menu: ${e.message}`);
      setMenu([]);
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchMenu(); }, []);

  // Lock scroll saat overlay
  useEffect(() => {
    const open = isCartSidebarOpen || isPaymentMethodModalOpen || showOrderSuccessPopup || showPaymentSuccessPopup;
    document.body.classList.toggle('cart-open', open);
    const prev = document.body.style.overflow;
    document.body.style.overflow = open ? 'hidden' : (prev || '');
    return () => { document.body.classList.remove('cart-open'); document.body.style.overflow = ''; };
  }, [isCartSidebarOpen, isPaymentMethodModalOpen, showOrderSuccessPopup, showPaymentSuccessPopup]);

  // Option change
  const handleOptionChange = (itemId, optionType, value) => {
    setItemSelections((p) => ({ ...p, [itemId]: { ...p[itemId], [optionType]: value } }));
  };

  // Cart helpers
  const findCartItem = (itemId, options) =>
    cart.find((ci) =>
      ci.id_menu === itemId &&
      ci.options.spiciness === (options.spiciness || '') &&
      ci.options.temperature === (options.temperature || '')
    );

  const addToCart = (itemToAdd) => {
    const opts = itemSelections[itemToAdd.id_menu] || { spiciness: '', temperature: '' };
    if (itemToAdd.category?.startsWith('menu mie') && !opts.spiciness) {
      alert('Silakan pilih tingkat kepedasan untuk ' + itemToAdd.name + '!');
      return;
    }
    if (itemToAdd.category?.startsWith('minuman') && !opts.temperature) {
      alert('Silakan pilih dingin/tidak dingin untuk ' + itemToAdd.name + '!');
      return;
    }
    setCart((prev) => {
      const exist = findCartItem(itemToAdd.id_menu, opts);
      if (exist) return prev.map((ci) => (ci === exist ? { ...ci, quantity: ci.quantity + 1 } : ci));
      return [...prev, { id_menu: itemToAdd.id_menu, name: itemToAdd.name, price: itemToAdd.price, quantity: 1, options: { ...opts } }];
    });
  };

  const removeFromCart = (itemInCart) => {
    setCart((prev) => {
      const exist = findCartItem(itemInCart.id_menu, itemInCart.options);
      if (!exist) return prev;
      if (exist.quantity > 1) return prev.map((ci) => (ci === exist ? { ...ci, quantity: ci.quantity - 1 } : ci));
      const n = prev.filter((ci) => ci !== exist);
      if (n.length === 0) setIsCartSidebarOpen(false);
      return n;
    });
  };

  const deleteFromCart = (itemInCart) => {
    setCart((prev) =>
      prev.filter(
        (ci) =>
          !(
            ci.id_menu === itemInCart.id_menu &&
            (ci.options?.spiciness || '') === (itemInCart.options?.spiciness || '') &&
            (ci.options?.temperature || '') === (itemInCart.options?.temperature || '')
          )
      )
    );
  };

  const getTotalItemsInCart = () => cart.reduce((s, i) => s + i.quantity, 0);
  const getTotalPrice = () => cart.reduce((s, i) => s + i.price * i.quantity, 0);

  // ORDER (logic dipertahankan)
  const processOrder = async (paymentMethod) => {
    if (getTotalItemsInCart() === 0) { alert('Keranjang belanja kosong! Silakan pilih item terlebih dahulu.'); return; }

    const orderItemsForBackend = cart.map((i) => ({
      id_menu: Number(i.id_menu),
      quantity: Number(i.quantity),
      spiciness_level: i.options?.spiciness ? String(i.options.spiciness) : null,
      temperature_level: i.options?.temperature ? String(i.options.temperature) : null,
    }));

    const tableNumberForAPI = getTableNumberForAPI();
    const checkForBooleans = (obj) => {
      const loop = (o) => {
        Object.entries(o).forEach(([k, v]) => {
          if (typeof v === 'boolean') throw new Error(`Boolean value at ${k}`);
          if (Array.isArray(v)) v.forEach(loop);
          else if (v && typeof v === 'object') loop(v);
        });
      };
      loop(obj);
    };
    try { checkForBooleans({ tableNumber: tableNumberForAPI, items: orderItemsForBackend }); }
    catch (e) { alert('Terjadi kesalahan dalam data pesanan: ' + e.message); return; }

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
          item_details: cart.map((i) => ({
            id: String(i.id_menu), name: String(i.name), price: Number(i.price), quantity: Number(i.quantity)
          })),
          custom_field1: String(getTableNumberForAPI()),
          custom_field2: JSON.stringify(orderItemsForBackend),
        };
        const tr = await fetch(`${API_BASE_URL}/midtrans/transaction`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(transactionData),
        });
        if (!tr.ok) {
          let msg = 'Gagal membuat transaksi Midtrans.'; try { const e = await tr.json(); msg = e.message || e.error || msg; } catch {}
          throw new Error(msg);
        }
        const data = await tr.json();
        window.snap.pay(data.token, {
          onSuccess: async (res) => {
            try {
              const payload = {
                tableNumber: String(getTableNumberForAPI()),
                items: orderItemsForBackend,
                payment_status: 'Sudah Bayar',
                payment_method: 'midtrans',
                midtrans_order_id: tempOrderId,
                midtrans_transaction_id: res.transaction_id,
              };
              const or = await fetch(`${API_BASE_URL}/orders`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
              });
              if (!or.ok) { alert('Pembayaran berhasil, tetapi terjadi kesalahan saat menyimpan pesanan.'); return; }
              const od = await or.json();
              setPaymentSuccessData({
                orderId: od.orderId, totalAmount: getTotalPrice(),
                transactionId: res.transaction_id, paymentType: res.payment_type || 'Online Payment',
                status: 'success',
              });
              setShowPaymentSuccessPopup(true);
              setCart([]);
              const reset = {}; menu.forEach((it) => { reset[it.id_menu] = { spiciness: '', temperature: '' }; });
              setItemSelections(reset);
              setIsCartSidebarOpen(false);
            } catch {
              alert('Pembayaran berhasil, tetapi terjadi kesalahan saat menyimpan pesanan.');
            }
          },
          onPending: async (res) => {
            try {
              const payload = {
                tableNumber: String(getTableNumberForAPI()),
                items: orderItemsForBackend,
                payment_status: 'Pending',
                payment_method: 'midtrans',
                midtrans_order_id: tempOrderId,
                midtrans_transaction_id: res.transaction_id,
              };
              const or = await fetch(`${API_BASE_URL}/orders`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
              });
              if (or.ok) {
                const od = await or.json();
                setPaymentSuccessData({
                  orderId: od.orderId, totalAmount: getTotalPrice(),
                  transactionId: res.transaction_id, paymentType: res.payment_type || 'Online Payment',
                  status: 'pending',
                });
                setShowPaymentSuccessPopup(true);
              }
            } catch {}
            setCart([]);
            const reset = {}; menu.forEach((it) => { reset[it.id_menu] = { spiciness: '', temperature: '' }; });
            setItemSelections(reset);
            setIsCartSidebarOpen(false);
          },
          onError: () => alert('Pembayaran gagal! Silakan coba lagi.'),
          onClose: () => alert('Anda menutup pop-up pembayaran tanpa menyelesaikan transaksi.'),
        });
      } catch (e) { alert(`Terjadi kesalahan saat memproses pembayaran online: ${e.message}`); }
    } else {
      try {
        const payload = {
          tableNumber: String(tableNumberForAPI),
          items: orderItemsForBackend,
          payment_status: 'Belum Bayar',
          payment_method: 'cash',
        };
        const str = JSON.stringify(payload);
        if (str.includes('true') || str.includes('false')) { alert('Error: Data mengandung nilai boolean yang tidak diperbolehkan'); return; }
        const r = await fetch(`${API_BASE_URL}/orders`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
        });
        if (!r.ok) { const e = await r.json(); throw new Error(e.message || e.error || 'Terjadi kesalahan saat mengirim pesanan.'); }
        await r.json();
        setShowOrderSuccessPopup(true);
        setCart([]);
        const reset = {}; menu.forEach((it) => { reset[it.id_menu] = { spiciness: '', temperature: '' }; });
        setItemSelections(reset);
        setIsCartSidebarOpen(false);
      } catch (e) {
        let msg = e.message;
        if (msg.includes('operator does not exist')) msg = 'Terjadi kesalahan format data pada server. Silakan coba lagi atau hubungi admin.';
        alert(`Gagal mengirim pesanan: ${msg}`);
      }
    }
    setIsPaymentMethodModalOpen(false);
  };

  const handlePlaceOrderClick = () => {
    if (getTotalItemsInCart() === 0) { alert('Keranjang belanja kosong! Silakan pilih item terlebih dahulu.'); return; }
    setIsCartSidebarOpen(false);
    setIsPaymentMethodModalOpen(true);
  };

  const closeCartSidebar = () => setIsCartSidebarOpen(false);

  if (loading) {
    return (
      <div className="menu-message">
        <span className="spinner" /> Memuat menu...
      </div>
    );
  }

  if (error) {
    return (
      <div className="menu-message menu-error">
        {error}<br />
        <button className="retry-btn" onClick={fetchMenu}>Coba Lagi</button>
      </div>
    );
  }

  // Group category
  const kategoriMenu = {};
  menu.forEach((item) => {
    const ok = item.is_available === 1 || item.is_available === true;
    if (!ok) return;
    if (!kategoriMenu[item.category]) kategoriMenu[item.category] = [];
    kategoriMenu[item.category].push(item);
  });

  const categoriesOrder = [
    'makanan-nasi','makanan-pelengkap','minuman-kopi','minuman-nonkopi',
    'menu mie-banggodrong','menu mie-aceh','menu mie-toping',
    'camilan-manis','camilan-gurih','lain-lain'
  ];

  return (
    <div className="menu-page-container">
      {/* NAVBAR */}
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

      {/* CONTENT */}
      <div className="main-menu-content">
        <h1 className="menu-page-title">Menu Restoran {tableNumber ? `(${decodeURIComponent(tableNumber)})` : 'Online'}</h1>
        <p className="menu-page-description">Silakan pilih makanan dan minuman Anda. Pembayaran dapat dilakukan di kasir atau online.</p>

        {menu.length === 0 && <p className="menu-message no-menu-available">Belum ada menu yang tersedia.</p>}

        {categoriesOrder.map((key) => {
          const items = kategoriMenu[key];
          if (!items || items.length === 0) return null;
          const displayTitle = key.replace(/-/g, ' ').toUpperCase();

          return (
            <section key={key}>
              <h2 className="menu-category-title">{displayTitle}</h2>
              <div className="menu-items-grid">
                {items.map((item) => {
                  const currentOptions = itemSelections[item.id_menu] || { spiciness: '', temperature: '' };
                  const qty = findCartItem(item.id_menu, currentOptions)?.quantity || 0;

                  return (
                    <article key={item.id_menu} className="menu-item-card">
                      <img
                        src={item.image_url ? item.image_url : 'https://placehold.co/320x180/EEF2F7/64748b?text=No+Image'}
                        onError={(e) => { e.target.onerror = null; e.target.src = 'https://placehold.co/320x180/EEF2F7/64748b?text=No+Image'; }}
                        alt={item.name}
                        className="menu-item-image"
                      />
                      <div className="menu-item-content">
                        <h3 className="menu-item-name">{item.name}</h3>
                        <p className="menu-item-description">{item.description || 'Deskripsi tidak tersedia.'}</p>
                        <p className="menu-item-price">Rp {formatPrice(item.price)}</p>

                        {item.category?.startsWith('menu mie') && (
                          <div className="item-options-group">
                            <p className="option-label">Kepedasan:</p>
                            <label>
                              <input type="radio" name={`sp-${item.id_menu}`}
                                checked={currentOptions.spiciness === 'tidak pedas'}
                                onChange={() => handleOptionChange(item.id_menu, 'spiciness', 'tidak pedas')} />
                              Tidak Pedas
                            </label>
                            <label>
                              <input type="radio" name={`sp-${item.id_menu}`}
                                checked={currentOptions.spiciness === 'pedas sedang'}
                                onChange={() => handleOptionChange(item.id_menu, 'spiciness', 'pedas sedang')} />
                              Pedas Sedang
                            </label>
                            <label>
                              <input type="radio" name={`sp-${item.id_menu}`}
                                checked={currentOptions.spiciness === 'pedas'}
                                onChange={() => handleOptionChange(item.id_menu, 'spiciness', 'pedas')} />
                              Pedas
                            </label>
                          </div>
                        )}

                        {item.category?.startsWith('minuman') && (
                          <div className="item-options-group">
                            <p className="option-label">Suhu:</p>
                            <label>
                              <input type="radio" name={`tp-${item.id_menu}`}
                                checked={currentOptions.temperature === 'dingin'}
                                onChange={() => handleOptionChange(item.id_menu, 'temperature', 'dingin')} />
                              Dingin
                            </label>
                            <label>
                              <input type="radio" name={`tp-${item.id_menu}`}
                                checked={currentOptions.temperature === 'tidak dingin'}
                                onChange={() => handleOptionChange(item.id_menu, 'temperature', 'tidak dingin')} />
                              Tidak Dingin
                            </label>
                          </div>
                        )}

                        <div className="quantity-control">
                          <button
                            onClick={() => removeFromCart({ id_menu: item.id_menu, options: currentOptions })}
                            disabled={qty === 0}
                            className="quantity-buttons removees"
                          >
                            −
                          </button>
                          <span className="quantity-display">{qty}</span>
                          <button onClick={() => addToCart(item)} className="quantity-buttons add">+</button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      {/* CART SIDEBAR */}
      <aside className={`cart-sidebar ${isCartSidebarOpen ? 'open' : ''}`}>
        <div className="cart-sidebar-header">
          <h3>🛒 Keranjang Anda ({getTotalItemsInCart()})</h3>
          <button onClick={closeCartSidebar} className="close-sidebar-button">×</button>
        </div>

        <div className="cart-items">
          {cart.length === 0 ? (
            <p className="empty-cart-message">Keranjang Anda kosong.</p>
          ) : (
            cart.map((item, idx) => (
              <div key={idx} className="cart-item">
                <button className="remove-from-cart-button" onClick={() => deleteFromCart(item)} title="Hapus item">×</button>
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

        {/* Footer keranjang — selalu tampil di HP */}
        <div className="cart-bottom-section">
          <div className="cart-summary-total">
            <p>Total: <strong>Rp {formatPrice(getTotalPrice())}</strong></p>
          </div>
          <button className="place-order-button" disabled={getTotalItemsInCart() === 0} onClick={handlePlaceOrderClick}>
            🛒 Pesan Sekarang
          </button>
        </div>
      </aside>

      {/* Overlay */}
      {isCartSidebarOpen && <div className="cart-overlay" onClick={closeCartSidebar} />}

      {/* MODAL & RESULT */}
      <PaymentMethodModal
        isOpen={isPaymentMethodModalOpen}
        onClose={() => setIsPaymentMethodModalOpen(false)}
        onSelectMethod={processOrder}
      />

      {showOrderSuccessPopup && (
        <div className="rs-overlay">
          <div className="rs-card">
            <button className="rs-close" onClick={() => setShowOrderSuccessPopup(false)}>×</button>
            <div className="rs-icon">🎉</div>
            <h3 className="rs-title">Pesanan Berhasil Dibuat!</h3>
            <p className="rs-sub">Silakan lakukan pembayaran di kasir.</p>
            <button className="rs-cta green" onClick={() => setShowOrderSuccessPopup(false)}>OK, Mengerti</button>
          </div>
        </div>
      )}

      {showPaymentSuccessPopup && paymentSuccessData && (
        <div className="rs-overlay">
          <div className="rs-card">
            <button className="rs-close" onClick={() => setShowPaymentSuccessPopup(false)}>×</button>
            {paymentSuccessData.status === 'pending' ? (
              <>
                <div className="rs-icon">⏳</div>
                <h3 className="rs-title">Pembayaran Sedang Diproses</h3>
                <div className="rs-summary rs-warn">
                  <p><strong>ID Pesanan:</strong> #{paymentSuccessData.orderId}</p>
                  <p><strong>Total:</strong> Rp {formatPrice(paymentSuccessData.totalAmount)}</p>
                  <p><strong>Metode:</strong> {paymentSuccessData.paymentType}</p>
                  <p><strong>ID Transaksi:</strong> {paymentSuccessData.transactionId}</p>
                </div>
                <button className="rs-cta amber" onClick={() => setShowPaymentSuccessPopup(false)}>OK, Mengerti</button>
              </>
            ) : (
              <>
                <div className="rs-icon">🎉</div>
                <h3 className="rs-title">Pembayaran Berhasil!</h3>
                <div className="rs-summary rs-ok">
                  <p><strong>ID Pesanan:</strong> #{paymentSuccessData.orderId}</p>
                  <p><strong>Total Dibayar:</strong> Rp {formatPrice(paymentSuccessData.totalAmount)}</p>
                  <p><strong>Metode:</strong> {paymentSuccessData.paymentType}</p>
                  <p><strong>ID Transaksi:</strong> {paymentSuccessData.transactionId}</p>
                </div>
                <button className="rs-cta green" onClick={() => setShowPaymentSuccessPopup(false)}>OK, Mengerti</button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default MenuPage;
