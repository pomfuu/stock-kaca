// src/pages/Login.js
import React, { useState, useEffect } from 'react';
import { Lock, Package } from 'lucide-react';

export default function Login({ onLoginSuccess }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (localStorage.getItem('isLoggedIn') === 'true') {
      onLoginSuccess();
    }
  }, [onLoginSuccess]);

  const handleLogin = () => {
    if (password === '74708774') {
      localStorage.setItem('isLoggedIn', 'true');
      onLoginSuccess();
    } else {
      setError('Password salah!');
      setPassword('');
    }
  };

  return (
    <div className="vh-100 d-flex align-items-center justify-content-center bg-primary">
      <div className="card shadow" style={{ width: '400px' }}>
        <div className="card-body p-5 text-center">
          <Package size={48} className="text-primary mb-3" />
          <h4 className="mb-4">Stock Kaca & Frame</h4>
          
          <div className="text-start">
            <label className="form-label"><Lock size={16} /> Password</label>
            <input
              type="password"
              className={`form-control ${error ? 'is-invalid' : ''}`}
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(''); }}
              onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
              autoFocus
            />
            {error && <div className="invalid-feedback">{error}</div>}
          </div>
          
          <button onClick={handleLogin} className="btn btn-primary w-100 mt-3">
            Login
          </button>
        </div>
      </div>
    </div>
  );
}