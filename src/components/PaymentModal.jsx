import React, { useState, useEffect } from 'react';
import '../styles/PaymentModal.css';

const PaymentModal = ({ isOpen, onClose, orderId, totalAmount, onPaymentConfirmed }) => {
    const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('cash');
    const [isProcessing, setIsProcessing] = useState(false);
    const [cashReceived, setCashReceived] = useState('');
    const [change, setChange] = useState(0);

    const API_BASE_URL = 'http://localhost:5000/api';

    // Reset state saat modal dibuka/tutup
    useEffect(() => {
        if (isOpen) {
            setSelectedPaymentMethod('cash');
            setCashReceived('');
            setChange(0);
            setIsProcessing(false);
        }
    }, [isOpen]);

    // Hitung kembalian
    useEffect(() => {
        const received = parseFloat(cashReceived) || 0;
        const changeAmount = received - totalAmount;
        setChange(changeAmount > 0 ? changeAmount : 0);
    }, [cashReceived, totalAmount]);

    // Fungsi untuk memformat harga ke format Rupiah
    const formatPrice = (price) => {
        return new Intl.NumberFormat('id-ID', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(price);
    };

    // Fungsi untuk proses pembayaran cash
    const handleCashPayment = async () => {
        const received = parseFloat(cashReceived) || 0;
        
        if (received < totalAmount) {
            alert('Uang yang diterima kurang dari total pembayaran!');
            return;
        }

        setIsProcessing(true);
        
        try {
            await onPaymentConfirmed(orderId, 'paid', 'cash');
            
            if (change > 0) {
                alert(`Pembayaran berhasil! Kembalian: Rp ${formatPrice(change)}`);
            } else {
                alert('Pembayaran berhasil!');
            }
            
            onClose();
        } catch (error) {
            console.error('Error processing cash payment:', error);
            alert('Gagal memproses pembayaran cash. Silakan coba lagi.');
        } finally {
            setIsProcessing(false);
        }
    };

    // Fungsi untuk proses pembayaran online via Midtrans
    const handleOnlinePayment = async () => {
        setIsProcessing(true);

        try {
            // Check if Midtrans Snap is available
            if (!window.snap) {
                alert('Sistem pembayaran online belum siap. Pastikan koneksi internet stabil dan refresh halaman.');
                setIsProcessing(false);
                return;
            }

            // Generate temporary order ID untuk Midtrans
            const tempOrderId = `admin_${orderId}_${Date.now()}`;
            
            const transactionData = {
                order_id: tempOrderId,
                gross_amount: totalAmount,
                item_details: [{
                    id: orderId.toString(),
                    name: `Pesanan #${orderId}`,
                    price: totalAmount,
                    quantity: 1
                }],
                customer_details: {
                    first_name: "Customer",
                    email: "customer@example.com",
                    phone: "08123456789"
                }
            };

            console.log('Sending transaction data to Midtrans:', transactionData);

            const response = await fetch(`${API_BASE_URL}/midtrans/transaction`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(transactionData)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Gagal membuat transaksi Midtrans');
            }

            const midtransData = await response.json();
            console.log('Midtrans transaction created:', midtransData);

            // Proses pembayaran via Snap
            window.snap.pay(midtransData.token, {
                onSuccess: async function(result) {
                    console.log('Payment success:', result);
                    
                    try {
                        await onPaymentConfirmed(orderId, 'paid', 'midtrans');
                        alert('Pembayaran online berhasil!');
                        onClose();
                    } catch (error) {
                        console.error('Error updating payment status:', error);
                        alert('Pembayaran berhasil, tetapi gagal update status. Silakan refresh halaman.');
                    }
                },
                
                onPending: async function(result) {
                    console.log('Payment pending:', result);
                    
                    try {
                        await onPaymentConfirmed(orderId, 'Pending', 'midtrans');
                        alert('Pembayaran sedang diproses. Status: Pending');
                        onClose();
                    } catch (error) {
                        console.error('Error updating payment status:', error);
                        alert('Pembayaran pending, tetapi gagal update status. Silakan refresh halaman.');
                    }
                },
                
                onError: function(result) {
                    console.log('Payment error:', result);
                    alert('Pembayaran online gagal! Silakan coba lagi.');
                    setIsProcessing(false);
                },
                
                onClose: function() {
                    console.log('Payment popup closed');
                    alert('Pembayaran dibatalkan.');
                    setIsProcessing(false);
                }
            });

        } catch (error) {
            console.error('Error with online payment:', error);
            alert(`Gagal memproses pembayaran online: ${error.message}`);
            setIsProcessing(false);
        }
    };

    // Fungsi untuk menandai sebagai belum bayar
    const handleUnpaidStatus = async () => {
        setIsProcessing(true);
        
        try {
            await onPaymentConfirmed(orderId, 'unpaid', 'cash');
            alert('Status pembayaran diubah menjadi Belum Bayar.');
            onClose();
        } catch (error) {
            console.error('Error updating payment status:', error);
            alert('Gagal mengubah status pembayaran.');
        } finally {
            setIsProcessing(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="payment-modal-overlay">
            <div className="payment-modal-content">
                <div className="payment-modal-header">
                    <h2>Proses Pembayaran</h2>
                    <button 
                        className="payment-modal-close" 
                        onClick={onClose}
                        disabled={isProcessing}
                    >
                        &times;
                    </button>
                </div>

                <div className="payment-modal-body">
                    <div className="payment-order-info">
                        <p><strong>ID Pesanan:</strong> #{orderId}</p>
                        <p><strong>Total Pembayaran:</strong> <span className="total-amount">Rp {formatPrice(totalAmount)}</span></p>
                    </div>

                    <div className="payment-method-selection">
                        <h3>Pilih Metode Pembayaran:</h3>
                        
                        <div className="payment-method-options">
                            <label className={`payment-method-option ${selectedPaymentMethod === 'cash' ? 'selected' : ''}`}>
                                <input
                                    type="radio"
                                    name="paymentMethod"
                                    value="cash"
                                    checked={selectedPaymentMethod === 'cash'}
                                    onChange={(e) => setSelectedPaymentMethod(e.target.value)}
                                    disabled={isProcessing}
                                />
                                <span className="payment-method-label">💰 Tunai</span>
                            </label>

                            <label className={`payment-method-option ${selectedPaymentMethod === 'qris' ? 'selected' : ''}`}>
                                <input
                                    type="radio"
                                    name="paymentMethod"
                                    value="qris"
                                    checked={selectedPaymentMethod === 'qris'}
                                    onChange={(e) => setSelectedPaymentMethod(e.target.value)}
                                    disabled={isProcessing}
                                />
                                <span className="payment-method-label">📱 (Online)</span>
                            </label>
                        </div>
                    </div>

                    {/* Form untuk pembayaran cash */}
                    {selectedPaymentMethod === 'cash' && (
                        <div className="cash-payment-form">
                            <div className="cash-input-group">
                                <label htmlFor="cashReceived">Uang Diterima:</label>
                                <input
                                    type="number"
                                    id="cashReceived"
                                    value={cashReceived}
                                    onChange={(e) => setCashReceived(e.target.value)}
                                    placeholder="Masukkan jumlah uang yang diterima"
                                    className="cash-input"
                                    disabled={isProcessing}
                                />
                            </div>
                            
                            {cashReceived && (
                                <div className="cash-calculation">
                                    <p><strong>Total Pembayaran:</strong> Rp {formatPrice(totalAmount)}</p>
                                    <p><strong>Uang Diterima:</strong> Rp {formatPrice(parseFloat(cashReceived) || 0)}</p>
                                    <p className={`change-amount ${change > 0 ? 'positive' : change < 0 ? 'negative' : ''}`}>
                                        <strong>Kembalian:</strong> Rp {formatPrice(change)}
                                        {parseFloat(cashReceived) < totalAmount && <span className="insufficient"> (Kurang!)</span>}
                                    </p>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="payment-modal-footer">
                    <button
                        className="payment-cancel-button"
                        onClick={onClose}
                        disabled={isProcessing}
                    >
                        Batal
                    </button>

                    <button
                        className="payment-confirm-button"
                        onClick={() => {
                            if (selectedPaymentMethod === 'cash') {
                                handleCashPayment();
                            } else if (selectedPaymentMethod === 'qris') {
                                handleOnlinePayment();
                            } else if (selectedPaymentMethod === 'unpaid') {
                                handleUnpaidStatus();
                            }
                        }}
                        disabled={
                            isProcessing || 
                            (selectedPaymentMethod === 'cash' && (parseFloat(cashReceived) < totalAmount || !cashReceived))
                        }
                    >
                        {isProcessing ? 'Memproses...' : 
                         selectedPaymentMethod === 'cash' ? 'Konfirmasi Pembayaran Tunai' :
                         selectedPaymentMethod === 'qris' ? 'Proses Pembayaran QRIS' :
                         'Tandai Belum Bayar'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PaymentModal;