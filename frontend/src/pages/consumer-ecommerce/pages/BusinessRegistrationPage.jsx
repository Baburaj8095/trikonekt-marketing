import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { FaArrowLeft } from 'react-icons/fa6';
import '../consumerEcommerce.css';

export default function BusinessRegistrationPage() {
  const [formData, setFormData] = useState({
    businessName: '',
    ownerName: '',
    mobileNumber: '',
    email: '',
    category: '',
    address: ''
  });
  
  const [errors, setErrors] = useState({});
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: null }));
    }
  };

  const validate = () => {
    const newErrors = {};
    if (!formData.businessName.trim()) newErrors.businessName = 'Business Name is required';
    if (!formData.ownerName.trim()) newErrors.ownerName = 'Owner Name is required';
    if (!formData.mobileNumber.trim()) {
      newErrors.mobileNumber = 'Mobile Number is required';
    } else if (formData.mobileNumber.length < 10) {
      newErrors.mobileNumber = 'Enter a valid 10-digit mobile number';
    }
    if (!formData.category) newErrors.category = 'Please select a category';
    return newErrors;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }
    setIsSubmitted(true);
    setTimeout(() => {
      alert('Business Registration Submitted Successfully!');
      setIsSubmitted(false);
      setFormData({
        businessName: '',
        ownerName: '',
        mobileNumber: '',
        email: '',
        category: '',
        address: ''
      });
    }, 1000);
  };

  return (
    <div className="ce-app" style={{ background: '#f8fafc' }}>
      <header className="ce-header">
        <div className="ce-header-inner">
          <Link to="/consumer-ecommerce" className="ce-icon-btn" aria-label="Back to dashboard">
            <FaArrowLeft />
          </Link>
          <div className="ce-header-title-container">
            <h1 className="ce-header-title">List Your Business</h1>
            <span className="ce-header-subtitle">Join Trikonekt today</span>
          </div>
          <div style={{ width: '42px' }}></div>
        </div>
      </header>

      <main className="ce-container" style={{ paddingTop: '80px', paddingBottom: '40px' }}>
        <form onSubmit={handleSubmit} className="ce-form-card">
          <div className="ce-form-header">
            <h2>Business Details</h2>
            <p>Fill in the details below to register your business on our platform.</p>
          </div>

          <div className="ce-form-group">
            <label className="ce-label">Business Name *</label>
            <input 
              type="text" 
              name="businessName"
              className={`ce-input ${errors.businessName ? 'ce-input-error' : ''}`}
              placeholder="e.g. Fresh Supermarket" 
              value={formData.businessName}
              onChange={handleChange}
            />
            {errors.businessName && <span className="ce-error-text">{errors.businessName}</span>}
          </div>

          <div className="ce-form-group">
            <label className="ce-label">Owner Full Name *</label>
            <input 
              type="text" 
              name="ownerName"
              className={`ce-input ${errors.ownerName ? 'ce-input-error' : ''}`}
              placeholder="Enter your full name" 
              value={formData.ownerName}
              onChange={handleChange}
            />
            {errors.ownerName && <span className="ce-error-text">{errors.ownerName}</span>}
          </div>

          <div className="ce-form-group">
            <label className="ce-label">Mobile Number *</label>
            <input 
              type="tel" 
              name="mobileNumber"
              className={`ce-input ${errors.mobileNumber ? 'ce-input-error' : ''}`}
              placeholder="10-digit mobile number" 
              value={formData.mobileNumber}
              onChange={handleChange}
            />
            {errors.mobileNumber && <span className="ce-error-text">{errors.mobileNumber}</span>}
          </div>

          <div className="ce-form-group">
            <label className="ce-label">Email ID (Optional)</label>
            <input 
              type="email" 
              name="email"
              className="ce-input"
              placeholder="contact@business.com" 
              value={formData.email}
              onChange={handleChange}
            />
          </div>

          <div className="ce-form-group">
            <label className="ce-label">Business Category *</label>
            <select 
              name="category"
              className={`ce-input ce-select ${errors.category ? 'ce-input-error' : ''}`}
              value={formData.category}
              onChange={handleChange}
            >
              <option value="">Select a category</option>
              <option value="retail">Retail & Grocery</option>
              <option value="food">Restaurant & Food</option>
              <option value="services">Home Services</option>
              <option value="health">Healthcare & Pharmacy</option>
              <option value="other">Other</option>
            </select>
            {errors.category && <span className="ce-error-text">{errors.category}</span>}
          </div>

          <div className="ce-form-group">
            <label className="ce-label">Full Address</label>
            <textarea 
              name="address"
              className="ce-input ce-textarea"
              placeholder="Enter complete business address" 
              rows="3"
              value={formData.address}
              onChange={handleChange}
            />
          </div>

          <div className="ce-form-group">
            <label className="ce-label">Upload Store Images (Optional)</label>
            <div className="ce-file-upload">
              <span>📷 Tap to upload images</span>
              <input type="file" multiple accept="image/*" className="ce-file-input" />
            </div>
          </div>

          <button type="submit" className="ce-submit-btn" disabled={isSubmitted}>
            {isSubmitted ? 'Submitting...' : 'Submit Registration'}
          </button>
        </form>
      </main>
    </div>
  );
}
