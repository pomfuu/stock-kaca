// src/App.js
import React, { useState } from 'react';
import 'bootstrap/dist/css/bootstrap.min.css';
import Login from './pages/Login';
import Stock from './pages/Stock';

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  return (
    <>
      {!isLoggedIn ? (
        <Login onLoginSuccess={() => setIsLoggedIn(true)} />
      ) : (
        <Stock onLogout={() => setIsLoggedIn(false)} />
      )}
    </>
  );
}

export default App;