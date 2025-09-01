import React, { useState, useEffect, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import '../styles/AdminPage.css'; 
import PaymentModal from '../components/PaymentModal';

const AdminPage = () => {
    // ===================================
    // UTILITY FUNCTIONS - MUST BE DEFINED FIRST
    // ===================================
    const getTodayDateString = () => {
        try {
            const today = new Date();
            const year = today.getFullYear();
            const month = String(today.getMonth() + 1).padStart(2, '0');
            const day = String(today.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        } catch (error) {
            console.error('Error getting today date:', error);
            return '2024-01-01';
        }
    };

    const formatPrice = (price) => {
        try {
            if (price == null || isNaN(price)) return '0';
            const numPrice = Number(price);
            return new Intl.NumberFormat('id-ID', {
                minimumFractionDigits: 0,
                maximumFractionDigits: 0
            }).format(numPrice);
        } catch (error) {
            console.error('Error formatting price:', error);
            return String(price || '0');
        }
    };

    const formatOrderTime = (timestamp) => {
        try {
            if (!timestamp) return 'Invalid Date';
            const date = new Date(timestamp);
            if (isNaN(date.getTime())) return 'Invalid Date';
            const options = { 
                year: 'numeric', 
                month: '2-digit', 
                day: '2-digit', 
                hour: '2-digit', 
                minute: '2-digit', 
                hour12: false 
            };
            return date.toLocaleString('en-GB', options).replace(',', '');
        } catch (error) {
            console.error('Error formatting order time:', error);
            return 'Invalid Date';
        }
    };

    const safeJsonParse = (jsonString, fallback = []) => {
        try {
            if (!jsonString || typeof jsonString !== 'string') return fallback;
            const parsed = JSON.parse(jsonString);
            return parsed != null ? parsed : fallback;
        } catch (error) {
            console.error('JSON parse error:', error, 'String:', jsonString);
            return fallback;
        }
    };

    const safeLocalStorage = (key, fallback = null) => {
        try {
            if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
                return fallback;
            }
            const item = localStorage.getItem(key);
            if (!item) return fallback;
            return JSON.parse(item);
        } catch (error) {
            console.error('LocalStorage error:', error);
            return fallback;
        }
    };

    // ===================================
    // STATE DEFINITIONS - SAFE INITIALIZATION
    // ===================================
    
    const ordersAbortRef = useRef(null);
    const ordersInFlightRef = useRef(false);


    // Auth states
    const [token, setToken] = useState(() => {
        try {
            if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
                return localStorage.getItem('adminToken') || '';
            }
            return '';
        } catch (e) {
            console.error('Error reading token:', e);
            return '';
        }
    });

    const [userRole, setUserRole] = useState(() => {
        try {
            if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
                return localStorage.getItem('userRole') || '';
            }
            return '';
        } catch (e) {
            console.error('Error reading userRole:', e);
            return '';
        }
    });

    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [loginError, setLoginError] = useState('');
    const [isLoggingIn, setIsLoggingIn] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    // UI states
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    // Data states
    const [orders, setOrders] = useState([]);
    const [menuItems, setMenuItems] = useState([]);
    const [tables, setTables] = useState([]);

    // Refresh state for better data sync
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [lastRefresh, setLastRefresh] = useState(new Date());

    // Form states
    const [newMenu, setNewMenu] = useState({ 
        name: '', 
        description: '', 
        price: '', 
        category: 'makanan-nasi', 
        imageFile: null, 
        imageUrlPreview: '' 
    });
    const [editingMenu, setEditingMenu] = useState(null);
    const [newTable, setNewTable] = useState({ table_number: '', capacity: '' });

    // QR states
    const [generatedQRs, setGeneratedQRs] = useState(() => {
        try {
            return safeLocalStorage('generatedQRs', []);
        } catch (error) {
            console.error('Error initializing QRs:', error);
            return [];
        }
    });

    // Payment modal states
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [selectedOrderIdForPayment, setSelectedOrderIdForPayment] = useState(0);
    const [selectedOrderTotalAmount, setSelectedOrderTotalAmount] = useState(0);

    // Tab states
    const [activeTab, setActiveTab] = useState('pesanan');
    const [activeMenuSubTab, setActiveMenuSubTab] = useState('menu-list');

    // Order modal states
    const [isAddOrderModalOpen, setIsAddOrderModalOpen] = useState(false);
    const [newOrderCustomerName, setNewOrderCustomerName] = useState('');
    const [newOrderCart, setNewOrderCart] = useState([]);
    const [newOrderItemSelections, setNewOrderItemSelections] = useState({});

    // Edit order states
    const [selectedOrderForDetail, setSelectedOrderForDetail] = useState(null);
    const [isEditOrderModalOpen, setIsEditOrderModalOpen] = useState(false);
    const [editOrderCart, setEditOrderCart] = useState([]);
    const [editOrderItemSelections, setEditOrderItemSelections] = useState({});
    const [editOrderNote, setEditOrderNote] = useState('');

    // Report states
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
        salesByDate: []
    });

    const [reportDateRange, setReportDateRange] = useState({
        startDate: getTodayDateString(),
        endDate: getTodayDateString()
    });
    const [isLoadingReport, setIsLoadingReport] = useState(false);

    // Try different backend ports - backend is running on 5000
    const [apiBaseUrl, setApiBaseUrl] = useState('https://let-s-pay-server.vercel.app/api');
    
    const API_PORTS = [
        { url: 'https://let-s-pay-server.vercel.app/api' },
    ];

    // ===================================
    // UI RESPONSIVE FUNCTIONS
    // ===================================
    const toggleSidebar = () => {
        setSidebarCollapsed(!sidebarCollapsed);
    };

    const toggleMobileMenu = () => {
        setMobileMenuOpen(!mobileMenuOpen);
    };

    const handleTabChange = (tab) => {
        setActiveTab(tab);
        setActiveMenuSubTab('menu-list');
        setMobileMenuOpen(false);
    };

    // ===================================
    // CATEGORY GROUPING FUNCTION - FIXED
    // ===================================
    const groupMenuByCategory = (menuItems) => {
        const grouped = {};
        menuItems.forEach(item => {
            if (item && (item.is_available === 1 || item.is_available === true || item.is_available === '1')) {
                const category = item.category || 'lain-lain';
                if (!grouped[category]) {
                    grouped[category] = [];
                }
                grouped[category].push(item);
            }
        });
        return grouped;
    };

    const getCategoryDisplayName = (category) => {
        const categoryNames = {
            'makanan-nasi': 'MAKANAN - NASI',
            'makanan-pelengkap': 'MAKANAN - PELENGKAP',
            'minuman-kopi': 'MINUMAN - KOPI',
            'minuman-nonkopi': 'MINUMAN - NON KOPI',
            'menu mie-banggodrong': 'MENU MIE - BANGGONDRONG',
            'menu mie-aceh': 'MENU MIE - ACEH',
            'menu mie-toping': 'MENU MIE - TOPING',
            'camilan-manis': 'CAMILAN - MANIS',
            'camilan-gurih': 'CAMILAN - GURIH',
            'lain-lain': 'LAIN-LAIN'
        };
        return categoryNames[category] || category.toUpperCase();
    };

    // ===================================
    // REFRESH FUNCTIONS - IMPROVED FOR PAYMENT SYNC
    // ===================================
    const handleManualRefresh = async () => {
        console.log('🔄 Manual refresh triggered');
        setIsRefreshing(true);
        try {
            await fetchOrders(true);
            setLastRefresh(new Date());
            alert('Data berhasil di-refresh!');
        } catch (error) {
            console.error('Error during manual refresh:', error);
            alert('Gagal refresh data');
        } finally {
            setIsRefreshing(false);
        }
    };

    // ===================================
    // AUTH FUNCTIONS - FIXED
    // ===================================
    const handleLogin = async () => {
        console.log('🔐 Login attempt started...');
        setLoginError('');
        setIsLoggingIn(true);
        
        if (!username.trim() || !password.trim()) {
            setLoginError('Username dan password harus diisi');
            setIsLoggingIn(false);
            return;
        }

        // Create timeout promise
        const timeout = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Request timeout - Server tidak merespon dalam 15 detik')), 15000)
        );

        try {
            console.log('📡 Sending login request to:', `${apiBaseUrl}/login`);
            console.log('📝 Request data:', { username: username.trim(), password: '***' });
            
            // Race between fetch and timeout
            const fetchPromise = fetch(`${apiBaseUrl}/login`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({ 
                    username: username.trim(), 
                    password: password.trim() 
                })
            });

            const response = await Promise.race([fetchPromise, timeout]);
            
            console.log('📡 Login response received - status:', response.status);
            console.log('📡 Response headers:', [...response.headers.entries()]);

            if (!response.ok) {
                let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
                try {
                    const errorData = await response.text(); // Use text() first, then try parse
                    console.log('📡 Error response body:', errorData);
                    try {
                        const parsedError = JSON.parse(errorData);
                        errorMessage = parsedError.message || errorMessage;
                    } catch {
                        errorMessage = errorData || errorMessage;
                    }
                } catch (parseError) {
                    console.error('Failed to read error response:', parseError);
                }
                throw new Error(errorMessage);
            }

            const responseText = await response.text();
            console.log('📡 Raw response body:', responseText);
            
            let data;
            try {
                data = JSON.parse(responseText);
            } catch (parseError) {
                console.error('Failed to parse JSON response:', parseError);
                throw new Error('Server mengirim response yang tidak valid (bukan JSON)');
            }
            
            console.log('✅ Login response data:', data);
            
            if (!data || !data.token || !data.user) {
                console.error('Invalid response structure:', data);
                throw new Error('Response tidak lengkap - missing token atau user data');
            }

            console.log('💾 Saving token and role to localStorage...');
            
            // Save to localStorage first
            localStorage.setItem('adminToken', data.token);
            localStorage.setItem('userRole', data.user.role || '');
            
            // Then update state
            setToken(data.token);
            setUserRole(data.user.role || '');
            
            console.log('✅ Login successful!');
            console.log('🔑 Token length:', data.token.length);
            console.log('👤 User role:', data.user.role);
            
            // Clear form
            setUsername('');
            setPassword('');
            setLoginError('');
            
            alert('Login berhasil sebagai ' + (data.user.role || 'user') + '!');
            
        } catch (error) {
            console.error('❌ Login error details:', error);
            console.error('❌ Error name:', error.name);
            console.error('❌ Error message:', error.message);
            console.error('❌ Error stack:', error.stack);
            
            if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
                setLoginError('❌ Tidak dapat terhubung ke server. Pastikan:\n• Server backend berjalan di https://let-s-pay-server.vercel.app\n• Tidak ada firewall yang memblokir\n• Port 5000 tidak digunakan aplikasi lain');
            } else if (error.message.includes('timeout')) {
                setLoginError('⏰ Login timeout - Server tidak merespon. Cek:\n• Apakah server backend aktif?\n• Koneksi internet stabil?');
            } else if (error.message.includes('CORS')) {
                setLoginError('🚫 CORS Error - Server perlu mengizinkan akses dari frontend');
            } else {
                setLoginError(`❌ Login gagal: ${error.message}`);
            }
        } finally {
            setIsLoggingIn(false);
        }
    };

    const handleLogout = () => {
        try {
            console.log('🚪 Logging out...');
            
            // Clear localStorage
            localStorage.removeItem('adminToken');
            localStorage.removeItem('userRole');
            
            // Clear state
            setToken('');
            setUserRole('');
            setUsername('');
            setPassword('');
            setLoginError('');
            
            // Reset data
            setOrders([]);
            setMenuItems([]);
            setTables([]);
            
            console.log('✅ Logout completed');
            alert('Anda telah logout.');
        } catch (error) {
            console.error('Error during logout:', error);
        }
    };

    // ===================================
    // DATA FETCHING FUNCTIONS - IMPROVED FOR PAYMENT SYNC
    // ===================================
    const fetchOrders = async (forceRefresh = false) => {
        if (!token) {
            console.log('No token for fetchOrders');
            return;
        }

        // Batalkan request sebelumnya jika masih jalan
        try { ordersAbortRef.current?.abort(); } catch {}
        ordersAbortRef.current = new AbortController();

        if (ordersInFlightRef.current) {
            console.log('Skip fetchOrders: in-flight');
            return;
        }
        ordersInFlightRef.current = true;

        try {
            const timestamp = forceRefresh ? `?t=${Date.now()}` : '';
            console.log('📦 Fetching orders with timestamp:', timestamp);

            const response = await fetch(`${apiBaseUrl}/orders${timestamp}`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/json',
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache'
            },
            signal: ordersAbortRef.current.signal,
            });

            if (!response.ok) {
            if (response.status === 401 || response.status === 403) {
                console.error('Auth failed during fetch orders');
                handleLogout();
                return;
            }
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            console.log('✅ Orders fetched:', Array.isArray(data) ? data.length : 0);
            setOrders(Array.isArray(data) ? data : []);

            if (Array.isArray(data) && data.length > 0) {
            console.log('💰 Payment statuses:', data.map(o => ({
                id: o.order_id, payment: o.payment_status, amount: o.total_amount
            })));
            }
        } catch (error) {
            // Jangan ganggu user kalau request memang dibatalkan
            if (error.name === 'AbortError') {
            console.log('fetchOrders aborted (newer request started)');
            return;
            }
            console.error('Error fetching orders:', error);
            setOrders([]);
            if (!String(error.message).includes('Auth failed')) {
            alert(`Gagal mengambil pesanan: ${error.message}`);
            }
        } finally {
            ordersInFlightRef.current = false;
        }
        };


    const fetchMenuItems = async () => {
        if (!token) return;
        
        try {
            console.log('🍽️ Fetching menu items...');
            const response = await fetch(`${apiBaseUrl}/menu`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (!response.ok) {
                if (response.status === 401 || response.status === 403) {
                    console.error('Auth failed during fetch menu');
                    handleLogout();
                    return;
                }
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            console.log('📊 Raw menu data from backend:', data);
            
            const menuArray = Array.isArray(data) ? data : [];
            
            // Debug: Log availability status for each item
            menuArray.forEach((item, index) => {
                console.log(`Menu ${index + 1}: "${item.name}" - is_available: ${item.is_available} (type: ${typeof item.is_available})`);
            });
            
            setMenuItems(menuArray);
            
            // Initialize selections for new order modal
            const initialSelections = {};
            menuArray.forEach(item => {
                if (item && item.id_menu) {
                    initialSelections[item.id_menu] = { spiciness: '', temperature: '' };
                }
            });
            setNewOrderItemSelections(initialSelections);
            
            console.log(`✅ Menu items loaded: ${menuArray.length} items`);
            
        } catch (error) {
            console.error('Error fetching menu items:', error);
            setMenuItems([]);
            if (!error.message.includes('Auth failed')) {
                alert(`Gagal mengambil menu: ${error.message}`);
            }
        }
    };

    const fetchTables = async () => {
        if (!token) return;
        
        try {
            const response = await fetch(`${apiBaseUrl}/tables`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (!response.ok) {
                if (response.status === 401 || response.status === 403) {
                    console.error('Auth failed during fetch tables');
                    handleLogout();
                    return;
                }
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            setTables(Array.isArray(data) ? data : []);
            
        } catch (error) {
            console.error('Error fetching tables:', error);
            setTables([]);
            if (!error.message.includes('Auth failed')) {
                alert(`Gagal mengambil meja: ${error.message}`);
            }
        }
    };

    // ===================================
    // MENU MANAGEMENT FUNCTIONS (Admin only)
    // ===================================
    const handleImageChange = (e) => {
        try {
            const file = e.target.files[0];
            if (file) {
                setNewMenu(prev => ({ ...prev, imageFile: file }));
                const reader = new FileReader();
                reader.onloadend = () => {
                    setNewMenu(prev => ({ ...prev, imageUrlPreview: reader.result }));
                };
                reader.readAsDataURL(file);
            } else {
                setNewMenu(prev => ({ ...prev, imageFile: null, imageUrlPreview: '' }));
            }
        } catch (error) {
            console.error('Error handling image change:', error);
        }
    };

const handleAddOrUpdateMenu = async () => {
  try {
    if (!newMenu.name.trim() || !newMenu.price || !newMenu.category) {
      alert('Nama, harga, dan kategori menu tidak boleh kosong!');
      return;
    }

    const payload = {
      name: newMenu.name.trim(),
      description: (newMenu.description || '').trim(),
      // kirim sebagai number (backend parseFloat oke)
      price: Number(newMenu.price),
      category: newMenu.category,
      is_available: newMenu.is_available === 0 ? 0 : 1,
      // kirim link gambar (Google Drive/URL langsung)
      image_link: (newMenu.imageUrlPreview || '').trim() || null
    };

    const url = editingMenu && editingMenu.id_menu
      ? `${apiBaseUrl}/menu/${editingMenu.id_menu}`
      : `${apiBaseUrl}/menu`;

    const method = editingMenu && editingMenu.id_menu ? 'PUT' : 'POST';

    const response = await fetch(`${url}?t=${Date.now()}`, {
      method,
      cache: 'no-store',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Cache-Control': 'no-cache, no-store, max-age=0, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
    }

    alert(`Menu berhasil ${editingMenu ? 'diupdate' : 'ditambahkan'}!`);

    setNewMenu({ name: '', description: '', price: '', category: 'makanan-nasi', imageFile: null, imageUrlPreview: '' });
    setEditingMenu(null);

    // refresh daftar menu anti-cache
    await fetchMenuItems();
  } catch (error) {
    alert(`Gagal ${editingMenu ? 'mengupdate' : 'menambahkan'} menu: ${error.message}`);
  }
};


    const handleEditMenuClick = (item) => {
        try {
            if (!item || !item.id_menu) {
                console.error('Invalid item for edit:', item);
                return;
            }
            
            setEditingMenu(item);
            setNewMenu({
                name: item.name || '',
                description: item.description || '',
                price: item.price || '',
                category: item.category || 'makanan-nasi',
                imageFile: null,
                // sekarang (pakai apa adanya, karena backend sekarang simpan full URL):
                imageUrlPreview: item.image_url || ''

            });
            window.scrollTo({ top: 0, behavior: 'smooth' });
            setActiveMenuSubTab('menu-form');
        } catch (error) {
            console.error('Error setting up menu edit:', error);
        }
    };

    const handleCancelEdit = () => {
        try {
            setEditingMenu(null);
            setNewMenu({ name: '', description: '', price: '', category: 'makanan-nasi', imageFile: null, imageUrlPreview: '' });
            const fileInput = document.getElementById('menuImageUpload');
            if (fileInput) fileInput.value = '';
            setActiveMenuSubTab('menu-list');
        } catch (error) {
            console.error('Error canceling edit:', error);
        }
    };

    const handleDeleteMenu = async (id_menu) => {
        if (!id_menu) {
            console.error('Invalid menu ID for delete:', id_menu);
            return;
        }
        
        if (!window.confirm('Apakah Anda yakin ingin menghapus menu ini?')) return;
        
        try {
            const response = await fetch(`${apiBaseUrl}/menu/${id_menu}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
            }
            
            alert('Menu berhasil dihapus!');
            fetchMenuItems();
            
        } catch (error) {
            console.error('Error deleting menu:', error);
            alert(`Gagal menghapus menu: ${error.message}`);
        }
    };

    const handleToggleMenuAvailability = async (item) => {
        try {
            if (!item || !item.id_menu) {
                console.error('Invalid item for toggle:', item);
                return;
            }
            
            // Handle different boolean formats consistently
            const isCurrentlyAvailable = (item.is_available === 1 || item.is_available === true || item.is_available === '1');
            const newAvailability = isCurrentlyAvailable ? 0 : 1;
            
            console.log(`🔄 Toggling availability for ${item.name}:`);
            console.log(`   Current: ${item.is_available} (${typeof item.is_available}) -> interpreted as: ${isCurrentlyAvailable}`);
            console.log(`   New: ${newAvailability}`);
            
            const response = await fetch(`${apiBaseUrl}/menu/${item.id_menu}/availability`, {
                method: 'PATCH',
                headers: { 
                    'Content-Type': 'application/json', 
                    'Authorization': `Bearer ${token}` 
                },
                body: JSON.stringify({ 
                    is_available: newAvailability 
                })
            });
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                console.error('❌ Toggle response error:', errorData);
                throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
            }
            
            const result = await response.json();
            console.log('✅ Toggle success:', result);
            
            alert(result.message || `Ketersediaan menu "${item.name}" berhasil diubah!`);
            
            // Refresh menu list to show updated status
            await fetchMenuItems();
            
        } catch (error) {
            console.error('❌ Error toggling menu availability:', error);
            alert(`Gagal mengubah ketersediaan menu: ${error.message}`);
        }
    };

    // ===================================
    // TABLE FUNCTIONS
    // ===================================
    const handleAddTable = async () => {
        try {
            if (!newTable.table_number.trim()) {
                alert('Nomor meja tidak boleh kosong!');
                return;
            }
            
            const response = await fetch(`${apiBaseUrl}/tables`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json', 
                    'Authorization': `Bearer ${token}` 
                },
                body: JSON.stringify({
                    table_number: newTable.table_number.trim(),
                    capacity: newTable.capacity || null
                })
            });
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
            }
            
            alert('Meja berhasil ditambahkan!');
            setNewTable({ table_number: '', capacity: '' });
            fetchTables();
            
        } catch (error) {
            console.error('Error adding table:', error);
            alert(`Gagal menambahkan meja: ${error.message}`);
        }
    };

    const generateQrCode = (tableNum) => {
        try {
            const baseUrl = window.location.origin;
            const url = `${baseUrl}/menu/${encodeURIComponent(tableNum || '')}`;
            return url;
        } catch (error) {
            console.error('Error generating QR code URL:', error);
            return `${window.location.origin}/menu/table`;
        }
    };

    const handleDownloadQR = (tableNum) => {
        try {
            if (!tableNum) {
                console.error('Invalid table number for QR download:', tableNum);
                return;
            }
            
            const validId = `qr-table-${String(tableNum).replace(/\s/g, '-')}`;
            const svgElement = document.getElementById(validId);

            if (svgElement && svgElement.tagName.toLowerCase() === 'svg') {
                const svgData = new XMLSerializer().serializeToString(svgElement);
                const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
                const svgUrl = URL.createObjectURL(svgBlob);

                const downloadLink = document.createElement('a');
                downloadLink.href = svgUrl;
                downloadLink.download = `meja_${String(tableNum).replace(/\s/g, '-')}_qrcode.svg`;
                document.body.appendChild(downloadLink);
                downloadLink.click();
                document.body.removeChild(downloadLink);
                URL.revokeObjectURL(svgUrl);
            } else {
                alert('SVG QR Code tidak ditemukan.');
            }
        } catch (error) {
            console.error('Error downloading QR:', error);
            alert('Gagal mengunduh QR Code.');
        }
    };

    // ===================================
    // ORDER MANAGEMENT FUNCTIONS - IMPROVED FOR PAYMENT SYNC
    // ===================================
    const updateOrderStatus = async (orderId, newStatus) => {
        if (!orderId || !newStatus) {
            console.error('Invalid order ID or status:', { orderId, newStatus });
            return;
        }
        
        if (!window.confirm(`Ubah status pesanan ${orderId} menjadi ${newStatus}?`)) return;
        
        try {
            const response = await fetch(`${apiBaseUrl}/orders/${orderId}/status`, {
                method: 'PUT',
                headers: { 
                    'Content-Type': 'application/json', 
                    'Authorization': `Bearer ${token}` 
                },
                body: JSON.stringify({ status: newStatus })
            });
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
            }
            
            alert(`Status pesanan ${orderId} berhasil diupdate menjadi ${newStatus}!`);
            
            // Force refresh to sync payment status after order update
            await fetchOrders(true);
            
        } catch (error) {
            console.error('Error updating order status:', error);
            alert(`Gagal mengupdate status pesanan: ${error.message}`);
        }
    };

    const handleCashierPaymentClick = (orderId, totalAmount) => {
        try {
            if (!orderId || totalAmount == null) {
                console.error('Invalid payment data:', { orderId, totalAmount });
                return;
            }
            
            setSelectedOrderIdForPayment(orderId);
            setSelectedOrderTotalAmount(Number(totalAmount) || 0);
            setIsPaymentModalOpen(true);
        } catch (error) {
            console.error('Error opening payment modal:', error);
        }
    };

    const updateOrderPaymentStatus = async (orderId, newPaymentStatusFromModal, paymentMethod) => {
        try {
            if (!orderId) {
                throw new Error('Order ID is required');
            }
            
            let statusToSend = newPaymentStatusFromModal;
            if (newPaymentStatusFromModal === 'paid') {
                statusToSend = 'Sudah Bayar';
            } else if (newPaymentStatusFromModal === 'unpaid') {
                statusToSend = 'Belum Bayar';
            } else if (newPaymentStatusFromModal === 'Pending') {
                statusToSend = 'Pending';
            }

            console.log('💳 Updating payment status:', { orderId, statusToSend, paymentMethod });

            const response = await fetch(`${apiBaseUrl}/orders/${orderId}/payment_status`, {
                method: 'PUT',
                headers: { 
                    'Content-Type': 'application/json', 
                    'Authorization': `Bearer ${token}` 
                },
                body: JSON.stringify({
                    payment_status: statusToSend,
                    payment_method: paymentMethod || 'cash'
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
            }

            alert(`Status pembayaran pesanan ${orderId} berhasil diupdate menjadi ${statusToSend}!`);
            
            // Force refresh to sync payment status immediately
            await fetchOrders(true);
            
            return Promise.resolve();

        } catch (error) {
            console.error('Error updating payment status:', error);
            alert(`Gagal update status pembayaran: ${error.message}`);
            return Promise.reject(error);
        }
    };

    // ===================================
    // ORDER EDIT FUNCTIONS
    // ===================================
    const showEditOrder = (order) => {
        try {
            if (!order || !order.items) {
                console.error('Invalid order data for edit:', order);
                alert('Data pesanan tidak valid untuk edit');
                return;
            }

            const existingItems = safeJsonParse(order.items, []);
            const editCart = existingItems.map(item => ({
                id_menu: item.menu_item_id || 0,
                name: item.menu_name || 'Unknown Item',
                price: item.price_at_order || 0,
                quantity: item.quantity || 0,
                options: {
                    spiciness: item.spiciness_level || '',
                    temperature: item.temperature_level || ''
                }
            }));
            
            setEditOrderCart(editCart);
            
            // Initialize selections
            const selections = {};
            if (Array.isArray(menuItems)) {
                menuItems.forEach(menuItem => {
                    if (menuItem && menuItem.id_menu) {
                        selections[menuItem.id_menu] = { spiciness: '', temperature: '' };
                    }
                });
            }
            
            // Set existing selections
            existingItems.forEach(item => {
                if (item && item.menu_item_id && selections[item.menu_item_id]) {
                    selections[item.menu_item_id] = {
                        spiciness: item.spiciness_level || '',
                        temperature: item.temperature_level || ''
                    };
                }
            });
            
            setEditOrderItemSelections(selections);
            setEditOrderNote('');
            setSelectedOrderForDetail(order);
            setIsEditOrderModalOpen(true);
            
        } catch (error) {
            console.error('Error setting up edit order:', error);
            alert('Error memuat data pesanan untuk edit');
        }
    };

    const closeEditOrder = () => {
        setIsEditOrderModalOpen(false);
        setSelectedOrderForDetail(null);
        setEditOrderCart([]);
        setEditOrderItemSelections({});
        setEditOrderNote('');
    };

    const findEditOrderCartItem = (itemId, options) => {
        if (!Array.isArray(editOrderCart)) return null;
        return editOrderCart.find(cartItem =>
            cartItem && 
            cartItem.id_menu === itemId &&
            cartItem.options &&
            cartItem.options.spiciness === (options.spiciness || '') &&
            cartItem.options.temperature === (options.temperature || '')
        );
    };

    const addItemToEditOrderCart = (itemToAdd) => {
        try {
            if (!itemToAdd || !itemToAdd.id_menu) {
                console.error('Invalid item to add:', itemToAdd);
                return;
            }

            const optionsForThisItem = editOrderItemSelections[itemToAdd.id_menu] || { spiciness: '', temperature: '' };

            if (itemToAdd.category && itemToAdd.category.startsWith('menu mie') && !optionsForThisItem.spiciness) {
                alert('Silakan pilih tingkat kepedasan untuk ' + itemToAdd.name + '!');
                return;
            }
            if (itemToAdd.category && itemToAdd.category.startsWith('minuman') && !optionsForThisItem.temperature) {
                alert('Silakan pilih dingin/tidak dingin untuk ' + itemToAdd.name + '!');
                return;
            }

            setEditOrderCart(prevCart => {
                const existingCartItem = findEditOrderCartItem(itemToAdd.id_menu, optionsForThisItem);

                if (existingCartItem) {
                    return prevCart.map(cartItem =>
                        cartItem === existingCartItem
                            ? { ...cartItem, quantity: (cartItem.quantity || 0) + 1 }
                            : cartItem
                    );
                } else {
                    return [
                        ...prevCart,
                        {
                            id_menu: itemToAdd.id_menu,
                            name: itemToAdd.name || 'Unknown Item',
                            price: itemToAdd.price || 0,
                            quantity: 1,
                            options: { ...optionsForThisItem }
                        }
                    ];
                }
            });
        } catch (error) {
            console.error('Error adding item to edit cart:', error);
        }
    };

    const removeItemFromEditOrderCart = (itemInCart) => {
        try {
            if (!itemInCart || !itemInCart.id_menu) {
                console.error('Invalid item to remove:', itemInCart);
                return;
            }

            setEditOrderCart(prevCart => {
                const existingCartItem = findEditOrderCartItem(itemInCart.id_menu, itemInCart.options || {});

                if (existingCartItem) {
                    if ((existingCartItem.quantity || 0) > 1) {
                        return prevCart.map(cartItem =>
                            cartItem === existingCartItem
                                ? { ...cartItem, quantity: (cartItem.quantity || 0) - 1 }
                                : cartItem
                        );
                    } else {
                        return prevCart.filter(cartItem => cartItem !== existingCartItem);
                    }
                }
                return prevCart;
            });
        } catch (error) {
            console.error('Error removing item from edit cart:', error);
        }
    };

    const getEditOrderTotalItems = () => {
        try {
            if (!Array.isArray(editOrderCart)) return 0;
            return editOrderCart.reduce((sum, item) => sum + (item && item.quantity ? item.quantity : 0), 0);
        } catch (error) {
            console.error('Error calculating edit order total items:', error);
            return 0;
        }
    };

    const getEditOrderTotalPrice = () => {
        try {
            if (!Array.isArray(editOrderCart)) return 0;
            return editOrderCart.reduce((sum, item) => 
                sum + (item && item.price && item.quantity ? (item.price * item.quantity) : 0), 0
            );
        } catch (error) {
            console.error('Error calculating edit order total price:', error);
            return 0;
        }
    };

    const handleEditOrderOptionChange = (itemId, optionType, value) => {
        try {
            setEditOrderItemSelections(prevSelections => ({
                ...prevSelections,
                [itemId]: {
                    ...prevSelections[itemId],
                    [optionType]: value
                }
            }));
        } catch (error) {
            console.error('Error handling edit order option change:', error);
        }
    };

    const handleSaveEditOrder = async () => {
        try {
            if (getEditOrderTotalItems() === 0) {
                alert('Keranjang pesanan kosong. Silakan tambahkan item.');
                return;
            }

            if (!selectedOrderForDetail || !selectedOrderForDetail.order_id) {
                alert('Data pesanan tidak valid.');
                return;
            }

            const orderItemsForBackend = editOrderCart.map(item => ({
                id_menu: item.id_menu || 0,
                quantity: item.quantity || 0,
                spiciness_level: (item.options && item.options.spiciness) || null,
                temperature_level: (item.options && item.options.temperature) || null
            }));

            const response = await fetch(`${apiBaseUrl}/orders/${selectedOrderForDetail.order_id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    items: orderItemsForBackend,
                    note: editOrderNote || ''
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
            }

            alert(`Pesanan #${selectedOrderForDetail.order_id} berhasil diperbarui!`);
            closeEditOrder();
            
            // Force refresh after edit to sync payment status
            await fetchOrders(true);

        } catch (error) {
            console.error('Error updating order:', error);
            alert(`Gagal memperbarui pesanan: ${error.message}`);
        }
    };

    // ===================================
    // NEW ORDER FUNCTIONS (Kasir)
    // ===================================
   const handleAddOrderForCashier = async () => {
    try {
        console.log('🛒 Creating new order...');
        console.log('📦 Current cart state:', newOrderCart);
        console.log('📊 Cart total items:', getNewOrderTotalItems());
        
        const tableNumberForOrder = 'Take Away';
        
        // VALIDASI LEBIH KETAT
        if (!Array.isArray(newOrderCart) || newOrderCart.length === 0) {
            alert('Keranjang pesanan kosong. Silakan tambahkan item terlebih dahulu.');
            console.error('❌ Cart is empty or invalid:', newOrderCart);
            return;
        }
        
        const totalItems = getNewOrderTotalItems();
        if (totalItems === 0) {
            alert('Total item dalam keranjang adalah 0. Silakan tambahkan item.');
            console.error('❌ Total items is 0');
            return;
        }

        // VALIDASI SETIAP ITEM DI CART
        const validCartItems = newOrderCart.filter(item => {
            if (!item || !item.id_menu || !item.quantity || item.quantity <= 0) {
                console.warn('⚠️ Invalid cart item filtered out:', item);
                return false;
            }
            return true;
        });

        if (validCartItems.length === 0) {
            alert('Tidak ada item valid dalam keranjang. Silakan periksa kembali.');
            console.error('❌ No valid items in cart after filtering');
            return;
        }

        console.log('✅ Valid cart items:', validCartItems.length, 'out of', newOrderCart.length);

        // BUAT PAYLOAD DENGAN VALIDASI TAMBAHAN
        const orderItemsForBackend = validCartItems.map(item => {
            const orderItem = {
                id_menu: parseInt(item.id_menu) || 0,
                quantity: parseInt(item.quantity) || 0,
                spiciness_level: (item.options && item.options.spiciness) || null,
                temperature_level: (item.options && item.options.temperature) || null
            };
            
            // VALIDASI LAGI SETIAP ITEM
            if (orderItem.id_menu <= 0 || orderItem.quantity <= 0) {
                console.error('❌ Invalid order item:', orderItem);
                throw new Error(`Item tidak valid: ID=${orderItem.id_menu}, Qty=${orderItem.quantity}`);
            }
            
            return orderItem;
        });

        console.log('📋 Final order items for backend:', orderItemsForBackend);

        // VALIDASI FINAL SEBELUM KIRIM
        if (orderItemsForBackend.length === 0) {
            throw new Error('Tidak ada item yang valid untuk dikirim ke server');
        }

        const payload = {
            tableNumber: tableNumberForOrder,
            items: orderItemsForBackend,
            customerName: newOrderCustomerName.trim() || null
        };

        console.log('🚀 Sending order payload:', payload);

        const response = await fetch(`${apiBaseUrl}/orders`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(payload)
        });

        console.log('📡 Server response status:', response.status);

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error('❌ Server error response:', errorData);
            throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
        }

        const orderData = await response.json();
        console.log('✅ Order created successfully:', orderData);

        // CEGAH MULTIPLE SUBMISSIONS
        setIsAddOrderModalOpen(false);

        // RESET STATE DENGAN KONFIRMASI
        setNewOrderCustomerName('');
        setNewOrderCart([]);
        
        const resetSelections = {};
        if (Array.isArray(menuItems)) {
            menuItems.forEach(item => {
                if (item && item.id_menu) {
                    resetSelections[item.id_menu] = { spiciness: '', temperature: '' };
                }
            });
        }
        setNewOrderItemSelections(resetSelections);

        alert(`✅ Pesanan baru untuk "${newOrderCustomerName.trim() || 'Take Away'}" berhasil dibuat dengan ID: ${orderData.orderId || 'N/A'}!`);
        
        // REFRESH ORDERS
        await fetchOrders(true);

    } catch (error) {
        console.error('❌ Error creating new order:', error);
        alert(`Gagal membuat pesanan baru: ${error.message}`);
    }
};
            const addNewItemToOrderCart = (itemToAdd) => {
                try {
                    console.log('🛒 Adding item to cart:', itemToAdd);
                    
                    if (!itemToAdd || !itemToAdd.id_menu) {
                        console.error('❌ Invalid item to add:', itemToAdd);
                        alert('Item tidak valid untuk ditambahkan');
                        return;
                    }

                    const optionsForThisItem = newOrderItemSelections[itemToAdd.id_menu] || { spiciness: '', temperature: '' };
                    console.log('📝 Item options:', optionsForThisItem);

                    // Validasi options untuk item yang memerlukan
                    if (itemToAdd.category && itemToAdd.category.startsWith('menu mie') && !optionsForThisItem.spiciness) {
                        alert('Silakan pilih tingkat kepedasan untuk ' + (itemToAdd.name || 'item ini') + '!');
                        return;
                    }
                    if (itemToAdd.category && itemToAdd.category.startsWith('minuman') && !optionsForThisItem.temperature) {
                        alert('Silakan pilih dingin/tidak dingin untuk ' + (itemToAdd.name || 'item ini') + '!');
                        return;
                    }

            setNewOrderCart(prevCart => {
                console.log('📦 Previous cart:', prevCart);
                
                const existingCartItem = findNewOrderCartItem(itemToAdd.id_menu, optionsForThisItem);
                console.log('🔍 Existing cart item:', existingCartItem);

                let newCart;
                if (existingCartItem) {
                    newCart = prevCart.map(cartItem =>
                        cartItem === existingCartItem
                            ? { ...cartItem, quantity: (cartItem.quantity || 0) + 1 }
                            : cartItem
                    );
                } else {
                    newCart = [
                        ...prevCart,
                        {
                            id_menu: itemToAdd.id_menu,
                            name: itemToAdd.name || 'Unknown Item',
                            price: itemToAdd.price || 0,
                            quantity: 1,
                            options: { ...optionsForThisItem }
                        }
                    ];
                }
                
                console.log('✅ New cart after adding:', newCart);
                return newCart;
            });
        } catch (error) {
            console.error('❌ Error adding new item to order cart:', error);
            alert('Gagal menambahkan item ke keranjang');
        }
    };;

    // Add this function to your AdminPage component, right before the addNewItemToOrderCart function
    const findNewOrderCartItem = (itemId, options) => {
        try {
            if (!Array.isArray(newOrderCart)) return null;
            return newOrderCart.find(cartItem =>
                cartItem && 
                cartItem.id_menu === itemId &&
                cartItem.options &&
                cartItem.options.spiciness === (options.spiciness || '') &&
                cartItem.options.temperature === (options.temperature || '')
            );
        } catch (error) {
            console.error('Error finding new order cart item:', error);
            return null;
        }
    };

    const removeNewItemFromOrderCart = (itemInCart) => {
        try {
            if (!itemInCart || !itemInCart.id_menu) {
                console.error('Invalid item to remove:', itemInCart);
                return;
            }

            setNewOrderCart(prevCart => {
                const existingCartItem = findNewOrderCartItem(itemInCart.id_menu, itemInCart.options || {});

                if (existingCartItem) {
                    if ((existingCartItem.quantity || 0) > 1) {
                        return prevCart.map(cartItem =>
                            cartItem === existingCartItem
                                ? { ...cartItem, quantity: (cartItem.quantity || 0) - 1 }
                                : cartItem
                        );
                    } else {
                        return prevCart.filter(cartItem => cartItem !== existingCartItem);
                    }
                }
                return prevCart;
            });
        } catch (error) {
            console.error('Error removing new item from order cart:', error);
        }
    };

    const getNewOrderTotalItems = () => {
        try {
            if (!Array.isArray(newOrderCart)) return 0;
            return newOrderCart.reduce((sum, item) => sum + (item && item.quantity ? item.quantity : 0), 0);
        } catch (error) {
            console.error('Error calculating new order total items:', error);
            return 0;
        }
    };

    const getNewOrderTotalPrice = () => {
        try {
            if (!Array.isArray(newOrderCart)) return 0;
            return newOrderCart.reduce((sum, item) => 
                sum + (item && item.price && item.quantity ? (item.price * item.quantity) : 0), 0
            );
        } catch (error) {
            console.error('Error calculating new order total price:', error);
            return 0;
        }
    };

    const handleNewOrderOptionChange = (itemId, optionType, value) => {
        try {
            setNewOrderItemSelections(prevSelections => ({
                ...prevSelections,
                [itemId]: {
                    ...prevSelections[itemId],
                    [optionType]: value
                }
            }));
        } catch (error) {
            console.error('Error handling new order option change:', error);
        }
    };

    // ===================================
    // REPORTS FUNCTIONS
    // ===================================
    const fetchSalesReport = async () => {
        if (!token) return;
        
        setIsLoadingReport(true);

        try {
            const response = await fetch(
                `${apiBaseUrl}/reports/sales?startDate=${reportDateRange.startDate}&endDate=${reportDateRange.endDate}`, 
                {
                    headers: { 'Authorization': `Bearer ${token}` }
                }
            );

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            setReportData(data || {
                totalSales: 0,
                totalOrders: 0,
                completedOrders: 0,
                cancelledOrders: 0,
                pendingOrders: 0,
                totalSalesToday: 0,
                totalOrdersToday: 0,
                topSellingItems: [],
                salesByPaymentMethod: [],
                salesByDate: []
            });
            
        } catch (error) {
            console.error('Error fetching sales report:', error);
            alert(`Gagal mengambil laporan: ${error.message}`);
        } finally {
            setIsLoadingReport(false);
        }
    };

    const exportReportToCSV = () => {
        try {
            const csvContent = [
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
                ...((reportData.topSellingItems || []).map(item => [
                    item.menu_name || 'Unknown',
                    item.total_quantity || 0,
                    `Rp ${formatPrice(item.total_revenue || 0)}`
                ]))
            ];

            const csvString = csvContent.map(row => row.join(',')).join('\n');
            const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');

            if (link.download !== undefined) {
                const url = URL.createObjectURL(blob);
                link.setAttribute('href', url);
                link.setAttribute('download', `laporan-penjualan-${reportDateRange.startDate}-${reportDateRange.endDate}.csv`);
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
            }
        } catch (error) {
            console.error('Error exporting report to CSV:', error);
            alert('Gagal mengexport laporan ke CSV.');
        }
    };

    // ===================================
    // PRINT FUNCTIONS
    // ===================================
    const handlePrintOrder = (order) => {
        try {
            if (!order || !order.order_id) {
                console.error('Invalid order for print:', order);
                return;
            }

            const items = safeJsonParse(order.items, []);
            const printContent = `
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Cetak Pesanan #${order.order_id}</title>
                    <meta charset="UTF-8">
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
                            <div class="info-line">
                                <span>Meja:</span>
                                <span>${order.table_number === 'Take Away' && order.customer_name ? `${order.table_number} - ${order.customer_name}` : order.table_number || 'N/A'}</span>
                            </div>
                            <div class="info-line">
                                <span>Status:</span>
                                <span>${(order.order_status || 'N/A').toUpperCase()}</span>
                            </div>
                            <div class="info-line">
                                <span>Pembayaran:</span>
                                <span>${(order.payment_status || 'N/A').toUpperCase()}</span>
                            </div>
                        </div>

                        <div class="section-divider"></div>

                        <div class="receipt-items-section">
                            <div class="item-header">DETAIL PESANAN:</div>
                            ${items.map(item => `
                                <div class="receipt-item-line">
                                    <div class="item-details">
                                        <span>${item.quantity || 0}x ${item.menu_name || 'Unknown Item'}</span>
                                        <span>Rp ${formatPrice((item.quantity || 0) * (item.price_at_order || 0))}</span>
                                    </div>
                                    <div class="item-details">
                                        <span style="font-size: 11px;">@ Rp ${formatPrice(item.price_at_order || 0)}</span>
                                        <span></span>
                                    </div>
                                    ${item.spiciness_level || item.temperature_level ? `
                                        <div class="item-options">
                                            ${item.spiciness_level ? `* ${item.spiciness_level}` : ''}
                                            ${item.temperature_level ? `* ${item.temperature_level}` : ''}
                                        </div>
                                    ` : ''}
                                </div>
                            `).join('')}
                        </div>

                        <div class="receipt-total-section">
                            <div class="total-line">
                                <span>TOTAL:</span>
                                <span>Rp ${formatPrice(order.total_amount || 0)}</span>
                            </div>
                        </div>

                        <div class="receipt-footer">
                            <div>Terima kasih atas kunjungan Anda!</div>
                            <div>Selamat menikmati makanan Anda</div>
                        </div>
                    </div>
                </body>
                </html>
            `;
            const printWindow = window.open('', '', 'height=600,width=400');
            if (printWindow) {
                printWindow.document.write(printContent);
                printWindow.document.close();
                printWindow.print();
            } else {
                alert('Gagal membuka window print. Pastikan popup blocker tidak menghalangi.');
            }
        } catch (error) {
            console.error('Error printing order:', error);
            alert('Gagal mencetak struk pesanan');
        }
    };

    // ===================================
    // EFFECTS - IMPROVED
    // ===================================
    useEffect(() => {
        console.log('🔄 AdminPage mounted, token state:', !!token);
        console.log('👤 UserRole state:', userRole);
        
        if (token) {
            console.log('✅ Token exists, fetching initial data...');
            fetchOrders(true);
            fetchMenuItems();
            fetchTables();
            
            // More frequent polling for payment status sync - every 5 seconds
            const POLL_MS = 5000; // 5 detik (boleh 3000–10000 sesuai kebutuhan)

            const intervalId = setInterval(() => {
            fetchOrders(true);
            }, POLL_MS);

            return () => {
            console.log('🧹 Cleaning up polling interval');
            clearInterval(intervalId);
            // batalkan request yang mungkin masih berjalan
            try { ordersAbortRef.current?.abort(); } catch {}
            };

        } else {
            console.log('🚫 No token, staying on login page');
        }
    }, [token]);

    useEffect(() => {
        if (activeTab === 'laporan' && token) {
            fetchSalesReport();
        }
    }, [activeTab, token, reportDateRange.startDate, reportDateRange.endDate]);

    // ===================================
    // RENDER FUNCTIONS
    // ===================================

    // LOGIN FORM
    if (!token) {
        return (
            <div className="login-form-container">
                <div className="login-form">
                    <h2 className="admin-section-title">Login Admin / Kasir</h2>
                    <div className="login-input-group">
                        <label>Username:</label>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className="login-input"
                            placeholder="Masukkan username"
                            disabled={isLoggingIn}
                        />
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
                                onKeyPress={(e) => {
                                    if (e.key === 'Enter' && !isLoggingIn) {
                                        handleLogin();
                                    }
                                }}
                                style={{ paddingRight: '45px' }}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="password-toggle-btn"
                                style={{
                                    position: 'absolute',
                                    right: '10px',
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    background: 'none',
                                    border: '1px solid #ddd',
                                    cursor: 'pointer',
                                    fontSize: '11px',
                                    color: '#666',
                                    padding: '4px 6px',
                                    borderRadius: '4px',
                                    minWidth: 'auto',
                                    height: '24px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontWeight: '500',
                                    transition: 'all 0.2s ease',
                                    ':hover': {
                                        backgroundColor: '#f5f5f5',
                                        borderColor: '#999'
                                    }
                                }}
                                disabled={isLoggingIn}
                                title={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                                onMouseOver={(e) => {
                                    e.target.style.backgroundColor = '#f5f5f5';
                                    e.target.style.borderColor = '#999';
                                }}
                                onMouseOut={(e) => {
                                    e.target.style.backgroundColor = 'transparent';
                                    e.target.style.borderColor = '#ddd';
                                }}
                            >
                                {showPassword ? 'Hide' : 'Show'}
                            </button>
                        </div>
                    </div>
                    {loginError && (
                        <div 
                            className="login-error-message" 
                            style={{ 
                                whiteSpace: 'pre-line', 
                                textAlign: 'left', 
                                padding: '12px', 
                                backgroundColor: '#fee', 
                                border: '1px solid #fcc', 
                                borderRadius: '4px', 
                                color: '#c33',
                                fontSize: '14px',
                                margin: '10px 0'
                            }}
                        >
                            {loginError}
                        </div>
                    )}
                    <button 
                        onClick={handleLogin} 
                        className="login-button"
                        disabled={isLoggingIn}
                    >
                        {isLoggingIn ? 'Logging in...' : 'Login'}
                    </button>
                    
                    {/* Debug Information */}
                    <div style={{ 
                        marginTop: '20px', 
                        padding: '12px', 
                        backgroundColor: '#f8f9fa', 
                        border: '1px solid #dee2e6', 
                        borderRadius: '4px', 
                        fontSize: '12px',
                        color: '#6c757d'
                    }}>
                        <strong>🔧 Debug Info:</strong><br/>
                        
                        <div style={{ marginBottom: '10px' }}>
                            <strong>Backend Port:</strong><br/>
                            {API_PORTS.map(({ port, url }) => (
                                <label key={port} style={{ display: 'block', margin: '4px 0' }}>
                                    <input
                                        type="radio"
                                        name="apiPort"
                                        value={url}
                                        checked={apiBaseUrl === url}
                                        onChange={(e) => setApiBaseUrl(e.target.value)}
                                        style={{ marginRight: '6px' }}
                                        disabled={isLoggingIn}
                                    />
                                    Port {port} ({url})
                                </label>
                            ))}
                        </div>
                        
                        Current API URL: <strong>{apiBaseUrl}</strong><br/>
                        Login Endpoint: <strong>{apiBaseUrl}/login</strong><br/>
                        Status: {isLoggingIn ? '⏳ Connecting...' : '✅ Ready'}<br/>
                        <br/>
                        <strong>Quick Test:</strong><br/>
                        <button
                            onClick={async () => {
                                try {
                                    console.log('🧪 Testing server connection to:', apiBaseUrl);
                                    const response = await fetch(`${apiBaseUrl}/health`);
                                    if (response.ok) {
                                        alert(`✅ Server is reachable at ${apiBaseUrl}!`);
                                    } else {
                                        alert(`⚠️ Server at ${apiBaseUrl} responded with status: ${response.status}`);
                                    }
                                } catch (error) {
                                    console.error(`Server test failed for ${apiBaseUrl}:`, error);
                                    alert(`❌ Cannot reach server at ${apiBaseUrl}: ${error.message}`);
                                }
                            }}
                            style={{
                                padding: '4px 8px',
                                fontSize: '11px',
                                marginRight: '5px',
                                background: '#e9ecef',
                                border: '1px solid #ced4da',
                                borderRadius: '3px',
                                cursor: 'pointer'
                            }}
                            disabled={isLoggingIn}
                        >
                            Test Current Port
                        </button>
                        
                        <button
                            onClick={async () => {
                                console.log('🔍 Auto-detecting backend port...');
                                for (const { port, url } of API_PORTS) {
                                    try {
                                        console.log(`Testing port ${port}...`);
                                        const response = await fetch(`${url}/health`);
                                        if (response.ok) {
                                            setApiBaseUrl(url);
                                            alert(`✅ Found backend server running on port ${port}!`);
                                            return;
                                        }
                                    } catch (error) {
                                        console.log(`Port ${port} not responding:`, error.message);
                                    }
                                }
                                alert('❌ No backend server found on common ports (3000, 4000, 5000, 8000)');
                            }}
                            style={{
                                padding: '4px 8px',
                                fontSize: '11px',
                                marginRight: '5px',
                                background: '#e9ecef',
                                border: '1px solid #ced4da',
                                borderRadius: '3px',
                                cursor: 'pointer'
                            }}
                            disabled={isLoggingIn}
                        >
                            Auto-Detect Port
                        </button>
                        
                        <button
                            onClick={() => {
                                setUsername('admin');
                                setPassword('admin123');
                            }}
                            style={{
                                padding: '4px 8px',
                                fontSize: '11px',
                                background: '#e9ecef',
                                border: '1px solid #ced4da',
                                borderRadius: '3px',
                                cursor: 'pointer'
                            }}
                            disabled={isLoggingIn}
                        >
                            Fill Test Credentials
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // MAIN DASHBOARD
    return (
        <div className="admin-dashboard-layout">
            {/* Mobile Menu Toggle */}
            <button className="mobile-menu-toggle" onClick={toggleMobileMenu}>
                <span></span>
                <span></span>
                <span></span>
            </button>

            {/* Sidebar Overlay for Mobile */}
            <div 
                className={`sidebar-overlay ${mobileMenuOpen ? 'active' : ''}`}
                onClick={() => setMobileMenuOpen(false)}
            ></div>

            {/* Sidebar */}
            <div className={`admin-sidebar ${sidebarCollapsed ? 'collapsed' : ''} ${mobileMenuOpen ? 'mobile-open' : ''}`}>
                {/* Desktop Sidebar Toggle */}
                <button className="desktop-sidebar-toggle" onClick={toggleSidebar}>
                    {sidebarCollapsed ? '→' : '←'}
                </button>

                <div className="admin-sidebar-header">
                    <span className="admin-sidebar-title">Dashboard Admin</span>
                </div>
                
                <div className="admin-sidebar-user-info">
                    <p>Login sebagai: <strong>{userRole.toUpperCase()}</strong></p>
                    <button onClick={handleLogout} className="admin-logout-button">Logout</button>
                </div>
                
                <ul className="admin-sidebar-nav">
                    <li 
                        className={activeTab === 'pesanan' ? 'active' : ''} 
                        onClick={() => handleTabChange('pesanan')}
                    >
                        <a href="#daftar-pesanan">Daftar Pesanan</a>
                    </li>
                    {userRole === 'admin' && (
                        <>
                            <li 
                                className={activeTab === 'manajemen-menu' ? 'active' : ''} 
                                onClick={() => handleTabChange('manajemen-menu')}
                            >
                                <a href="#manajemen-menu">Manajemen Menu</a>
                            </li>
                            <li 
                                className={activeTab === 'manajemen-meja' ? 'active' : ''} 
                                onClick={() => handleTabChange('manajemen-meja')}
                            >
                                <a href="#manajemen-meja">Manajemen Meja</a>
                            </li>
                        </>
                    )}
                    <li 
                        className={activeTab === 'laporan' ? 'active' : ''} 
                        onClick={() => handleTabChange('laporan')}
                    >
                        <a href="#laporan">Laporan</a>
                    </li>
                </ul>
            </div>

            {/* Main Content */}
            <div className={`admin-content-area ${sidebarCollapsed ? 'expanded' : ''}`}>
                {activeTab === 'pesanan' && (
                    <div className="admin-section-box">
                        <div className="order-list-header">
                            <h2 className="admin-section-title">Daftar Pesanan</h2>
                            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                                {/* REFRESH BUTTON FOR PAYMENT SYNC */}
                                <button
                                    onClick={handleManualRefresh}
                                    disabled={isRefreshing}
                                    style={{
                                        padding: '8px 16px',
                                        backgroundColor: isRefreshing ? '#6c757d' : '#28a745',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '5px',
                                        cursor: isRefreshing ? 'not-allowed' : 'pointer',
                                        fontSize: '0.9em',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '5px'
                                    }}
                                >
                                    {isRefreshing ? '🔄' : '↻'} {isRefreshing ? 'Refreshing...' : 'Refresh'}
                                </button>
                                
                                <small style={{ color: '#666', fontSize: '0.8em' }}>
                                    Last update: {lastRefresh.toLocaleTimeString('id-ID')}
                                </small>
                                
                                {(userRole === 'admin' || userRole === 'cashier') && (
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
                                {orders.map((order, index) => {
                                    if (!order) return null;
                                    
                                    const orderItems = safeJsonParse(order.items, []);
                                    
                                    return (
                                        <div key={order.order_id || index} className="order-card">
                                            <div className="order-card-header">
                                                <h3>ID Pesanan: {order.order_id || 'N/A'}</h3>
                                            </div>
                                            
                                            <div className="order-card-content">
                                                <div className="order-info-grid">
                                                    <div className="order-info-item">
                                                        <span className="order-info-label">Meja:</span>
                                                        <span className="order-info-value">
                                                            {order.table_number === 'Take Away' && order.customer_name 
                                                                ? `${order.table_number} - ${order.customer_name}` 
                                                                : order.table_number || 'N/A'}
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
                                                        <span className={`order-info-value ${
                                                            order.order_status === 'Dalam Proses' ? 'order-status-pending' : 
                                                            order.order_status === 'Selesai' ? 'order-status-completed' : 
                                                            'order-status-other'
                                                        }`}>
                                                            {order.order_status ? order.order_status.toUpperCase() : 'N/A'}
                                                        </span>
                                                    </div>
                                                    
                                                    <div className="order-info-item">
                                                        <span className="order-info-label">Pembayaran:</span>
                                                        <span className={`order-info-value ${
                                                            order.payment_status === 'Belum Bayar' ? 'payment-status-unpaid' : 
                                                            order.payment_status === 'Sudah Bayar' ? 'payment-status-paid' : 
                                                            'order-status-other'
                                                        }`}>
                                                            {order.payment_status ? order.payment_status.toUpperCase() : 'N/A'}
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
                                                        {orderItems.map((item, idx) => {
                                                            if (!item) return null;
                                                            return (
                                                                <li key={idx} className="order-item-detail">
                                                                    <div className="order-item-info">
                                                                        <span className="order-item-name">
                                                                            {item.quantity || 0}x {item.menu_name || 'Unknown Item'}
                                                                        </span>
                                                                        {(item.spiciness_level || item.temperature_level) && (
                                                                            <div className="order-item-options">
                                                                                {item.spiciness_level && <span className="order-item-option">({item.spiciness_level})</span>}
                                                                                {item.temperature_level && <span className="order-item-option">({item.temperature_level})</span>}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                    <div className="order-item-price">
                                                                        Rp {formatPrice((item.quantity || 0) * (item.price_at_order || 0))}
                                                                    </div>
                                                                </li>
                                                            );
                                                        })}
                                                    </ul>
                                                </div>
                                                
                                                <div className="order-actions">
                                                    {order.order_status === 'Dalam Proses' && (
                                                        <>
                                                            <div className="order-actions-row">
                                                                {order.payment_status === 'Belum Bayar' && (
                                                                    <button
                                                                        onClick={() => handleCashierPaymentClick(order.order_id, order.total_amount)}
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
                                                                {order.payment_status === 'Sudah Bayar' && (
                                                                    <button 
                                                                        onClick={() => updateOrderStatus(order.order_id, 'Selesai')} 
                                                                        className="order-action-button btn-success"
                                                                    >
                                                                        Selesai
                                                                    </button>
                                                                )}
                                                            </div>
                                                            <button 
                                                                onClick={() => updateOrderStatus(order.order_id, 'Dibatalkan')} 
                                                                className="order-action-button btn-secondary full-width"
                                                            >
                                                                Batalkan
                                                            </button>
                                                        </>
                                                    )}
                                                    {order.payment_status === 'Sudah Bayar' && order.order_status !== 'Dalam Proses' && (
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

                {/* Menu Management Tab */}
                {activeTab === 'manajemen-menu' && userRole === 'admin' && (
                    <div className="admin-section-box">
                        <div className="menu-header-controls">
                            {activeMenuSubTab === 'menu-list' ? (
                                <>
                                    <h2 className="admin-section-title">Daftar Menu</h2>
                                    <button
                                        onClick={() => {
                                            setEditingMenu(null);
                                            setNewMenu({ name: '', description: '', price: '', category: 'makanan-nasi', imageFile: null, imageUrlPreview: '' });
                                            setActiveMenuSubTab('menu-form');
                                        }}
                                        className="menu-add-button"
                                    >
                                        Tambah Menu Baru
                                    </button>
                                </>
                            ) : (
                                <h2 className="admin-section-title">
                                    {editingMenu ? 'Edit Menu' : 'Tambah Menu Baru'}
                                </h2>
                            )}
                        </div>

                        {activeMenuSubTab === 'menu-list' ? (
                            <>
                                <h3>Daftar Menu:</h3>
                                {menuItems.length === 0 ? (
                                    <p className="no-data-message">Belum ada menu.</p>
                                ) : (
                                    <div className="menu-list-grid">
                                        {menuItems.map((item, index) => {
                                            if (!item) return null;
                                            return (
                                                <div key={item.id_menu || index} className="menu-item-management-card">
                                                    <img 
                                                        src={item.image_url ? `https://let-s-pay-server.vercel.app${item.image_url}` : 'https://placehold.co/150x150/CCCCCC/000000?text=No+Image'} 
                                                        onError={(e) => { 
                                                            e.target.onerror = null; 
                                                            e.target.src = 'https://placehold.co/150x150/CCCCCC/000000?text=No+Image'; 
                                                        }} 
                                                        alt={item.name || 'Menu Item'} 
                                                        className="menu-item-management-image" 
                                                    />
                                                    <p><strong>{item.name || 'Unknown'}</strong> (Rp {formatPrice(item.price)})</p>
                                                    <p className="menu-item-management-category">Kategori: {item.category || 'N/A'}</p>
                                                    <p className={
                                                        (item.is_available === 1 || item.is_available === true || item.is_available === '1') 
                                                            ? 'menu-status-available' 
                                                            : 'menu-status-unavailable'
                                                    }>
                                                        Status: {
                                                            (item.is_available === 1 || item.is_available === true || item.is_available === '1')
                                                                ? 'Tersedia' 
                                                                : 'Tidak Tersedia'
                                                        }
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
                                                                (item.is_available === 1 || item.is_available === true || item.is_available === '1') 
                                                                    ? 'menu-action-button toggle-active' 
                                                                    : 'menu-action-button toggle-inactive'
                                                            }
                                                        >
                                                            {(item.is_available === 1 || item.is_available === true || item.is_available === '1') 
                                                                ? 'Nonaktifkan' 
                                                                : 'Aktifkan'
                                                            }
                                                        </button>
                                                        <button 
                                                            onClick={() => handleDeleteMenu(item.id_menu)} 
                                                            className="menu-action-button delete"
                                                        >
                                                            Hapus
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className="menu-form">
                                <input 
                                    type="text" 
                                    placeholder="Nama Menu" 
                                    value={newMenu.name} 
                                    onChange={(e) => setNewMenu({ ...newMenu, name: e.target.value })} 
                                    className="menu-form-input"
                                />
                                <textarea 
                                    placeholder="Deskripsi" 
                                    value={newMenu.description} 
                                    onChange={(e) => setNewMenu({ ...newMenu, description: e.target.value })} 
                                    className="menu-form-textarea"
                                    rows="2"
                                />
                                <input 
                                    type="number" 
                                    placeholder="Harga" 
                                    value={newMenu.price} 
                                    onChange={(e) => setNewMenu({ ...newMenu, price: e.target.value })} 
                                    className="menu-form-input"
                                />
                                <select 
                                    value={newMenu.category} 
                                    onChange={(e) => setNewMenu({ ...newMenu, category: e.target.value })} 
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
                                {newMenu.imageUrlPreview && (
                                    <div className="menu-image-preview-container">
                                        <img src={newMenu.imageUrlPreview} alt="Preview" className="menu-image-preview" />
                                    </div>
                                )}
                                <div className="menu-form-actions">
                                    <button 
                                        onClick={handleAddOrUpdateMenu} 
                                        className="menu-add-button"
                                    >
                                        {editingMenu ? 'Update Menu' : 'Tambah Menu'}
                                    </button>
                                    <button 
                                        onClick={handleCancelEdit} 
                                        className="menu-action-button btn-secondary"
                                    >
                                        Batal
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Table Management Tab */}
                {activeTab === 'manajemen-meja' && userRole === 'admin' && (
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
                            <button onClick={handleAddTable} className="table-add-button">
                                Tambah Meja
                            </button>
                        </div>
                        
                        <h3>QR Code Meja:</h3>
                        <div className="qr-code-grid">
                            {tables.map((table, index) => {
                                if (!table) return null;
                                return (
                                    <div key={table.id_table || index} className="qr-card">
                                        <h4 className="qr-card-title">Meja {table.table_number || 'N/A'}</h4>
                                        <p className="qr-card-status">Status: {table.status || 'Available'}</p>
                                        <QRCodeSVG
                                            id={`qr-table-${String(table.table_number || 'unknown').replace(/\s/g, '-')}`}
                                            value={generateQrCode(table.table_number)}
                                            size={100}
                                            level="H"
                                            includeMargin={true}
                                        />
                                        <button
                                            onClick={() => handleDownloadQR(table.table_number)}
                                            className="qr-download-button"
                                        >
                                            Unduh QR
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                        {tables.length === 0 && (
                            <p className="no-tables-message">Belum ada meja. Tambahkan meja baru di atas.</p>
                        )}
                    </div>
                )}

                {/* Reports Tab */}
                {activeTab === 'laporan' && (
                    <div className="admin-section-box">
                        <h2 className="admin-section-title">Laporan Penjualan</h2>
                        
                        <div className="report-filters">
                            <div className="date-filter-group">
                                <label>Dari Tanggal:</label>
                                <input
                                    type="date"
                                    value={reportDateRange.startDate}
                                    onChange={(e) => setReportDateRange(prev => ({
                                        ...prev,
                                        startDate: e.target.value
                                    }))}
                                    className="report-date-input"
                                />
                            </div>
                            <div className="date-filter-group">
                                <label>Sampai Tanggal:</label>
                                <input
                                    type="date"
                                    value={reportDateRange.endDate}
                                    onChange={(e) => setReportDateRange(prev => ({
                                        ...prev,
                                        endDate: e.target.value
                                    }))}
                                    className="report-date-input"
                                />
                            </div>
                            <button
                                onClick={fetchSalesReport}
                                className="generate-report-button"
                                disabled={isLoadingReport}
                            >
                                {isLoadingReport ? 'Loading...' : 'Generate Laporan'}
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
                                    <h3>Penjualan Tanggal Awal Periode ({new Date(reportDateRange.startDate).toLocaleDateString('id-ID')})</h3>
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
                                    {(!reportData.topSellingItems || reportData.topSellingItems.length === 0) ? (
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
                                                    {reportData.topSellingItems.map((item, index) => {
                                                        if (!item) return null;
                                                        return (
                                                            <tr key={item.menu_item_id || index}>
                                                                <td className="rank-cell">#{index + 1}</td>
                                                                <td className="menu-name-cell">{item.menu_name || 'Unknown'}</td>
                                                                <td className="quantity-cell">{item.total_quantity || 0}</td>
                                                                <td className="revenue-cell">Rp {formatPrice(item.total_revenue || 0)}</td>
                                                                <td className="avg-price-cell">Rp {formatPrice(item.avg_price || 0)}</td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>

                                {reportData.salesByPaymentMethod && reportData.salesByPaymentMethod.length > 0 && (
                                    <div className="payment-method-section">
                                        <h3>Penjualan per Metode Pembayaran</h3>
                                        <div className="payment-method-stats">
                                            {reportData.salesByPaymentMethod.map((method, index) => {
                                                if (!method) return null;
                                                return (
                                                    <div key={method.payment_method || index} className="payment-stat-card">
                                                        <h4>{method.payment_method || 'Belum Ditentukan'}</h4>
                                                        <p>Jumlah: {method.order_count || 0} pesanan</p>
                                                        <p>Total: Rp {formatPrice(method.total_amount || 0)}</p>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {reportData.salesByDate && reportData.salesByDate.length > 0 && (
                                    <div className="daily-sales-section">
                                        <h3>Penjualan Harian</h3>
                                        <div className="daily-sales-chart">
                                            {reportData.salesByDate.map((dateData, index) => {
                                                if (!dateData) return null;
                                                return (
                                                    <div key={dateData.sale_date || index} className="daily-sale-item">
                                                        <span className="sale-date">
                                                            {dateData.sale_date ? new Date(dateData.sale_date).toLocaleDateString('id-ID') : 'Unknown Date'}
                                                        </span>
                                                        <span className="sale-amount">Rp {formatPrice(dateData.daily_total || 0)}</span>
                                                        <span className="sale-orders">({dateData.order_count || 0} pesanan)</span>
                                                    </div>
                                                );
                                            })}
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
                            <button className="back-btn" onClick={closeEditOrder}>←</button>
                            <h2>Edit Pesanan #{selectedOrderForDetail.order_id || 'N/A'}</h2>
                        </div>

                        <div className="edit-alert">
                            <strong>Info:</strong> Anda sedang mengedit pesanan yang sudah ada. Item yang dipilih sebelumnya sudah terisi.
                        </div>

                        <div className="edit-menu-section">
                            <div className="edit-section-title">Menu Tersedia</div>
                            
                            {/* Group menu by category for edit modal */}
                            {Object.entries(groupMenuByCategory(menuItems)).map(([category, categoryItems]) => (
                                <div key={category} className="edit-menu-category-section" style={{marginBottom: '25px', border: '2px solid #27ae60', borderRadius: '10px', overflow: 'hidden'}}>
                                    <h3 className="edit-category-title" style={{background: '#f8f9fa', padding: '12px 20px', margin: '0', borderBottom: '1px solid #e0e0e0', textTransform: 'uppercase', fontWeight: 'bold'}}>{getCategoryDisplayName(category)}</h3>
                                    
                                    <div 
                                        className="edit-menu-category-content"
                                        style={{
                                            display: 'grid',
                                            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                                            gap: '15px',
                                            padding: '20px',
                                            background: '#f1f3f4',
                                            border: '2px dashed #ff6b6b'
                                        }}
                                    >
                                        {categoryItems.map((item, index) => {
                                            if (!item || !item.id_menu) return null;
                                            
                                            const currentOptions = editOrderItemSelections[item.id_menu] || { spiciness: '', temperature: '' };
                                            const currentQuantityInCart = findEditOrderCartItem(item.id_menu, currentOptions)?.quantity || 0;

                                            return (
                                                <div 
                                                    key={item.id_menu} 
                                                    className={`edit-menu-item ${currentQuantityInCart > 0 ? 'selected' : ''}`}
                                                    style={{
                                                        display: 'flex',
                                                        flexDirection: 'column',
                                                        padding: '15px',
                                                        background: currentQuantityInCart > 0 ? '#e8f4fd' : 'white',
                                                        borderRadius: '10px',
                                                        border: `2px solid ${currentQuantityInCart > 0 ? '#3498db' : '#e0e0e0'}`,
                                                        minHeight: '160px',
                                                        cursor: 'pointer',
                                                        transition: 'all 0.2s ease',
                                                        position: 'relative',
                                                        gap: '10px'
                                                    }}
                                                >
                                                    <div className="edit-menu-item-header" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px'}}>
                                                        <span className="edit-menu-item-name" style={{fontWeight: '600', color: '#2c3e50', fontSize: '0.95em', flex: '1', marginRight: '8px'}}>{item.name || 'Unknown Item'}</span>
                                                        <span className="edit-menu-item-price" style={{color: '#27ae60', fontWeight: 'bold', fontSize: '0.95em', whiteSpace: 'nowrap'}}>Rp {formatPrice(item.price)}</span>
                                                    </div>

                                                    {item.category && item.category.startsWith('menu mie') && (
                                                        <div className="edit-item-options-group" style={{margin: '8px 0', padding: '8px', background: '#f9f9f9', borderRadius: '6px', border: '1px solid #e0e0e0'}}>
                                                            <p className="edit-option-label" style={{fontWeight: '600', color: '#2c3e50', marginBottom: '6px', fontSize: '0.85em'}}>Kepedasan:</p>
                                                            <div className="edit-radio-group" style={{display: 'flex', flexDirection: 'column', gap: '6px'}}>
                                                                <label style={{display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.8em', padding: '4px 8px', borderRadius: '12px', background: 'white', border: '1px solid #ddd'}}>
                                                                    <input 
                                                                        type="radio" 
                                                                        name={`edit-spiciness-${item.id_menu}`} 
                                                                        value="tidak pedas" 
                                                                        checked={currentOptions.spiciness === 'tidak pedas'} 
                                                                        onChange={() => handleEditOrderOptionChange(item.id_menu, 'spiciness', 'tidak pedas')} 
                                                                    /> Tidak Pedas
                                                                </label>
                                                                <label style={{display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.8em', padding: '4px 8px', borderRadius: '12px', background: 'white', border: '1px solid #ddd'}}>
                                                                    <input 
                                                                        type="radio" 
                                                                        name={`edit-spiciness-${item.id_menu}`} 
                                                                        value="pedas sedang" 
                                                                        checked={currentOptions.spiciness === 'pedas sedang'} 
                                                                        onChange={() => handleEditOrderOptionChange(item.id_menu, 'spiciness', 'pedas sedang')} 
                                                                    /> Pedas Sedang
                                                                </label>
                                                                <label style={{display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.8em', padding: '4px 8px', borderRadius: '12px', background: 'white', border: '1px solid #ddd'}}>
                                                                    <input 
                                                                        type="radio" 
                                                                        name={`edit-spiciness-${item.id_menu}`} 
                                                                        value="pedas" 
                                                                        checked={currentOptions.spiciness === 'pedas'} 
                                                                        onChange={() => handleEditOrderOptionChange(item.id_menu, 'spiciness', 'pedas')} 
                                                                    /> Pedas
                                                                </label>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {item.category && item.category.startsWith('minuman') && (
                                                        <div className="edit-item-options-group" style={{margin: '8px 0', padding: '8px', background: '#f9f9f9', borderRadius: '6px', border: '1px solid #e0e0e0'}}>
                                                            <p className="edit-option-label" style={{fontWeight: '600', color: '#2c3e50', marginBottom: '6px', fontSize: '0.85em'}}>Suhu:</p>
                                                            <div className="edit-radio-group" style={{display: 'flex', flexDirection: 'column', gap: '6px'}}>
                                                                <label style={{display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.8em', padding: '4px 8px', borderRadius: '12px', background: 'white', border: '1px solid #ddd'}}>
                                                                    <input 
                                                                        type="radio" 
                                                                        name={`edit-temperature-${item.id_menu}`} 
                                                                        value="dingin" 
                                                                        checked={currentOptions.temperature === 'dingin'} 
                                                                        onChange={() => handleEditOrderOptionChange(item.id_menu, 'temperature', 'dingin')} 
                                                                    /> Dingin
                                                                </label>
                                                                <label style={{display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.8em', padding: '4px 8px', borderRadius: '12px', background: 'white', border: '1px solid #ddd'}}>
                                                                    <input 
                                                                        type="radio" 
                                                                        name={`edit-temperature-${item.id_menu}`} 
                                                                        value="tidak dingin" 
                                                                        checked={currentOptions.temperature === 'tidak dingin'} 
                                                                        onChange={() => handleEditOrderOptionChange(item.id_menu, 'temperature', 'tidak dingin')} 
                                                                    /> Tidak Dingin
                                                                </label>
                                                            </div>
                                                        </div>
                                                    )}

                                                    <div className="edit-quantity-controls" style={{display: 'flex', alignItems: 'center', gap: '8px', marginTop: 'auto', justifyContent: 'center'}}>
                                                        <button
                                                            className="edit-qty-btn"
                                                            onClick={() => removeItemFromEditOrderCart({ id_menu: item.id_menu, options: currentOptions })}
                                                            disabled={currentQuantityInCart === 0}
                                                            style={{
                                                                width: '32px',
                                                                height: '32px',
                                                                border: '1px solid #ddd',
                                                                background: 'white',
                                                                borderRadius: '50%',
                                                                fontSize: '1em',
                                                                fontWeight: 'bold',
                                                                cursor: currentQuantityInCart === 0 ? 'not-allowed' : 'pointer',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                opacity: currentQuantityInCart === 0 ? 0.5 : 1
                                                            }}
                                                        >
                                                            -
                                                        </button>
                                                        <span className="edit-qty-display" style={{fontSize: '1em', fontWeight: 'bold', color: '#2c3e50', minWidth: '24px', textAlign: 'center', padding: '6px', background: '#f8f9fa', borderRadius: '6px', border: '1px solid #e0e0e0'}}>{currentQuantityInCart}</span>
                                                        <button
                                                            className="edit-qty-btn"
                                                            onClick={() => addItemToEditOrderCart(item)}
                                                            style={{
                                                                width: '32px',
                                                                height: '32px',
                                                                border: '1px solid #ddd',
                                                                background: 'white',
                                                                borderRadius: '50%',
                                                                fontSize: '1em',
                                                                fontWeight: 'bold',
                                                                cursor: 'pointer',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center'
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
                            ))}

                            <div className="edit-note-section">
                                <label htmlFor="editOrderNote" className="edit-section-title">Catatan Pesanan:</label>
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
                                        editOrderCart.map((item, index) => {
                                            if (!item) return null;
                                            const itemKey = `${item.id_menu || 'unknown'}-${item.options?.spiciness || ''}-${item.options?.temperature || ''}-${index}`;
                                            return (
                                                <div key={itemKey} className="edit-summary-item">
                                                    <span>{item.quantity || 0}x {item.name || 'Unknown Item'}</span>
                                                    <span>Rp {formatPrice((item.price || 0) * (item.quantity || 0))}</span>
                                                    {(item.options?.spiciness || item.options?.temperature) && (
                                                        <div className="edit-summary-options">
                                                            {item.options.spiciness && <span>({item.options.spiciness})</span>}
                                                            {item.options.temperature && <span>({item.options.temperature})</span>}
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

            {/* Modal Tambah Pesanan untuk Kasir */}
            {isAddOrderModalOpen && (
                <div className="add-order-modal-overlay">
                    <div className="add-order-container">
                        <div className="add-order-header">
                            <button className="back-btn" onClick={() => {
                                setIsAddOrderModalOpen(false);
                                setNewOrderCustomerName('');
                                setNewOrderCart([]);
                                const resetSelections = {};
                                menuItems.forEach(item => {
                                    if (item && item.id_menu) {
                                        resetSelections[item.id_menu] = { spiciness: '', temperature: '' };
                                    }
                                });
                                setNewOrderItemSelections(resetSelections);
                            }}>←</button>
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
                            
                            {/* Group menu by category */}
                            {Object.entries(groupMenuByCategory(menuItems)).map(([category, categoryItems]) => (
                                <div key={category} className="add-menu-category-section">
                                    <h3 className="add-category-title">{getCategoryDisplayName(category)}</h3>
                                    
                                    {categoryItems.map((item, index) => {
                                        if (!item || !item.id_menu) return null;
                                        
                                        const currentOptions = newOrderItemSelections[item.id_menu] || { spiciness: '', temperature: '' };
                                        const currentQuantityInCart = findNewOrderCartItem(item.id_menu, currentOptions)?.quantity || 0;

                                        return (
                                            <div key={item.id_menu} className={`add-menu-item ${currentQuantityInCart > 0 ? 'selected' : ''}`}>
                                                <div className="add-menu-item-header">
                                                    <span className="add-menu-item-name">{item.name || 'Unknown Item'}</span>
                                                    <span className="add-menu-item-price">Rp {formatPrice(item.price)}</span>
                                                </div>

                                                {item.category && item.category.startsWith('menu mie') && (
                                                    <div className="add-item-options-group">
                                                        <p className="add-option-label">Kepedasan:</p>
                                                        <div className="add-radio-group">
                                                            <label>
                                                                <input 
                                                                    type="radio" 
                                                                    name={`add-spiciness-${item.id_menu}`} 
                                                                    value="tidak pedas" 
                                                                    checked={currentOptions.spiciness === 'tidak pedas'} 
                                                                    onChange={() => handleNewOrderOptionChange(item.id_menu, 'spiciness', 'tidak pedas')} 
                                                                /> Tidak Pedas
                                                            </label>
                                                            <label>
                                                                <input 
                                                                    type="radio" 
                                                                    name={`add-spiciness-${item.id_menu}`} 
                                                                    value="pedas sedang" 
                                                                    checked={currentOptions.spiciness === 'pedas sedang'} 
                                                                    onChange={() => handleNewOrderOptionChange(item.id_menu, 'spiciness', 'pedas sedang')} 
                                                                /> Pedas Sedang
                                                            </label>
                                                            <label>
                                                                <input 
                                                                    type="radio" 
                                                                    name={`add-spiciness-${item.id_menu}`} 
                                                                    value="pedas" 
                                                                    checked={currentOptions.spiciness === 'pedas'} 
                                                                    onChange={() => handleNewOrderOptionChange(item.id_menu, 'spiciness', 'pedas')} 
                                                                /> Pedas
                                                            </label>
                                                        </div>
                                                    </div>
                                                )}

                                                {item.category && item.category.startsWith('minuman') && (
                                                    <div className="add-item-options-group">
                                                        <p className="add-option-label">Suhu:</p>
                                                        <div className="add-radio-group">
                                                            <label>
                                                                <input 
                                                                    type="radio" 
                                                                    name={`add-temperature-${item.id_menu}`} 
                                                                    value="dingin" 
                                                                    checked={currentOptions.temperature === 'dingin'} 
                                                                    onChange={() => handleNewOrderOptionChange(item.id_menu, 'temperature', 'dingin')} 
                                                                /> Dingin
                                                            </label>
                                                            <label>
                                                                <input 
                                                                    type="radio" 
                                                                    name={`add-temperature-${item.id_menu}`} 
                                                                    value="tidak dingin" 
                                                                    checked={currentOptions.temperature === 'tidak dingin'} 
                                                                    onChange={() => handleNewOrderOptionChange(item.id_menu, 'temperature', 'tidak dingin')} 
                                                                /> Tidak Dingin
                                                            </label>
                                                        </div>
                                                    </div>
                                                )}

                                                <div className="add-quantity-controls">
                                                    <button
                                                        className="add-qty-btn"
                                                        onClick={() => removeNewItemFromOrderCart({ id_menu: item.id_menu, options: currentOptions })}
                                                        disabled={currentQuantityInCart === 0}
                                                    >
                                                        -
                                                    </button>
                                                    <span className="add-qty-display">{currentQuantityInCart}</span>
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
                            ))}

                            <div className="add-order-summary">
                                <div className="add-section-title">Ringkasan Pesanan Baru</div>
                                <div className="add-summary-list">
                                    {newOrderCart.length === 0 ? (
                                        <p>Keranjang kosong</p>
                                    ) : (
                                        newOrderCart.map((item, index) => {
                                            if (!item) return null;
                                            const itemKey = `${item.id_menu || 'unknown'}-${item.options?.spiciness || ''}-${item.options?.temperature || ''}-${index}`;
                                            return (
                                                <div key={itemKey} className="add-summary-item">
                                                    <span>{item.quantity || 0}x {item.name || 'Unknown Item'}</span>
                                                    <span>Rp {formatPrice((item.price || 0) * (item.quantity || 0))}</span>
                                                    {(item.options?.spiciness || item.options?.temperature) && (
                                                        <div className="add-summary-options">
                                                            {item.options.spiciness && <span>({item.options.spiciness})</span>}
                                                            {item.options.temperature && <span>({item.options.temperature})</span>}
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
                                    disabled={getNewOrderTotalItems() === 0}
                                >
                                    Buat Pesanan
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