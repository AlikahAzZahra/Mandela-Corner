// client/src/pages/MenuPage.jsx - IMPROVED MODERN DESIGN (Responsive Universal, No Function Changes)
import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import '../styles/MenuPage.css'; // Import file CSS yang sudah diperbaharui
import logo from '../assets/logo.jpeg';

// Komponen PaymentMethodModal yang sudah diperbaharui
const PaymentMethodModal = ({ isOpen, onClose, onSelectMethod }) => {
  if (!isOpen) return null;

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
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
  // Cart: [{ id_menu, name, price, quantity, options: { spiciness, temperature } }]
  const [cart, setCart] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Opsi sementara per item
  const [itemSelections, setItemSelections] = useState({});

  // Popup bayar di kasir
  const [showOrderSuccessPopup, setShowOrderSuccessPopup] = useState(false);

  // Popup pembayaran online
  const [showPaymentSuccessPopup, setShowPaymentSuccessPopup] = useState(false);
  const [paymentSuccessData, setPaymentSuccessData] = useState(null);

  // Sidebar keranjang
  const [isCartSidebarOpen, setIsCartSidebarOpen] = useState(false);

  // Modal metode pembayaran
  const [isPaymentMethodModalOpen, setIsPaymentMethodModalOpen] = useState(false);

  const API_BASE_URL = 'https://let-s-pay-server.vercel.app/api';

  // Helper bersihkan nomor meja
  const cleanTableNumber = (tableNum) => {
    if (!tableNum) return tableNum;
    if (tableNum.toLowerCase().startsWith('meja ')) return tableNum.substring(5);
    return tableNum;
  };

  // Nomor meja sebagai STRING untuk API
  const getTableNumberForAPI = () => {
    if (!tableNumber || tableNumber === 'undefined' || tableNumber === undefined) return '1';
    const cleanedNumber = cleanTableNumber(tableNumber);
    if (!cleanedNumber || cleanedNumber === 'undefined') return '1';
    return String(cleanedNumber);
  };

  // Format Rupiah
  const formatPrice = (price) => {
    if (price == null || isNaN(price)) return '0';
    return new Intl.NumberFormat('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
      .format(Number(price));
  };

  // Ambil menu
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
      data.forEach(item => { if (item?.id_menu) initialSelections[item.id_menu] = { spiciness: '', temperature: '' }; });
      setItemSelections(initialSelections);
    } catch (err) {
      setError(`Gagal memuat menu: ${err.message}`);
      setMenu([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMenu();
    // Debug snap
    // console.log('Midtrans Snap available:', !!window.snap);
  }, []);

  // Lock scroll saat overlay/sidebars aktif
  useEffect(() => {
    const open = isCartSidebarOpen || isPaymentMethodModalOpen || showOrderSuccessPopup || showPaymentSuccessPopup;
    document.body.classList.toggle('cart-open', open);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = open ? 'hidden' : prevOverflow || '';
    return () => { document.body.classList.remove('cart-open'); document.body.style.overflow = ''; };
  }, [isCartSidebarOpen, isPaymentMethodModalOpen, showOrderSuccessPopup, showPaymentSuccessPopup]);

  // Ubah opsi item
  const handleOptionChange = (itemId, optionType, value) => {
    setItemSelections(prev => ({ ...prev, [itemId]: { ...(prev[itemId] || {}), [optionType]: value } }));
  };

  // Temukan item pada cart (berdasarkan id + opsi)
  const findCartItem = (itemId, options) => {
    return cart.find(cartItem =>
      cartItem.id_menu === itemId &&
      cartItem.options.spiciness === (options.spiciness || '') &&
      cartItem.options.temperature === (options.temperature || '')
    );
  };

  // Tambah item ke cart
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

    setCart(prevCart => {
      const existingCartItem = findCartItem(itemToAdd.id_menu, optionsForThisItem);
      if (existingCartItem) {
        return prevCart.map(cartItem =>
          cartItem === existingCartItem
            ? { ...cartItem, quantity: cartItem.quantity + 1 }
            : cartItem
        );
      } else {
        return [
          ...prevCart,
          {
            id_menu: itemToAdd.id_menu,
            name: itemToAdd.name,
            price: itemToAdd.price,
            quantity: 1,
            options: { ...optionsForThisItem }
          }
        ];
      }
    });
  };

  // Kurangi item
  const removeFromCart = (itemInCart) => {
    setCart(prevCart => {
      const existingCartItem = findCartItem(itemInCart.id_menu, itemInCart.options);
      if (existingCartItem) {
        if (existingCartItem.quantity > 1) {
          return prevCart.map(cartItem =>
            cartItem === existingCartItem
              ? { ...cartItem, quantity: cartItem.quantity - 1 }
              : cartItem
          );
        } else {
          const newCart = prevCart.filter(cartItem => cartItem !== existingCartItem);
          if (newCart.length === 0) setIsCartSidebarOpen(false);
          return newCart;
        }
      }
      return prevCart;
    });
  };

  // Hapus varian dari cart
  const deleteFromCart = (itemInCart) => {
    setCart(prevCart => {
      const newCart = prevCart.filter(cartItem =>
        !(
          cartItem.id_menu === itemInCart.id_menu &&
          (cartItem.options?.spiciness || '') === (itemInCart.options?.spiciness || '') &&
          (cartItem.options?.temperature || '') === (itemInCart.options?.temperature || '')
        )
      );
      if (newCart.length === 0) setIsCartSidebarOpen(false);
      return newCart;
    });
  };

  const getTotalItemsInCart = () => cart.reduce((sum, item) => sum + item.quantity, 0);
  const getTotalPrice = () => cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  // Proses pesanan (fungsi sama, tanpa perubahan logika)
  const processOrder = async (paymentMethod) => {
    if (getTotalItemsInCart() === 0) {
      alert('Keranjang belanja kosong! Silakan pilih item terlebih dahulu.');
      return;
    }

    const orderItemsForBackend = cart.map(item => ({
      id_menu: Number(item.id_menu),
      quantity: Number(item.quantity),
      spiciness_level: (item.options?.spiciness && item.options.spiciness !== '') ? String(item.options.spiciness) : null,
      temperature_level: (item.options?.temperature && item.options.temperature !== '') ? String(item.options.temperature) : null
    }));

    const tableNumberForAPI = getTableNumberForAPI();
    if (typeof tableNumberForAPI !== 'string') { alert('Error: Nomor meja harus berupa teks.'); return; }

    // Cek boolean
    const checkForBooleans = (obj, path = '') => {
      Object.entries(obj).forEach(([key, value]) => {
        const currentPath = path ? `${path}.${key}` : key;
        if (typeof value === 'boolean') throw new Error(`Boolean value found at ${currentPath}`);
        if (Array.isArray(value)) value.forEach((v, i) => (typeof v === 'object' && v) && checkForBooleans(v, `${currentPath}[${i}]`));
        else if (typeof value === 'object' && value) checkForBooleans(value, currentPath);
      });
    };
    try { checkForBooleans({ tableNumber: tableNumberForAPI, items: orderItemsForBackend }); }
    catch (err) { alert('Terjadi kesalahan dalam data pesanan: ' + err.message); return; }

    if (paymentMethod === 'bayar online') {
      if (typeof window === 'undefined' || !window.snap || typeof window.snap.pay !== 'function') {
        alert('Sistem pembayaran belum siap. Pastikan koneksi internet stabil & refresh halaman.');
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
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(transactionData)
        });
        if (!midtransResponse.ok) {
          let errorMessage = 'Gagal membuat transaksi Midtrans.';
          try { const errorData = await midtransResponse.json(); errorMessage = errorData.message || errorData.error || errorMessage; } catch {}
          throw new Error(errorMessage);
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
              if (!orderResponse.ok) throw new Error('Pembayaran berhasil, tetapi terjadi kesalahan saat menyimpan pesanan.');
              const orderData = await orderResponse.json();

              setPaymentSuccessData({
                orderId: orderData.orderId,
                totalAmount: getTotalPrice(),
                transactionId: result.transaction_id,
                paymentType: result.payment_type || 'Online Payment',
                status: 'success'
              });
              setShowPaymentSuccessPopup(true);
              setCart([]); const resetSel = {}; menu.forEach(it => resetSel[it.id_menu] = { spiciness: '', temperature: '' }); setItemSelections(resetSel); setIsCartSidebarOpen(false);
            } catch (orderError) {
              alert(orderError.message);
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
              await fetch(`${API_BASE_URL}/orders`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(orderPayload)
              });
              setPaymentSuccessData({
                orderId: tempOrderId,
                totalAmount: getTotalPrice(),
                transactionId: result.transaction_id,
                paymentType: result.payment_type || 'Online Payment',
                status: 'pending'
              });
              setShowPaymentSuccessPopup(true);
            } finally {
              setCart([]); const resetSel = {}; menu.forEach(it => resetSel[it.id_menu] = { spiciness: '', temperature: '' }); setItemSelections(resetSel); setIsCartSidebarOpen(false);
            }
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
        const orderResponse = await fetch(`${API_BASE_URL}/orders`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(orderPayload)
        });
        if (!orderResponse.ok) {
          let errorMessage = 'Terjadi kesalahan saat mengirim pesanan.';
          try { const ed = await orderResponse.json(); errorMessage = ed.message || ed.error || errorMessage; } catch {}
          throw new Error(errorMessage);
        }
        await orderResponse.json();
        setShowOrderSuccessPopup(true);
        setCart([]); const resetSel = {}; menu.forEach(it => resetSel[it.id_menu] = { spiciness: '', temperature: '' }); setItemSelections(resetSel); setIsCartSidebarOpen(false);
      } catch (error) {
        alert(`Gagal mengirim pesanan: ${error.message}`);
        return;
      }
    }
    setIsPaymentMethodModalOpen(false);
  };

  // Tutup keranjang → buka modal pembayaran
  const handlePlaceOrderClick = () => {
    if (getTotalItemsInCart() === 0) {
      alert('Keranjang belanja kosong! Silakan pilih item terlebih dahulu.');
      return;
    }
    setIsCartSidebarOpen(false);
    setIsPaymentMethodModalOpen(true);
  };

  // Close handlers
  const handleCloseOrderSuccessPopup = () => setShowOrderSuccessPopup(false);
  const handleClosePaymentSuccessPopup = () => { setShowPaymentSuccessPopup(false); setPaymentSuccessData(null); };
  const closeCartSidebar = () => setIsCartSidebarOpen(false);

  if (loading) {
    return (
      <div className="menu-message">
        <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:'12px'}}>
          <div style={{width:'20px',height:'20px',border:'3px solid #e2e8f0',borderTop:'3px solid #667eea',borderRadius:'50%',animation:'spin 1s linear infinite'}}></div>
          Memuat menu...
        </div>
        <style>{`
          @keyframes spin { 0%{transform:rotate(0)} 100%{transform:rotate(360deg)} }
        `}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div className="menu-message menu-error">
        {error}
        <br />
        <button
          onClick={fetchMenu}
          style={{
            marginTop:'16px', padding:'12px 24px',
            background:'var(--gradient-primary)', color:'white',
            border:'none', borderRadius:'25px', cursor:'pointer', fontWeight:'600',
            transition:'all .3s ease', boxShadow:'0 4px 12px rgba(102,126,234,.3)'
          }}
          onMouseEnter={(e)=>{ e.target.style.transform='translateY(-2px)'; e.target.style.boxShadow='0 8px 20px rgba(102,126,234,.4)'; }}
          onMouseLeave={(e)=>{ e.target.style.transform='translateY(0)'; e.target.style.boxShadow='0 4px 12px rgba(102,126,234,.3)'; }}
        >
          Coba Lagi
        </button>
      </div>
    );
  }

  // Kelompok kategori yang tersedia
  const kategoriMenu = {};
  menu.forEach(item => {
    const isAvailable = item.is_available === 1 || item.is_available === true;
    if (isAvailable) (kategoriMenu[item.category] ||= []).push(item);
  });

  const processImageUrl = (imageUrl) => {
  if (!imageUrl) {
    return "https://placehold.co/200x150/CCCCCC/000000?text=No+Image";
  }
  
  // Jika URL Google Drive, konversi ke direct view
  if (imageUrl.includes('drive.google.com')) {
    // Format: https://drive.google.com/file/d/FILE_ID/view?usp=sharing
    const match = imageUrl.match(/\/file\/d\/([^/]+)/);
    if (match && match[1]) {
      return `https://drive.google.com/uc?export=view&id=${match[1]}`;
    }
    
    // Format: https://drive.google.com/open?id=FILE_ID
    const urlParams = new URLSearchParams(imageUrl.split('?')[1]);
    const fileId = urlParams.get('id');
    if (fileId) {
      return `https://drive.google.com/uc?export=view&id=${fileId}`;
    }
  }
  
  return imageUrl;
};

const MenuItemImage = ({ imageUrl, altText, className }) => {
  const [imgSrc, setImgSrc] = useState(processImageUrl(imageUrl));
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setImgSrc(processImageUrl(imageUrl));
    setHasError(false);
    setIsLoading(true);
  }, [imageUrl]);

  const handleError = () => {
    if (!hasError) {
      console.log('Image failed to load:', imgSrc);
      setHasError(true);
      setImgSrc("https://placehold.co/200x150/CCCCCC/000000?text=No+Image");
    }
  };

  const handleLoad = () => {
    setIsLoading(false);
  };

  return (
    <div className="menu-item-image-container">
      {isLoading && (
        <div className="menu-item-image-loading">
          <div className="loading-spinner"></div>
          <span>Loading...</span>
        </div>
      )}
      <img
        src={imgSrc}
        alt={altText || "Menu Item"}
        className={`${className || 'menu-item-image'} ${isLoading ? 'loading' : 'loaded'}`}
        onError={handleError}
        onLoad={handleLoad}
        loading="lazy"
      />
    </div>
  );
};

const MenuItemCard = ({ item, onAddToCart, cartItemsMap, onOptionChange, itemSelections }) => {
  const currentOpts = itemSelections[item.id_menu] || { spiciness: "", temperature: "" };
  const qty = cartItemsMap[item.id_menu]?.quantity || 0;

  return (
    <div className={`menu-item ${qty > 0 ? 'selected' : ''}`}>
      <MenuItemImage
        imageUrl={item.image_url}
        altText={item.name}
        className="menu-item-image"
      />
      
      <div className="menu-item-content">
        <div className="menu-item-header">
          <h3 className="menu-item-name">{item.name || "Unknown Item"}</h3>
          <p className="menu-item-price">Rp {formatPrice(item.price)}</p>
        </div>

        {item.description && (
          <p className="menu-item-description">{item.description}</p>
        )}

        {/* Options untuk Mie */}
        {item.category?.startsWith("menu mie") && (
          <div className="menu-item-options">
            <label className="option-label">Kepedasan:</label>
            <div className="radio-group">
              {["tidak pedas", "pedas sedang", "pedas"].map((level) => (
                <label key={level} className="radio-option">
                  <input
                    type="radio"
                    name={`spiciness-${item.id_menu}`}
                    value={level}
                    checked={currentOpts.spiciness === level}
                    onChange={() => onOptionChange(item.id_menu, "spiciness", level)}
                  />
                  <span className="radio-label">{level}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Options untuk Minuman */}
        {item.category?.startsWith("minuman") && (
          <div className="menu-item-options">
            <label className="option-label">Suhu:</label>
            <div className="radio-group">
              {["dingin", "tidak dingin"].map((temp) => (
                <label key={temp} className="radio-option">
                  <input
                    type="radio"
                    name={`temperature-${item.id_menu}`}
                    value={temp}
                    checked={currentOpts.temperature === temp}
                    onChange={() => onOptionChange(item.id_menu, "temperature", temp)}
                  />
                  <span className="radio-label">{temp}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        <div className="quantity-controls">
          <button
            className="qty-btn minus"
            onClick={() => onAddToCart(item, -1)}
            disabled={qty === 0}
          >
            -
          </button>
          <span className="qty-display">{qty}</span>
          <button
            className="qty-btn plus"
            onClick={() => onAddToCart(item, 1)}
          >
            +
          </button>
        </div>
      </div>
    </div>
  );
};

const useImagePreloader = (imageSrcs) => {
  useEffect(() => {
    imageSrcs.forEach((src) => {
      if (src && !src.includes('placehold.co')) {
        const img = new Image();
        img.src = processImageUrl(src);
      }
    });
  }, [imageSrcs]);
};

// 6. Contoh penggunaan dalam MenuPage component
const MenuPageExample = ({ menuItems, onAddToCart, cartItemsMap, onOptionChange, itemSelections }) => {
  // Preload images
  const imageSrcs = menuItems.map(item => item.image_url).filter(Boolean);
  useImagePreloader(imageSrcs);

  return (
    <div className="menu-items-grid">
      {menuItems.map((item) => (
        <MenuItemCard
          key={item.id_menu}
          item={item}
          onAddToCart={onAddToCart}
          cartItemsMap={cartItemsMap}
          onOptionChange={onOptionChange}
          itemSelections={itemSelections}
        />
      ))}
    </div>
  );
};

  const categoriesOrder = [
    'makanan-nasi', 'makanan-pelengkap', 'minuman-kopi', 'minuman-nonkopi',
    'menu mie-banggodrong', 'menu mie-aceh', 'menu mie-toping',
    'camilan-manis', 'camilan-gurih', 'lain-lain'
  ];

  return (
    <div className="menu-page-container">
      {/* Navbar */}
      <nav className="main-navbar">
        <div className="navbar-logo-group">
          <img src={logo} alt="Logo Mandela Corner" className="navbar-logo" />
          <div className="navbar-text">
            <span className="navbar-app-name">Mandela Corner</span>
            <span className="navbar-slogan">Pesan makanan &amp; minuman favoritmu!</span>
          </div>
        </div>
        <button className={`cart-toggle-button ${isCartSidebarOpen ? 'hidden' : ''}`} onClick={() => setIsCartSidebarOpen(true)}>
          🛒 Keranjang ({getTotalItemsInCart()})
        </button>
      </nav>

      {/* Konten utama */}
      <div className="main-menu-content">
        <h1 className="menu-page-title">
          Menu Restoran (Meja {tableNumber ? `(${decodeURIComponent tableNumber})` : 'Online'})
        </h1>
        <p className="menu-page-description">
          Silakan pilih makanan dan minuman Anda. Pembayaran dapat dilakukan di kasir atau online.
        </p>

        {menu.length === 0 && !loading && !error && (
          <p className="menu-message no-menu-available">Belum ada menu yang tersedia.</p>
        )}

        {categoriesOrder.map(categoryKey => {
          const items = kategoriMenu[categoryKey];
          if (!items?.length) return null;

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
                        src={item.image_url || 'https://placehold.co/180x180/667eea/FFFFFF?text=No+Image'}
                        onError={(e) => { e.target.onerror=null; e.target.src='https://placehold.co/180x180/667eea/FFFFFF?text=No+Image'; }}
                        alt={item.name}
                        className="menu-item-image"
                      />
                      <div className="menu-item-content">
                        <h3 className="menu-item-name">{item.name}</h3>
                        <p className="menu-item-description">{item.description || 'Deskripsi tidak tersedia.'}</p>
                        <p className="menu-item-price">Rp {formatPrice(item.price)}</p>

                        {/* Opsi Kepedasan */}
                        {item.category && item.category.startsWith('menu mie') && (
                          <div className="item-options-group">
                            <p className="option-label">Kepedasan:</p>
                            <label>
                              <input
                                type="radio"
                                name={`spiciness-${item.id_menu}`}
                                value="tidak pedas"
                                checked={currentOptions.spiciness === 'tidak pedas'}
                                onChange={() => handleOptionChange(item.id_menu, 'spiciness', 'tidak pedas')}
                              />
                              Tidak Pedas
                            </label>
                            <label>
                              <input
                                type="radio"
                                name={`spiciness-${item.id_menu}`}
                                value="pedas sedang"
                                checked={currentOptions.spiciness === 'pedas sedang'}
                                onChange={() => handleOptionChange(item.id_menu, 'spiciness', 'pedas sedang')}
                              />
                              Pedas Sedang
                            </label>
                            <label>
                              <input
                                type="radio"
                                name={`spiciness-${item.id_menu}`}
                                value="pedas"
                                checked={currentOptions.spiciness === 'pedas'}
                                onChange={() => handleOptionChange(item.id_menu, 'spiciness', 'pedas')}
                              />
                              Pedas
                            </label>
                          </div>
                        )}

                        {/* Opsi Suhu */}
                        {item.category && item.category.startsWith('minuman') && (
                          <div className="item-options-group">
                            <p className="option-label">Suhu:</p>
                            <label>
                              <input
                                type="radio"
                                name={`temperature-${item.id_menu}`}
                                value="dingin"
                                checked={currentOptions.temperature === 'dingin'}
                                onChange={() => handleOptionChange(item.id_menu, 'temperature', 'dingin')}
                              />
                              Dingin
                            </label>
                            <label>
                              <input
                                type="radio"
                                name={`temperature-${item.id_menu}`}
                                value="tidak dingin"
                                checked={currentOptions.temperature === 'tidak dingin'}
                                onChange={() => handleOptionChange(item.id_menu, 'temperature', 'tidak dingin')}
                              />
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

      {/* Sidebar keranjang */}
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
                <button
                  onClick={() => deleteFromCart(item)}
                  className="remove-from-cart-button"
                  title="Hapus item"
                >
                  ×
                </button>

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

        {/* Footer keranjang (summary + tombol) */}
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
      {isCartSidebarOpen && <div className="cart-overlay" onClick={closeCartSidebar}></div>}

      {/* Modal metode pembayaran */}
      <PaymentMethodModal
        isOpen={isPaymentMethodModalOpen}
        onClose={() => setIsPaymentMethodModalOpen(false)}
        onSelectMethod={processOrder}
      />

      {/* Popup bayar di kasir */}
      {showOrderSuccessPopup && (
        <div className="payment-success-overlay">
          <div className="payment-success-content">
            <div className="success-icon">🎉</div>
            <h2 style={{ color: 'var(--success-color)', marginBottom: '20px' }}>Pesanan Berhasil Dibuat!</h2>
            <p style={{ fontSize: '1.1em', color: '#555', marginBottom: '20px' }}>
              Pesanan Anda telah kami terima dan sedang diproses. Silakan lakukan pembayaran di kasir.
            </p>
            <button onClick={handleCloseOrderSuccessPopup} className="success-button">OK, Mengerti</button>
          </div>
        </div>
      )}

      {/* Popup online (success/pending) */}
      {showPaymentSuccessPopup && paymentSuccessData && (
        <div className="payment-success-overlay">
          <div className="payment-success-content">
            {paymentSuccessData.status === 'pending' ? (
              <>
                <div className="pending-icon">⏳</div>
                <h2 style={{ color: 'var(--warning-color)', marginBottom: '20px' }}>Pembayaran Sedang Diproses!</h2>
                <p style={{ fontSize: '1.1em', color: '#555', marginBottom: '15px' }}>
                  Pembayaran Anda sedang dalam proses verifikasi.
                </p>
                <div className="success-details pending">
                  <p><strong>ID Pesanan:</strong> #{paymentSuccessData.orderId}</p>
                  <p><strong>Total:</strong> Rp {formatPrice(paymentSuccessData.totalAmount)}</p>
                  <p><strong>Metode:</strong> {paymentSuccessData.paymentType}</p>
                  <p><strong>ID Transaksi:</strong> {paymentSuccessData.transactionId}</p>
                </div>
                <p style={{ fontSize: '0.95em', color: '#6c757d', marginBottom: '20px' }}>
                  Kami akan memproses pesanan Anda setelah pembayaran dikonfirmasi.
                </p>
                <button onClick={handleClosePaymentSuccessPopup} className="success-button pending">OK, Mengerti</button>
              </>
            ) : (
              <>
                <div className="success-icon">🎉</div>
                <h2 style={{ color: 'var(--success-color)', marginBottom: '20px' }}>Pembayaran Berhasil!</h2>
                <p style={{ fontSize: '1.1em', color: '#555', marginBottom: '15px' }}>
                  Terima kasih! Pembayaran Anda telah berhasil dan pesanan sedang diproses.
                </p>
                <div className="success-details">
                  <p><strong>ID Pesanan:</strong> #{paymentSuccessData.orderId}</p>
                  <p><strong>Total Dibayar:</strong> Rp {formatPrice(paymentSuccessData.totalAmount)}</p>
                  <p><strong>Metode:</strong> {paymentSuccessData.paymentType}</p>
                  <p><strong>ID Transaksi:</strong> {paymentSuccessData.transactionId}</p>
                </div>
                <p style={{ fontSize: '0.95em', color: '#6c757d', marginBottom: '20px' }}>
                  Pesanan Anda akan segera disiapkan. Silakan menunggu di tempat duduk Anda.
                </p>
                <button onClick={handleClosePaymentSuccessPopup} className="success-button">OK, Mengerti</button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default MenuPage;
