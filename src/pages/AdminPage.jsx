import React, { useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import "../styles/AdminPage.css";
import PaymentModal from "../components/PaymentModal";

/**
 * ========================
 * Helper / Utilities
 * ========================
 */
const getTodayDateString = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const formatPrice = (val) => {
  const n = Number(val || 0);
  return new Intl.NumberFormat("id-ID", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
};

const formatOrderTime = (ts) => {
  if (!ts) return "Invalid Date";
  const d = new Date(ts);
  if (isNaN(d.getTime())) return "Invalid Date";
  const s = d
    .toLocaleString("en-GB", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })
    .replace(",", "");
  return s;
};

// IMPROVED normalizeOrderItems function - ganti yang ada di AdminPage.jsx
const normalizeOrderItems = (itemsField) => {
  console.log('🔍 normalizeOrderItems called with:', {
    type: typeof itemsField,
    isArray: Array.isArray(itemsField),
    value: itemsField
  });
  
  if (!itemsField) {
    console.log('⚠️ itemsField is null/undefined');
    return [];
  }
  
  if (Array.isArray(itemsField)) {
    console.log('✅ itemsField is already an array:', itemsField.length, 'items');
    return itemsField;
  }
  
  if (typeof itemsField === "string") {
    try {
      console.log('🔄 Parsing string itemsField...');
      const parsed = JSON.parse(itemsField);
      
      if (Array.isArray(parsed)) {
        console.log('✅ Successfully parsed string to array:', parsed.length, 'items');
        return parsed;
      } else {
        console.warn('⚠️ Parsed result is not an array:', typeof parsed);
        return [];
      }
    } catch (error) {
      console.error('❌ JSON parse error:', error.message);
      console.log('Raw string that failed to parse:', itemsField.substring(0, 200) + '...');
      return [];
    }
  }
  
  console.warn('⚠️ Unexpected itemsField type:', typeof itemsField);
  return [];
};

// IMPROVED toUnifiedItem function - ganti yang ada di AdminPage.jsx  
const toUnifiedItem = (it) => {
  if (!it) {
    console.warn('⚠️ toUnifiedItem called with null/undefined item');
    return {
      id_menu: 0,
      name: "Unknown Item",
      price: 0,
      quantity: 0,
      options: { spiciness: "", temperature: "" }
    };
  }

  const unified = {
    id_menu: Number(
      it?.id_menu ?? it?.menu_item_id ?? it?.menu_id ?? it?.menuId ?? 0
    ) || 0,
    name: it?.menu_name ?? it?.name ?? "Unknown Item",
    price: Number(it?.price_at_order ?? it?.price ?? 0),
    quantity: Number(it?.quantity ?? 0),
    options: {
      spiciness: it?.spiciness_level ?? it?.spiciness ?? "",
      temperature: it?.temperature_level ?? it?.temperature ?? "",
    },
  };

  console.log('🔄 Unified item:', {
    original: it,
    unified: unified
  });

  return unified;
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const groupMenuByCategory = (arr) => {
  const g = {};
  (arr || []).forEach((item) => {
    if (
      item &&
      (item.is_available === 1 ||
        item.is_available === true ||
        item.is_available === "1")
    ) {
      const cat = item.category || "lain-lain";
      if (!g[cat]) g[cat] = [];
      g[cat].push(item);
    }
  });
  return g;
};

const getCategoryDisplayName = (category) => {
  const names = {
    "makanan-nasi": "MAKANAN - NASI",
    "makanan-pelengkap": "MAKANAN - PELENGKAP",
    "minuman-kopi": "MINUMAN - KOPI",
    "minuman-nonkopi": "MINUMAN - NON KOPI",
    "menu mie-banggodrong": "MENU MIE - BANGGONDRONG",
    "menu mie-aceh": "MENU MIE - ACEH",
    "menu mie-toping": "MENU MIE - TOPING",
    "camilan-manis": "CAMILAN - MANIS",
    "camilan-gurih": "CAMILAN - GURIH",
    "lain-lain": "LAIN-LAIN",
  };
  return names[category] || String(category || "").toUpperCase();
};

/**
 * ========================
 * Component
 * ========================
 */
const AdminPage = () => {
  // ====== Config
  const [apiBaseUrl] = useState("https://let-s-pay-server.vercel.app/api");

  // ====== Refs
  const ordersAbortRef = useRef(null);
  const ordersInFlightRef = useRef(false);

  // ====== Auth/UI
  const [token, setToken] = useState(() => {
    try {
      return localStorage.getItem("adminToken") || "";
    } catch {
      return "";
    }
  });
  const [userRole, setUserRole] = useState(() => {
    try {
      return localStorage.getItem("userRole") || "";
    } catch {
      return "";
    }
  });
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // ====== Data
  const [orders, setOrders] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [tables, setTables] = useState([]);

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  // ====== Menu form
  const [newMenu, setNewMenu] = useState({
    name: "",
    description: "",
    price: "",
    category: "makanan-nasi",
    imageFile: null,
    imageUrlPreview: "",
    is_available: 1,
  });
  const [editingMenu, setEditingMenu] = useState(null);

  // ====== Table
  const [newTable, setNewTable] = useState({ table_number: "", capacity: "" });

  // ====== Tabs
  const [activeTab, setActiveTab] = useState("pesanan");
  const [activeMenuSubTab, setActiveMenuSubTab] = useState("menu-list");

  // ====== Kasir - order baru
  const [isAddOrderModalOpen, setIsAddOrderModalOpen] = useState(false);
  const [newOrderCustomerName, setNewOrderCustomerName] = useState("");
  const [newOrderCart, setNewOrderCart] = useState([]);
  const [newOrderItemSelections, setNewOrderItemSelections] = useState({});

  // ====== Edit order
  const [selectedOrderForDetail, setSelectedOrderForDetail] = useState(null);
  const [isEditOrderModalOpen, setIsEditOrderModalOpen] = useState(false);
  const [editOrderCart, setEditOrderCart] = useState([]);
  const [editOrderItemSelections, setEditOrderItemSelections] = useState({});
  const [editOrderNote, setEditOrderNote] = useState("");

  // ====== Payment modal
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [selectedOrderIdForPayment, setSelectedOrderIdForPayment] = useState(0);
  const [selectedOrderTotalAmount, setSelectedOrderTotalAmount] = useState(0);

  // ====== Reports
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

  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);

  /**
   * ========================
   * Auth
   * ========================
   */
  const handleLogin = async () => {
    setLoginError("");
    if (!username.trim() || !password.trim()) {
      setLoginError("Username dan password harus diisi");
      return;
    }
    setIsLoggingIn(true);
    try {
      const resp = await fetch(`${apiBaseUrl}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ username: username.trim(), password: password.trim() }),
      });
      if (!resp.ok) {
        let msg = `HTTP ${resp.status}`;
        try {
          const j = await resp.json();
          msg = j.message || msg;
        } catch {
          const t = await resp.text();
          if (t) msg = t;
        }
        throw new Error(msg);
      }
      const data = await resp.json();
      localStorage.setItem("adminToken", data.token);
      localStorage.setItem("userRole", data.user?.role || "");
      setToken(data.token);
      setUserRole(data.user?.role || "");
      setUsername("");
      setPassword("");
      alert("Login berhasil!");
    } catch (e) {
      setLoginError(`Login gagal: ${e.message}`);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = () => {
    try {
      localStorage.removeItem("adminToken");
      localStorage.removeItem("userRole");
    } catch {}
    setToken("");
    setUserRole("");
    setOrders([]);
    setMenuItems([]);
    setTables([]);
  };

  /**
   * ========================
   * Fetchers
   * ========================
   */
  const warmupBackend = async () => {
    try {
      await fetch(`${apiBaseUrl}/health?t=${Date.now()}`, {
        headers: { Accept: "application/json", "Cache-Control": "no-cache" },
      });
    } catch {
      // ignore
    }
  };

// FIXED fetchOrders function - ganti function yang ada di AdminPage.jsx
const fetchOrders = async (force = false) => {
  console.log('📋 fetchOrders called, token:', !!token, 'force:', force);
  
  if (!token) {
    console.log('❌ No token available for fetchOrders');
    return;
  }
  
  if (ordersInFlightRef.current && !force) {
    console.log('⚠️ Orders request already in flight, skipping...');
    return;
  }

  if (ordersAbortRef.current) {
    try {
      ordersAbortRef.current.abort('New request initiated');
    } catch (err) {
      console.log('Previous request cleanup completed');
    }
  }

  ordersInFlightRef.current = true;
  const controller = new AbortController();
  ordersAbortRef.current = controller;
  
  const timeoutId = setTimeout(() => {
    console.log('⏱️ Request timeout, aborting...');
    controller.abort('Request timeout after 30 seconds');
  }, 30000);

  try {
    console.log('🔄 Fetching orders...');
    const url = `${apiBaseUrl}/orders?t=${Date.now()}${force ? "&force=1" : ""}`;
    
    const resp = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        "Content-Type": "application/json",
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Pragma": "no-cache",
        "Expires": "0"
      },
      signal: controller.signal,
    });

    console.log('📋 Orders response status:', resp.status);
    
    if (!resp.ok) {
      if (resp.status === 401 || resp.status === 403) {
        console.log('🔐 Authentication failed in fetchOrders');
        handleLogout();
        return;
      }
      throw new Error(`HTTP ${resp.status}`);
    }

    const responseText = await resp.text();
    console.log('📋 Orders response length:', responseText.length);
    
    let data = [];
    try {
      const parsed = JSON.parse(responseText);
      data = Array.isArray(parsed) ? parsed : [];
      console.log('📋 Orders parsed successfully:', data.length, 'orders');
    } catch (parseError) {
      console.error('❌ Orders JSON parse error:', parseError);
      data = [];
    }

    console.log('📋 Setting orders state with:', data.length, 'orders');
    setOrders(data);
    setLastRefresh(new Date());
    console.log('📋 Orders state updated successfully');
    
  } catch (error) {
    console.error('❌ fetchOrders error:', error);
    
    if (error.name === 'AbortError') {
      console.log('🔄 Request was aborted:', error.message || 'Unknown reason');
    } else {
      console.error('💥 Unexpected fetchOrders error:', error.message);
    }
    
  } finally {
    clearTimeout(timeoutId);
    ordersInFlightRef.current = false;
    setTimeout(() => {
      if (ordersAbortRef.current === controller) {
        ordersAbortRef.current = null;
      }
    }, 1000);
  }
};

  const fetchMenuItems = async () => {
  console.log('🍽️ fetchMenuItems called, token:', !!token);
  
  if (!token) {
    console.log('❌ No token available for fetchMenuItems');
    return;
  }
  
  try {
    console.log('🔄 Fetching menu items...');
    const resp = await fetch(`${apiBaseUrl}/menu?t=${Date.now()}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        "Content-Type": "application/json",
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Pragma": "no-cache",
        "Expires": "0"
      },
    });
    
    console.log('🍽️ Menu response status:', resp.status);
    
    if (!resp.ok) {
      if (resp.status === 401 || resp.status === 403) {
        console.log('🔐 Authentication failed in fetchMenuItems');
        handleLogout();
        return;
      }
      throw new Error(`HTTP ${resp.status}`);
    }
    
    const data = await resp.json();
    console.log('🍽️ Menu data received:', data);
    console.log('🍽️ Menu data type:', typeof data, 'isArray:', Array.isArray(data));
    console.log('🍽️ Menu data length:', data?.length);
    
    const arr = Array.isArray(data) ? data : [];
    console.log('🍽️ Setting menuItems state with:', arr.length, 'items');
    
    setMenuItems(arr);
    console.log('🍽️ setMenuItems called successfully');

    // Initialize selection map
    const sel = {};
    arr.forEach((it) => {
      if (it?.id_menu) sel[it.id_menu] = { spiciness: "", temperature: "" };
    });
    setNewOrderItemSelections(sel);
    console.log('🍽️ Selection map initialized');
    
  } catch (e) {
    console.error('❌ fetchMenuItems error:', e);
  }
};

const fetchTables = async () => {
  console.log('🪑 fetchTables called, token:', !!token);
  
  if (!token) {
    console.log('❌ No token available for fetchTables');
    return;
  }
  
  try {
    console.log('🔄 Fetching tables...');
    const resp = await fetch(`${apiBaseUrl}/tables?t=${Date.now()}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        "Content-Type": "application/json",
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Pragma": "no-cache",
        "Expires": "0"
      },
    });
    
    console.log('🪑 Tables response status:', resp.status);
    
    if (!resp.ok) {
      if (resp.status === 401 || resp.status === 403) {
        console.log('🔐 Authentication failed in fetchTables');
        handleLogout();
        return;
      }
      throw new Error(`HTTP ${resp.status}`);
    }
    
    const data = await resp.json();
    console.log('🪑 Tables data received:', data);
    console.log('🪑 Tables data length:', data?.length);
    
    const arr = Array.isArray(data) ? data : [];
    console.log('🪑 Setting tables state with:', arr.length, 'tables');
    
    setTables(arr);
    console.log('🪑 setTables called successfully');
    
  } catch (e) {
    console.error('❌ fetchTables error:', e);
  }
};

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      await fetchOrders(true);
      alert("Data berhasil di-refresh!");
    } catch (e) {
      alert("Gagal refresh data");
    } finally {
      setIsRefreshing(false);
    }
  };

  /**
   * ========================
   * Menu CRUD
   * ========================
   */
  const handleImageChange = (e) => {
    const file = e.target.files?.[0] || null;
    if (!file) {
      setNewMenu((p) => ({ ...p, imageFile: null, imageUrlPreview: "" }));
      return;
    }
    setNewMenu((p) => ({ ...p, imageFile: file }));
    const r = new FileReader();
    r.onloadend = () => setNewMenu((p) => ({ ...p, imageUrlPreview: String(r.result || "") }));
    r.readAsDataURL(file);
  };

  const handleAddOrUpdateMenu = async () => {
    if (!newMenu.name.trim() || !newMenu.price || !newMenu.category) {
      alert("Nama, harga, dan kategori menu tidak boleh kosong!");
      return;
    }
    const payload = {
      name: newMenu.name.trim(),
      description: (newMenu.description || "").trim(),
      price: Number(newMenu.price),
      category: newMenu.category,
      is_available:
        newMenu.is_available === 0 || newMenu.is_available === "0" ? 0 : 1,
      image_link:
        newMenu.imageUrlPreview && !newMenu.imageUrlPreview.startsWith("data:")
          ? newMenu.imageUrlPreview
          : null,
    };

    const isEdit = Boolean(editingMenu?.id_menu);
    const url = isEdit
      ? `${apiBaseUrl}/menu/${editingMenu.id_menu}?t=${Date.now()}`
      : `${apiBaseUrl}/menu?t=${Date.now()}`;

    try {
      const resp = await fetch(url, {
        method: isEdit ? "PUT" : "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
          "Cache-Control": "no-cache",
        },
        cache: "no-store",
        body: JSON.stringify(payload),
      });
      if (!resp.ok) {
        const j = await resp.json().catch(() => ({}));
        throw new Error(j.message || `HTTP ${resp.status}`);
      }
      alert(`Menu berhasil ${isEdit ? "diupdate" : "ditambahkan"}!`);
      setNewMenu({
        name: "",
        description: "",
        price: "",
        category: "makanan-nasi",
        imageFile: null,
        imageUrlPreview: "",
        is_available: 1,
      });
      setEditingMenu(null);
      fetchMenuItems();
      setActiveMenuSubTab("menu-list");
    } catch (e) {
      alert(`Gagal ${editingMenu ? "mengupdate" : "menambahkan"} menu: ${e.message}`);
    }
  };

  const handleEditMenuClick = (item) => {
    setEditingMenu(item);
    setNewMenu({
      name: item?.name || "",
      description: item?.description || "",
      price: item?.price || "",
      category: item?.category || "makanan-nasi",
      imageFile: null,
      imageUrlPreview: item?.image_url || "",
      is_available:
        item?.is_available === 1 ||
        item?.is_available === true ||
        item?.is_available === "1"
          ? 1
          : 0,
    });
    setActiveMenuSubTab("menu-form");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleCancelEdit = () => {
    setEditingMenu(null);
    setNewMenu({
      name: "",
      description: "",
      price: "",
      category: "makanan-nasi",
      imageFile: null,
      imageUrlPreview: "",
      is_available: 1,
    });
    setActiveMenuSubTab("menu-list");
  };

  const handleDeleteMenu = async (id_menu) => {
    if (!id_menu) return;
    if (!window.confirm("Hapus menu ini?")) return;
    try {
      const resp = await fetch(`${apiBaseUrl}/menu/${id_menu}?t=${Date.now()}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
          "Cache-Control": "no-cache",
        },
        cache: "no-store",
      });
      if (!resp.ok) {
        const j = await resp.json().catch(() => ({}));
        throw new Error(j.message || `HTTP ${resp.status}`);
      }
      alert("Menu berhasil dihapus!");
      fetchMenuItems();
    } catch (e) {
      alert(`Gagal menghapus menu: ${e.message}`);
    }
  };

  const handleToggleMenuAvailability = async (item) => {
    if (!item?.id_menu) return;
    const isAvail =
      item.is_available === 1 ||
      item.is_available === true ||
      item.is_available === "1";
    try {
      const resp = await fetch(
        `${apiBaseUrl}/menu/${item.id_menu}/availability?t=${Date.now()}`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            Accept: "application/json",
            "Cache-Control": "no-cache",
          },
          cache: "no-store",
          body: JSON.stringify({ is_available: isAvail ? 0 : 1 }),
        }
      );
      if (!resp.ok) {
        const j = await resp.json().catch(() => ({}));
        throw new Error(j.message || `HTTP ${resp.status}`);
      }
      const j = await resp.json();
      alert(j.message || "Ketersediaan menu diubah");
      fetchMenuItems();
    } catch (e) {
      alert(`Gagal mengubah ketersediaan: ${e.message}`);
    }
  };

  /**
   * ========================
   * Tables
   * ========================
   */
  const handleAddTable = async () => {
    if (!newTable.table_number.trim()) {
      alert("Nomor meja tidak boleh kosong!");
      return;
    }
    try {
      const resp = await fetch(`${apiBaseUrl}/tables?t=${Date.now()}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
          "Cache-Control": "no-cache",
        },
        cache: "no-store",
        body: JSON.stringify({
          table_number: newTable.table_number.trim(),
          capacity: newTable.capacity || null,
        }),
      });
      if (!resp.ok) {
        const j = await resp.json().catch(() => ({}));
        throw new Error(j.message || `HTTP ${resp.status}`);
      }
      alert("Meja berhasil ditambahkan!");
      setNewTable({ table_number: "", capacity: "" });
      fetchTables();
    } catch (e) {
      alert(`Gagal menambahkan meja: ${e.message}`);
    }
  };

  const generateQrUrl = (tableNum) =>
    `${window.location.origin}/menu/${encodeURIComponent(tableNum || "")}`;

  const handleDownloadQR = (tableNum) => {
    const id = `qr-table-${String(tableNum || "unknown").replace(/\s/g, "-")}`;
    const el = document.getElementById(id);
    if (!el || el.tagName.toLowerCase() !== "svg") {
      alert("QR tidak ditemukan");
      return;
    }
    const data = new XMLSerializer().serializeToString(el);
    const blob = new Blob([data], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `meja_${String(tableNum).replace(/\s/g, "-")}_qrcode.svg`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  /**
   * ========================
   * Orders
   * ========================
   */
// Fix updateOrderStatus function
const updateOrderStatus = async (orderId, newStatus) => {
  if (!orderId || !newStatus) return;
  if (!window.confirm(`Ubah status pesanan ${orderId} menjadi ${newStatus}?`)) return;
  
  try {
    const resp = await fetch(`${apiBaseUrl}/orders/${orderId}/status?t=${Date.now()}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ status: newStatus }),
    });
    
    const result = await resp.json();
    
    if (!resp.ok) {
      throw new Error(result.message || `HTTP ${resp.status}`);
    }
    
    // PERBAIKAN: Selalu refresh data dan hanya tampilkan success message
    await fetchOrders(true);
    
    // Check if update actually worked by finding the order
    const updatedOrder = orders.find(o => o.order_id === orderId);
    if (updatedOrder && updatedOrder.order_status === newStatus) {
      alert(`Status pesanan ${orderId} berhasil diubah!`);
    } else {
      alert(`Status pesanan ${orderId} diupdate. Silakan refresh jika belum terlihat.`);
    }
    
  } catch (e) {
    console.error('Update status error:', e);
    
    // PERBAIKAN: Refresh data dulu sebelum tampilkan error
    await fetchOrders(true);
    
    const updatedOrder = orders.find(o => o.order_id === orderId);
    if (updatedOrder && updatedOrder.order_status === newStatus) {
      // Actually succeeded despite error message
      alert(`Status pesanan ${orderId} berhasil diubah!`);
    } else {
      alert(`Gagal update status: ${e.message}`);
    }
  }
};

  const handleCashierPaymentClick = (orderId, amount) => {
    setSelectedOrderIdForPayment(orderId);
    setSelectedOrderTotalAmount(Number(amount || 0));
    setIsPaymentModalOpen(true);
  };

 const updateOrderPaymentStatus = async (orderId, modalPaymentStatus, paymentMethod) => {
  try {
    let statusToSend = modalPaymentStatus;
    if (modalPaymentStatus === "paid") statusToSend = "Sudah Bayar";
    if (modalPaymentStatus === "unpaid") statusToSend = "Belum Bayar";

    const resp = await fetch(
      `${apiBaseUrl}/orders/${orderId}/payment_status?t=${Date.now()}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
          "Cache-Control": "no-cache",
        },
        cache: "no-store",
        body: JSON.stringify({
          payment_status: statusToSend,
          payment_method: paymentMethod || "cash",
        }),
      }
    );

    if (!resp.ok) {
      const j = await resp.json().catch(() => ({}));
      throw new Error(j.message || `HTTP ${resp.status}`);
    }

    // PERBAIKAN: Close modal sebelum refresh
    setIsPaymentModalOpen(false);
    setSelectedOrderIdForPayment(0);
    setSelectedOrderTotalAmount(0);

    // Success message
    alert(`Status pembayaran pesanan ${orderId} berhasil diupdate!`);
    
    // Refresh orders
    await fetchOrders(true);
    
    // Return resolved promise
    return Promise.resolve();
    
  } catch (e) {
    console.error('Payment update error:', e);
    
    // PERBAIKAN: Tetap close modal meskipun error
    setIsPaymentModalOpen(false);
    setSelectedOrderIdForPayment(0);
    setSelectedOrderTotalAmount(0);
    
    // Check if payment actually succeeded by refreshing data
    await fetchOrders(true);
    
    alert(`Error: ${e.message}. Silakan cek status pembayaran di daftar pesanan.`);
    return Promise.reject(e);
  }
};

  const removeItemFromEditOrderCart = (item) => {
    if (!item?.id_menu) return;
    setEditOrderCart((prev) => {
      const exist = findEditOrderCartItem(item.id_menu, item.options || {});
      if (!exist) return prev;
      if ((exist.quantity || 0) > 1) {
        return prev.map((c) =>
          c === exist ? { ...c, quantity: (c.quantity || 0) - 1 } : c
        );
      }
      return prev.filter((c) => c !== exist);
    });
  };

  const handleEditOrderOptionChange = (itemId, type, value) => {
    setEditOrderItemSelections((p) => ({
      ...p,
      [itemId]: { ...p[itemId], [type]: value },
    }));
  };

  const getEditOrderTotalItems = () =>
    (editOrderCart || []).reduce((s, it) => s + (Number(it?.quantity) || 0), 0);

  const getEditOrderTotalPrice = () =>
    (editOrderCart || []).reduce(
      (s, it) => s + (Number(it?.price || 0) * Number(it?.quantity || 0)),
      0
    );

  const handleSaveEditOrder = async () => {
    if (!selectedOrderForDetail?.order_id) {
      alert("Data pesanan tidak valid.");
      return;
    }
    if (getEditOrderTotalItems() === 0) {
      alert("Keranjang kosong.");
      return;
    }
    const items = (editOrderCart || [])
      .map((it) => ({
        id_menu: Number(it.id_menu) || 0,
        quantity: Number(it.quantity) || 0,
        spiciness_level: it?.options?.spiciness || null,
        temperature_level: it?.options?.temperature || null,
      }))
      .filter((x) => x.id_menu > 0 && x.quantity > 0);

    const payload = { items, note: editOrderNote || "" };
    let resp = await fetch(
      `${apiBaseUrl}/orders/${selectedOrderForDetail.order_id}?t=${Date.now()}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
          "Cache-Control": "no-cache",
        },
        cache: "no-store",
        body: JSON.stringify(payload),
      }
    );

    // fallback route
    if (resp.status === 404) {
      resp = await fetch(
        `${apiBaseUrl}/orders/update/${selectedOrderForDetail.order_id}?t=${Date.now()}`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            Accept: "application/json",
            "Cache-Control": "no-cache",
          },
          cache: "no-store",
          body: JSON.stringify(payload),
        }
      );
    }

    if (!resp.ok) {
      let msg = await resp.text();
      try {
        const j = JSON.parse(msg);
        msg = j.message || msg;
      } catch {}
      alert(`Gagal memperbarui pesanan: ${msg}`);
      return;
    }

    alert(`Pesanan #${selectedOrderForDetail.order_id} berhasil diperbarui!`);
    closeEditOrder();
    fetchOrders(true);
  };

  // ====== Kasir - order baru
  const findNewOrderCartItem = (itemId, options) =>
    (newOrderCart || []).find(
      (c) =>
        c?.id_menu === itemId &&
        (c.options?.spiciness || "") === (options?.spiciness || "") &&
        (c.options?.temperature || "") === (options?.temperature || "")
    );

  const addNewItemToOrderCart = (item) => {
    if (!item?.id_menu) return;
    const opts = newOrderItemSelections[item.id_menu] || {
      spiciness: "",
      temperature: "",
    };
    setNewOrderCart((prev) => {
      const exist = findNewOrderCartItem(item.id_menu, opts);
      if (exist) {
        return prev.map((c) =>
          c === exist ? { ...c, quantity: (c.quantity || 0) + 1 } : c
        );
      }
      return [
        ...prev,
        {
          id_menu: item.id_menu,
          name: item.name || "Unknown Item",
          price: item.price || 0,
          quantity: 1,
          options: { ...opts },
        },
      ];
    });
  };

  const removeNewItemFromOrderCart = (item) => {
    if (!item?.id_menu) return;
    setNewOrderCart((prev) => {
      const exist = findNewOrderCartItem(item.id_menu, item.options || {});
      if (!exist) return prev;
      if ((exist.quantity || 0) > 1) {
        return prev.map((c) =>
          c === exist ? { ...c, quantity: (c.quantity || 0) - 1 } : c
        );
      }
      return prev.filter((c) => c !== exist);
    });
  };

  const handleNewOrderOptionChange = (itemId, type, value) => {
    setNewOrderItemSelections((p) => ({
      ...p,
      [itemId]: { ...p[itemId], [type]: value },
    }));
  };

  const getNewOrderTotalItems = () =>
    (newOrderCart || []).reduce((s, it) => s + (Number(it?.quantity) || 0), 0);
  const getNewOrderTotalPrice = () =>
    (newOrderCart || []).reduce(
      (s, it) => s + Number(it?.price || 0) * Number(it?.quantity || 0),
      0
    );

const handleAddOrderForCashier = async () => {
  // Prevent multiple submissions
  if (isSubmittingOrder) {
    console.log('Order submission already in progress...');
    return;
  }

  const valid = (newOrderCart || []).filter(
    (it) => it?.id_menu && Number(it?.quantity) > 0
  );
  
  if (valid.length === 0) {
    alert("Keranjang pesanan kosong.");
    return;
  }

  setIsSubmittingOrder(true); // Start loading

  const items = valid.map((it) => ({
    id_menu: Number(it.id_menu),
    quantity: Number(it.quantity),
    spiciness_level: it?.options?.spiciness || null,
    temperature_level: it?.options?.temperature || null,
  }));

  const payload = {
    tableNumber: "Take Away",
    items,
    customerName: newOrderCustomerName.trim() || null,
  };

  console.log('Submitting order:', payload);

  try {
    const resp = await fetch(`${apiBaseUrl}/orders?t=${Date.now()}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
        "Cache-Control": "no-cache",
      },
      body: JSON.stringify(payload),
    });

    console.log('Order submission response status:', resp.status);

    if (!resp.ok) {
      const j = await resp.json().catch(() => ({}));
      throw new Error(j.message || `HTTP ${resp.status}`);
    }

    const j = await resp.json();
    console.log('Order creation response:', j);

    // Close modal immediately
    setIsAddOrderModalOpen(false);
    
    // Clear form
    setNewOrderCustomerName("");
    setNewOrderCart([]);
    const sel = {};
    (menuItems || []).forEach((mi) => {
      if (mi?.id_menu) sel[mi.id_menu] = { spiciness: "", temperature: "" };
    });
    setNewOrderItemSelections(sel);

    // Show success message immediately
    alert(`Pesanan baru berhasil dibuat! ID: ${j.orderId || "unknown"}`);
    
    // Refresh orders after short delay
    setTimeout(() => {
      fetchOrders(true);
    }, 1000);

  } catch (e) {
    console.error('Order submission error:', e);
    alert(`Gagal membuat pesanan: ${e.message}`);
  } finally {
    setIsSubmittingOrder(false); // End loading
  }
};


  // ====== Reports
  const fetchSalesReport = async () => {
    if (!token) return;
    setIsLoadingReport(true);
    try {
      const resp = await fetch(
        `${apiBaseUrl}/reports/sales?startDate=${reportDateRange.startDate}&endDate=${reportDateRange.endDate}&t=${Date.now()}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
            "Cache-Control": "no-cache",
          },
          cache: "no-store",
        }
      );
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      setReportData(
        data || {
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
        }
      );
    } catch (e) {
      alert(`Gagal mengambil laporan: ${e.message}`);
    } finally {
      setIsLoadingReport(false);
    }
  };

  const exportReportToCSV = () => {
    const rows = [
      ["Laporan Penjualan"],
      ["Periode", `${reportDateRange.startDate} - ${reportDateRange.endDate}`],
      [""],
      ["Ringkasan"],
      ["Total Penjualan", `Rp ${formatPrice(reportData.totalSales || 0)}`],
      ["Total Pesanan", reportData.totalOrders || 0],
      ["Pesanan Selesai", reportData.completedOrders || 0],
      ["Pesanan Dibatalkan", reportData.cancelledOrders || 0],
      ["Pesanan Dalam Proses", reportData.pendingOrders || 0],
      [""],
      ["Menu Terlaris"],
      ["Nama Menu", "Jumlah Terjual", "Total Pendapatan"],
      ...((reportData.topSellingItems || []).map((it) => [
        it.menu_name || "Unknown",
        it.total_quantity || 0,
        `Rp ${formatPrice(it.total_revenue || 0)}`,
      ]) || []),
    ];
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `laporan-penjualan-${reportDateRange.startDate}-${reportDateRange.endDate}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  // ====== Cetak struk
  const handlePrintOrder = (order) => {
    if (!order?.order_id) return;
    const items = normalizeOrderItems(order.items);
    const htmlItems = items
      .map((i) => {
        const qty = Number(i?.quantity) || 0;
        const each = Number(i?.price_at_order ?? i?.price ?? 0);
        const name = i?.menu_name ?? i?.name ?? "Unknown Item";
        const spice = i?.spiciness_level ?? i?.spiciness;
        const temp = i?.temperature_level ?? i?.temperature;
        return `
          <div class="receipt-item-line">
            <div class="item-details">
              <span>${qty}x ${name}</span>
              <span>Rp ${formatPrice(qty * each)}</span>
            </div>
            <div class="item-details">
              <span style="font-size: 11px;">@ Rp ${formatPrice(each)}</span>
              <span></span>
            </div>
            ${spice || temp ? `<div class="item-options">${spice ? `* ${spice}` : ""} ${temp ? `* ${temp}` : ""}</div>` : ""}
          </div>
        `;
      })
      .join("");

    const html = `
      <!doctype html>
      <html>
      <head>
        <meta charset="utf-8" />
        <title>Cetak Pesanan #${order.order_id}</title>
        <style>
          .print-receipt { font-family: 'Courier New', monospace; max-width: 80mm; margin: 0; padding: 20px; }
          .receipt-header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #000; padding-bottom: 10px; }
          .restaurant-name { font-size: 18px; font-weight: bold; margin-bottom: 5px; }
          .receipt-title { font-size: 16px; font-weight: bold; margin-bottom: 5px; }
          .info-line { display: flex; justify-content: space-between; margin-bottom: 3px; }
          .section-divider { border-top: 1px dashed #000; margin: 10px 0; }
          .item-details { display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 2px; }
          .item-options { font-size: 11px; color: #666; margin-bottom: 3px; padding-left: 10px; }
          .receipt-total-section { border-top: 2px solid #000; padding-top: 10px; margin-top: 15px; }
          .total-line { display: flex; justify-content: space-between; font-size: 16px; font-weight: bold; }
          .receipt-footer { text-align: center; margin-top: 20px; font-size: 11px; border-top: 1px dashed #000; padding-top: 10px; }
        </style>
      </head>
      <body>
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
              order.table_number === "Take Away" && order.customer_name
                ? `${order.table_number} - ${order.customer_name}`
                : order.table_number || "N/A"
            }</span></div>
            <div class="info-line"><span>Status:</span><span>${
              (order.order_status || "N/A").toUpperCase()
            }</span></div>
            <div class="info-line"><span>Pembayaran:</span><span>${
              (order.payment_status || "N/A").toUpperCase()
            }</span></div>
          </div>

          <div class="section-divider"></div>

          <div class="receipt-items-section">
            <div class="item-header">DETAIL PESANAN:</div>
            ${htmlItems}
          </div>

          <div class="receipt-total-section">
            <div class="total-line"><span>TOTAL:</span><span>Rp ${formatPrice(
              order.total_amount || 0
            )}</span></div>
          </div>

          <div class="receipt-footer">
            <div>Terima kasih atas kunjungan Anda!</div>
            <div>Selamat menikmati makanan Anda</div>
          </div>
        </div>
      </body>
      </html>
    `;
    const w = window.open("", "", "height=600,width=400");
    if (!w) {
      alert("Popup diblokir. Izinkan pop-up untuk mencetak.");
      return;
    }
    w.document.write(html);
    w.document.close();
    w.print();
  };

  /**
   * ========================
   * Effects
   * ========================
   */
// Tambahkan di bagian atas AdminPage.jsx untuk debugging network requests
// GANTI useEffect yang ada di AdminPage.jsx dengan ini:

useEffect(() => {
  console.log('useEffect triggered - token:', !!token);
  
  if (!token) {
    console.log('No token, skipping data fetch');
    return;
  }
  
  let intervalId;
  
  const initializeData = async () => {
    try {
      console.log('Starting data initialization...');
      
      // Warmup backend
      await warmupBackend();
      console.log('Backend warmed up');
      
      // Fetch all data
      await fetchOrders(true);
      console.log('Orders fetched');
      
      await fetchMenuItems();
      console.log('Menu items fetched');
      
      await fetchTables();
      console.log('Tables fetched');
      
      console.log('All data fetched successfully');
      
      // Set up interval for orders only
      intervalId = setInterval(() => {
        console.log('Interval fetch orders...');
        fetchOrders(true);
      }, 10000); // Increased to 10 seconds
      
    } catch (error) {
      console.error('Error in data initialization:', error);
    }
  };
  
  // Call initialization
  initializeData();
  
  // Cleanup function
  return () => {
    console.log('Cleaning up useEffect...');
    try {
      if (intervalId) {
        clearInterval(intervalId);
        console.log('Interval cleared');
      }
    } catch (e) {
      console.error('Error clearing interval:', e);
    }
    try {
      if (ordersAbortRef.current) {
        ordersAbortRef.current.abort('Component unmounting');
        console.log('Pending requests aborted');
      }
    } catch (e) {
      console.error('Error aborting requests:', e);
    }
  };
}, [token]); // Keep dependency on token

// TAMBAHAN: useEffect untuk debug state changes
useEffect(() => {
  console.log('MenuItems state updated:', menuItems.length, 'items');
}, [menuItems]);

useEffect(() => {
  console.log('Tables state updated:', tables.length, 'tables');
}, [tables]);

useEffect(() => {
  console.log('Orders state updated:', orders.length, 'orders');
}, [orders]);

// FIXED showEditOrder function - ganti yang ada di AdminPage.jsx
const showEditOrder = (order) => {
  console.log('showEditOrder called with:', order);
  
  if (!order?.items) {
    alert("Data pesanan tidak valid");
    return;
  }

  const normalizedItems = normalizeOrderItems(order.items);
  if (!normalizedItems || normalizedItems.length === 0) {
    alert("Pesanan ini tidak memiliki item yang valid");
    return;
  }

  const existing = normalizedItems.map(toUnifiedItem).filter((it) => it.id_menu > 0 && it.quantity > 0);
  
  setEditOrderCart(existing);
  setSelectedOrderForDetail(order);
  setIsEditOrderModalOpen(true);
};

  useEffect(() => {
    if (activeTab === "laporan" && token) fetchSalesReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, token, reportDateRange.startDate, reportDateRange.endDate]);

  /**
   * ========================
   * UI helpers
   * ========================
   */
  const toggleSidebar = () => setSidebarCollapsed((v) => !v);
  const toggleMobileMenu = () => setMobileMenuOpen((v) => !v);
  const handleTabChange = (t) => {
    setActiveTab(t);
    setActiveMenuSubTab("menu-list");
    setMobileMenuOpen(false);
  };

  /**
   * ========================
   * RENDER
   * ========================
   */

  // Login
  if (!token) {
    return (
      <div className="login-form-container">
        <div className="login-form">
          <h2 className="admin-section-title">Login Admin / Kasir</h2>

          <div className="login-input-group">
            <label>Username:</label>
            <input
              className="login-input"
              placeholder="Masukkan username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={isLoggingIn}
            />
          </div>

          <div className="login-input-group">
            <label>Password:</label>
            <div className="password-input-container" style={{ position: "relative" }}>
              <input
                type={showPassword ? "text" : "password"}
                className="login-input"
                placeholder="Masukkan password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoggingIn}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !isLoggingIn) handleLogin();
                }}
                style={{ paddingRight: 45 }}
              />
              <button
                type="button"
                className="password-toggle-btn"
                onClick={() => setShowPassword((v) => !v)}
                disabled={isLoggingIn}
                title={showPassword ? "Sembunyikan" : "Tampilkan"}
                style={{
                  position: "absolute",
                  right: 10,
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "none",
                  border: "1px solid #ddd",
                  cursor: "pointer",
                  fontSize: 11,
                  color: "#666",
                  padding: "4px 6px",
                  borderRadius: 4,
                  height: 24,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 500,
                }}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          {loginError ? (
            <div
              className="login-error-message"
              style={{
                whiteSpace: "pre-line",
                textAlign: "left",
                padding: 12,
                backgroundColor: "#fee",
                border: "1px solid #fcc",
                borderRadius: 4,
                color: "#c33",
                fontSize: 14,
                margin: "10px 0",
              }}
            >
              {loginError}
            </div>
          ) : null}

          <button className="login-button" onClick={handleLogin} disabled={isLoggingIn}>
            {isLoggingIn ? "Logging in..." : "Login"}
          </button>
        </div>
      </div>
    );
  }

  // Dashboard
  return (
    <div className="admin-dashboard-layout">
      {/* Mobile toggle */}
      <button className="mobile-menu-toggle" onClick={toggleMobileMenu}>
        <span></span><span></span><span></span>
      </button>

      {/* Overlay */}
      <div
        className={`sidebar-overlay ${mobileMenuOpen ? "active" : ""}`}
        onClick={() => setMobileMenuOpen(false)}
      />

      {/* Sidebar */}
      <div
        className={`admin-sidebar ${sidebarCollapsed ? "collapsed" : ""} ${
          mobileMenuOpen ? "mobile-open" : ""
        }`}
      >
        <button className="desktop-sidebar-toggle" onClick={toggleSidebar}>
          {sidebarCollapsed ? "→" : "←"}
        </button>

        <div className="admin-sidebar-header">
          <span className="admin-sidebar-title">Dashboard Admin</span>
        </div>

        <div className="admin-sidebar-user-info">
          <p>
            Login sebagai: <strong>{String(userRole || "").toUpperCase()}</strong>
          </p>
          <button onClick={handleLogout} className="admin-logout-button">
            Logout
          </button>
        </div>

        <ul className="admin-sidebar-nav">
          <li
            className={activeTab === "pesanan" ? "active" : ""}
            onClick={() => handleTabChange("pesanan")}
          >
            <a href="#daftar-pesanan">Daftar Pesanan</a>
          </li>
          {userRole === "admin" && (
            <>
              <li
                className={activeTab === "manajemen-menu" ? "active" : ""}
                onClick={() => handleTabChange("manajemen-menu")}
              >
                <a href="#manajemen-menu">Manajemen Menu</a>
              </li>
              <li
                className={activeTab === "manajemen-meja" ? "active" : ""}
                onClick={() => handleTabChange("manajemen-meja")}
              >
                <a href="#manajemen-meja">Manajemen Meja</a>
              </li>
            </>
          )}
          <li
            className={activeTab === "laporan" ? "active" : ""}
            onClick={() => handleTabChange("laporan")}
          >
            <a href="#laporan">Laporan</a>
          </li>
        </ul>
      </div>

      {/* Content */}
      <div className={`admin-content-area ${sidebarCollapsed ? "expanded" : ""}`}>
        {/* Pesanan */}
        {activeTab === "pesanan" && (
          <div className="admin-section-box">
            <div className="order-list-header">
              <h2 className="admin-section-title">Daftar Pesanan</h2>
              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <button
                  onClick={handleManualRefresh}
                  disabled={isRefreshing}
                  style={{
                    padding: "8px 16px",
                    backgroundColor: isRefreshing ? "#6c757d" : "#28a745",
                    color: "#fff",
                    border: "none",
                    borderRadius: 5,
                    cursor: isRefreshing ? "not-allowed" : "pointer",
                    fontSize: "0.9em",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  {isRefreshing ? "🔄" : "↻"} {isRefreshing ? "Refreshing..." : "Refresh"}
                </button>
                <small style={{ color: "#666", fontSize: "0.8em" }}>
                  Last update: {lastRefresh.toLocaleTimeString("id-ID")}
                </small>
                {(userRole === "admin" || userRole === "cashier") && (
                  <button
                    onClick={() => setIsAddOrderModalOpen(true)}
                    className="add-order-button"
                  >
                    Tambah Pesanan
                  </button>
                )}
              </div>
            </div>

            {orders.length === 0 ? (
              <p className="no-data-message">Belum ada pesanan masuk.</p>
            ) : (
              <div className="orders-grid">
                {orders.map((order, idx) => {
                  if (!order) return null;
                  const orderItems = normalizeOrderItems(order.items);
                  return (
                    <div key={order.order_id || idx} className="order-card">
                      <div className="order-card-header">
                        <h3>ID Pesanan: {order.order_id || "N/A"}</h3>
                      </div>

                      <div className="order-card-content">
                        <div className="order-info-grid">
                          <div className="order-info-item">
                            <span className="order-info-label">Meja:</span>
                            <span className="order-info-value">
                              {order.table_number === "Take Away" && order.customer_name
                                ? `${order.table_number} - ${order.customer_name}`
                                : order.table_number || "N/A"}
                            </span>
                          </div>

                          <div className="order-info-item">
                            <span className="order-info-label">Total:</span>
                            <span className="order-info-value order-total-value">
                              Rp {formatPrice(order.total_amount)}
                            </span>
                          </div>

                          <div className="order-info-item">
                            <span className="order-info-label">Status:</span>
                            <span
                              className={`order-info-value ${
                                order.order_status === "Dalam Proses"
                                  ? "order-status-pending"
                                  : order.order_status === "Selesai"
                                  ? "order-status-completed"
                                  : "order-status-other"
                              }`}
                            >
                              {order.order_status ? order.order_status.toUpperCase() : "N/A"}
                            </span>
                          </div>

                          <div className="order-info-item">
                            <span className="order-info-label">Pembayaran:</span>
                            <span
                              className={`order-info-value ${
                                order.payment_status === "Belum Bayar"
                                  ? "payment-status-unpaid"
                                  : order.payment_status === "Sudah Bayar"
                                  ? "payment-status-paid"
                                  : "order-status-other"
                              }`}
                            >
                              {order.payment_status
                                ? order.payment_status.toUpperCase()
                                : "N/A"}
                            </span>
                          </div>

                          <div className="order-info-item">
                            <span className="order-info-label">Waktu Pesan:</span>
                            <span className="order-info-value">
                              {formatOrderTime(order.order_time)}
                            </span>
                          </div>
                        </div>

                        <div className="order-items-section">
                          <div className="order-items-header">Item Pesanan:</div>
                          <ul className="order-items-list">
                            {orderItems.map((i, ii) => {
                              if (!i) return null;
                              const qty = Number(i?.quantity) || 0;
                              const each = Number(i?.price_at_order ?? i?.price ?? 0);
                              const name = i?.menu_name ?? i?.name ?? "Unknown Item";
                              const spice = i?.spiciness_level ?? i?.spiciness;
                              const temp = i?.temperature_level ?? i?.temperature;
                              return (
                                <li key={ii} className="order-item-detail">
                                  <div className="order-item-info">
                                    <span className="order-item-name">
                                      {qty}x {name}
                                    </span>
                                    {(spice || temp) && (
                                      <div className="order-item-options">
                                        {spice && <span className="order-item-option">({spice})</span>}
                                        {temp && <span className="order-item-option">({temp})</span>}
                                      </div>
                                    )}
                                  </div>
                                  <div className="order-item-price">
                                    Rp {formatPrice(qty * each)}
                                  </div>
                                </li>
                              );
                            })}
                          </ul>
                        </div>

                        <div className="order-actions">
                          {order.order_status === "Dalam Proses" && (
                            <>
                              <div className="order-actions-row">
                                {order.payment_status === "Belum Bayar" && (
                                  <button
                                    onClick={() =>
                                      handleCashierPaymentClick(order.order_id, order.total_amount)
                                    }
                                    className="order-action-button btn-success"
                                  >
                                    Bayar
                                  </button>
                                )}
                                // Ganti button Edit dengan ini untuk test:
                                <button
                                  onClick={() => {
                                    console.log('Edit button clicked for order:', order.order_id);
                                    alert(`Edit order ${order.order_id} - Function sedang diperbaiki`);
                                  }}
                                  className="order-action-button btn-warning"
                                >
                                  Edit Test
                                </button>
                                {order.payment_status === "Sudah Bayar" && (
                                  <button
                                    onClick={() =>
                                      updateOrderStatus(order.order_id, "Selesai")
                                    }
                                    className="order-action-button btn-success"
                                  >
                                    Selesai
                                  </button>
                                )}
                              </div>
                              <button
                                onClick={() =>
                                  updateOrderStatus(order.order_id, "Dibatalkan")
                                }
                                className="order-action-button btn-secondary full-width"
                              >
                                Batalkan
                              </button>
                            </>
                          )}

                          {order.payment_status === "Sudah Bayar" &&
                            order.order_status !== "Dalam Proses" && (
                              <button
                                onClick={() => handlePrintOrder(order)}
                                className="order-action-button btn-info full-width"
                              >
                                Cetak Struk
                              </button>
                            )}
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
        {activeTab === "manajemen-menu" && userRole === "admin" && (
          <div className="admin-section-box">
            <div className="menu-header-controls">
              {activeMenuSubTab === "menu-list" ? (
                <>
                  <h2 className="admin-section-title">Daftar Menu</h2>
                  <button
                    onClick={() => {
                      setEditingMenu(null);
                      setNewMenu({
                        name: "",
                        description: "",
                        price: "",
                        category: "makanan-nasi",
                        imageFile: null,
                        imageUrlPreview: "",
                        is_available: 1,
                      });
                      setActiveMenuSubTab("menu-form");
                    }}
                    className="menu-add-button"
                  >
                    Tambah Menu Baru
                  </button>
                </>
              ) : (
                <h2 className="admin-section-title">
                  {editingMenu ? "Edit Menu" : "Tambah Menu Baru"}
                </h2>
              )}
            </div>

            {activeMenuSubTab === "menu-list" ? (
              <>
                <h3>Daftar Menu:</h3>
                {menuItems.length === 0 ? (
                  <p className="no-data-message">Belum ada menu.</p>
                ) : (
                  <div className="menu-list-grid">
                    {menuItems.map((item) => (
                      <div
                        key={item.id_menu}
                        className="menu-item-management-card"
                      >
                        <img
                          src={
                            item.image_url ||
                            "https://placehold.co/150x150/CCCCCC/000000?text=No+Image"
                          }
                          onError={(e) => {
                            e.currentTarget.src =
                              "https://placehold.co/150x150/CCCCCC/000000?text=No+Image";
                          }}
                          alt={item.name || "Menu Item"}
                          className="menu-item-management-image"
                        />
                        <p>
                          <strong>{item.name || "Unknown"}</strong> (Rp{" "}
                          {formatPrice(item.price)})
                        </p>
                        <p className="menu-item-management-category">
                          Kategori: {item.category || "N/A"}
                        </p>
                        <p
                          className={
                            item.is_available === 1 ||
                            item.is_available === true ||
                            item.is_available === "1"
                              ? "menu-status-available"
                              : "menu-status-unavailable"
                          }
                        >
                          Status:{" "}
                          {item.is_available === 1 ||
                          item.is_available === true ||
                          item.is_available === "1"
                            ? "Tersedia"
                            : "Tidak Tersedia"}
                        </p>
                        <div className="menu-action-buttons">
                          <button
                            onClick={() => handleEditMenuClick(item)}
                            className="menu-action-button btn-info"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleToggleMenuAvailability(item)}
                            className={
                              item.is_available === 1 ||
                              item.is_available === true ||
                              item.is_available === "1"
                                ? "menu-action-button toggle-active"
                                : "menu-action-button toggle-inactive"
                            }
                          >
                            {item.is_available === 1 ||
                            item.is_available === true ||
                            item.is_available === "1"
                              ? "Nonaktifkan"
                              : "Aktifkan"}
                          </button>
                          <button
                            onClick={() => handleDeleteMenu(item.id_menu)}
                            className="menu-action-button delete"
                          >
                            Hapus
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="menu-form">
                <input
                  type="text"
                  placeholder="Nama Menu"
                  value={newMenu.name}
                  onChange={(e) =>
                    setNewMenu((p) => ({ ...p, name: e.target.value }))
                  }
                  className="menu-form-input"
                />
                <textarea
                  placeholder="Deskripsi"
                  value={newMenu.description}
                  onChange={(e) =>
                    setNewMenu((p) => ({ ...p, description: e.target.value }))
                  }
                  className="menu-form-textarea"
                  rows={2}
                />
                <input
                  type="number"
                  placeholder="Harga"
                  value={newMenu.price}
                  onChange={(e) =>
                    setNewMenu((p) => ({ ...p, price: e.target.value }))
                  }
                  className="menu-form-input"
                />
                <select
                  value={newMenu.category}
                  onChange={(e) =>
                    setNewMenu((p) => ({ ...p, category: e.target.value }))
                  }
                  className="menu-form-select"
                >
                  <option value="makanan-nasi">MAKANAN - NASI</option>
                  <option value="makanan-pelengkap">MAKANAN - PELENGKAP</option>
                  <option value="minuman-kopi">MINUMAN - KOPI</option>
                  <option value="minuman-nonkopi">MINUMAN - NON KOPI</option>
                  <option value="menu mie-banggodrong">MENU MIE - BANGGONDRONG</option>
                  <option value="menu mie-aceh">MENU MIE - ACEH</option>
                  <option value="menu mie-toping">MENU MIE - TOPING</option>
                  <option value="camilan-manis">CAMILAN - MANIS</option>
                  <option value="camilan-gurih">CAMILAN - GURIH</option>
                  <option value="lain-lain">LAIN-LAIN</option>
                </select>
                <input
                  type="file"
                  id="menuImageUpload"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="menu-form-file"
                />
                {newMenu.imageUrlPreview ? (
                  <div className="menu-image-preview-container">
                    <img
                      src={newMenu.imageUrlPreview}
                      alt="Preview"
                      className="menu-image-preview"
                    />
                  </div>
                ) : null}
                <div className="menu-form-actions">
                  <button onClick={handleAddOrUpdateMenu} className="menu-add-button">
                    {editingMenu ? "Update Menu" : "Tambah Menu"}
                  </button>
                  <button onClick={handleCancelEdit} className="menu-action-button btn-secondary">
                    Batal
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Manajemen Meja */}
        {activeTab === "manajemen-meja" && userRole === "admin" && (
          <div className="admin-section-box">
            <h2 className="admin-section-title">Manajemen Meja</h2>
            <div className="table-form">
              <input
                type="text"
                placeholder="Nomor Meja (misal: Meja 1, Bar 3)"
                value={newTable.table_number}
                onChange={(e) =>
                  setNewTable((p) => ({ ...p, table_number: e.target.value }))
                }
                className="table-form-input"
              />
              <input
                type="number"
                placeholder="Kapasitas (opsional)"
                value={newTable.capacity}
                onChange={(e) =>
                  setNewTable((p) => ({ ...p, capacity: e.target.value }))
                }
                className="table-form-input"
              />
              <button onClick={handleAddTable} className="table-add-button">
                Tambah Meja
              </button>
            </div>

            <h3>QR Code Meja:</h3>
            <div className="qr-code-grid">
              {tables.map((t) => (
                <div key={t.id_table} className="qr-card">
                  <h4 className="qr-card-title">Meja {t.table_number || "N/A"}</h4>
                  <p className="qr-card-status">Status: {t.status || "Available"}</p>
                  <QRCodeSVG
                    id={`qr-table-${String(t.table_number || "unknown").replace(/\s/g, "-")}`}
                    value={generateQrUrl(t.table_number)}
                    size={100}
                    level="H"
                    includeMargin
                  />
                  <button
                    onClick={() => handleDownloadQR(t.table_number)}
                    className="qr-download-button"
                  >
                    Unduh QR
                  </button>
                </div>
              ))}
            </div>
            {tables.length === 0 && (
              <p className="no-tables-message">Belum ada meja. Tambahkan meja baru di atas.</p>
            )}
          </div>
        )}

        {/* Laporan */}
        {activeTab === "laporan" && (
          <div className="admin-section-box">
            <h2 className="admin-section-title">Laporan Penjualan</h2>

            <div className="report-filters">
              <div className="date-filter-group">
                <label>Dari Tanggal:</label>
                <input
                  type="date"
                  value={reportDateRange.startDate}
                  onChange={(e) =>
                    setReportDateRange((p) => ({ ...p, startDate: e.target.value }))
                  }
                  className="report-date-input"
                />
              </div>
              <div className="date-filter-group">
                <label>Sampai Tanggal:</label>
                <input
                  type="date"
                  value={reportDateRange.endDate}
                  onChange={(e) =>
                    setReportDateRange((p) => ({ ...p, endDate: e.target.value }))
                  }
                  className="report-date-input"
                />
              </div>
              <button
                onClick={fetchSalesReport}
                className="generate-report-button"
                disabled={isLoadingReport}
              >
                {isLoadingReport ? "Loading..." : "Generate Laporan"}
              </button>
              <button
                onClick={exportReportToCSV}
                className="export-button"
                disabled={isLoadingReport || (reportData.totalOrders || 0) === 0}
              >
                Export CSV
              </button>
            </div>

            {isLoadingReport ? (
              <div className="loading-message">Memuat laporan...</div>
            ) : (
              <>
                <div className="report-summary">
                  <div className="summary-card">
                    <h3>Total Penjualan</h3>
                    <p className="summary-value">Rp {formatPrice(reportData.totalSales || 0)}</p>
                  </div>
                  <div className="summary-card">
                    <h3>Total Pesanan</h3>
                    <p className="summary-value">{reportData.totalOrders || 0}</p>
                  </div>
                  <div className="summary-card">
                    <h3>Pesanan Selesai</h3>
                    <p className="summary-value success">{reportData.completedOrders || 0}</p>
                  </div>
                  <div className="summary-card">
                    <h3>Pesanan Dibatalkan</h3>
                    <p className="summary-value danger">{reportData.cancelledOrders || 0}</p>
                  </div>
                  <div className="summary-card">
                    <h3>Pesanan Dalam Proses</h3>
                    <p className="summary-value info">{reportData.pendingOrders || 0}</p>
                  </div>
                </div>

                <div className="today-sales">
                  <h3>
                    Penjualan Tanggal Awal Periode (
                    {new Date(reportDateRange.startDate).toLocaleDateString("id-ID")}
                    )
                  </h3>
                  <div className="today-stats">
                    <div className="today-stat">
                      <span>Pendapatan: </span>
                      <strong>Rp {formatPrice(reportData.totalSalesToday || 0)}</strong>
                    </div>
                    <div className="today-stat">
                      <span>Pesanan: </span>
                      <strong>{reportData.totalOrdersToday || 0}</strong>
                    </div>
                  </div>
                </div>

                <div className="top-selling-section">
                  <h3>Menu Terlaris (Periode Dipilih)</h3>
                  {!reportData.topSellingItems?.length ? (
                    <p className="no-data-message">Tidak ada data penjualan untuk periode yang dipilih.</p>
                  ) : (
                    <div className="top-selling-table">
                      <table>
                        <thead>
                          <tr>
                            <th>Peringkat</th>
                            <th>Nama Menu</th>
                            <th>Jumlah Terjual</th>
                            <th>Total Pendapatan</th>
                            <th>Rata-rata Harga</th>
                          </tr>
                        </thead>
                        <tbody>
                          {reportData.topSellingItems.map((it, i) => (
                            <tr key={it.menu_item_id || `${it.menu_name}-${i}`}>
                              <td className="rank-cell">#{i + 1}</td>
                              <td className="menu-name-cell">{it.menu_name || "Unknown"}</td>
                              <td className="quantity-cell">{it.total_quantity || 0}</td>
                              <td className="revenue-cell">
                                Rp {formatPrice(it.total_revenue || 0)}
                              </td>
                              <td className="avg-price-cell">Rp {formatPrice(it.avg_price || 0)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {reportData.salesByPaymentMethod?.length > 0 && (
                  <div className="payment-method-section">
                    <h3>Penjualan per Metode Pembayaran</h3>
                    <div className="payment-method-stats">
                      {reportData.salesByPaymentMethod.map((m, i) => (
                        <div key={m.payment_method || i} className="payment-stat-card">
                          <h4>{m.payment_method || "Belum Ditentukan"}</h4>
                          <p>Jumlah: {m.order_count || 0} pesanan</p>
                          <p>Total: Rp {formatPrice(m.total_amount || 0)}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {reportData.salesByDate?.length > 0 && (
                  <div className="daily-sales-section">
                    <h3>Penjualan Harian</h3>
                    <div className="daily-sales-chart">
                      {reportData.salesByDate.map((d, i) => (
                        <div key={d.sale_date || i} className="daily-sale-item">
                          <span className="sale-date">
                            {d.sale_date
                              ? new Date(d.sale_date).toLocaleDateString("id-ID")
                              : "Unknown Date"}
                          </span>
                          <span className="sale-amount">
                            Rp {formatPrice(d.daily_total || 0)}
                          </span>
                          <span className="sale-orders">({d.order_count || 0} pesanan)</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Edit Order Modal */}
      {isEditOrderModalOpen && selectedOrderForDetail && (
        <div className="edit-order-modal-overlay">
          <div className="edit-order-container">
            <div className="edit-order-header">
              <button className="back-btn" onClick={() => {
                setIsEditOrderModalOpen(false);
                setSelectedOrderForDetail(null);
                setEditOrderCart([]);
                setEditOrderItemSelections({});
                setEditOrderNote("");
              }}>
                ←
              </button>
              <h2>Edit Pesanan #{selectedOrderForDetail.order_id || "N/A"}</h2>
            </div>

            <div className="edit-alert">
              <strong>Info:</strong> Anda sedang mengedit pesanan yang sudah ada.
            </div>

            <div className="edit-menu-section">
              <div className="edit-section-title">Menu Tersedia</div>

              {Object.entries(groupMenuByCategory(menuItems)).map(
                ([category, categoryItems]) => (
                  <div
                    key={category}
                    className="edit-menu-category-section"
                    style={{
                      marginBottom: 25,
                      border: "2px solid #27ae60",
                      borderRadius: 10,
                      overflow: "hidden",
                    }}
                  >
                    <h3
                      className="edit-category-title"
                      style={{
                        background: "#f8f9fa",
                        padding: "12px 20px",
                        margin: 0,
                        borderBottom: "1px solid #e0e0e0",
                        textTransform: "uppercase",
                        fontWeight: "bold",
                      }}
                    >
                      {getCategoryDisplayName(category)}
                    </h3>

                    <div
                      className="edit-menu-category-content"
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                        gap: 15,
                        padding: 20,
                        background: "#f1f3f4",
                        border: "2px dashed #ff6b6b",
                      }}
                    >
                      {categoryItems.map((item) => {
                        if (!item?.id_menu) return null;
                        const currentOpts =
                          editOrderItemSelections[item.id_menu] || {
                            spiciness: "",
                            temperature: "",
                          };
                        const qty =
                          findEditOrderCartItem(item.id_menu, currentOpts)?.quantity || 0;

                        return (
                          <div
                            key={item.id_menu}
                            className={`edit-menu-item ${qty > 0 ? "selected" : ""}`}
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              padding: 15,
                              background: qty > 0 ? "#e8f4fd" : "#fff",
                              borderRadius: 10,
                              border: `2px solid ${qty > 0 ? "#3498db" : "#e0e0e0"}`,
                              minHeight: 160,
                              cursor: "pointer",
                              transition: "all .2s ease",
                              position: "relative",
                              gap: 10,
                            }}
                          >
                            <div
                              className="edit-menu-item-header"
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "flex-start",
                                marginBottom: 8,
                              }}
                            >
                              <span
                                className="edit-menu-item-name"
                                style={{
                                  fontWeight: 600,
                                  color: "#2c3e50",
                                  fontSize: "0.95em",
                                  flex: 1,
                                  marginRight: 8,
                                }}
                              >
                                {item.name || "Unknown Item"}
                              </span>
                              <span
                                className="edit-menu-item-price"
                                style={{
                                  color: "#27ae60",
                                  fontWeight: "bold",
                                  fontSize: "0.95em",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                Rp {formatPrice(item.price)}
                              </span>
                            </div>

                            {item.category?.startsWith("menu mie") && (
                              <div
                                className="edit-item-options-group"
                                style={{
                                  margin: "8px 0",
                                  padding: 8,
                                  background: "#f9f9f9",
                                  borderRadius: 6,
                                  border: "1px solid #e0e0e0",
                                }}
                              >
                                <p
                                  className="edit-option-label"
                                  style={{
                                    fontWeight: 600,
                                    color: "#2c3e50",
                                    marginBottom: 6,
                                    fontSize: "0.85em",
                                  }}
                                >
                                  Kepedasan:
                                </p>
                                <div
                                  className="edit-radio-group"
                                  style={{ display: "flex", flexDirection: "column", gap: 6 }}
                                >
                                  <label
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      gap: 6,
                                      cursor: "pointer",
                                      fontSize: "0.8em",
                                      padding: "4px 8px",
                                      borderRadius: 12,
                                      background: "#fff",
                                      border: "1px solid #ddd",
                                    }}
                                  >
                                    <input
                                      type="radio"
                                      name={`edit-spiciness-${item.id_menu}`}
                                      value="tidak pedas"
                                      checked={currentOpts.spiciness === "tidak pedas"}
                                      onChange={() =>
                                        handleEditOrderOptionChange(
                                          item.id_menu,
                                          "spiciness",
                                          "tidak pedas"
                                        )
                                      }
                                    />{" "}
                                    Tidak Pedas
                                  </label>
                                  <label
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      gap: 6,
                                      cursor: "pointer",
                                      fontSize: "0.8em",
                                      padding: "4px 8px",
                                      borderRadius: 12,
                                      background: "#fff",
                                      border: "1px solid #ddd",
                                    }}
                                  >
                                    <input
                                      type="radio"
                                      name={`edit-spiciness-${item.id_menu}`}
                                      value="pedas sedang"
                                      checked={currentOpts.spiciness === "pedas sedang"}
                                      onChange={() =>
                                        handleEditOrderOptionChange(
                                          item.id_menu,
                                          "spiciness",
                                          "pedas sedang"
                                        )
                                      }
                                    />{" "}
                                    Pedas Sedang
                                  </label>
                                  <label
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      gap: 6,
                                      cursor: "pointer",
                                      fontSize: "0.8em",
                                      padding: "4px 8px",
                                      borderRadius: 12,
                                      background: "#fff",
                                      border: "1px solid #ddd",
                                    }}
                                  >
                                    <input
                                      type="radio"
                                      name={`edit-spiciness-${item.id_menu}`}
                                      value="pedas"
                                      checked={currentOpts.spiciness === "pedas"}
                                      onChange={() =>
                                        handleEditOrderOptionChange(
                                          item.id_menu,
                                          "spiciness",
                                          "pedas"
                                        )
                                      }
                                    />{" "}
                                    Pedas
                                  </label>
                                </div>
                              </div>
                            )}

                            {item.category?.startsWith("minuman") && (
                              <div
                                className="edit-item-options-group"
                                style={{
                                  margin: "8px 0",
                                  padding: 8,
                                  background: "#f9f9f9",
                                  borderRadius: 6,
                                  border: "1px solid #e0e0e0",
                                }}
                              >
                                <p
                                  className="edit-option-label"
                                  style={{
                                    fontWeight: 600,
                                    color: "#2c3e50",
                                    marginBottom: 6,
                                    fontSize: "0.85em",
                                  }}
                                >
                                  Suhu:
                                </p>
                                <div
                                  className="edit-radio-group"
                                  style={{ display: "flex", flexDirection: "column", gap: 6 }}
                                >
                                  <label
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      gap: 6,
                                      cursor: "pointer",
                                      fontSize: "0.8em",
                                      padding: "4px 8px",
                                      borderRadius: 12,
                                      background: "#fff",
                                      border: "1px solid #ddd",
                                    }}
                                  >
                                    <input
                                      type="radio"
                                      name={`edit-temperature-${item.id_menu}`}
                                      value="dingin"
                                      checked={currentOpts.temperature === "dingin"}
                                      onChange={() =>
                                        handleEditOrderOptionChange(
                                          item.id_menu,
                                          "temperature",
                                          "dingin"
                                        )
                                      }
                                    />{" "}
                                    Dingin
                                  </label>
                                  <label
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      gap: 6,
                                      cursor: "pointer",
                                      fontSize: "0.8em",
                                      padding: "4px 8px",
                                      borderRadius: 12,
                                      background: "#fff",
                                      border: "1px solid #ddd",
                                    }}
                                  >
                                    <input
                                      type="radio"
                                      name={`edit-temperature-${item.id_menu}`}
                                      value="tidak dingin"
                                      checked={currentOpts.temperature === "tidak dingin"}
                                      onChange={() =>
                                        handleEditOrderOptionChange(
                                          item.id_menu,
                                          "temperature",
                                          "tidak dingin"
                                        )
                                      }
                                    />{" "}
                                    Tidak Dingin
                                  </label>
                                </div>
                              </div>
                            )}

                            <div
                              className="edit-quantity-controls"
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                                marginTop: "auto",
                                justifyContent: "center",
                              }}
                            >
                              <button
                                className="edit-qty-btn"
                                onClick={() =>
                                  removeItemFromEditOrderCart({
                                    id_menu: item.id_menu,
                                    options: currentOpts,
                                  })
                                }
                                disabled={qty === 0}
                                style={{
                                  width: 32,
                                  height: 32,
                                  border: "1px solid #ddd",
                                  background: "#fff",
                                  borderRadius: "50%",
                                  fontSize: "1em",
                                  fontWeight: "bold",
                                  cursor: qty === 0 ? "not-allowed" : "pointer",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  opacity: qty === 0 ? 0.5 : 1,
                                }}
                              >
                                -
                              </button>
                              <span
                                className="edit-qty-display"
                                style={{
                                  fontSize: "1em",
                                  fontWeight: "bold",
                                  color: "#2c3e50",
                                  minWidth: 24,
                                  textAlign: "center",
                                  padding: 6,
                                  background: "#f8f9fa",
                                  borderRadius: 6,
                                  border: "1px solid #e0e0e0",
                                }}
                              >
                                {qty}
                              </span>
                              <button
                                className="edit-qty-btn"
                                onClick={() => addItemToEditOrderCart(item)}
                                style={{
                                  width: 32,
                                  height: 32,
                                  border: "1px solid #ddd",
                                  background: "#fff",
                                  borderRadius: "50%",
                                  fontSize: "1em",
                                  fontWeight: "bold",
                                  cursor: "pointer",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                }}
                              >
                                +
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )
              )}

              <div className="edit-note-section">
                <label htmlFor="editOrderNote" className="edit-section-title">
                  Catatan Pesanan:
                </label>
                <textarea
                  id="editOrderNote"
                  className="edit-note-input"
                  placeholder="Tambahkan catatan untuk pesanan ini..."
                  value={editOrderNote}
                  onChange={(e) => setEditOrderNote(e.target.value)}
                />
              </div>

              <div className="edit-order-summary">
                <div className="edit-section-title">Ringkasan Pesanan</div>
                <div className="edit-summary-list">
                  {editOrderCart.length === 0 ? (
                    <p>Keranjang kosong</p>
                  ) : (
                    editOrderCart.map((item, i) => {
                      const key = `${item.id_menu}-${item.options?.spiciness || ""}-${item.options?.temperature || ""}-${i}`;
                      return (
                        <div key={key} className="edit-summary-item">
                          <span>
                            {item.quantity || 0}x {item.name || "Unknown Item"}
                          </span>
                          <span>
                            Rp {formatPrice(Number(item.price || 0) * Number(item.quantity || 0))}
                          </span>
                          {(item.options?.spiciness || item.options?.temperature) && (
                            <div className="edit-summary-options">
                              {item.options?.spiciness && <span>({item.options.spiciness})</span>}
                              {item.options?.temperature && <span>({item.options.temperature})</span>}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>

                <div className="edit-summary-total">
                  <span>Total:</span>
                  <span>Rp {formatPrice(getEditOrderTotalPrice())}</span>
                </div>

                <button
                  className="edit-save-btn"
                  onClick={handleSaveEditOrder}
                  disabled={getEditOrderTotalItems() === 0}
                >
                  Simpan Perubahan
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      <PaymentModal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        orderId={selectedOrderIdForPayment}
        totalAmount={selectedOrderTotalAmount}
        onPaymentConfirmed={updateOrderPaymentStatus}
      />

      {/* Modal Tambah Pesanan */}
      {isAddOrderModalOpen && (
        <div className="add-order-modal-overlay">
          <div className="add-order-container">
            <div className="add-order-header">
              <button
                className="back-btn"
                onClick={() => {
                  setIsAddOrderModalOpen(false);
                  setNewOrderCustomerName("");
                  setNewOrderCart([]);
                  const sel = {};
                  (menuItems || []).forEach((it) => {
                    if (it?.id_menu)
                      sel[it.id_menu] = { spiciness: "", temperature: "" };
                  });
                  setNewOrderItemSelections(sel);
                }}
              >
                ←
              </button>
              <h2>Tambah Pesanan Baru</h2>
            </div>

            <div className="add-detail-section">
              <div className="add-section-title">Detail Pesanan</div>
              <div className="add-input-group">
                <label htmlFor="customerName">Nama Pelanggan (Take Away):</label>
                <input
                  type="text"
                  id="customerName"
                  value={newOrderCustomerName}
                  onChange={(e) => setNewOrderCustomerName(e.target.value)}
                  className="add-input"
                  placeholder="Masukkan nama pelanggan"
                />
                <small className="add-input-note">
                  *Nama akan ditampilkan sebagai identifikasi untuk pesanan Take Away
                </small>
              </div>
            </div>

            <div className="add-menu-section">
              <div className="add-section-title">Menu Tersedia</div>

              {Object.entries(groupMenuByCategory(menuItems)).map(
                ([category, categoryItems]) => (
                  <div key={category} className="add-menu-category-section">
                    <h3 className="add-category-title">
                      {getCategoryDisplayName(category)}
                    </h3>

                    {categoryItems.map((item) => {
                      if (!item?.id_menu) return null;
                      const currentOpts =
                        newOrderItemSelections[item.id_menu] || {
                          spiciness: "",
                          temperature: "",
                        };
                      const qty =
                        findNewOrderCartItem(item.id_menu, currentOpts)?.quantity || 0;

                      return (
                        <div
                          key={item.id_menu}
                          className={`add-menu-item ${qty > 0 ? "selected" : ""}`}
                        >
                          <div className="add-menu-item-header">
                            <span className="add-menu-item-name">
                              {item.name || "Unknown Item"}
                            </span>
                            <span className="add-menu-item-price">
                              Rp {formatPrice(item.price)}
                            </span>
                          </div>

                          {item.category?.startsWith("menu mie") && (
                            <div className="add-item-options-group">
                              <p className="add-option-label">Kepedasan:</p>
                              <div className="add-radio-group">
                                <label>
                                  <input
                                    type="radio"
                                    name={`add-spiciness-${item.id_menu}`}
                                    value="tidak pedas"
                                    checked={currentOpts.spiciness === "tidak pedas"}
                                    onChange={() =>
                                      handleNewOrderOptionChange(
                                        item.id_menu,
                                        "spiciness",
                                        "tidak pedas"
                                      )
                                    }
                                  />{" "}
                                  Tidak Pedas
                                </label>
                                <label>
                                  <input
                                    type="radio"
                                    name={`add-spiciness-${item.id_menu}`}
                                    value="pedas sedang"
                                    checked={currentOpts.spiciness === "pedas sedang"}
                                    onChange={() =>
                                      handleNewOrderOptionChange(
                                        item.id_menu,
                                        "spiciness",
                                        "pedas sedang"
                                      )
                                    }
                                  />{" "}
                                  Pedas Sedang
                                </label>
                                <label>
                                  <input
                                    type="radio"
                                    name={`add-spiciness-${item.id_menu}`}
                                    value="pedas"
                                    checked={currentOpts.spiciness === "pedas"}
                                    onChange={() =>
                                      handleNewOrderOptionChange(
                                        item.id_menu,
                                        "spiciness",
                                        "pedas"
                                      )
                                    }
                                  />{" "}
                                  Pedas
                                </label>
                              </div>
                            </div>
                          )}

                          {item.category?.startsWith("minuman") && (
                            <div className="add-item-options-group">
                              <p className="add-option-label">Suhu:</p>
                              <div className="add-radio-group">
                                <label>
                                  <input
                                    type="radio"
                                    name={`add-temperature-${item.id_menu}`}
                                    value="dingin"
                                    checked={currentOpts.temperature === "dingin"}
                                    onChange={() =>
                                      handleNewOrderOptionChange(
                                        item.id_menu,
                                        "temperature",
                                        "dingin"
                                      )
                                    }
                                  />{" "}
                                  Dingin
                                </label>
                                <label>
                                  <input
                                    type="radio"
                                    name={`add-temperature-${item.id_menu}`}
                                    value="tidak dingin"
                                    checked={currentOpts.temperature === "tidak dingin"}
                                    onChange={() =>
                                      handleNewOrderOptionChange(
                                        item.id_menu,
                                        "temperature",
                                        "tidak dingin"
                                      )
                                    }
                                  />{" "}
                                  Tidak Dingin
                                </label>
                              </div>
                            </div>
                          )}

                          <div className="add-quantity-controls">
                            <button
                              className="add-qty-btn"
                              onClick={() =>
                                removeNewItemFromOrderCart({
                                  id_menu: item.id_menu,
                                  options: currentOpts,
                                })
                              }
                              disabled={qty === 0}
                            >
                              -
                            </button>
                            <span className="add-qty-display">{qty}</span>
                            <button
                              className="add-qty-btn"
                              onClick={() => addNewItemToOrderCart(item)}
                            >
                              +
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )
              )}

              <div className="add-order-summary">
                <div className="add-section-title">Ringkasan Pesanan Baru</div>
                <div className="add-summary-list">
                  {newOrderCart.length === 0 ? (
                    <p>Keranjang kosong</p>
                  ) : (
                    newOrderCart.map((item, i) => {
                      const key = `${item.id_menu}-${item.options?.spiciness || ""}-${item.options?.temperature || ""}-${i}`;
                      return (
                        <div key={key} className="add-summary-item">
                          <span>
                            {item.quantity || 0}x {item.name || "Unknown Item"}
                          </span>
                          <span>
                            Rp {formatPrice(Number(item.price || 0) * Number(item.quantity || 0))}
                          </span>
                          {(item.options?.spiciness || item.options?.temperature) && (
                            <div className="add-summary-options">
                              {item.options?.spiciness && <span>({item.options.spiciness})</span>}
                              {item.options?.temperature && <span>({item.options.temperature})</span>}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>

                <div className="add-summary-total">
                  <span>Total:</span>
                  <span>Rp {formatPrice(getNewOrderTotalPrice())}</span>
                </div>

                <button
                  className="add-save-btn"
                  onClick={handleAddOrderForCashier}
                  disabled={getNewOrderTotalItems() === 0 || isSubmittingOrder}
                  style={{
                    opacity: isSubmittingOrder ? 0.6 : 1,
                    cursor: isSubmittingOrder ? 'not-allowed' : 'pointer'
                  }}
                >
                  {isSubmittingOrder ? 'Memproses...' : 'Buat Pesanan'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPage;
