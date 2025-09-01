// client/src/pages/MenuPage.jsx - FIXED VERSION (MINIMAL CHANGES)
import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import '../styles/MenuPage.css'; // Import file CSS
import PaymentMethodModal from '../components/PaymentMethodModal'; // Import komponen modal baru
import logo from '../assets/logo.jpeg';

function MenuPage() {
    const { tableNumber } = useParams();
    const [menu, setMenu] = useState([]);
    // Cart sekarang adalah array of objects: [{ id_menu, name, price, quantity, options: { spiciness, temperature } }]
    const [cart, setCart] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    
    // State untuk opsi yang dipilih per item di UI (sementara sebelum ditambahkan ke cart)
    const [itemSelections, setItemSelections] = useState({});

    // State untuk pop-up bayar di kasir (popup lama)
    const [showOrderSuccessPopup, setShowOrderSuccessPopup] = useState(false);
    
    // State untuk pop-up pembayaran online berhasil (popup baru)
    const [showPaymentSuccessPopup, setShowPaymentSuccessPopup] = useState(false);
    const [paymentSuccessData, setPaymentSuccessData] = useState(null);
    
    // State untuk mengontrol tampilan sidebar keranjang
    const [isCartSidebarOpen, setIsCartSidebarOpen] = useState(false);
    
    // State untuk mengontrol modal metode pembayaran
    const [isPaymentMethodModalOpen, setIsPaymentMethodModalOpen] = useState(false);

    const API_BASE_URL = 'https://let-s-pay-server.vercel.app/api';

    // Helper function to clean table number - remove "Meja" prefix if it exists
    const cleanTableNumber = (tableNum) => {
        if (!tableNum) return tableNum;
        // If tableNumber starts with "Meja ", remove it to get just the number
        if (tableNum.toLowerCase().startsWith('meja ')) {
            return tableNum.substring(5); // Remove "Meja " (5 characters)
        }
        return tableNum;
    };

    // 🔧 CRITICAL FIX: Get table number as STRING for API calls
    const getTableNumberForAPI = () => {
        console.log('🔍 getTableNumberForAPI called with tableNumber:', tableNumber, typeof tableNumber);
        
        if (!tableNumber || tableNumber === 'undefined' || tableNumber === undefined) {
            console.log('❌ tableNumber is invalid, defaulting to "1"');
            return '1'; // Default fallback
        }
        
        const cleanedNumber = cleanTableNumber(tableNumber);
        console.log('🔍 cleanedNumber after cleaning:', cleanedNumber);
        
        if (!cleanedNumber || cleanedNumber === 'undefined') {
            console.log('❌ cleanedNumber is invalid, defaulting to "1"');
            return '1'; // Default fallback
        }
        
        const result = String(cleanedNumber);
        console.log('✅ Final table number for API:', result);
        return result;
    };

    // Fungsi untuk memformat harga ke format Rupiah (tanpa desimal)
    const formatPrice = (price) => {
        if (price == null || isNaN(price)) return '0';
        const numPrice = Number(price);
        return new Intl.NumberFormat('id-ID', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(numPrice);
    };

    // Fungsi untuk mengambil menu dari backend - FIXED
    const fetchMenu = async () => {
        try {
            console.log('🔍 Fetching menu from:', `${API_BASE_URL}/menu`);
            setLoading(true);
            setError(null);
            
            const response = await fetch(`${API_BASE_URL}/menu`, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                }
            });
            
            console.log('📡 Response status:', response.status);
            console.log('📡 Response headers:', response.headers);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status} - ${response.statusText}`);
            }
            
            const data = await response.json();
            console.log('📦 Menu data received:', data);
            console.log('📊 Number of menu items:', data?.length || 0);
            
            if (!Array.isArray(data)) {
                console.error('❌ Menu data is not an array:', typeof data);
                throw new Error('Data menu tidak valid dari server');
            }
            
            setMenu(data);
            
            // Inisialisasi itemSelections untuk setiap menu item
            const initialSelections = {};
            data.forEach(item => {
                if (item && item.id_menu) {
                    initialSelections[item.id_menu] = { spiciness: '', temperature: '' };
                }
            });
            setItemSelections(initialSelections);
            
            console.log('✅ Menu successfully loaded:', data.length, 'items');
            
        } catch (err) {
            console.error('❌ Error fetching menu:', err);
            setError(`Gagal memuat menu: ${err.message}`);
            setMenu([]); // Set empty array on error
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        console.log('🚀 MenuPage mounted, fetching menu...');
        fetchMenu();
        
        // Debug Midtrans Snap availability
        console.log('Midtrans Snap available:', !!window.snap);
        if (window.snap) {
            console.log('Snap object:', typeof window.snap);
            console.log('Snap.pay function:', typeof window.snap.pay);
        }
    }, []);

    // PATCH: Kunci/unlock scroll body saat keranjang atau modal/popup terbuka
    useEffect(() => {
        const open =
            isCartSidebarOpen ||
            isPaymentMethodModalOpen ||
            showOrderSuccessPopup ||
            showPaymentSuccessPopup;

        // toggle class (kalau CSS menambahkan body.cart-open { overflow:hidden; })
        document.body.classList.toggle('cart-open', open);

        // hard-lock juga via style supaya aman walau CSS belum ditambah
        const prevOverflow = document.body.style.overflow;
        if (open) document.body.style.overflow = 'hidden';
        else document.body.style.overflow = prevOverflow || '';

        return () => {
            document.body.classList.remove('cart-open');
            document.body.style.overflow = '';
        };
    }, [isCartSidebarOpen, isPaymentMethodModalOpen, showOrderSuccessPopup, showPaymentSuccessPopup]);

    // Fungsi untuk menangani perubahan opsi (pedas/dingin)
    const handleOptionChange = (itemId, optionType, value) => {
        setItemSelections(prevSelections => ({
            ...prevSelections,
            [itemId]: {
                ...prevSelections[itemId],
                [optionType]: value
            }
        }));
    };

    // Helper function to find an item in the cart based on its ID and options
    const findCartItem = (itemId, options) => {
        return cart.find(cartItem =>
            cartItem.id_menu === itemId &&
            cartItem.options.spiciness === (options.spiciness || '') &&
            cartItem.options.temperature === (options.temperature || '')
        );
    };

    // Fungsi untuk menambahkan item ke keranjang
    const addToCart = (itemToAdd) => {
        console.log('=== ADD TO CART DEBUG ===');
        console.log('Adding item to cart:', itemToAdd);
        console.log('Item JSON:', JSON.stringify(itemToAdd, null, 2));
        
        // Check for any boolean values in the menu item
        Object.entries(itemToAdd).forEach(([key, value]) => {
            console.log(`itemToAdd.${key}:`, value, `(type: ${typeof value})`);
            if (typeof value === 'boolean') {
                console.warn(`🚨 Boolean detected in menu item: ${key} = ${value}`);
            }
        });
        
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
                const updatedCart = prevCart.map(cartItem =>
                    cartItem === existingCartItem
                        ? { ...cartItem, quantity: cartItem.quantity + 1 }
                        : cartItem
                );
                console.log('Updated cart with existing item:', updatedCart);
                return updatedCart;
            } else {
                // Create ONLY the fields we need, NO EXTRA FIELDS from menu item
                const newCartItem = {
                    id_menu: itemToAdd.id_menu,      // Keep original type from menu
                    name: itemToAdd.name,            // String
                    price: itemToAdd.price,          // Keep original type from menu  
                    quantity: 1,                     // Number
                    options: { ...optionsForThisItem } // Object with strings
                };
                
                console.log('New cart item created:', newCartItem);
                console.log('New cart item JSON:', JSON.stringify(newCartItem, null, 2));
                
                // Verify no boolean values in cart item
                Object.entries(newCartItem).forEach(([key, value]) => {
                    if (typeof value === 'boolean') {
                        console.error(`🚨 BOOLEAN in new cart item: ${key} = ${value}`);
                    }
                });
                
                const newCart = [...prevCart, newCartItem];
                console.log('New cart array:', newCart);
                return newCart;
            }
        });
        setIsCartSidebarOpen(true);
    };

    const removeFromCart = (itemInCart) => {
        setCart(prevCart => {
            const existingCartItem = findCartItem(itemInCart.id_menu, itemInCart.options);

            if (existingCartItem) {
                if (existingCartItem.quantity > 1) {
                    const updatedCart = prevCart.map(cartItem =>
                        cartItem === existingCartItem
                            ? { ...cartItem, quantity: cartItem.quantity - 1 }
                            : cartItem
                    );
                    return updatedCart;
                } else {
                    const newCart = prevCart.filter(cartItem => cartItem !== existingCartItem);
                    if (newCart.length === 0) {
                        setIsCartSidebarOpen(false);
                    }
                    return newCart;
                }
            }
            return prevCart;
        });
    };

    const getTotalItemsInCart = () => {
        return cart.reduce((sum, item) => sum + item.quantity, 0);
    };

    const getTotalPrice = () => {
        return cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    };

    // 🔧 MAIN FIX: PROCESSORDER FUNCTION WITH TYPE-SAFE TABLENUMBER
    const processOrder = async (paymentMethod) => {
        if (getTotalItemsInCart() === 0) {
            alert('Keranjang belanja kosong! Silakan pilih item terlebih dahulu.');
            return;
        }

        console.log('=== DEBUGGING ORDER PROCESS WITH TYPE-SAFE FIX ===');
        console.log('Raw cart data:', cart);
        console.log('Cart JSON:', JSON.stringify(cart, null, 2));

        // FIXED: Sanitize ALL data very strictly - NO BOOLEANS OR EXTRA FIELDS
        const orderItemsForBackend = cart.map((item, index) => {
            console.log(`Processing cart item ${index}:`, item);
            
            // Create completely clean object with ONLY the exact fields needed
            // Ensure NO boolean values or unexpected fields are included
            const cleanItem = {
                id_menu: Number(item.id_menu),
                quantity: Number(item.quantity),
                spiciness_level: (item.options?.spiciness && item.options.spiciness !== '') ? String(item.options.spiciness) : null,
                temperature_level: (item.options?.temperature && item.options.temperature !== '') ? String(item.options.temperature) : null
            };
            
            // Validate that we only have the expected fields
            const allowedFields = ['id_menu', 'quantity', 'spiciness_level', 'temperature_level'];
            Object.keys(cleanItem).forEach(key => {
                if (!allowedFields.includes(key)) {
                    console.warn(`🚨 Unexpected field in cleanItem: ${key}`);
                    delete cleanItem[key];
                }
            });
            
            console.log(`Clean item ${index}:`, cleanItem);
            console.log(`Clean item ${index} types:`, {
                id_menu: typeof cleanItem.id_menu,
                quantity: typeof cleanItem.quantity,
                spiciness_level: typeof cleanItem.spiciness_level,
                temperature_level: typeof cleanItem.temperature_level
            });
            
            // Double-check for any boolean values
            Object.entries(cleanItem).forEach(([key, value]) => {
                if (typeof value === 'boolean') {
                    console.error(`🚨 BOOLEAN DETECTED in cleanItem[${key}]:`, value);
                    throw new Error(`Boolean value detected in order data: ${key} = ${value}`);
                }
            });
            
            return cleanItem;
        });

        // 🔧 CRITICAL FIX: Use STRING table number - NO NUMBER CONVERSION!
        const tableNumberForAPI = getTableNumberForAPI(); // This now returns STRING
        
        console.log('=== CRITICAL TABLE NUMBER FIX ===');
        console.log('Original tableNumber from params:', tableNumber, typeof tableNumber);
        console.log('Cleaned tableNumber:', tableNumberForAPI, typeof tableNumberForAPI);
        console.log('Table number is STRING:', typeof tableNumberForAPI === 'string');
        
        // Ensure it's definitely a string
        if (typeof tableNumberForAPI !== 'string') {
            console.error('🚨 Table number is not string after cleaning:', tableNumberForAPI);
            alert('Error: Nomor meja harus berupa teks.');
            return;
        }
        
        console.log('✅ Table number validation passed - using STRING:', tableNumberForAPI);
        console.log('Clean order items:', orderItemsForBackend);
        
        // Additional safety check for the entire order data
        console.log('=== FINAL ORDER DATA VALIDATION ===');
        const fullOrderPreview = {
            tableNumber: tableNumberForAPI, // ✅ STRING!
            items: orderItemsForBackend
        };
        
        // Check for any boolean values in the entire structure
        const checkForBooleans = (obj, path = '') => {
            Object.entries(obj).forEach(([key, value]) => {
                const currentPath = path ? `${path}.${key}` : key;
                if (typeof value === 'boolean') {
                    console.error(`🚨 BOOLEAN FOUND AT ${currentPath}:`, value);
                    throw new Error(`Boolean value found in order data at ${currentPath}: ${value}`);
                } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                    checkForBooleans(value, currentPath);
                } else if (Array.isArray(value)) {
                    value.forEach((item, index) => {
                        if (typeof item === 'object' && item !== null) {
                            checkForBooleans(item, `${currentPath}[${index}]`);
                        } else if (typeof item === 'boolean') {
                            console.error(`🚨 BOOLEAN FOUND AT ${currentPath}[${index}]:`, item);
                            throw new Error(`Boolean value found in order data at ${currentPath}[${index}]: ${item}`);
                        }
                    });
                }
            });
        };
        
        try {
            checkForBooleans(fullOrderPreview);
            console.log('✅ No boolean values detected in order data');
        } catch (error) {
            console.error('❌ Boolean validation failed:', error);
            alert('Terjadi kesalahan dalam data pesanan: ' + error.message);
            return;
        }

        if (paymentMethod === 'bayar online') {
            // Check if Midtrans Snap is available with better error handling
            console.log('Checking Midtrans Snap availability...');
            console.log('window.snap:', !!window.snap);
            
            if (typeof window === 'undefined') {
                alert('Browser tidak mendukung sistem pembayaran online.');
                return;
            }
            
            if (!window.snap) {
                console.error('Midtrans Snap not loaded. Window object:', window);
                console.error('Available scripts:', document.querySelectorAll('script[src*="snap"]'));
                alert('Sistem pembayaran belum siap. Pastikan koneksi internet stabil dan refresh halaman.');
                return;
            }
            
            if (typeof window.snap.pay !== 'function') {
                console.error('snap.pay is not a function:', typeof window.snap.pay);
                alert('Sistem pembayaran tidak berfungsi dengan benar. Silakan refresh halaman.');
                return;
            }

            // For online payment, create the Midtrans transaction first
            try {
                // Generate a temporary order ID for Midtrans
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
                    // Add table number and order items to custom data
                    custom_field1: String(getTableNumberForAPI()), // ✅ FIX: Call function properly!
                    custom_field2: JSON.stringify(orderItemsForBackend)
                };
                
                console.log('Sending transaction data to Midtrans:', transactionData);
                
                const midtransResponse = await fetch(`${API_BASE_URL}/midtrans/transaction`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(transactionData)
                });
                
                if (!midtransResponse.ok) {
                    let errorMessage = 'Gagal membuat transaksi Midtrans.';
                    try {
                        const errorData = await midtransResponse.json();
                        errorMessage = errorData.message || errorData.error || errorMessage;
                        console.error('Midtrans error details:', errorData);
                    } catch (parseError) {
                        console.error('Failed to parse Midtrans error response');
                        const textError = await midtransResponse.text();
                        console.error('Raw error response:', textError);
                        errorMessage = `Server error (${midtransResponse.status}): ${textError}`;
                    }
                    throw new Error(errorMessage);
                }
                
                const midtransData = await midtransResponse.json();
                console.log('Midtrans transaction created:', midtransData);
                
                // Only proceed with Snap payment if Midtrans transaction was successful
                window.snap.pay(midtransData.token, {
                    onSuccess: async function(result) {
                        console.log('Payment success:', result);
                        
                        // Now create the actual order since payment was successful
                        try {
                            // Create completely clean payload - NO EXTRA FIELDS
                            const orderPayload = {
                                tableNumber: String(getTableNumberForAPI()), // ✅ FIX: Call function properly!
                                items: orderItemsForBackend,
                                payment_status: 'Sudah Bayar',
                                payment_method: 'midtrans',
                                midtrans_order_id: tempOrderId,
                                midtrans_transaction_id: result.transaction_id
                            };

                            console.log('=== ONLINE PAYMENT ORDER PAYLOAD ===');
                            console.log('Payload:', orderPayload);
                            console.log('Payload JSON:', JSON.stringify(orderPayload, null, 2));

                            const orderResponse = await fetch(`${API_BASE_URL}/orders`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify(orderPayload)
                            });
                            
                            if (!orderResponse.ok) {
                                const errorData = await orderResponse.json();
                                console.error('Error creating order after successful payment:', errorData);
                                alert('Pembayaran berhasil, tetapi terjadi kesalahan saat menyimpan pesanan. Silakan hubungi staff.');
                                return;
                            }
                            
                            const orderData = await orderResponse.json();
                            console.log('Order created successfully after payment with ID:', orderData.orderId);
                            
                            // TAMPILKAN POPUP PEMBAYARAN ONLINE BERHASIL (bukan popup biasa)
                            setPaymentSuccessData({
                                orderId: orderData.orderId,
                                totalAmount: getTotalPrice(),
                                transactionId: result.transaction_id,
                                paymentType: result.payment_type || 'Online Payment',
                                status: 'success'
                            });
                            setShowPaymentSuccessPopup(true); // Popup khusus untuk pembayaran online
                            
                            // Reset cart dan form
                            setCart([]);
                            const resetSelections = {};
                            menu.forEach(item => {
                                resetSelections[item.id_menu] = { spiciness: '', temperature: '' };
                            });
                            setItemSelections(resetSelections);
                            setIsCartSidebarOpen(false);
                            
                        } catch (orderError) {
                            console.error('Error creating order after successful payment:', orderError);
                            alert('Pembayaran berhasil, tetapi terjadi kesalahan saat menyimpan pesanan. Silakan hubungi staff.');
                        }
                    },
                    onPending: async function(result) {
                        console.log('Payment pending:', result);
                        
                        // Create order with pending status
                        try {
                            // Create completely clean payload - NO EXTRA FIELDS
                            const orderPayload = {
                                tableNumber: String(getTableNumberForAPI()), // ✅ FIX: Call function properly!
                                items: orderItemsForBackend,
                                payment_status: 'Pending',
                                payment_method: 'midtrans',
                                midtrans_order_id: tempOrderId,
                                midtrans_transaction_id: result.transaction_id
                            };

                            console.log('=== PENDING PAYMENT ORDER PAYLOAD ===');
                            console.log('Payload:', orderPayload);

                            const orderResponse = await fetch(`${API_BASE_URL}/orders`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify(orderPayload)
                            });
                            
                            if (orderResponse.ok) {
                                const orderData = await orderResponse.json();
                                console.log('Order created with pending status, ID:', orderData.orderId);
                                
                                // TAMPILKAN POPUP PENDING PAYMENT
                                setPaymentSuccessData({
                                    orderId: orderData.orderId,
                                    totalAmount: getTotalPrice(),
                                    transactionId: result.transaction_id,
                                    paymentType: result.payment_type || 'Online Payment',
                                    status: 'pending'
                                });
                                setShowPaymentSuccessPopup(true);
                            } else {
                                const errorData = await orderResponse.json();
                                console.error('Error creating pending order:', errorData);
                            }
                        } catch (orderError) {
                            console.error('Error creating order for pending payment:', orderError);
                        }
                        
                        // Reset cart
                        setCart([]);
                        const resetSelections = {};
                        menu.forEach(item => {
                            resetSelections[item.id_menu] = { spiciness: '', temperature: '' };
                        });
                        setItemSelections(resetSelections);
                        setIsCartSidebarOpen(false);
                    },
                    onError: function(result) {
                        console.log('Payment error:', result);
                        alert("Pembayaran gagal! Silakan coba lagi.");
                    },
                    onClose: function() {
                        console.log('Payment popup closed');
                        alert('Anda menutup pop-up pembayaran tanpa menyelesaikan transaksi.');
                    }
                });

            } catch (error) {
                console.error('Error with Midtrans transaction:', error);
                alert(`Terjadi kesalahan saat memproses pembayaran online: ${error.message}`);
            }

        } else {
            // 🔧 MAIN FIX FOR CASH PAYMENT: Bayar di kasir - create order directly dengan popup lama
            try {
                // Create completely clean payload - NO EXTRA FIELDS, NO BOOLEANS
                const orderPayload = {
                    tableNumber: String(tableNumberForAPI), // ✅ CRITICAL FIX: ALWAYS STRING!
                    items: orderItemsForBackend,
                    payment_status: 'Belum Bayar',
                    payment_method: 'cash'
                };

                console.log('=== CASH ORDER PAYLOAD DEBUG - TYPE SAFE VERSION ===');
                console.log('tableNumber type:', typeof orderPayload.tableNumber);
                console.log('tableNumber value:', orderPayload.tableNumber);
                console.log('Payload object:', orderPayload);
                console.log('Payload JSON string:', JSON.stringify(orderPayload, null, 2));
                
                // Verify no boolean values in payload
                const payloadStr = JSON.stringify(orderPayload);
                if (payloadStr.includes('true') || payloadStr.includes('false')) {
                    console.error('🚨 BOOLEAN VALUES DETECTED IN PAYLOAD JSON!');
                    console.error('Payload string containing booleans:', payloadStr);
                    
                    // Find exactly where the boolean is
                    const lines = payloadStr.split('\n');
                    lines.forEach((line, index) => {
                        if (line.includes('true') || line.includes('false')) {
                            console.error(`Line ${index + 1} contains boolean:`, line);
                        }
                    });
                    
                    alert('Error: Data mengandung nilai boolean yang tidak diperbolehkan');
                    return;
                }
                
                console.log('✅ Payload validated - no booleans detected');
                console.log('✅ Table number is STRING - type safe fix applied');
                
                const orderResponse = await fetch(`${API_BASE_URL}/orders`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(orderPayload)
                });
                
                if (!orderResponse.ok) {
                    const errorData = await orderResponse.json();
                    console.error('❌ DETAILED SERVER ERROR:');
                    console.error('- Status:', orderResponse.status);
                    console.error('- StatusText:', orderResponse.statusText);
                    console.error('- Error Data:', JSON.stringify(errorData, null, 2));
                    console.error('- Error message:', errorData.message);
                    console.error('- Error details:', errorData.error);
                    
                    console.error('❌ REQUEST DETAILS:');
                    console.error('- URL:', `${API_BASE_URL}/orders`);
                    console.error('- Method: POST');
                    console.error('- Headers: Content-Type: application/json');
                    console.error('- Payload:', JSON.stringify(orderPayload, null, 2));
                    
                    // Enhanced error reporting for type mismatch
                    if (errorData.error && errorData.error.includes('operator does not exist')) {
                        console.error('🚨 DATABASE TYPE MISMATCH ERROR CONFIRMED!');
                        console.error('Server error details:', errorData.error);
                        console.error('Current tableNumber being sent:', orderPayload.tableNumber, typeof orderPayload.tableNumber);
                        
                        // Let's also check if it's a different field causing the issue
                        console.error('🔍 CHECKING ALL PAYLOAD FIELDS:');
                        Object.entries(orderPayload).forEach(([key, value]) => {
                            console.error(`- ${key}:`, value, `(${typeof value})`);
                        });
                        
                        // Check items array
                        if (orderPayload.items) {
                            console.error('🔍 CHECKING ITEMS ARRAY:');
                            orderPayload.items.forEach((item, index) => {
                                console.error(`Item ${index}:`, JSON.stringify(item, null, 2));
                                Object.entries(item).forEach(([k, v]) => {
                                    console.error(`  - ${k}:`, v, `(${typeof v})`);
                                });
                            });
                        }
                    }
                    
                    throw new Error(errorData.message || errorData.error || 'Terjadi kesalahan saat mengirim pesanan.');
                }
                
                const orderData = await orderResponse.json();
                console.log('✅ Order created successfully with ID:', orderData.orderId);
                
                // TAMPILKAN POPUP BAYAR DI KASIR (popup lama)
                setShowOrderSuccessPopup(true);
                setCart([]);
                const resetSelections = {};
                menu.forEach(item => {
                    resetSelections[item.id_menu] = { spiciness: '', temperature: '' };
                });
                setItemSelections(resetSelections);
                setIsCartSidebarOpen(false);
                
            } catch (error) {
                console.error('❌ Error placing order:', error);
                
                // Enhanced error message for debugging
                let errorMessage = error.message;
                if (error.message.includes('operator does not exist')) {
                    errorMessage = 'Terjadi kesalahan format data pada server. Silakan coba lagi atau hubungi admin.';
                    console.error('🚨 This is likely the tableNumber type mismatch issue');
                    console.error('Current table number being sent:', tableNumberForAPI, typeof tableNumberForAPI);
                }
                
                alert(`Gagal mengirim pesanan: ${errorMessage}`);
                return;
            }
        }
        setIsPaymentMethodModalOpen(false);
    };
    
    // PATCH: FUNGSI HANDLEPLACEORDERCLICK — tutup keranjang dulu baru buka modal
    const handlePlaceOrderClick = () => {
        if (getTotalItemsInCart() === 0) {
            alert('Keranjang belanja kosong! Silakan pilih item terlebih dahulu.');
            return;
        }
        setIsCartSidebarOpen(false);          // <<— tutup keranjang
        setIsPaymentMethodModalOpen(true);    // <<— buka modal metode pembayaran
    };

    // Handler untuk close popup bayar di kasir (popup lama)
    const handleCloseOrderSuccessPopup = () => {
        setShowOrderSuccessPopup(false);
    };
    
    // Handler untuk close popup pembayaran online (popup baru)
    const handleClosePaymentSuccessPopup = () => {
        setShowPaymentSuccessPopup(false);
        setPaymentSuccessData(null);
    };
    
    const closeCartSidebar = () => {
        setIsCartSidebarOpen(false);
    };

    if (loading) {
        return <div className="menu-message">Memuat menu...</div>;
    }

    if (error) {
        return (
            <div className="menu-message menu-error">
                {error}
                <br />
                <button 
                    onClick={fetchMenu} 
                    style={{
                        marginTop: '10px',
                        padding: '8px 16px',
                        backgroundColor: '#007bff',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer'
                    }}
                >
                    Coba Lagi
                </button>
            </div>
        );
    }

    // FIXED: Boolean comparison for is_available
    const kategoriMenu = {};
    menu.forEach(item => {
        // Fixed boolean comparison - handle both 1/0 and true/false
        const isAvailable = item.is_available === 1 || item.is_available === true;
        if (isAvailable) {
            const categoryKey = item.category;
            if (!kategoriMenu[categoryKey]) {
                kategoriMenu[categoryKey] = [];
            }
            kategoriMenu[categoryKey].push(item);
        }
    });

    const categoriesOrder = [
        'makanan-nasi', 'makanan-pelengkap', 'minuman-kopi', 'minuman-nonkopi',
        'menu mie-banggodrong', 'menu mie-aceh', 'menu mie-toping',
        'camilan-manis', 'camilan-gurih', 'lain-lain'
    ];

    return (
        <div className="menu-page-container">
            {/* Navbar di atas */}
            <nav className="main-navbar">
                <div className="navbar-logo-group">
                    {/* Menggunakan variabel logo yang diimpor */}
                    <img src={logo} alt="Logo Mandela Corner" className="navbar-logo" />
                    <div className="navbar-text">
                        <span className="navbar-app-name">Mandela Corner</span>
                        <span className="navbar-slogan">Pesan makanan & minuman favoritmu!</span>
                    </div>
                </div>
                <button className={`cart-toggle-button ${isCartSidebarOpen ? 'hidden' : ''}`} onClick={() => setIsCartSidebarOpen(true)}>
                    <i className="fa-solid fa-cart-shopping"></i> Keranjang ({getTotalItemsInCart()})
                </button>
            </nav>
            
            {/* Main menu content */}
            <div className="main-menu-content">
                <h1 className="menu-page-title">
                    Menu Restoran {tableNumber ? `(${decodeURIComponent(tableNumber)})` : 'Online'}
                </h1>
                <p className="menu-page-description">
                    Silakan pilih makanan dan minuman Anda. Pembayaran dapat dilakukan di kasir atau online.
                </p>

                {menu.length === 0 && !loading && !error && (
                    <p className="menu-message no-menu-available">
                        Belum ada menu yang tersedia.
                    </p>
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
                                                /* ⬇️ REVISI: gunakan URL gambar langsung dari backend (tanpa prefix server) */
                                                src={item.image_url ? item.image_url : 'https://placehold.co/150x150/CCCCCC/000000?text=No+Image'}
                                                onError={(e) => { 
                                                    e.target.onerror = null; 
                                                    e.target.src = 'https://placehold.co/150x150/CCCCCC/000000?text=No+Image'; 
                                                }} 
                                                alt={item.name} 
                                                className="menu-item-image" 
                                            />
                                            <h3 className="menu-item-name">{item.name}</h3>
                                            <p className="menu-item-description">{item.description || 'Deskripsi tidak tersedia.'}</p>
                                            <p className="menu-item-price">Rp {formatPrice(item.price)}</p>
                                            
                                            {/* Opsi Tingkat Kepedasan untuk MENU MIE */}
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

                                            {/* Opsi Dingin/Tidak Dingin untuk Minuman */}
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
                                                    className="quantity-button remove"
                                                >
                                                    -
                                                </button>
                                                <span className="quantity-display">{currentQuantityInCart}</span>
                                                <button
                                                    onClick={() => addToCart(item)}
                                                    className="quantity-button add"
                                                >
                                                    +
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Sidebar untuk keranjang */}
            <div
                className={`cart-sidebar ${isCartSidebarOpen ? 'open' : ''}`}
                // PATCH: tempelkan di bawah navbar (70px) dan penuhi sisa tinggi viewport
                style={{ top: '70px', height: 'calc(100vh - 70px)' }}
            >
                <div className="cart-sidebar-header">
                    <h3>Keranjang Anda ({getTotalItemsInCart()})</h3>
                    <button onClick={closeCartSidebar} className="close-sidebar-button">&times;</button>
                </div>
                <div className="cart-items">
                    {cart.length === 0 ? (
                        <p className="empty-cart-message">Keranjang Anda kosong.</p>
                    ) : (
                        cart.map((item, index) => (
                            <div key={index} className="cart-item">
                                {/* Remove button di kanan atas */}
                                <button 
                                    onClick={() => removeFromCart(item)} 
                                    className="remove-from-cart-button"
                                    title="Hapus item"
                                >
                                    &times;
                                </button>
                                
                                {/* Top row: Quantity dan Nama sejajar */}
                                <div className="cart-item-top-row">
                                    <div className="cart-item-left">
                                        <span className="cart-item-quantity">{item.quantity}x</span>
                                        <span className="cart-item-name">{item.name}</span>
                                    </div>
                                </div>
                                
                                {/* Harga di bawah nama */}
                                <div className="cart-item-price">
                                    Rp {formatPrice(item.price * item.quantity)}
                                </div>
                                
                                {/* Options di bawah harga (jika ada) */}
                                {(item.options.spiciness || item.options.temperature) && (
                                    <div className="cart-item-options">
                                        {item.options.spiciness && (
                                            <span className="cart-item-option">
                                                {item.options.spiciness}
                                            </span>
                                        )}
                                        {item.options.temperature && (
                                            <span className="cart-item-option">
                                                {item.options.temperature}
                                            </span>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>
                <div className="cart-summary-total">
                    <p>Total: <strong>Rp {formatPrice(getTotalPrice())}</strong></p>
                </div>
                <button
                    onClick={handlePlaceOrderClick}
                    disabled={getTotalItemsInCart() === 0}
                    className="place-order-button"
                >
                    Pesan Sekarang
                </button>
            </div>
            {isCartSidebarOpen && <div className="cart-overlay" onClick={closeCartSidebar}></div>}

            {/* Pop-up metode pembayaran */}
            <PaymentMethodModal
                isOpen={isPaymentMethodModalOpen}
                onClose={() => setIsPaymentMethodModalOpen(false)}
                onSelectMethod={processOrder}
            />

            {/* Pop-up Pesanan Berhasil Dibuat - BAYAR DI KASIR (popup lama) */}
            {showOrderSuccessPopup && (
                <div className="payment-success-overlay">
                    <div className="payment-success-content">
                        <h2 style={{ color: '#28a745', marginBottom: '20px' }}>Pesanan Berhasil Dibuat!</h2>
                        <p style={{ fontSize: '1.1em', color: '#555', marginBottom: '20px' }}>
                            Pesanan Anda telah kami terima dan sedang diproses. Silakan lakukan pembayaran di kasir.
                        </p>
                        <button
                            onClick={handleCloseOrderSuccessPopup}
                            style={{
                                padding: '10px 20px',
                                fontSize: '1em',
                                backgroundColor: '#007bff',
                                color: 'white',
                                border: 'none',
                                borderRadius: '5px',
                                cursor: 'pointer'
                            }}
                        >
                            OK
                        </button>
                    </div>
                </div>
            )}

            {/* POPUP BARU - Pembayaran Online Berhasil/Pending */}
            {showPaymentSuccessPopup && paymentSuccessData && (
                <div className="payment-success-overlay">
                    <div className="payment-success-content">
                        {paymentSuccessData.status === 'pending' ? (
                            // Popup untuk pembayaran pending
                            <>
                                <div style={{ fontSize: '3em', marginBottom: '15px' }}>⏳</div>
                                <h2 style={{ color: '#ffc107', marginBottom: '20px' }}>Pembayaran Sedang Diproses!</h2>
                                <p style={{ fontSize: '1.1em', color: '#555', marginBottom: '15px' }}>
                                    Pembayaran Anda sedang dalam proses verifikasi.
                                </p>
                                <div style={{ 
                                    backgroundColor: '#fff3cd', 
                                    padding: '15px', 
                                    borderRadius: '8px', 
                                    marginBottom: '20px',
                                    border: '1px solid #ffeaa7'
                                }}>
                                    <p style={{ margin: '5px 0', fontSize: '0.9em' }}>
                                        <strong>ID Pesanan:</strong> #{paymentSuccessData.orderId}
                                    </p>
                                    <p style={{ margin: '5px 0', fontSize: '0.9em' }}>
                                        <strong>Total:</strong> Rp {formatPrice(paymentSuccessData.totalAmount)}
                                    </p>
                                    <p style={{ margin: '5px 0', fontSize: '0.9em' }}>
                                        <strong>Metode:</strong> {paymentSuccessData.paymentType}
                                    </p>
                                    <p style={{ margin: '5px 0', fontSize: '0.9em' }}>
                                        <strong>ID Transaksi:</strong> {paymentSuccessData.transactionId}
                                    </p>
                                </div>
                                <p style={{ fontSize: '0.95em', color: '#6c757d', marginBottom: '20px' }}>
                                    Kami akan memproses pesanan Anda setelah pembayaran dikonfirmasi. 
                                    Terima kasih atas kesabaran Anda!
                                </p>
                            </>
                        ) : (
                            // Popup untuk pembayaran berhasil
                            <>
                                <div style={{ fontSize: '3em', marginBottom: '15px' }}>🎉</div>
                                <h2 style={{ color: '#28a745', marginBottom: '20px' }}>Pembayaran Berhasil!</h2>
                                <p style={{ fontSize: '1.1em', color: '#555', marginBottom: '15px' }}>
                                    Terima kasih! Pembayaran Anda telah berhasil dan pesanan sedang diproses.
                                </p>
                                <div style={{ 
                                    backgroundColor: '#d4edda', 
                                    padding: '15px', 
                                    borderRadius: '8px', 
                                    marginBottom: '20px',
                                    border: '1px solid #c3e6cb'
                                }}>
                                    <p style={{ margin: '5px 0', fontSize: '0.9em' }}>
                                        <strong>ID Pesanan:</strong> #{paymentSuccessData.orderId}
                                    </p>
                                    <p style={{ margin: '5px 0', fontSize: '0.9em' }}>
                                        <strong>Total Dibayar:</strong> Rp {formatPrice(paymentSuccessData.totalAmount)}
                                    </p>
                                    <p style={{ margin: '5px 0', fontSize: '0.9em' }}>
                                        <strong>Metode:</strong> {paymentSuccessData.paymentType}
                                    </p>
                                    <p style={{ margin: '5px 0', fontSize: '0.9em' }}>
                                        <strong>ID Transaksi:</strong> {paymentSuccessData.transactionId}
                                    </p>
                                </div>
                                <p style={{ fontSize: '0.95em', color: '#6c757d', marginBottom: '20px' }}>
                                    Pesanan Anda akan segera disiapkan. Silakan menunggu di tempat duduk Anda.
                                </p>
                            </>
                        )}
                        <button
                            onClick={handleClosePaymentSuccessPopup}
                            style={{
                                padding: '12px 24px',
                                fontSize: '1em',
                                backgroundColor: paymentSuccessData.status === 'pending' ? '#ffc107' : '#28a745',
                                color: 'white',
                                border: 'none',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontWeight: 'bold'
                            }}
                        >
                            OK, Mengerti
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

export default MenuPage;