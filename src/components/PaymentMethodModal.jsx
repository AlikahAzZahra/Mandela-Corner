// client/src/components/PaymentMethodModal.jsx
import React from 'react';
import '../styles/PaymentMethodModal.css';

const PaymentMethodModal = ({ isOpen, onClose, onSelectMethod }) => {
    if (!isOpen) return null;

    const handleSelectMethod = (method) => {
        onSelectMethod(method);
    };

    return (
        <div className="payment-modal-overlay">
            <div className="payment-modal-content">
                <button className="close-modal-button" onClick={onClose}>
                    &times;
                </button>
                <h2>Pilih Metode Pembayaran</h2>
                <div className="payment-options">
                    <button 
                        className="payment-option-button cash"
                        onClick={() => handleSelectMethod('bayar di kasir')}
                    >
                        Bayar di Kasir
                    </button>
                    <button 
                        className="payment-option-button online"
                        onClick={() => handleSelectMethod('bayar online')}
                    >
                        Bayar Online (Midtrans)
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PaymentMethodModal;
