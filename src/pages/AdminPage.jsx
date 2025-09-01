// client/src/pages/AdminPage.jsx - REVISED (create menu made obvious + image by link + faster orders list)
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import '../styles/AdminPage.css';
import PaymentModal from '../components/PaymentModal';

const AdminPage = () => {
  // ============ UTIL ============
  const getTodayDateString = () => {
    try {
      const today = new Date();
      const y = today.getFullYear();
      const m = String(today.getMonth() + 1).padStart(2, '0');
      const d = String(today.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    } catch {
      return '2024-01-01';
    }
  };
  const formatPrice = (price) => {
    try {
      const n = Number(price || 0);
      return new Intl.NumberFormat('id-ID').format(n);
    } catch {
      return String(price || 0);
    }
  };
  const formatOrderTime = (ts) => {
    try {
      if (!ts) return 'Invalid Date';
      const dt = new Date(ts);
      if (isNaN(dt.getTime())) return 'Invalid Date';
      return dt
        .toLocaleString('en-GB', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        })
        .replace(',', '');
    } catch {
      return 'Invalid Date';
    }
  };
  const safeJsonParse = (s, fb = []) => {
    try {
      if (!s || typeof s !== 'string') return fb;
      const p = JSON.parse(s);
      return p ?? fb;
    } catch {
      return fb;
    }
  };
  const safeLocalStorage = (key, fb = null) => {
    try {
      if (typeof window === 'undefined' || typeof localStorage === 'undefined') return fb;
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : fb;
    } catch {
      return fb;
    }
  };

  // ============ STATE ============
  const ordersAbortRef = useRef(null);
  const ordersInFlightRef = useRef(false);

  const [token, setToken] = useState(() => {
    try { return localStorage.getItem('adminToken') || ''; } catch { return ''; }
  });
  const [userRole, setUserRole] = useState(() => {
    try { return localStorage.getItem('userRole') || ''; } catch { return ''; }
  });

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [orders, setOrders] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [tables, setTables] = useState([]);

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  // ⬇️ Link gambar (bukan upload file)
  const [newMenu, setNewMenu] = useState({
    name: '',
    description: '',
    price: '',
    category: 'makanan-nasi',
    is_available: 1,
    imageLink: '',
    keepExistingImage: true,
  });
  const [editingMenu, setEditingMenu] = useState(null);

  const [newTable, setNewTable] = useState({ table_number: '', capacity: '' });

  const [generatedQRs, setGeneratedQRs] = useState(() => safeLocalStorage('generatedQRs', []));

  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [selectedOrderIdForPayment, setSelectedOrderIdForPayment] = useState(0);
  const [selectedOrderTotalAmount, setSelectedOrderTotalAmount] = useState(0);

  const [activeTab, setActiveTab] = useState('pesanan');
  const [activeMenuSubTab, setActiveMenuSubTab] = useState('menu-list');

  const [isAddOrderModalOpen, setIsAddOrderModalOpen] = useState(false);
  const [newOrderCustomerName, setNewOrderCustomerName] = useState('');
  const [newOrderCart, setNewOrderCart] = useState([]);
  const [newOrderItemSelections, setNewOrderItemSelections] = useState({});

  const [selectedOrderForDetail, setSelectedOrderForDetail] = useState(null);
  const [isEditOrderModalOpen, setIsEditOrderModalOpen] = useState(false);
  const [editOrderCart, setEditOrderCart] = useState([]);
  const [editOrderItemSelections, setEditOrderItemSelections] = useState({});
  const [editOrderNote, setEditOrderNote] = useState('');

  const [reportData, setReportData] = useState({
    totalSales: 0,
    totalOrders: 0,
    completedOrders: 0,
    cancelledOrders: 0,
    pendingOrders: 0,
    totalSalesToday: 0,
    totalOrdersToday: 0,
    topSellingItems: [],
    salesByPaymentMethod: [],
    salesByDate: [],
  });
  const [reportDateRange, setReportDateRange] = useState({
    startDate: getTodayDateString(),
    endDate: getTodayDateString(),
  });
  const [isLoadingReport, setIsLoadingReport] = useState(false);

  const [apiBaseUrl, setApiBaseUrl] = useState('https://let-s-pay-server.vercel.app/api');
  const API_PORTS = [{ url: 'https://let-s-pay-server.vercel.app/api' }];

  // ============ UI ============
  const toggleSidebar = () => setSidebarCollapsed((v) => !v);
  const toggleMobileMenu = () => setMobileMenuOpen((v) => !v);
  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setActiveMenuSubTab('menu-list');
    setMobileMenuOpen(false);
  };

  // Quick action: buka form create
  const gotoCreateMenu = () => {
    setEditingMenu(null);
    setNewMenu({
      name: '',
      description: '',
      price: '',
      category: 'makanan-nasi',
      is_available: 1,
      imageLink: '',
      keepExistingImage: true,
    });
    setActiveMenuSubTab('menu-form');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ============ CATEGORY ============
  const groupMenuByCategory = (menu) => {
    const g = {};
    menu.forEach((it) => {
      if (it && (it.is_available === 1 || it.is_available === true || it.is_available === '1')) {
        const c = it.category || 'lain-lain';
        if (!g[c]) g[c] = [];
        g[c].push(it);
      }
    });
    return g;
  };
  const getCategoryDisplayName = (category) => {
    const names = {
      'makanan-nasi': 'MAKANAN - NASI',
      'makanan-pelengkap': 'MAKANAN - PELENGKAP',
      'minuman-kopi': 'MINUMAN - KOPI',
      'minuman-nonkopi': 'MINUMAN - NON KOPI',
      'menu mie-banggodrong': 'MENU MIE - BANGGONDRONG',
      'menu mie-aceh': 'MENU MIE - ACEH',
      'menu mie-toping': 'MENU MIE - TOPING',
      'camilan-manis': 'CAMILAN - MANIS',
      'camilan-gurih': 'CAMILAN - GURIH',
      'lain-lain': 'LAIN-LAIN',
    };
    return names[category] || category.toUpperCase();
  };

  // ============ REFRESH ============
  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      await fetchOrders(true);
      setLastRefresh(new Date());
      alert('Data berhasil di-refresh!');
    } catch (e) {
      alert('Gagal refresh data');
    } finally {
      setIsRefreshing(false);
    }
  };

  // ============ AUTH ============
  const handleLogin = async () => {
    setLoginError('');
    setIsLoggingIn(true);
    if (!username.trim() || !password.trim()) {
      setLoginError('Username dan password harus diisi');
      setIsLoggingIn(false);
      return;
    }
    const timeout = new Promise((_, rej) =>
      setTimeout(() => rej(new Error('Request timeout - Server tidak merespon dalam 15 detik')), 15000)
    );
    try {
      const response = await Promise.race([
        fetch(`${apiBaseUrl}/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ username: username.trim(), password: password.trim() }),
        }),
        timeout,
      ]);
      if (!response.ok) {
        let msg = `HTTP ${response.status}: ${response.statusText}`;
        try {
          const t = await response.text();
          try { msg = JSON.parse(t).message || msg; } catch { msg = t || msg; }
        } catch {}
        throw new Error(msg);
      }
      const data = await response.json();
      if (!data || !data.token || !data.user) throw new Error('Response tidak lengkap - missing token/user');
      localStorage.setItem('adminToken', data.token);
      localStorage.setItem('userRole', data.user.role || '');
      setToken(data.token);
      setUserRole(data.user.role || '');
      setUsername('');
      setPassword('');
      alert('Login berhasil sebagai ' + (data.user.role || 'user') + '!');
    } catch (e) {
      if (e.message.includes('Failed to fetch') || e.message.includes('NetworkError')) {
        setLoginError('❌ Tidak dapat terhubung ke server.');
      } else if (e.message.includes('timeout')) {
        setLoginError('⏰ Login timeout - Server tidak merespon.');
      } else if (e.message.includes('CORS')) {
        setLoginError('🚫 CORS Error - Server perlu mengizinkan akses dari frontend');
      } else {
        setLoginError(`❌ Login gagal: ${e.message}`);
      }
    } finally {
      setIsLoggingIn(false);
    }
  };
  const handleLogout = () => {
    try {
      localStorage.removeItem('adminToken');
      localStorage.removeItem('userRole');
      setToken('');
      setUserRole('');
      setUsername('');
      setPassword('');
      setLoginError('');
      setOrders([]);
      setMenuItems([]);
      setTables([]);
      alert('Anda telah logout.');
    } catch {}
  };

  // ============ FETCH ============
  const fetchOrders = async (forceRefresh = false) => {
    if (!token) return;
    try { ordersAbortRef.current?.abort(); } catch {}
    ordersAbortRef.current = new AbortController();
    if (ordersInFlightRef.current) return;
    ordersInFlightRef.current = true;
    try {
      const ts = forceRefresh ? `?t=${Date.now()}` : '';
      const res = await fetch(`${apiBaseUrl}/orders${ts}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
          'Cache-Control': 'no-cache',
          Pragma: 'no-cache',
        },
        signal: ordersAbortRef.current.signal,
      });
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          handleLogout();
          return;
        }
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      const data = await res.json();
      setOrders(Array.isArray(data) ? data : []);
    } catch (e) {
      if (e.name !== 'AbortError') setOrders([]);
    } finally {
      ordersInFlightRef.current = false;
    }
  };
  const fetchMenuItems = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${apiBaseUrl}/menu`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) { handleLogout(); return; }
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      const data = await res.json();
      const arr = Array.isArray(data) ? data : [];
      setMenuItems(arr);
      // init selections (kasir modal)
      const sel = {};
      arr.forEach((it) => { if (it?.id_menu) sel[it.id_menu] = { spiciness: '', temperature: '' }; });
      setNewOrderItemSelections(sel);
    } catch (e) {
      setMenuItems([]);
    }
  };
  const fetchTables = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${apiBaseUrl}/tables`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) { handleLogout(); return; }
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      const data = await res.json();
      setTables(Array.isArray(data) ? data : []);
    } catch (e) {
      setTables([]);
    }
  };

  // ============ MENU (ADMIN) ============
  const handleImageLinkChange = (e) => {
    const v = e.target.value;
    setNewMenu((prev) => ({ ...prev, imageLink: v, keepExistingImage: v.trim() === '' ? true : false }));
  };

  const handleAddOrUpdateMenu = async () => {
    try {
      if (!newMenu.name.trim() || newMenu.price === '' || newMenu.category === '') {
        alert('Nama, harga, dan kategori menu tidak boleh kosong!');
        return;
      }

      const payloadBase = {
        name: newMenu.name.trim(),
        description: (newMenu.description || '').trim(),
        price: Number(newMenu.price), // pastikan number
        category: newMenu.category,
        is_available: newMenu.is_available ? 1 : 0,
      };

      let response;
      if (editingMenu && editingMenu.id_menu) {
        const body = {
          ...payloadBase,
          image_url_existing: editingMenu.image_url || null,
          image_link: (newMenu.imageLink || '').trim(),
          clear_image: (!newMenu.imageLink && !newMenu.keepExistingImage) ? 'true' : 'false',
        };
        response = await fetch(`${apiBaseUrl}/menu/${editingMenu.id_menu}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(body),
        });
      } else {
        const body = {
          ...payloadBase,
          image_link: (newMenu.imageLink || '').trim(),
        };
        response = await fetch(`${apiBaseUrl}/menu`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(body),
        });
      }

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.message || `HTTP ${response.status}: ${response.statusText}`);
      }

      alert(`Menu berhasil ${editingMenu ? 'diupdate' : 'ditambahkan'}!`);
      setNewMenu({
        name: '',
        description: '',
        price: '',
        category: 'makanan-nasi',
        is_available: 1,
        imageLink: '',
        keepExistingImage: true,
      });
      setEditingMenu(null);
      await fetchMenuItems();
      setActiveMenuSubTab('menu-list');
    } catch (error) {
      alert(`Gagal ${editingMenu ? 'mengupdate' : 'menambahkan'} menu: ${error.message}`);
    }
  };

  const handleEditMenuClick = (item) => {
    if (!item || !item.id_menu) return;
    setEditingMenu(item);
    setNewMenu({
      name: item.name || '',
      description: item.description || '',
      price: item.price ?? '',
      category: item.category || 'makanan-nasi',
      is_available: (item.is_available === 1 || item.is_available === true || item.is_available === '1') ? 1 : 0,
      imageLink: item.image_url || '',
      keepExistingImage: !!item.image_url,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setActiveMenuSubTab('menu-form');
  };

  const handleCancelEdit = () => {
    setEditingMenu(null);
    setNewMenu({
      name: '',
      description: '',
      price: '',
      category: 'makanan-nasi',
      is_available: 1,
      imageLink: '',
      keepExistingImage: true,
    });
    setActiveMenuSubTab('menu-list');
  };

  const handleDeleteMenu = async (id_menu) => {
    if (!id_menu) return;
    if (!window.confirm('Apakah Anda yakin ingin menghapus menu ini?')) return;
    try {
      const res = await fetch(`${apiBaseUrl}/menu/${id_menu}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || `HTTP ${res.status}: ${res.statusText}`);
      }
      alert('Menu berhasil dihapus!');
      fetchMenuItems();
    } catch (e) {
      alert(`Gagal menghapus menu: ${e.message}`);
    }
  };

  const handleToggleMenuAvailability = async (item) => {
    if (!item?.id_menu) return;
    const isAvail = (item.is_available === 1 || item.is_available === true || item.is_available === '1');
    const newAvailability = isAvail ? 0 : 1;
    try {
      const res = await fetch(`${apiBaseUrl}/menu/${item.id_menu}/availability`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ is_available: newAvailability }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || `HTTP ${res.status}: ${res.statusText}`);
      }
      await fetchMenuItems();
    } catch (e) {
      alert(`Gagal mengubah ketersediaan menu: ${e.message}`);
    }
  };

  // ============ TABLE ============
  const handleAddTable = async () => {
    if (!newTable.table_number.trim()) {
      alert('Nomor meja tidak boleh kosong!');
      return;
    }
    try {
      const res = await fetch(`${apiBaseUrl}/tables`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          table_number: newTable.table_number.trim(),
          capacity: newTable.capacity || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || `HTTP ${res.status}: ${res.statusText}`);
      }
      alert('Meja berhasil ditambahkan!');
      setNewTable({ table_number: '', capacity: '' });
      fetchTables();
    } catch (e) {
      alert(`Gagal menambahkan meja: ${e.message}`);
    }
  };
  const generateQrCode = (tableNum) => {
    const baseUrl = window.location.origin;
    return `${baseUrl}/menu/${encodeURIComponent(tableNum || '')}`;
  };
  const handleDownloadQR = (tableNum) => {
    try {
      const id = `qr-table-${String(tableNum).replace(/\s/g, '-')}`;
      const svgElement = document.getElementById(id);
      if (svgElement?.tagName?.toLowerCase() === 'svg') {
        const svgData = new XMLSerializer().serializeToString(svgElement);
        const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
        const svgUrl = URL.createObjectURL(svgBlob);
        const a = document.createElement('a');
        a.href = svgUrl;
        a.download = `meja_${String(tableNum).replace(/\s/g, '-')}_qrcode.svg`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(svgUrl);
      } else {
        alert('SVG QR Code tidak ditemukan.');
      }
    } catch {
      alert('Gagal mengunduh QR Code.');
    }
  };

  // ============ ORDER (status & pembayaran) ============
  const updateOrderStatus = async (orderId, newStatus) => {
    if (!orderId || !newStatus) return;
    if (!window.confirm(`Ubah status pesanan ${orderId} menjadi ${newStatus}?`)) return;
    try {
      const res = await fetch(`${apiBaseUrl}/orders/${orderId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || `HTTP ${res.status}: ${res.statusText}`);
      }
      await fetchOrders(true);
    } catch (e) {
      alert(`Gagal mengupdate status pesanan: ${e.message}`);
    }
  };
  const handleCashierPaymentClick = (orderId, totalAmount) => {
    setSelectedOrderIdForPayment(orderId);
    setSelectedOrderTotalAmount(Number(totalAmount) || 0);
    setIsPaymentModalOpen(true);
  };
  const updateOrderPaymentStatus = async (orderId, modalStatus, method) => {
    try {
      let statusToSend = modalStatus;
      if (modalStatus === 'paid') statusToSend = 'Sudah Bayar';
      else if (modalStatus === 'unpaid') statusToSend = 'Belum Bayar';
      else if (modalStatus === 'Pending') statusToSend = 'Pending';
      const res = await fetch(`${apiBaseUrl}/orders/${orderId}/payment_status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ payment_status: statusToSend, payment_method: method || 'cash' }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || `HTTP ${res.status}: ${res.statusText}`);
      }
      await fetchOrders(true);
      return Promise.resolve();
    } catch (e) {
      alert(`Gagal update status pembayaran: ${e.message}`);
      return Promise.reject(e);
    }
  };

  // ============ ORDER (edit) ============
  const showEditOrder = (order) => {
    if (!order?.items) {
      alert('Data pesanan tidak valid untuk edit');
      return;
    }
    const existingItems = safeJsonParse(order.items, []);
    const editCart = existingItems.map((it) => ({
      id_menu: it.menu_item_id || 0,
      name: it.menu_name || 'Unknown Item',
      price: it.price_at_order || 0,
      quantity: it.quantity || 0,
      options: { spiciness: it.spiciness_level || '', temperature: it.temperature_level || '' },
    }));
    setEditOrderCart(editCart);
    const sel = {};
    (menuItems || []).forEach((m) => { if (m?.id_menu) sel[m.id_menu] = { spiciness: '', temperature: '' }; });
    existingItems.forEach((it) => {
      if (it?.menu_item_id && sel[it.menu_item_id]) {
        sel[it.menu_item_id] = { spiciness: it.spiciness_level || '', temperature: it.temperature_level || '' };
      }
    });
    setEditOrderItemSelections(sel);
    setEditOrderNote('');
    setSelectedOrderForDetail(order);
    setIsEditOrderModalOpen(true);
  };
  const closeEditOrder = () => {
    setIsEditOrderModalOpen(false);
    setSelectedOrderForDetail(null);
    setEditOrderCart([]);
    setEditOrderItemSelections({});
    setEditOrderNote('');
  };
  const findEditOrderCartItem = (id, opt) =>
    (editOrderCart || []).find(
      (c) => c?.id_menu === id && c?.options?.spiciness === (opt.spiciness || '') && c?.options?.temperature === (opt.temperature || '')
    );
  const addItemToEditOrderCart = (item) => {
    if (!item?.id_menu) return;
    const opts = editOrderItemSelections[item.id_menu] || { spiciness: '', temperature: '' };
    if (item.category?.startsWith('menu mie') && !opts.spiciness) { alert('Pilih tingkat kepedasan!'); return; }
    if (item.category?.startsWith('minuman') && !opts.temperature) { alert('Pilih dingin/tidak!'); return; }
    setEditOrderCart((prev) => {
      const exist = findEditOrderCartItem(item.id_menu, opts);
      if (exist) return prev.map((c) => (c === exist ? { ...c, quantity: (c.quantity || 0) + 1 } : c));
      return [...prev, { id_menu: item.id_menu, name: item.name || 'Unknown', price: item.price || 0, quantity: 1, options: { ...opts } }];
    });
  };
  const removeItemFromEditOrderCart = (item) => {
    if (!item?.id_menu) return;
    setEditOrderCart((prev) => {
      const exist = findEditOrderCartItem(item.id_menu, item.options || {});
      if (exist) {
        if ((exist.quantity || 0) > 1) return prev.map((c) => (c === exist ? { ...c, quantity: (c.quantity || 0) - 1 } : c));
        return prev.filter((c) => c !== exist);
      }
      return prev;
    });
  };
  const getEditOrderTotalItems = () => (editOrderCart || []).reduce((s, it) => s + (it?.quantity || 0), 0);
  const getEditOrderTotalPrice = () =>
    (editOrderCart || []).reduce((s, it) => s + ((it?.price || 0) * (it?.quantity || 0)), 0);
  const handleEditOrderOptionChange = (id, t, v) => {
    setEditOrderItemSelections((prev) => ({ ...prev, [id]: { ...(prev[id] || {}), [t]: v } }));
  };
  const handleSaveEditOrder = async () => {
    try {
      if (getEditOrderTotalItems() === 0) { alert('Keranjang kosong.'); return; }
      if (!selectedOrderForDetail?.order_id) { alert('Data pesanan tidak valid.'); return; }
      const items = editOrderCart.map((it) => ({
        id_menu: it.id_menu || 0,
        quantity: it.quantity || 0,
        spiciness_level: it.options?.spiciness || null,
        temperature_level: it.options?.temperature || null,
      }));
      const res = await fetch(`${apiBaseUrl}/orders/${selectedOrderForDetail.order_id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ items, note: editOrderNote || '' }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || `HTTP ${res.status}: ${res.statusText}`);
      }
      alert(`Pesanan #${selectedOrderForDetail.order_id} berhasil diperbarui!`);
      closeEditOrder();
      await fetchOrders(true);
    } catch (e) {
      alert(`Gagal memperbarui pesanan: ${e.message}`);
    }
  };

  // ============ ORDER (kasir - tambah) ============
  const findNewOrderCartItem = (id, opt) =>
    (newOrderCart || []).find(
      (c) => c?.id_menu === id && c?.options?.spiciness === (opt.spiciness || '') && c?.options?.temperature === (opt.temperature || '')
    );
  const addNewItemToOrderCart = (item) => {
    if (!item?.id_menu) { alert('Item tidak valid'); return; }
    const opts = newOrderItemSelections[item.id_menu] || { spiciness: '', temperature: '' };
    if (item.category?.startsWith('menu mie') && !opts.spiciness) { alert('Pilih tingkat kepedasan!'); return; }
    if (item.category?.startsWith('minuman') && !opts.temperature) { alert('Pilih dingin/tidak!'); return; }
    setNewOrderCart((prev) => {
      const exist = findNewOrderCartItem(item.id_menu, opts);
      if (exist) return prev.map((c) => (c === exist ? { ...c, quantity: (c.quantity || 0) + 1 } : c));
      return [...prev, { id_menu: item.id_menu, name: item.name || 'Unknown', price: item.price || 0, quantity: 1, options: { ...opts } }];
    });
  };
  const removeNewItemFromOrderCart = (item) => {
    if (!item?.id_menu) return;
    setNewOrderCart((prev) => {
      const exist = findNewOrderCartItem(item.id_menu, item.options || {});
      if (exist) {
        if ((exist.quantity || 0) > 1) return prev.map((c) => (c === exist ? { ...c, quantity: (c.quantity || 0) - 1 } : c));
        return prev.filter((c) => c !== exist);
      }
      return prev;
    });
  };
  const getNewOrderTotalItems = () => (newOrderCart || []).reduce((s, it) => s + (it?.quantity || 0), 0);
  const getNewOrderTotalPrice = () =>
    (newOrderCart || []).reduce((s, it) => s + ((it?.price || 0) * (it?.quantity || 0)), 0);
  const handleNewOrderOptionChange = (id, t, v) => {
    setNewOrderItemSelections((prev) => ({ ...prev, [id]: { ...(prev[id] || {}), [t]: v } }));
  };
  const handleAddOrderForCashier = async () => {
    try {
      const tableNumberForOrder = 'Take Away';
      if (!Array.isArray(newOrderCart) || newOrderCart.length === 0) { alert('Keranjang kosong.'); return; }
      const totalItems = getNewOrderTotalItems();
      if (totalItems === 0) { alert('Total item 0.'); return; }
      const validItems = newOrderCart.filter((it) => it?.id_menu && it?.quantity > 0);
      if (validItems.length === 0) { alert('Tidak ada item valid.'); return; }
      const items = validItems.map((it) => ({
        id_menu: parseInt(it.id_menu) || 0,
        quantity: parseInt(it.quantity) || 0,
        spiciness_level: it.options?.spiciness || null,
        temperature_level: it.options?.temperature || null,
      }));
      const payload = { tableNumber: tableNumberForOrder, items, customerName: newOrderCustomerName.trim() || null };
      const res = await fetch(`${apiBaseUrl}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || `HTTP ${res.status}: ${res.statusText}`);
      }
      const data = await res.json();
      setIsAddOrderModalOpen(false);
      setNewOrderCustomerName('');
      setNewOrderCart([]);
      const resetSel = {};
      (menuItems || []).forEach((m) => { if (m?.id_menu) resetSel[m.id_menu] = { spiciness: '', temperature: '' }; });
      setNewOrderItemSelections(resetSel);
      alert(`✅ Pesanan baru berhasil dibuat dengan ID: ${data.orderId || 'N/A'}!`);
      await fetchOrders(true);
    } catch (e) {
      alert(`Gagal membuat pesanan baru: ${e.message}`);
    }
  };

  // ============ REPORT ============
  const fetchSalesReport = async () => {
    if (!token) return;
    setIsLoadingReport(true);
    try {
      const res = await fetch(
        `${apiBaseUrl}/reports/sales?startDate=${reportDateRange.startDate}&endDate=${reportDateRange.endDate}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      const data = await res.json();
      setReportData(
        data || {
          totalSales: 0, totalOrders: 0, completedOrders: 0, cancelledOrders: 0, pendingOrders: 0,
          totalSalesToday: 0, totalOrdersToday: 0, topSellingItems: [], salesByPaymentMethod: [], salesByDate: [],
        }
      );
    } catch (e) {
      alert(`Gagal mengambil laporan: ${e.message}`);
    } finally {
      setIsLoadingReport(false);
    }
  };
  const exportReportToCSV = () => {
    try {
      const csv = [
        ['Laporan Penjualan'],
        ['Periode', `${reportDateRange.startDate} - ${reportDateRange.endDate}`],
        [''],
        ['Ringkasan'],
        ['Total Penjualan', `Rp ${formatPrice(reportData.totalSales || 0)}`],
        ['Total Pesanan', reportData.totalOrders || 0],
        ['Pesanan Selesai', reportData.completedOrders || 0],
        ['Pesanan Dibatalkan', reportData.cancelledOrders || 0],
        ['Pesanan Dalam Proses', reportData.pendingOrders || 0],
        [''],
        ['Menu Terlaris'],
        ['Nama Menu', 'Jumlah Terjual', 'Total Pendapatan'],
        ...(reportData.topSellingItems || []).map((it) => [
          it.menu_name || 'Unknown',
          it.total_quantity || 0,
          `Rp ${formatPrice(it.total_revenue || 0)}`,
        ]),
      ];
      const csvString = csv.map((r) => r.join(',')).join('\n');
      const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
      const a = document.createElement('a');
      const url = URL.createObjectURL(blob);
      a.href = url;
      a.download = `laporan-penjualan-${reportDateRange.startDate}-${reportDateRange.endDate}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      alert('Gagal export CSV.');
    }
  };

  // ============ PRINT ============
  const handlePrintOrder = (order) => {
    try {
      if (!order?.order_id) return;
      const items = safeJsonParse(order.items, []);
      const html = `
      <!DOCTYPE html><html><head><meta charset="UTF-8"><title>Cetak Pesanan #${order.order_id}</title>
      <style>
      .print-receipt{font-family:'Courier New',monospace;max-width:80mm;margin:0;padding:20px}
      .receipt-header{text-align:center;margin-bottom:20px;border-bottom:2px solid #000;padding-bottom:10px}
      .restaurant-name{font-size:18px;font-weight:bold;margin-bottom:5px}
      .receipt-title{font-size:16px;font-weight:bold;margin-bottom:5px}
      .info-line{display:flex;justify-content:space-between;margin-bottom:3px}
      .section-divider{border-top:1px dashed #000;margin:10px 0}
      .item-details{display:flex;justify-content:space-between;font-size:12px;margin-bottom:2px}
      .item-options{font-size:11px;color:#666;margin-bottom:3px;padding-left:10px}
      .receipt-total-section{border-top:2px solid #000;padding-top:10px;margin-top:15px}
      .total-line{display:flex;justify-content:space-between;font-size:16px;font-weight:bold}
      .receipt-footer{text-align:center;margin-top:20px;font-size:11px;border-top:1px dashed #000;padding-top:10px}
      </style></head><body>
      <div class="print-receipt">
        <div class="receipt-header">
          <div class="restaurant-name">RUMAH MAKAN</div>
          <div class="restaurant-name">MANDELA CORNER</div>
          <div class="receipt-title">STRUK PESANAN</div>
          <div class="order-id">ID Pesanan: #${order.order_id}</div>
          <div class="receipt-date">${formatOrderTime(order.order_time)}</div>
        </div>
        <div class="receipt-order-info">
          <div class="info-line"><span>Meja:</span><span>${
            order.table_number === 'Take Away' && order.customer_name
              ? `${order.table_number} - ${order.customer_name}`
              : order.table_number || 'N/A'
          }</span></div>
          <div class="info-line"><span>Status:</span><span>${(order.order_status || 'N/A').toUpperCase()}</span></div>
          <div class="info-line"><span>Pembayaran:</span><span>${(order.payment_status || 'N/A').toUpperCase()}</span></div>
        </div>
        <div class="section-divider"></div>
        <div class="receipt-items-section">
          <div class="item-header">DETAIL PESANAN:</div>
          ${items
            .map(
              (it) => `
            <div class="receipt-item-line">
              <div class="item-details">
                <span>${it.quantity || 0}x ${it.menu_name || 'Unknown Item'}</span>
                <span>Rp ${formatPrice((it.quantity || 0) * (it.price_at_order || 0))}</span>
              </div>
              <div class="item-details">
                <span style="font-size:11px;">@ Rp ${formatPrice(it.price_at_order || 0)}</span>
                <span></span>
              </div>
              ${
                it.spiciness_level || it.temperature_level
                  ? `<div class="item-options">${it.spiciness_level ? `* ${it.spiciness_level}` : ''}${
                      it.temperature_level ? ` * ${it.temperature_level}` : ''
                    }</div>`
                  : ''
              }
            </div>`
            )
            .join('')}
        </div>
        <div class="receipt-total-section">
          <div class="total-line"><span>TOTAL:</span><span>Rp ${formatPrice(order.total_amount || 0)}</span></div>
        </div>
        <div class="receipt-footer"><div>Terima kasih atas kunjungan Anda!</div><div>Selamat menikmati makanan Anda</div></div>
      </div></body></html>`;
      const w = window.open('', '', 'height=600,width=400');
      if (!w) return alert('Popup diblokir.');
      w.document.write(html);
      w.document.close();
      w.print();
    } catch {
      alert('Gagal mencetak struk.');
    }
  };

  // ============ EFFECTS ============
  useEffect(() => {
    if (token) {
      fetchOrders(true);
      fetchMenuItems();
      fetchTables();
      const POLL_MS = 5000;
      const id = setInterval(() => fetchOrders(true), POLL_MS);
      return () => {
        clearInterval(id);
        try { ordersAbortRef.current?.abort(); } catch {}
      };
    }
  }, [token]);

  useEffect(() => {
    if (activeTab === 'laporan' && token) fetchSalesReport();
  }, [activeTab, token, reportDateRange.startDate, reportDateRange.endDate]);

  // ============ PERFORMANCE BOOST: pagination daftar pesanan ============
  const [orderPage, setOrderPage] = useState(1);
  const [orderPageSize, setOrderPageSize] = useState(12);
  useEffect(() => { setOrderPage(1); }, [orders]);
  const totalOrderPages = Math.max(1, Math.ceil((orders?.length || 0) / orderPageSize));
  const pagedOrders = useMemo(() => {
    const start = (orderPage - 1) * orderPageSize;
    const end = start + orderPageSize;
    return (orders || []).slice(start, end);
  }, [orders, orderPage, orderPageSize]);

  // ============ RENDER ============
  if (!token) {
    return (
      <div className="login-form-container">
        <div className="login-form">
          <h2 className="admin-section-title">Login Admin / Kasir</h2>
          <div className="login-input-group">
            <label>Username:</label>
            <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} className="login-input" placeholder="Masukkan username" disabled={isLoggingIn} />
          </div>
          <div className="login-input-group">
            <label>Password:</label>
            <div className="password-input-container" style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="login-input"
                placeholder="Masukkan password"
                disabled={isLoggingIn}
                onKeyPress={(e) => { if (e.key === 'Enter' && !isLoggingIn) handleLogin(); }}
                style={{ paddingRight: '45px' }}
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="password-toggle-btn" style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)' }} disabled={isLoggingIn}>
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>
          {loginError && (
            <div className="login-error-message" style={{ whiteSpace: 'pre-line' }}>
              {loginError}
            </div>
          )}
          <button onClick={handleLogin} className="login-button" disabled={isLoggingIn}>
            {isLoggingIn ? 'Logging in...' : 'Login'}
          </button>
          <div style={{ marginTop: 12, fontSize: 12, color: '#666' }}>
            Current API URL: <b>{apiBaseUrl}</b>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-dashboard-layout">
      {/* Mobile Menu Toggle */}
      <button className="mobile-menu-toggle" onClick={toggleMobileMenu}><span></span><span></span><span></span></button>
      <div className={`sidebar-overlay ${mobileMenuOpen ? 'active' : ''}`} onClick={() => setMobileMenuOpen(false)} />
      {/* Sidebar */}
      <div className={`admin-sidebar ${sidebarCollapsed ? 'collapsed' : ''} ${mobileMenuOpen ? 'mobile-open' : ''}`}>
        <button className="desktop-sidebar-toggle" onClick={toggleSidebar}>{sidebarCollapsed ? '→' : '←'}</button>
        <div className="admin-sidebar-header"><span className="admin-sidebar-title">Dashboard Admin</span></div>
        <div className="admin-sidebar-user-info">
          <p>Login sebagai: <strong>{(userRole || '').toUpperCase()}</strong></p>
          <button onClick={handleLogout} className="admin-logout-button">Logout</button>
        </div>
        <ul className="admin-sidebar-nav">
          <li className={activeTab === 'pesanan' ? 'active' : ''} onClick={() => handleTabChange('pesanan')}><a href="#daftar-pesanan">Daftar Pesanan</a></li>
          {(userRole === 'admin') && (
            <>
              <li className={activeTab === 'manajemen-menu' ? 'active' : ''} onClick={() => handleTabChange('manajemen-menu')}><a href="#manajemen-menu">Manajemen Menu</a></li>
              <li className={activeTab === 'manajemen-meja' ? 'active' : ''} onClick={() => handleTabChange('manajemen-meja')}><a href="#manajemen-meja">Manajemen Meja</a></li>
            </>
          )}
          <li className={activeTab === 'laporan' ? 'active' : ''} onClick={() => handleTabChange('laporan')}><a href="#laporan">Laporan</a></li>
        </ul>
      </div>

      {/* Content */}
      <div className={`admin-content-area ${sidebarCollapsed ? 'expanded' : ''}`}>
        {/* Pesanan */}
        {activeTab === 'pesanan' && (
          <div className="admin-section-box">
            <div className="order-list-header">
              <h2 className="admin-section-title">Daftar Pesanan</h2>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <button onClick={handleManualRefresh} disabled={isRefreshing} className="refresh-button">
                  {isRefreshing ? '🔄 Refreshing...' : '↻ Refresh'}
                </button>
                <small style={{ color: '#666', fontSize: '0.8em' }}>Last update: {lastRefresh.toLocaleTimeString('id-ID')}</small>
                {(userRole === 'admin' || userRole === 'cashier') && (
                  <button onClick={() => setIsAddOrderModalOpen(true)} className="add-order-button">Tambah Pesanan</button>
                )}
              </div>
            </div>

            {/* NEW: Pagination controls */}
            <div className="orders-pagination-bar">
              <label>
                Tampilkan:&nbsp;
                <select value={orderPageSize} onChange={(e) => setOrderPageSize(Number(e.target.value))}>
                  <option value={8}>8</option>
                  <option value={12}>12</option>
                  <option value={24}>24</option>
                  <option value={48}>48</option>
                </select>
                &nbsp;per halaman
              </label>
              <div className="orders-pager">
                <button disabled={orderPage <= 1} onClick={() => setOrderPage((p) => Math.max(1, p - 1))}>‹</button>
                <span>Hal {orderPage} / {totalOrderPages}</span>
                <button disabled={orderPage >= totalOrderPages} onClick={() => setOrderPage((p) => Math.min(totalOrderPages, p + 1))}>›</button>
              </div>
            </div>

            {(pagedOrders.length === 0) ? (
              <p className="no-data-message">Belum ada pesanan masuk.</p>
            ) : (
              <div className="orders-grid">
                {pagedOrders.map((order, index) => {
                  if (!order) return null;
                  const orderItems = safeJsonParse(order.items, []);
                  return (
                    <div key={order.order_id || index} className="order-card">
                      <div className="order-card-header"><h3>ID Pesanan: {order.order_id || 'N/A'}</h3></div>
                      <div className="order-card-content">
                        <div className="order-info-grid">
                          <div className="order-info-item"><span className="order-info-label">Meja:</span><span className="order-info-value">
                            {order.table_number === 'Take Away' && order.customer_name ? `${order.table_number} - ${order.customer_name}` : (order.table_number || 'N/A')}
                          </span></div>
                          <div className="order-info-item"><span className="order-info-label">Total:</span><span className="order-info-value order-total-value">Rp {formatPrice(order.total_amount)}</span></div>
                          <div className="order-info-item"><span className="order-info-label">Status:</span><span className={`order-info-value ${
                            order.order_status === 'Dalam Proses' ? 'order-status-pending' :
                            order.order_status === 'Selesai' ? 'order-status-completed' : 'order-status-other'
                          }`}>{(order.order_status || 'N/A').toUpperCase()}</span></div>
                          <div className="order-info-item"><span className="order-info-label">Pembayaran:</span><span className={`order-info-value ${
                            order.payment_status === 'Belum Bayar' ? 'payment-status-unpaid' :
                            order.payment_status === 'Sudah Bayar' ? 'payment-status-paid' : 'order-status-other'
                          }`}>{(order.payment_status || 'N/A').toUpperCase()}</span></div>
                          <div className="order-info-item"><span className="order-info-label">Waktu Pesan:</span><span className="order-info-value">{formatOrderTime(order.order_time)}</span></div>
                        </div>

                        <div className="order-items-section">
                          <div className="order-items-header">Item Pesanan:</div>
                          <ul className="order-items-list">
                            {orderItems.map((it, idx) => (
                              <li key={idx} className="order-item-detail">
                                <div className="order-item-row">
                                  <span>{it.quantity || 0}x {it.menu_name || 'Unknown Item'}</span>
                                  <span>Rp {formatPrice((it.quantity || 0) * (it.price_at_order || 0))}</span>
                                </div>
                                {(it.spiciness_level || it.temperature_level) && (
                                  <div className="order-item-options">
                                    {it.spiciness_level ? `* ${it.spiciness_level}` : ''} {it.temperature_level ? `* ${it.temperature_level}` : ''}
                                  </div>
                                )}
                              </li>
                            ))}
                          </ul>
                        </div>

                        <div className="order-actions">
                          <button onClick={() => handleCashierPaymentClick(order.order_id, order.total_amount)} className="order-action-btn">Bayar di Kasir</button>
                          <button onClick={() => updateOrderStatus(order.order_id, 'Dalam Proses')} className="order-action-btn">Dalam Proses</button>
                          <button onClick={() => updateOrderStatus(order.order_id, 'Selesai')} className="order-action-btn success">Selesai</button>
                          <button onClick={() => handlePrintOrder(order)} className="order-action-btn">Cetak</button>
                          <button onClick={() => showEditOrder(order)} className="order-action-btn">Edit</button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Manajemen Menu */}
        {activeTab === 'manajemen-menu' && (
          <div className="admin-section-box">
            <div className="menu-header-row">
              <h2 className="admin-section-title">Manajemen Menu</h2>
              {/* CTA selalu terlihat */}
              <button className="primary-cta" onClick={gotoCreateMenu}>+ Tambah Menu Baru</button>
            </div>

            {/* Subtab (tetap ada) */}
            <div className="menu-subtabs">
              <button className={activeMenuSubTab === 'menu-list' ? 'active' : ''} onClick={() => setActiveMenuSubTab('menu-list')}>Daftar Menu</button>
              <button className={activeMenuSubTab === 'menu-form' ? 'active' : ''} onClick={() => setActiveMenuSubTab('menu-form')}>
                {editingMenu ? 'Edit Menu' : 'Tambah Menu'}
              </button>
            </div>

            {/* Form tambah/edit menu */}
            {activeMenuSubTab === 'menu-form' && (
              <div className="menu-form">
                <div className="menu-form-grid">
                  <div className="menu-form-field">
                    <label>Nama Menu</label>
                    <input value={newMenu.name} onChange={(e) => setNewMenu((p) => ({ ...p, name: e.target.value }))} placeholder="Nama menu" />
                  </div>
                  <div className="menu-form-field">
                    <label>Deskripsi</label>
                    <input value={newMenu.description} onChange={(e) => setNewMenu((p) => ({ ...p, description: e.target.value }))} placeholder="Deskripsi (opsional)" />
                  </div>
                  <div className="menu-form-field">
                    <label>Harga</label>
                    <input type="number" value={newMenu.price} onChange={(e) => setNewMenu((p) => ({ ...p, price: e.target.value }))} placeholder="Harga" />
                  </div>
                  <div className="menu-form-field">
                    <label>Kategori</label>
                    <select value={newMenu.category} onChange={(e) => setNewMenu((p) => ({ ...p, category: e.target.value }))}>
                      <option value="makanan-nasi">Makanan - Nasi</option>
                      <option value="makanan-pelengkap">Makanan - Pelengkap</option>
                      <option value="minuman-kopi">Minuman - Kopi</option>
                      <option value="minuman-nonkopi">Minuman - Non Kopi</option>
                      <option value="menu mie-banggodrong">Menu Mie - Banggondrong</option>
                      <option value="menu mie-aceh">Menu Mie - Aceh</option>
                      <option value="menu mie-toping">Menu Mie - Toping</option>
                      <option value="camilan-manis">Camilan - Manis</option>
                      <option value="camilan-gurih">Camilan - Gurih</option>
                      <option value="lain-lain">Lain-lain</option>
                    </select>
                  </div>
                  <div className="menu-form-field">
                    <label>Ketersediaan</label>
                    <select value={newMenu.is_available} onChange={(e) => setNewMenu((p) => ({ ...p, is_available: Number(e.target.value) }))}>
                      <option value={1}>Tersedia</option>
                      <option value={0}>Tidak Tersedia</option>
                    </select>
                  </div>

                  {/* Link gambar Google/URL */}
                  <div className="menu-form-field">
                    <label>Link Gambar (Google Drive/URL)</label>
                    <input
                      value={newMenu.imageLink}
                      onChange={handleImageLinkChange}
                      placeholder="Tempel link Google Drive (sharing) atau URL gambar langsung"
                    />
                    <small className="hint">
                      Masukkan link Google Drive / URL gambar. Backend akan mengubah link Drive menjadi direct URL jika perlu.
                    </small>
                    {newMenu.imageLink?.trim() ? (
                      <div className="image-preview">
                        <img
                          src={newMenu.imageLink}
                          alt="Preview"
                          onError={(e) => (e.currentTarget.style.display = 'none')}
                          style={{ maxWidth: 160, borderRadius: 8, marginTop: 8 }}
                        />
                      </div>
                    ) : (editingMenu?.image_url ? (
                      <div className="image-preview">
                        <img
                          src={editingMenu.image_url}
                          alt="Existing"
                          onError={(e) => (e.currentTarget.style.display = 'none')}
                          style={{ maxWidth: 160, borderRadius: 8, marginTop: 8 }}
                        />
                        <small className="hint">Tidak mengubah link = tetap pakai gambar yang ada.</small>
                      </div>
                    ) : null)}
                  </div>
                </div>

                <div className="menu-form-actions">
                  <button onClick={handleAddOrUpdateMenu} className="save-menu-button">{editingMenu ? 'Update Menu' : 'Tambah Menu'}</button>
                  {editingMenu && <button onClick={handleCancelEdit} className="cancel-menu-button">Batal</button>}
                </div>
              </div>
            )}

            {/* Daftar menu */}
            {activeMenuSubTab === 'menu-list' && (
              <>
                <div className="menu-actions-row">
                  <button className="primary-cta" onClick={gotoCreateMenu}>+ Tambah Menu Baru</button>
                </div>
                <div className="menu-list-grid">
                  {(menuItems || []).map((item) => (
                    <div key={item.id_menu} className="menu-card">
                      <div className="menu-card-thumb">
                        {item.image_url ? (
                          <img src={item.image_url} alt={item.name} />
                        ) : (
                          <div className="no-image">No Image</div>
                        )}
                      </div>
                      <div className="menu-card-body">
                        <div className="menu-card-title">{item.name}</div>
                        <div className="menu-card-price">Rp {formatPrice(item.price)}</div>
                        <div className="menu-card-meta">
                          <span className="chip">{getCategoryDisplayName(item.category || 'lain-lain')}</span>
                          <span className={`chip ${item.is_available ? 'ok' : 'no'}`}>{item.is_available ? 'Tersedia' : 'Tidak'}</span>
                        </div>
                      </div>
                      <div className="menu-card-actions">
                        <button onClick={() => handleEditMenuClick(item)} className="menu-btn">Edit</button>
                        <button onClick={() => handleToggleMenuAvailability(item)} className="menu-btn">{item.is_available ? 'Nonaktifkan' : 'Aktifkan'}</button>
                        <button onClick={() => handleDeleteMenu(item.id_menu)} className="menu-btn danger">Hapus</button>
                      </div>
                    </div>
                  ))}
                </div>
                {(menuItems || []).length === 0 && (
                  <div className="empty-state">
                    <p>Belum ada menu.</p>
                    <button className="primary-cta" onClick={gotoCreateMenu}>+ Tambah Menu Pertama</button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Manajemen Meja */}
        {activeTab === 'manajemen-meja' && (
          <div className="admin-section-box">
            <h2 className="admin-section-title">Manajemen Meja</h2>
            <div className="table-form">
              <input
                type="text"
                placeholder="Nomor Meja (misal: Meja 1, Bar 3)"
                value={newTable.table_number}
                onChange={(e) => setNewTable({ ...newTable, table_number: e.target.value })}
                className="table-form-input"
              />
              <input
                type="number"
                placeholder="Kapasitas (opsional)"
                value={newTable.capacity}
                onChange={(e) => setNewTable({ ...newTable, capacity: e.target.value })}
                className="table-form-input"
              />
              <button onClick={handleAddTable} className="table-add-button">Tambah Meja</button>
            </div>
            <h3>QR Code Meja:</h3>
            <div className="qr-code-grid">
              {(tables || []).map((table, idx) => (
                <div key={table.id_table || idx} className="qr-card">
                  <h4 className="qr-card-title">Meja {table.table_number || 'N/A'}</h4>
                  <p className="qr-card-status">Status: {table.status || 'Available'}</p>
                  <QRCodeSVG id={`qr-table-${String(table.table_number || 'unknown').replace(/\s/g, '-')}`} value={generateQrCode(table.table_number)} size={100} level="H" includeMargin />
                  <button onClick={() => handleDownloadQR(table.table_number)} className="qr-download-button">Unduh QR</button>
                </div>
              ))}
            </div>
            {(tables || []).length === 0 && <p className="no-tables-message">Belum ada meja. Tambahkan meja baru di atas.</p>}
          </div>
        )}

        {/* Laporan */}
        {activeTab === 'laporan' && (
          <div className="admin-section-box">
            <h2 className="admin-section-title">Laporan Penjualan</h2>
            <div className="report-filters">
              <div className="date-filter-group">
                <label>Dari Tanggal:</label>
                <input type="date" value={reportDateRange.startDate} onChange={(e) => setReportDateRange((p) => ({ ...p, startDate: e.target.value }))} className="report-date-input" />
              </div>
              <div className="date-filter-group">
                <label>Sampai Tanggal:</label>
                <input type="date" value={reportDateRange.endDate} onChange={(e) => setReportDateRange((p) => ({ ...p, endDate: e.target.value }))} className="report-date-input" />
              </div>
              <button onClick={fetchSalesReport} className="generate-report-button" disabled={isLoadingReport}>
                {isLoadingReport ? 'Loading...' : 'Generate Laporan'}
              </button>
              <button onClick={exportReportToCSV} className="export-button" disabled={isLoadingReport || (reportData.totalOrders || 0) === 0}>
                Export CSV
              </button>
            </div>

            <div className="report-summary">
              <div className="report-card"><div className="report-kv"><span>Total Penjualan</span><strong>Rp {formatPrice(reportData.totalSales || 0)}</strong></div></div>
              <div className="report-card"><div className="report-kv"><span>Total Pesanan</span><strong>{reportData.totalOrders || 0}</strong></div></div>
              <div className="report-card"><div className="report-kv"><span>Selesai</span><strong>{reportData.completedOrders || 0}</strong></div></div>
              <div className="report-card"><div className="report-kv"><span>Dibatalkan</span><strong>{reportData.cancelledOrders || 0}</strong></div></div>
            </div>
          </div>
        )}
      </div>

      {/* Payment Modal */}
      <PaymentModal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        orderId={selectedOrderIdForPayment}
        totalAmount={selectedOrderTotalAmount}
        onPaymentConfirmed={updateOrderPaymentStatus}
      />

      {/* Modal Tambah Pesanan (Kasir) */}
      {isAddOrderModalOpen && (
        <div className="add-order-modal-overlay">
          <div className="add-order-container">
            <div className="add-order-header">
              <button className="back-btn" onClick={() => {
                setIsAddOrderModalOpen(false);
                setNewOrderCustomerName('');
                setNewOrderCart([]);
                const resetSelections = {};
                (menuItems || []).forEach((it) => { if (it?.id_menu) resetSelections[it.id_menu] = { spiciness: '', temperature: '' }; });
                setNewOrderItemSelections(resetSelections);
              }}>←</button>
              <h2>Tambah Pesanan Baru</h2>
            </div>

            <div className="add-detail-section">
              <div className="add-section-title">Detail Pesanan</div>
              <div className="add-input-group">
                <label htmlFor="customerName">Nama Pelanggan (Take Away):</label>
                <input type="text" id="customerName" value={newOrderCustomerName} onChange={(e) => setNewOrderCustomerName(e.target.value)} className="add-input" placeholder="Masukkan nama pelanggan" />
                <small className="add-input-note">*Nama akan ditampilkan untuk pesanan Take Away</small>
              </div>
            </div>

            <div className="add-menu-section">
              <div className="add-section-title">Menu Tersedia</div>
              {Object.entries(groupMenuByCategory(menuItems)).map(([category, categoryItems]) => (
                <div key={category} className="add-menu-category-section">
                  <h3 className="add-category-title">{getCategoryDisplayName(category)}</h3>
                  {categoryItems.map((item) => {
                    if (!item?.id_menu) return null;
                    const currentOptions = newOrderItemSelections[item.id_menu] || { spiciness: '', temperature: '' };
                    const currentQty = findNewOrderCartItem(item.id_menu, currentOptions)?.quantity || 0;
                    return (
                      <div key={item.id_menu} className={`add-menu-item ${currentQty > 0 ? 'in-cart' : ''}`}>
                        <div className="add-menu-thumb">
                          {item.image_url ? <img src={item.image_url} alt={item.name} /> : <div className="no-image">No Image</div>}
                        </div>
                        <div className="add-menu-info">
                          <div className="add-menu-title">{item.name}</div>
                          <div className="add-menu-price">Rp {formatPrice(item.price)}</div>
                          {item.category?.startsWith('menu mie') && (
                            <div className="option-row">
                              <label>Tingkat Pedas:</label>
                              <select value={currentOptions.spiciness} onChange={(e) => handleNewOrderOptionChange(item.id_menu, 'spiciness', e.target.value)}>
                                <option value="">— Pilih —</option>
                                <option value="Pedas">Pedas</option>
                                <option value="Sedang">Sedang</option>
                                <option value="Tidak Pedas">Tidak Pedas</option>
                              </select>
                            </div>
                          )}
                          {item.category?.startsWith('minuman') && (
                            <div className="option-row">
                              <label>Suhu:</label>
                              <select value={currentOptions.temperature} onChange={(e) => handleNewOrderOptionChange(item.id_menu, 'temperature', e.target.value)}>
                                <option value="">— Pilih —</option>
                                <option value="Dingin">Dingin</option>
                                <option value="Tidak Dingin">Tidak Dingin</option>
                              </select>
                            </div>
                          )}
                        </div>
                        <div className="add-menu-actions">
                          <button onClick={() => removeNewItemFromOrderCart({ id_menu: item.id_menu, options: currentOptions })} disabled={currentQty === 0}>-</button>
                          <span className="qty">{currentQty}</span>
                          <button onClick={() => addNewItemToOrderCart(item)}>+</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>

            <div className="add-cart-footer">
              <div className="add-cart-summary">Total Item: {getNewOrderTotalItems()} • Total Harga: Rp {formatPrice(getNewOrderTotalPrice())}</div>
              <div className="add-cart-actions">
                <button onClick={handleAddOrderForCashier} className="submit-order-btn">Buat Pesanan</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPage;