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

// FUNGSI HELPER UNTUK GAMBAR - YANG DIPERBAIKI
const processImageUrl = (imageUrl) => {
  console.log('Processing image URL:', imageUrl);
  
  if (!imageUrl || imageUrl.trim() === '') {
    console.log('Empty image URL, using placeholder');
    return "https://placehold.co/150x150/CCCCCC/000000?text=No+Image";
  }
  
  const url = imageUrl.trim();
  
  // Handle Imgur URLs
  if (url.includes('imgur.com')) {
    console.log('Detected Imgur URL');
    
    // Convert imgur.com/ID to i.imgur.com/ID.jpg
    const imgurMatch = url.match(/imgur\.com\/([a-zA-Z0-9]+)(?:\.[a-zA-Z]+)?$/);
    if (imgurMatch && imgurMatch[1]) {
      const imageId = imgurMatch[1];
      // Try common image extensions
      const directUrl = `https://i.imgur.com/${imageId}.jpg`;
      console.log('Converted Imgur URL:', directUrl);
      return directUrl;
    }
    
    // If already i.imgur.com format, use as is
    if (url.includes('i.imgur.com')) {
      console.log('Already direct Imgur URL');
      return url;
    }
  }
  
  // Handle Google Drive URLs
  if (url.includes('drive.google.com')) {
    console.log('Detected Google Drive URL');
    
    // Format: https://drive.google.com/file/d/FILE_ID/view?usp=sharing
    const match = url.match(/\/file\/d\/([^/]+)/);
    if (match && match[1]) {
      const directUrl = `https://drive.google.com/uc?export=view&id=${match[1]}`;
      console.log('Converted Google Drive URL:', directUrl);
      return directUrl;
    }
    
    // Format: https://drive.google.com/open?id=FILE_ID
    try {
      const urlParams = new URLSearchParams(url.split('?')[1]);
      const fileId = urlParams.get('id');
      if (fileId) {
        const directUrl = `https://drive.google.com/uc?export=view&id=${fileId}`;
        console.log('Converted Google Drive URL from query:', directUrl);
        return directUrl;
      }
    } catch (e) {
      console.log('Error parsing Google Drive URL:', e);
    }
  }
  
  // Handle other common image hosting services
  if (url.includes('dropbox.com') && url.includes('dl=0')) {
    const directUrl = url.replace('dl=0', 'dl=1');
    console.log('Converted Dropbox URL:', directUrl);
    return directUrl;
  }
  
  // If URL looks like a direct image URL (has image extension), use as is
  if (/\.(jpg|jpeg|png|gif|webp|bmp|svg)(\?|$)/i.test(url)) {
    console.log('Direct image URL detected');
    return url;
  }
  
  // For other URLs, try to use as is
  console.log('Using original URL:', url);
  return url;
};

// KOMPONEN IMAGE YANG ROBUST
const MenuItemImage = ({ imageUrl, altText, className, style }) => {
  const [imgSrc, setImgSrc] = useState(processImageUrl(imageUrl));
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    const processedUrl = processImageUrl(imageUrl);
    console.log('MenuItemImage useEffect - Original:', imageUrl, 'Processed:', processedUrl);
    setImgSrc(processedUrl);
    setHasError(false);
    setIsLoading(true);
    setRetryCount(0);
  }, [imageUrl]);

  const handleError = () => {
    console.log('Image load error for URL:', imgSrc, 'Retry count:', retryCount);
    
    if (retryCount < 2 && imgSrc.includes('imgur.com')) {
      // Try different extensions for Imgur
      const extensions = ['.png', '.gif', '.jpeg'];
      const currentExt = extensions[retryCount];
      
      if (imgSrc.includes('.jpg')) {
        const newSrc = imgSrc.replace('.jpg', currentExt);
        console.log('Retrying with different extension:', newSrc);
        setImgSrc(newSrc);
        setRetryCount(prev => prev + 1);
        return;
      }
    }
    
    if (!hasError) {
      setHasError(true);
      setImgSrc("https://placehold.co/150x150/FFCCCC/CC0000?text=Error+Loading");
    }
    setIsLoading(false);
  };

  const handleLoad = () => {
    console.log('Image loaded successfully:', imgSrc);
    setIsLoading(false);
    setHasError(false);
  };

  // Tambahkan test untuk CORS dan availability
  const testImageUrl = (url) => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(true);
      img.onerror = () => resolve(false);
      img.crossOrigin = 'anonymous';
      img.src = url;
    });
  };

  return (
    <div style={{ position: 'relative', ...style }}>
      {isLoading && (
        <div 
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: '#f8f9fa',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '12px',
            color: '#666',
            borderRadius: '4px',
            border: '1px solid #e9ecef'
          }}
        >
          Loading...
        </div>
      )}
      <img
        src={imgSrc}
        alt={altText || "Menu Item"}
        className={className}
        onError={handleError}
        onLoad={handleLoad}
        style={{
          opacity: isLoading ? 0 : 1,
          transition: 'opacity 0.3s ease',
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          borderRadius: '4px'
        }}
        crossOrigin="anonymous"
      />
      
      {/* Debug info - bisa dihapus di production */}
      {process.env.NODE_ENV === 'development' && (
        <div style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: 'rgba(0,0,0,0.7)',
          color: 'white',
          fontSize: '10px',
          padding: '2px 4px',
          borderRadius: '0 0 4px 4px'
        }}>
          {hasError ? 'ERROR' : 'OK'} | Retry: {retryCount}
        </div>
      )}
    </div>
  );
};

// IMPROVED normalizeOrderItems function
const normalizeOrderItems = (itemsField) => {
  console.log('normalizeOrderItems called with:', {
    type: typeof itemsField,
    isArray: Array.isArray(itemsField),
    value: itemsField,
    length: itemsField?.length || 0
  });
  
  if (!itemsField) {
    console.warn('itemsField is null/undefined, returning empty array');
    return [];
  }
  
  if (Array.isArray(itemsField)) {
    console.log('itemsField is already an array with', itemsField.length, 'items');
    return itemsField;
  }
  
  if (typeof itemsField === "string") {
    if (itemsField.trim() === '' || itemsField === 'null' || itemsField === 'undefined') {
      console.log('itemsField is empty/null string, returning empty array');
      return [];
    }
    
    try {
      console.log('Attempting to parse JSON string:', itemsField.substring(0, 100) + '...');
      const parsed = JSON.parse(itemsField);
      
      if (Array.isArray(parsed)) {
        console.log('Successfully parsed string to array with', parsed.length, 'items');
        return parsed;
      } else if (parsed === null || parsed === undefined) {
        console.log('Parsed result is null/undefined, returning empty array');
        return [];
      } else {
        console.warn('Parsed result is not an array:', typeof parsed, parsed);
        return [];
      }
    } catch (error) {
      console.error('JSON parse error:', error.message);
      console.error('Failed string:', itemsField);
      
      try {
        const cleanedString = itemsField
          .replace(/,(\s*[}\]])/g, '$1')
          .replace(/'/g, '"')
          .trim();
          
        const retryParsed = JSON.parse(cleanedString);
        if (Array.isArray(retryParsed)) {
          console.log('Successfully parsed after cleanup');
          return retryParsed;
        }
      } catch (retryError) {
        console.error('Retry parse also failed:', retryError.message);
      }
      
      return [];
    }
  }
  
  console.warn('Unexpected itemsField type:', typeof itemsField, itemsField);
  return [];
};

// IMPROVED toUnifiedItem function
const toUnifiedItem = (item) => {
  if (!item) {
    console.warn('toUnifiedItem called with null/undefined item');
    return {
      id_menu: 0,
      name: "Unknown Item",
      price: 0,
      quantity: 0,
      options: { spiciness: "", temperature: "" }
    };
  }

  console.log('Converting item to unified format:', {
    original: item,
    keys: Object.keys(item || {}),
    hasMenuId: !!(item?.id_menu || item?.menu_item_id),
    hasName: !!(item?.menu_name || item?.name),
    hasPrice: !!(item?.price_at_order || item?.price),
    hasQuantity: !!item?.quantity
  });

  const unified = {
    id_menu: Number(
      item?.id_menu ?? 
      item?.menu_item_id ?? 
      item?.menu_id ?? 
      item?.menuId ?? 
      0
    ) || 0,
    
    name: 
      item?.menu_name ?? 
      item?.name ?? 
      item?.item_name ??
      "Unknown Item",
      
    price: Number(
      item?.price_at_order ?? 
      item?.price ?? 
      0
    ) || 0,
    
    quantity: Number(item?.quantity ?? 0) || 0,
    
    options: {
      spiciness: 
        item?.spiciness_level ?? 
        item?.spiciness ?? 
        item?.spice_level ??
        "",
      temperature: 
        item?.temperature_level ?? 
        item?.temperature ?? 
        item?.temp_level ??
        "",
    },
  };

  if (unified.id_menu === 0) {
    console.warn('Unified item has no valid menu ID:', item);
  }
  if (!unified.name || unified.name === "Unknown Item") {
    console.warn('Unified item has no valid name:', item);
  }

  console.log('Unified item result:', unified);
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

  const fetchOrders = async (force = false) => {
    console.log('fetchOrders called, token:', !!token, 'force:', force);
    
    if (!token) {
      console.log('No token available for fetchOrders');
      return;
    }
    
    if (ordersInFlightRef.current && !force) {
      console.log('Orders request already in flight, skipping...');
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
      console.log('Request timeout, aborting...');
      controller.abort('Request timeout after 30 seconds');
    }, 30000);

    try {
      console.log('Fetching orders from API...');
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

      console.log('Orders response status:', resp.status);
      
      if (!resp.ok) {
        if (resp.status === 401 || resp.status === 403) {
          console.log('Authentication failed in fetchOrders');
          handleLogout();
          return;
        }
        
        const errorText = await resp.text();
        console.error('API Error Response:', errorText);
        throw new Error(`HTTP ${resp.status}: ${errorText}`);
      }

      const responseText = await resp.text();
      console.log('Orders response length:', responseText.length);
      
      let data = [];
      try {
        const parsed = JSON.parse(responseText);
        data = Array.isArray(parsed) ? parsed : [];
        console.log('Orders parsed successfully:', data.length, 'orders');
        
        data.forEach((order, index) => {
          console.log(`Order ${index + 1}:`, {
            id: order.order_id,
            items_type: typeof order.items,
            items_length: order.items?.length || 0,
            items_content: order.items
          });
          
          try {
            const parsedItems = normalizeOrderItems(order.items);
            console.log(`Order ${order.order_id} normalized items:`, parsedItems.length, 'items');
          } catch (itemError) {
            console.error(`Error normalizing items for order ${order.order_id}:`, itemError);
          }
        });
        
      } catch (parseError) {
        console.error('Orders JSON parse error:', parseError);
        console.error('Response text that failed to parse:', responseText.substring(0, 500));
        data = [];
      }

      console.log('Setting orders state with:', data.length, 'orders');
      setOrders(data);
      setLastRefresh(new Date());
      console.log('Orders state updated successfully');
      
    } catch (error) {
      console.error('fetchOrders error:', error);
      
      if (error.name === 'AbortError') {
        console.log('Request was aborted:', error.message || 'Unknown reason');
      } else {
        console.error('Unexpected fetchOrders error:', error.message);
        
        if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
          console.error('Network connectivity issue detected');
        } else if (error.message.includes('timeout')) {
          console.error('Request timeout detected');
        }
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
    console.log('fetchMenuItems called, token:', !!token);
    
    if (!token) {
      console.log('No token available for fetchMenuItems');
      return;
    }
    
    try {
      console.log('Fetching menu items...');
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
      
      console.log('Menu response status:', resp.status);
      
      if (!resp.ok) {
        if (resp.status === 401 || resp.status === 403) {
          console.log('Authentication failed in fetchMenuItems');
          handleLogout();
          return;
        }
        throw new Error(`HTTP ${resp.status}`);
      }
      
      const data = await resp.json();
      console.log('Menu data received:', data);
      console.log('Menu data type:', typeof data, 'isArray:', Array.isArray(data));
      console.log('Menu data length:', data?.length);
      
      const arr = Array.isArray(data) ? data : [];
      console.log('Setting menuItems state with:', arr.length, 'items');
      
      setMenuItems(arr);
      console.log('setMenuItems called successfully');

      const sel = {};
      arr.forEach((it) => {
        if (it?.id_menu) sel[it.id_menu] = { spiciness: "", temperature: "" };
      });
      setNewOrderItemSelections(sel);
      console.log('Selection map initialized');
      
    } catch (e) {
      console.error('fetchMenuItems error:', e);
    }
  };

  const fetchTables = async () => {
    console.log('fetchTables called, token:', !!token);
    
    if (!token) {
      console.log('No token available for fetchTables');
      return;
    }
    
    try {
      console.log('Fetching tables...');
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
      
      console.log('Tables response status:', resp.status);
      
      if (!resp.ok) {
        if (resp.status === 401 || resp.status === 403) {
          console.log('Authentication failed in fetchTables');
          handleLogout();
          return;
        }
        throw new Error(`HTTP ${resp.status}`);
      }
      
      const data = await resp.json();
      console.log('Tables data received:', data);
      console.log('Tables data length:', data?.length);
      
      const arr = Array.isArray(data) ? data : [];
      console.log('Setting tables state with:', arr.length, 'tables');
      
      setTables(arr);
      console.log('setTables called successfully');
      
    } catch (e) {
      console.error('fetchTables error:', e);
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
   * Menu CRUD - DIPERBAIKI DENGAN IMAGE HANDLING
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

  const validateImageUrl = async (url) => {
    if (!url) return false;
    
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(true);
      img.onerror = () => resolve(false);
      img.src = processImageUrl(url);
      
      // Timeout after 5 seconds
      setTimeout(() => resolve(false), 5000);
    });
  };

  const handleAddOrUpdateMenu = async () => {
    console.log('=== SUBMIT MENU DEBUG ===');
    console.log('newMenu state:', newMenu);
    console.log('imageUrlPreview:', newMenu.imageUrlPreview);
    console.log('processedImageUrl:', processImageUrl(newMenu.imageUrlPreview));

    if (!newMenu.name.trim() || !newMenu.price || !newMenu.category) {
      alert("Nama, harga, dan kategori menu tidak boleh kosong!");
      return;
    }

    const processedImageUrl = processImageUrl(newMenu.imageUrlPreview);
    
    // Validate image URL if provided
    if (newMenu.imageUrlPreview && !processedImageUrl.includes('placehold.co')) {
      console.log('Validating image URL...');
      const isValid = await validateImageUrl(newMenu.imageUrlPreview);
      if (!isValid) {
        const confirmProceed = window.confirm(
          'URL gambar mungkin tidak valid atau tidak dapat diakses. Lanjutkan tanpa gambar?'
        );
        if (!confirmProceed) return;
      }
    }

    const payload = {
      name: newMenu.name.trim(),
      description: (newMenu.description || "").trim(),
      price: Number(newMenu.price),
      category: newMenu.category,
      is_available:
        newMenu.is_available === 0 || newMenu.is_available === "0" ? 0 : 1,
      image_link: processedImageUrl && !processedImageUrl.includes('placehold.co') ? processedImageUrl : null,
    };

    console.log('Payload being sent:', payload);

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
      
      await fetchOrders(true);
      
      const updatedOrder = orders.find(o => o.order_id === orderId);
      if (updatedOrder && updatedOrder.order_status === newStatus) {
        alert(`Status pesanan ${orderId} berhasil diubah!`);
      } else {
        alert(`Status pesanan ${orderId} diupdate. Silakan refresh jika belum terlihat.`);
      }
      
    } catch (e) {
      console.error('Update status error:', e);
      
      await fetchOrders(true);
      
      const updatedOrder = orders.find(o => o.order_id === orderId);
      if (updatedOrder && updatedOrder.order_status === newStatus) {
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

      setIsPaymentModalOpen(false);
      setSelectedOrderIdForPayment(0);
      setSelectedOrderTotalAmount(0);

      alert(`Status pembayaran pesanan ${orderId} berhasil diupdate!`);
      
      await fetchOrders(true);
      
      return Promise.resolve();
      
    } catch (e) {
      console.error('Payment update error:', e);
      
      setIsPaymentModalOpen(false);
      setSelectedOrderIdForPayment(0);
      setSelectedOrderTotalAmount(0);
      
      await fetchOrders(true);
      
      alert(`Error: ${e.message}. Silakan cek status pembayaran di daftar pesanan.`);
      return Promise.reject(e);
    }
  };

  const findEditOrderCartItem = (itemId, options) =>
    (editOrderCart || []).find(
      (c) =>
        c?.id_menu === itemId &&
        (c.options?.spiciness || "") === (options?.spiciness || "") &&
        (c.options?.temperature || "") === (options?.temperature || "")
    );

  const addItemToEditOrderCart = (item) => {
    if (!item?.id_menu) return;
    const opts = editOrderItemSelections[item.id_menu] || {
      spiciness: "",
      temperature: "",
    };
    setEditOrderCart((prev) => {
      const exist = findEditOrderCartItem(item.id_menu, opts);
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

  const closeEditOrder = () => {
    setIsEditOrderModalOpen(false);
    setSelectedOrderForDetail(null);
    setEditOrderCart([]);
    setEditOrderItemSelections({});
    setEditOrderNote("");
  };

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

    setIsSubmittingOrder(true);

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

      setIsAddOrderModalOpen(false);
      
      setNewOrderCustomerName("");
      setNewOrderCart([]);
      const sel = {};
      (menuItems || []).forEach((mi) => {
        if (mi?.id_menu) sel[mi.id_menu] = { spiciness: "", temperature: "" };
      });
      setNewOrderItemSelections(sel);

      alert(`Pesanan baru berhasil dibuat! ID: ${j.orderId || "unknown"}`);
      
      setTimeout(() => {
        fetchOrders(true);
      }, 1000);

    } catch (e) {
      console.error('Order submission error:', e);
      alert(`Gagal membuat pesanan: ${e.message}`);
    } finally {
      setIsSubmittingOrder(false);
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
        
        await warmupBackend();
        console.log('Backend warmed up');
        
        await fetchOrders(true);
        console.log('Orders fetched');
        
        await fetchMenuItems();
        console.log('Menu items fetched');
        
        await fetchTables();
        console.log('Tables fetched');
        
        console.log('All data fetched successfully');
        
        intervalId = setInterval(() => {
          console.log('Interval fetch orders...');
          fetchOrders(true);
        }, 10000);
        
      } catch (error) {
        console.error('Error in data initialization:', error);
      }
    };
    
    initializeData();
    
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
  }, [token]);

  useEffect(() => {
    console.log('MenuItems state updated:', menuItems.length, 'items');
  }, [menuItems]);

  useEffect(() => {
    console.log('Tables state updated:', tables.length, 'tables');
  }, [tables]);

  useEffect(() => {
    console.log('Orders state updated:', orders.length, 'orders');
  }, [orders]);

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
                                <button
                                  onClick={() => showEditOrder(order)}
                                  className="order-action-button btn-warning"
                                >
                                  Edit
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

        {/* Manajemen Menu - BAGIAN YANG DIPERBAIKI */}
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
                        {/* GAMBAR YANG DIPERBAIKI */}
                        <MenuItemImage
                          imageUrl={item.image_url}
                          altText={item.name}
                          className="menu-item-management-image"
                          style={{ width: '100%', height: '150px', borderRadius: '8px' }}
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

                {/* INPUT URL GAMBAR YANG DIPERBAIKI */}
                <div className="menu-form-input-group" style={{ marginBottom: '15px' }}>
                  <label htmlFor="imageUrl" style={{ display: 'block', marginBottom: '5px', fontWeight: '600' }}>
                    URL Gambar:
                  </label>
                  <input
                    type="url"
                    id="imageUrl"
                    placeholder="Paste Imgur, Google Drive, atau direct image URL di sini"
                    value={newMenu.imageUrlPreview || ''}
                    onChange={(e) => {
                      const url = e.target.value.trim();
                      console.log('Image URL input changed:', url);
                      setNewMenu((p) => ({ 
                        ...p, 
                        imageUrlPreview: url,
                        imageFile: null
                      }));
                    }}
                    className="menu-form-input"
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      border: '1px solid #ddd',
                      borderRadius: '4px',
                      fontSize: '14px'
                    }}
                  />
                  <small style={{ 
                    display: 'block', 
                    marginTop: '5px', 
                    fontSize: '12px', 
                    color: '#666',
                    fontStyle: 'italic' 
                  }}>
                    Contoh: https://imgur.com/PCjv5M atau https://i.imgur.com/PCjv5M.jpg
                    <br />
                    Juga mendukung Google Drive dan URL gambar langsung lainnya.
                  </small>
                  
                  {/* Test button untuk debug */}
                  {newMenu.imageUrlPreview && (
                    <div style={{ marginTop: '8px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <button
                        type="button"
                        onClick={() => {
                          const processedUrl = processImageUrl(newMenu.imageUrlPreview);
                          console.log('Original URL:', newMenu.imageUrlPreview);
                          console.log('Processed URL:', processedUrl);
                          window.open(processedUrl, '_blank');
                        }}
                        style={{
                          padding: '4px 8px',
                          fontSize: '12px',
                          backgroundColor: '#f8f9fa',
                          border: '1px solid #ddd',
                          borderRadius: '4px',
                          cursor: 'pointer'
                        }}
                      >
                        Test URL
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          const isValid = await validateImageUrl(newMenu.imageUrlPreview);
                          alert(isValid ? 'URL gambar valid!' : 'URL gambar tidak dapat diakses');
                        }}
                        style={{
                          padding: '4px 8px',
                          fontSize: '12px',
                          backgroundColor: '#e9ecef',
                          border: '1px solid #ddd',
                          borderRadius: '4px',
                          cursor: 'pointer'
                        }}
                      >
                        Validate URL
                      </button>
                    </div>
                  )}
                </div>

                {/* PREVIEW GAMBAR YANG DIPERBAIKI */}
                {newMenu.imageUrlPreview && (
                  <div className="menu-image-preview-container" style={{ marginBottom: '15px' }}>
                    <div style={{ marginBottom: '8px', fontSize: '14px', fontWeight: '600' }}>
                      Preview Gambar:
                    </div>
                    <MenuItemImage
                      imageUrl={newMenu.imageUrlPreview}
                      altText="Preview"
                      className="menu-image-preview"
                      style={{ 
                        maxWidth: '250px', 
                        maxHeight: '200px', 
                        border: '2px solid #ddd', 
                        borderRadius: '8px',
                        backgroundColor: '#f8f9fa' 
                      }}
                    />
                    <div style={{ marginTop: '8px', fontSize: '11px', color: '#666', fontFamily: 'monospace' }}>
                      <strong>Original:</strong> {newMenu.imageUrlPreview.substring(0, 60)}{newMenu.imageUrlPreview.length > 60 ? '...' : ''}
                      <br />
                      <strong>Processed:</strong> {processImageUrl(newMenu.imageUrlPreview).substring(0, 60)}{processImageUrl(newMenu.imageUrlPreview).length > 60 ? '...' : ''}
                    </div>
                  </div>
                )}

                <div className="menu-form-availability">
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '15px' }}>
                    <input
                      type="checkbox"
                      checked={newMenu.is_available === 1}
                      onChange={(e) =>
                        setNewMenu((p) => ({ ...p, is_available: e.target.checked ? 1 : 0 }))
                      }
                    />
                    Menu Tersedia
                  </label>
                </div>

                <div className="menu-form-actions">
                  <button 
                    onClick={handleAddOrUpdateMenu} 
                    className="menu-add-button"
                    style={{ marginRight: '10px' }}
                  >
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
              <h3>Tambah Meja Baru:</h3>
              <input
                type="text"
                placeholder="Nomor Meja"
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

            <h3>Daftar Meja & QR Code:</h3>
            {tables.length === 0 ? (
              <p className="no-data-message">Belum ada meja.</p>
            ) : (
              <div className="tables-grid">
                {tables.map((table) => (
                  <div key={table.table_id} className="table-card">
                    <h4>Meja {table.table_number}</h4>
                    {table.capacity && <p>Kapasitas: {table.capacity} orang</p>}
                    
                    <div className="qr-section">
                      <QRCodeSVG
                        id={`qr-table-${String(table.table_number).replace(/\s/g, "-")}`}
                        value={generateQrUrl(table.table_number)}
                        size={120}
                        level="M"
                        includeMargin={true}
                      />
                      <button
                        onClick={() => handleDownloadQR(table.table_number)}
                        className="download-qr-button"
                      >
                        Download QR
                      </button>
                    </div>
                    
                    <div className="table-url">
                      <small>{generateQrUrl(table.table_number)}</small>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Laporan */}
        {activeTab === "laporan" && (
          <div className="admin-section-box">
            <h2 className="admin-section-title">Laporan Penjualan</h2>

            <div className="report-controls">
              <div className="date-range-inputs">
                <label>
                  Tanggal Mulai:
                  <input
                    type="date"
                    value={reportDateRange.startDate}
                    onChange={(e) =>
                      setReportDateRange((p) => ({ ...p, startDate: e.target.value }))
                    }
                    className="date-input"
                  />
                </label>
                <label>
                  Tanggal Akhir:
                  <input
                    type="date"
                    value={reportDateRange.endDate}
                    onChange={(e) =>
                      setReportDateRange((p) => ({ ...p, endDate: e.target.value }))
                    }
                    className="date-input"
                  />
                </label>
              </div>
              <button
                onClick={exportReportToCSV}
                className="export-button"
                disabled={isLoadingReport}
              >
                Export CSV
              </button>
            </div>

            {isLoadingReport ? (
              <p>Memuat laporan...</p>
            ) : (
              <div className="report-content">
                <div className="report-summary">
                  <h3>Ringkasan Periode {reportDateRange.startDate} - {reportDateRange.endDate}</h3>
                  <div className="summary-cards">
                    <div className="summary-card">
                      <h4>Total Penjualan</h4>
                      <p className="summary-value">Rp {formatPrice(reportData.totalSales || 0)}</p>
                    </div>
                    <div className="summary-card">
                      <h4>Total Pesanan</h4>
                      <p className="summary-value">{reportData.totalOrders || 0}</p>
                    </div>
                    <div className="summary-card">
                      <h4>Pesanan Selesai</h4>
                      <p className="summary-value">{reportData.completedOrders || 0}</p>
                    </div>
                    <div className="summary-card">
                      <h4>Pesanan Dibatalkan</h4>
                      <p className="summary-value">{reportData.cancelledOrders || 0}</p>
                    </div>
                  </div>
                </div>

                <div className="report-details">
                  <h4>Menu Terlaris</h4>
                  {(reportData.topSellingItems || []).length === 0 ? (
                    <p>Tidak ada data menu.</p>
                  ) : (
                    <div className="top-selling-table">
                      <table>
                        <thead>
                          <tr>
                            <th>Nama Menu</th>
                            <th>Jumlah Terjual</th>
                            <th>Total Pendapatan</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(reportData.topSellingItems || []).map((item, idx) => (
                            <tr key={idx}>
                              <td>{item.menu_name || "Unknown"}</td>
                              <td>{item.total_quantity || 0}</td>
                              <td>Rp {formatPrice(item.total_revenue || 0)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Add Order Modal */}
      {isAddOrderModalOpen && (
        <div className="modal-overlay" onClick={() => setIsAddOrderModalOpen(false)}>
          <div className="modal-content large-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Tambah Pesanan Baru</h3>
              <button
                className="modal-close-button"
                onClick={() => setIsAddOrderModalOpen(false)}
              >
                ×
              </button>
            </div>

            <div className="modal-body">
              <div className="customer-name-input">
                <label>Nama Pelanggan (opsional):</label>
                <input
                  type="text"
                  placeholder="Masukkan nama pelanggan"
                  value={newOrderCustomerName}
                  onChange={(e) => setNewOrderCustomerName(e.target.value)}
                  className="customer-name-field"
                />
              </div>

              <div className="order-modal-content">
                <div className="menu-selection-section">
                  <h4>Pilih Menu</h4>
                  <div className="menu-items-grid">
                    {Object.entries(groupMenuByCategory(menuItems)).map(([category, items]) => (
                      <div key={category} className="menu-category-section">
                        <h5 className="menu-category-title">
                          {getCategoryDisplayName(category)}
                        </h5>
                        <div className="menu-items-list">
                          {items.map((item) => (
                            <div key={item.id_menu} className="menu-item-card">
                              <MenuItemImage
                                imageUrl={item.image_url}
                                altText={item.name}
                                className="menu-item-image"
                                style={{ width: '60px', height: '60px', borderRadius: '8px' }}
                              />
                              <div className="menu-item-info">
                                <h6>{item.name}</h6>
                                <p className="menu-item-price">Rp {formatPrice(item.price)}</p>
                              </div>
                              
                              <div className="menu-item-options">
                                <select
                                  value={newOrderItemSelections[item.id_menu]?.spiciness || ""}
                                  onChange={(e) =>
                                    handleNewOrderOptionChange(item.id_menu, "spiciness", e.target.value)
                                  }
                                  className="option-select"
                                >
                                  <option value="">Tingkat Pedas</option>
                                  <option value="Tidak Pedas">Tidak Pedas</option>
                                  <option value="Pedas Level 1">Pedas Level 1</option>
                                  <option value="Pedas Level 2">Pedas Level 2</option>
                                  <option value="Pedas Level 3">Pedas Level 3</option>
                                </select>
                                
                                <select
                                  value={newOrderItemSelections[item.id_menu]?.temperature || ""}
                                  onChange={(e) =>
                                    handleNewOrderOptionChange(item.id_menu, "temperature", e.target.value)
                                  }
                                  className="option-select"
                                >
                                  <option value="">Suhu</option>
                                  <option value="Dingin">Dingin</option>
                                  <option value="Normal">Normal</option>
                                  <option value="Hangat">Hangat</option>
                                  <option value="Panas">Panas</option>
                                </select>
                              </div>
                              
                              <button
                                onClick={() => addNewItemToOrderCart(item)}
                                className="add-to-cart-button"
                              >
                                Tambah ke Keranjang
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="cart-section">
                  <h4>Keranjang Pesanan</h4>
                  {newOrderCart.length === 0 ? (
                    <p className="empty-cart-message">Keranjang kosong</p>
                  ) : (
                    <>
                      <div className="cart-items">
                        {newOrderCart.map((cartItem, idx) => (
                          <div key={idx} className="cart-item">
                            <div className="cart-item-info">
                              <span className="cart-item-name">{cartItem.name}</span>
                              <div className="cart-item-options">
                                {cartItem.options?.spiciness && (
                                  <span className="cart-option">Pedas: {cartItem.options.spiciness}</span>
                                )}
                                {cartItem.options?.temperature && (
                                  <span className="cart-option">Suhu: {cartItem.options.temperature}</span>
                                )}
                              </div>
                            </div>
                            <div className="cart-item-controls">
                              <button
                                onClick={() => removeNewItemFromOrderCart(cartItem)}
                                className="quantity-button"
                              >
                                -
                              </button>
                              <span className="cart-item-quantity">{cartItem.quantity}</span>
                              <button
                                onClick={() => addNewItemToOrderCart({ 
                                  id_menu: cartItem.id_menu, 
                                  name: cartItem.name, 
                                  price: cartItem.price 
                                })}
                                className="quantity-button"
                              >
                                +
                              </button>
                            </div>
                            <div className="cart-item-price">
                              Rp {formatPrice(cartItem.quantity * cartItem.price)}
                            </div>
                          </div>
                        ))}
                      </div>
                      
                      <div className="cart-summary">
                        <div className="cart-total-items">
                          Total Item: {getNewOrderTotalItems()}
                        </div>
                        <div className="cart-total-price">
                          Total Harga: Rp {formatPrice(getNewOrderTotalPrice())}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button
                onClick={() => setIsAddOrderModalOpen(false)}
                className="modal-button secondary"
              >
                Batal
              </button>
              <button
                onClick={handleAddOrderForCashier}
                disabled={newOrderCart.length === 0 || isSubmittingOrder}
                className="modal-button primary"
              >
                {isSubmittingOrder ? "Membuat Pesanan..." : "Buat Pesanan"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Order Modal */}
      {isEditOrderModalOpen && (
        <div className="modal-overlay" onClick={closeEditOrder}>
          <div className="modal-content large-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Edit Pesanan #{selectedOrderForDetail?.order_id}</h3>
              <button className="modal-close-button" onClick={closeEditOrder}>
                ×
              </button>
            </div>

            <div className="modal-body">
              <div className="order-modal-content">
                <div className="menu-selection-section">
                  <h4>Pilih Menu</h4>
                  <div className="menu-items-grid">
                    {Object.entries(groupMenuByCategory(menuItems)).map(([category, items]) => (
                      <div key={category} className="menu-category-section">
                        <h5 className="menu-category-title">
                          {getCategoryDisplayName(category)}
                        </h5>
                        <div className="menu-items-list">
                          {items.map((item) => (
                            <div key={item.id_menu} className="menu-item-card">
                              <MenuItemImage
                                imageUrl={item.image_url}
                                altText={item.name}
                                className="menu-item-image"
                                style={{ width: '60px', height: '60px', borderRadius: '8px' }}
                              />
                              <div className="menu-item-info">
                                <h6>{item.name}</h6>
                                <p className="menu-item-price">Rp {formatPrice(item.price)}</p>
                              </div>
                              
                              <div className="menu-item-options">
                                <select
                                  value={editOrderItemSelections[item.id_menu]?.spiciness || ""}
                                  onChange={(e) =>
                                    handleEditOrderOptionChange(item.id_menu, "spiciness", e.target.value)
                                  }
                                  className="option-select"
                                >
                                  <option value="">Tingkat Pedas</option>
                                  <option value="Tidak Pedas">Tidak Pedas</option>
                                  <option value="Pedas Level 1">Pedas Level 1</option>
                                  <option value="Pedas Level 2">Pedas Level 2</option>
                                  <option value="Pedas Level 3">Pedas Level 3</option>
                                </select>
                                
                                <select
                                  value={editOrderItemSelections[item.id_menu]?.temperature || ""}
                                  onChange={(e) =>
                                    handleEditOrderOptionChange(item.id_menu, "temperature", e.target.value)
                                  }
                                  className="option-select"
                                >
                                  <option value="">Suhu</option>
                                  <option value="Dingin">Dingin</option>
                                  <option value="Normal">Normal</option>
                                  <option value="Hangat">Hangat</option>
                                  <option value="Panas">Panas</option>
                                </select>
                              </div>
                              
                              <button
                                onClick={() => addItemToEditOrderCart(item)}
                                className="add-to-cart-button"
                              >
                                Tambah ke Keranjang
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="cart-section">
                  <h4>Keranjang Edit</h4>
                  {editOrderCart.length === 0 ? (
                    <p className="empty-cart-message">Keranjang kosong</p>
                  ) : (
                    <>
                      <div className="cart-items">
                        {editOrderCart.map((cartItem, idx) => (
                          <div key={idx} className="cart-item">
                            <div className="cart-item-info">
                              <span className="cart-item-name">{cartItem.name}</span>
                              <div className="cart-item-options">
                                {cartItem.options?.spiciness && (
                                  <span className="cart-option">Pedas: {cartItem.options.spiciness}</span>
                                )}
                                {cartItem.options?.temperature && (
                                  <span className="cart-option">Suhu: {cartItem.options.temperature}</span>
                                )}
                              </div>
                            </div>
                            <div className="cart-item-controls">
                              <button
                                onClick={() => removeItemFromEditOrderCart(cartItem)}
                                className="quantity-button"
                              >
                                -
                              </button>
                              <span className="cart-item-quantity">{cartItem.quantity}</span>
                              <button
                                onClick={() => addItemToEditOrderCart({ 
                                  id_menu: cartItem.id_menu, 
                                  name: cartItem.name, 
                                  price: cartItem.price 
                                })}
                                className="quantity-button"
                              >
                                +
                              </button>
                            </div>
                            <div className="cart-item-price">
                              Rp {formatPrice(cartItem.quantity * cartItem.price)}
                            </div>
                          </div>
                        ))}
                      </div>
                      
                      <div className="cart-summary">
                        <div className="cart-total-items">
                          Total Item: {getEditOrderTotalItems()}
                        </div>
                        <div className="cart-total-price">
                          Total Harga: Rp {formatPrice(getEditOrderTotalPrice())}
                        </div>
                      </div>
                    </>
                  )}
                  
                  <div className="order-note-section">
                    <label>Catatan Pesanan:</label>
                    <textarea
                      value={editOrderNote}
                      onChange={(e) => setEditOrderNote(e.target.value)}
                      placeholder="Tambahkan catatan pesanan..."
                      className="order-note-textarea"
                      rows={3}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button onClick={closeEditOrder} className="modal-button secondary">
                Batal
              </button>
              <button
                onClick={handleSaveEditOrder}
                disabled={editOrderCart.length === 0}
                className="modal-button primary"
              >
                Simpan Perubahan
              </button>
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
    </div>
  );
};

export default AdminPage;