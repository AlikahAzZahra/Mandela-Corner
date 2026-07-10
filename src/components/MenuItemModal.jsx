// client/src/components/MenuItemModal.jsx
import React, { useState, useEffect } from 'react';
import '../styles/MenuItemModal.css';

const MenuItemModal = ({ item, isOpen, onClose, onAddToCart }) => {
  const [selectedOptions, setSelectedOptions] = useState({
    temperature: '',
    sugarLevel: '',
    iceLevel: '',
    spiciness: '',
    notes: '',
  });
  const [quantity, setQuantity] = useState(1);

  // errors: field -> true kalau field itu wajib diisi & belum dipilih
  const [errors, setErrors] = useState({
    spiciness: false,
    temperature: false,
    sugarLevel: false,
    iceLevel: false,
  });

  // Reset state setiap kali modal dibuka dengan item baru
  useEffect(() => {
    if (isOpen && item) {
      setSelectedOptions({
        temperature: '',
        sugarLevel: '',
        iceLevel: '',
        spiciness: '',
        notes: '',
      });
      setQuantity(1);
      setErrors({ spiciness: false, temperature: false, sugarLevel: false, iceLevel: false });
    }
  }, [isOpen, item]);

  if (!isOpen || !item) return null;

  const isMinuman = item.category && item.category.startsWith('minuman');
  const isMie = item.category && item.category.startsWith('menu mie');

  const formatPrice = (price) => {
    if (price == null || isNaN(price)) return '0';
    return new Intl.NumberFormat('id-ID', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(Number(price));
  };

  const handleOptionChange = (optionType, value) => {
    setSelectedOptions((prev) => {
      const next = { ...prev, [optionType]: value };
      // Kalau ganti suhu jadi "tidak dingin", kosongkan pilihan es yang mungkin sudah dipilih
      if (optionType === 'temperature' && value === 'tidak dingin') {
        next.iceLevel = '';
      }
      return next;
    });
    // Hapus warning begitu pelanggan memilih opsi itu
    setErrors((prev) => {
      const next = prev[optionType] ? { ...prev, [optionType]: false } : prev;
      // Kalau ganti ke "tidak dingin", warning tingkat es juga tidak relevan lagi
      if (optionType === 'temperature' && value === 'tidak dingin' && next.iceLevel) {
        return { ...next, iceLevel: false };
      }
      return next;
    });
  };

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  const handleAddToCart = () => {
    // Validasi wajib -> tampilkan warning inline, jangan pakai alert()
    const nextErrors = {
      spiciness: isMie && !selectedOptions.spiciness,
      temperature: isMinuman && !selectedOptions.temperature,
      sugarLevel: isMinuman && !selectedOptions.sugarLevel,
      iceLevel: isMinuman && selectedOptions.temperature === 'dingin' && !selectedOptions.iceLevel,
    };

    const hasError = Object.values(nextErrors).some(Boolean);
    if (hasError) {
      setErrors(nextErrors);
      return;
    }

    onAddToCart({
      ...item,
      quantity,
      options: {
        spiciness: selectedOptions.spiciness || '',
        temperature: selectedOptions.temperature || '',
        sugar: selectedOptions.sugarLevel || '',
        ice: selectedOptions.iceLevel || '',
        notes: selectedOptions.notes || '',
      },
    });
    onClose();
  };

  const totalPrice = item.price * quantity;

  return (
    <div className="menu-item-modal-overlay" onClick={handleBackdropClick}>
      <div className="menu-item-modal">
        {/* Header */}
        <div className="modal-header">
          <button className="modal-close-btn" onClick={onClose}>×</button>
          <h2 className="modal-title">Detail Pesanan</h2>
        </div>

        <div className="modal-body">
          {/* Gambar & Info Item */}
          <div className="modal-item-info">
            <img
              src={item.image_url || 'https://placehold.co/300x200/667eea/FFFFFF?text=No+Image'}
              onError={(e) => {
                e.target.onerror = null;
                e.target.src = 'https://placehold.co/300x200/667eea/FFFFFF?text=No+Image';
              }}
              alt={item.name}
              className="modal-item-image"
            />
            <div className="modal-item-details">
              <h3 className="modal-item-name">{item.name}</h3>
              {item.description && (
                <p className="modal-item-description">{item.description}</p>
              )}
              <p className="modal-item-price">Rp {formatPrice(item.price)}</p>
            </div>
          </div>

          <div className="modal-options">
            {/* Opsi Kepedasan (Mie) */}
            {isMie && (
              <div className="modal-option-group">
                <h4 className="modal-option-title">
                  Tingkat Kepedasan <span className="required">*</span>
                </h4>
                <div className="modal-radio-group">
                  {[
                    { value: 'Tidak Pedas', label: 'Tidak Pedas' },
                    { value: 'Pedas Sedang', label: 'Pedas Sedang' },
                    { value: 'Pedas', label: 'Pedas' },
                    { value: 'Sangat Pedas', label: 'Sangat Pedas' },    
                  ].map((opt) => (
                    <label
                      key={opt.value}
                      className={`modal-radio-option ${selectedOptions.spiciness === opt.value ? 'selected' : ''}`}
                    >
                      <input
                        type="radio"
                        name="spiciness"
                        value={opt.value}
                        checked={selectedOptions.spiciness === opt.value}
                        onChange={() => handleOptionChange('spiciness', opt.value)}
                      />
                      <span>{opt.label}</span>
                    </label>
                  ))}
                </div>
                {errors.spiciness && (
                  <p className="modal-option-warning">⚠️ Silakan pilih tingkat kepedasan.</p>
                )}
              </div>
            )}

            {/* Opsi Suhu (Minuman) */}
            {isMinuman && (
              <div className="modal-option-group">
                <h4 className="modal-option-title">
                  Suhu <span className="required">*</span>
                </h4>
                <div className="modal-radio-group">
                  {[
                    { value: 'dingin', label: 'Dingin' },
                    { value: 'tidak dingin', label: 'Tidak Dingin' },
                  ].map((opt) => (
                    <label
                      key={opt.value}
                      className={`modal-radio-option ${selectedOptions.temperature === opt.value ? 'selected' : ''}`}
                    >
                      <input
                        type="radio"
                        name="temperature"
                        value={opt.value}
                        checked={selectedOptions.temperature === opt.value}
                        onChange={() => handleOptionChange('temperature', opt.value)}
                      />
                      <span>{opt.label}</span>
                    </label>
                  ))}
                </div>
                {errors.temperature && (
                  <p className="modal-option-warning">⚠️ Silakan pilih suhu minuman.</p>
                )}
              </div>
            )}

            {/* Opsi Es Level (Minuman) */}
            {isMinuman && selectedOptions.temperature === 'dingin' && (
              <div className="modal-option-group">
                <h4 className="modal-option-title">
                  Tingkat Es <span className="required">*</span>
                </h4>
                <div className="modal-radio-group">
                  {[
                    { value: 'Tidak Pakai Es', label: '0%' },
                    { value: 'Sediki Es', label: '25%' },
                    { value: 'Es Sedang', label: '50%' },
                    { value: 'Es Normal', label: '100%' },
                  ].map((opt) => (
                    <label
                      key={opt.value}
                      className={`modal-radio-option ${selectedOptions.iceLevel === opt.value ? 'selected' : ''}`}
                    >
                      <input
                        type="radio"
                        name="iceLevel"
                        value={opt.value}
                        checked={selectedOptions.iceLevel === opt.value}
                        onChange={() => handleOptionChange('iceLevel', opt.value)}
                      />
                      <span>{opt.label}</span>
                    </label>
                  ))}
                </div>
                {errors.iceLevel && (
                  <p className="modal-option-warning">⚠️ Silakan pilih tingkat es.</p>
                )}
              </div>
            )}

            {/* Opsi Gula Level (Minuman) */}
            {isMinuman && (
              <div className="modal-option-group">
                <h4 className="modal-option-title">
                  Tingkat Gula <span className="required">*</span>
                </h4>
                <div className="modal-radio-group">
                  {[
                    { value: 'Tidak Manis', label: '0%' },
                    { value: 'Sedikit Manis', label: '25%' },
                    { value: 'Manis Sedang', label: '50%' },
                    { value: 'Manis', label: '100%' },
                  ].map((opt) => (
                    <label
                      key={opt.value}
                      className={`modal-radio-option ${selectedOptions.sugarLevel === opt.value ? 'selected' : ''}`}
                    >
                      <input
                        type="radio"
                        name="sugarLevel"
                        value={opt.value}
                        checked={selectedOptions.sugarLevel === opt.value}
                        onChange={() => handleOptionChange('sugarLevel', opt.value)}
                      />
                      <span>{opt.label}</span>
                    </label>
                  ))}
                </div>
                {errors.sugarLevel && (
                  <p className="modal-option-warning">⚠️ Silakan pilih tingkat gula.</p>
                )}
              </div>
            )}

            {/* Catatan/Notes */}
            <div className="modal-option-group">
              <h4 className="modal-option-title">📝 Catatan (Opsional)</h4>
              <textarea
                className="modal-notes-input"
                placeholder="Contoh: jangan pakai bawang, ekstra sambal, dll..."
                value={selectedOptions.notes}
                onChange={(e) => handleOptionChange('notes', e.target.value)}
                rows={3}
                maxLength={200}
              />
              <small className="notes-counter">{selectedOptions.notes.length}/200</small>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="modal-footer">
          {/* Quantity Control */}
          <div className="modal-quantity-control">
            <button
              className="modal-qty-btn minus"
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              disabled={quantity <= 1}
            >
              −
            </button>
            <span className="modal-qty-display">{quantity}</span>
            <button
              className="modal-qty-btn plus"
              onClick={() => setQuantity((q) => q + 1)}
            >
              +
            </button>
          </div>

          {/* Add to Cart Button */}
          <button className="modal-add-btn" onClick={handleAddToCart}>
            🛒 Tambah ke Keranjang
            <span className="modal-total-price">Rp {formatPrice(totalPrice)}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default MenuItemModal;
