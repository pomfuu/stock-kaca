import React, { useState, useEffect } from 'react';
import { LogOut, Plus, Edit2, Trash2, Package, History, TrendingUp, TrendingDown } from 'lucide-react';
import { db } from '../firebase';
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot } from 'firebase/firestore';

export default function Stock({ onLogout }) {
  const [tab, setTab] = useState('kaca');
  const [kaca, setKaca] = useState([]);
  const [frame, setFrame] = useState([]);
  const [modal, setModal] = useState({ show: false, type: '', item: null, parent: null });
  const [form, setForm] = useState({});
  const [loading, setLoading] = useState(true);
  
  const [stockModal, setStockModal] = useState({ show: false, item: null, parentId: null });
  const [stockForm, setStockForm] = useState({ mode: 'set', value: '', keterangan: '' });
  
  const [historyModal, setHistoryModal] = useState({ show: false, history: [], selectedMonth: '' });
  const [monthlyStats, setMonthlyStats] = useState({ startStock: 0, endStock: 0 });
  
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 3;

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'kaca'), (snapshot) => {
      const kacaData = snapshot.docs.map(doc => ({
        id: doc.id,
        createdAt: doc.data().createdAt || Date.now(),
        ...doc.data()
      }));
      kacaData.sort((a, b) => a.createdAt - b.createdAt);
      setKaca(kacaData);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'frame'), (snapshot) => {
      const frameData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setFrame(frameData);
    });
    return () => unsubscribe();
  }, []);

  const handleLogout = () => {
    if (window.confirm('Yakin logout?')) {
      localStorage.removeItem('isLoggedIn');
      onLogout();
    }
  };

  const openModal = (type, item = null, parent = null) => {
    setModal({ show: true, type, item, parent });
    if (type === 'ukuran' && item) {
      const [p, l] = (item.ukuran || '').split('x');
      setForm({ ...item, panjang: p || '', lebar: l || '' });
    } else {
      setForm(item || {});
    }
  };

  const closeModal = () => {
    setModal({ show: false, type: '', item: null, parent: null });
    setForm({});
  };

  const openStockModal = (ukuran, parentId) => {
    setStockModal({ show: true, item: ukuran, parentId });
    setStockForm({ mode: 'set', value: '', keterangan: '' });
  };

  const closeStockModal = () => {
    setStockModal({ show: false, item: null, parentId: null });
    setStockForm({ mode: 'set', value: '', keterangan: '' });
  };

  const handleUpdateStock = async () => {
    try {
      const value = Number(stockForm.value);
      if (isNaN(value) || value <= 0) {
        alert('Masukkan nilai yang valid!');
        return;
      }

      const jenisDoc = kaca.find(k => k.id === stockModal.parentId);
      const currentUkuran = jenisDoc.ukuran.find(u => u.id === stockModal.item.id);
      const oldStock = currentUkuran.stock || 0;
      
      let newStock;
      let change;
      if (stockForm.mode === 'set') {
        newStock = value;
        change = value - oldStock;
      } else if (stockForm.mode === 'add') {
        newStock = oldStock + value;
        change = value;
      } else {
        newStock = oldStock - value;
        change = -value;
      }

      const historyEntry = {
        timestamp: new Date().toISOString(),
        oldStock,
        newStock,
        change,
        mode: stockForm.mode,
        keterangan: stockForm.keterangan || '',
        // Simpan label untuk history
        keteranganLabel: change < 0 ? 'Dikirim Untuk' : 'Dapat Dari'
      };

      const updatedUkuran = jenisDoc.ukuran.map(u => {
        if (u.id === stockModal.item.id) {
          return {
            ...u,
            stock: newStock,
            history: [...(u.history || []), historyEntry]
          };
        }
        return u;
      });

      await updateDoc(doc(db, 'kaca', stockModal.parentId), {
        ukuran: updatedUkuran
      });

      closeStockModal();
    } catch (error) {
      console.error('Error updating stock:', error);
      alert('Gagal update stock');
    }
  };

  const showHistory = (ukuran) => {
    const history = ukuran.history || [];
    
    const months = [...new Set(history.map(h => {
      const date = new Date(h.timestamp);
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    }))].sort().reverse();
    
    const currentMonth = months[0] || '';
    
    setHistoryModal({ 
      show: true, 
      history,
      allHistory: history,
      ukuran: ukuran.ukuran,
      kode: ukuran.kode,
      currentStock: ukuran.stock,
      selectedMonth: currentMonth,
      availableMonths: months
    });
    
    if (currentMonth) {
      calculateMonthlyStats(history, currentMonth);
    }
  };

  const calculateMonthlyStats = (allHistory, month) => {
    const [year, monthNum] = month.split('-').map(Number);
    const startDate = new Date(year, monthNum - 1, 1);
    const endDate = new Date(year, monthNum, 0, 23, 59, 59);
    
    const monthHistory = allHistory.filter(h => {
      const date = new Date(h.timestamp);
      return date >= startDate && date <= endDate;
    }).sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    
    const startStock = monthHistory.length > 0 ? monthHistory[0].oldStock : 0;
    const endStock = monthHistory.length > 0 ? monthHistory[monthHistory.length - 1].newStock : startStock;
    
    setMonthlyStats({ startStock, endStock, totalChanges: monthHistory.length });
    setHistoryModal(prev => ({ ...prev, history: monthHistory }));
  };

  const handleMonthFilter = (month) => {
    setHistoryModal(prev => ({ ...prev, selectedMonth: month }));
    calculateMonthlyStats(historyModal.allHistory, month);
  };

  const closeHistoryModal = () => {
    setHistoryModal({ 
      show: false, 
      history: [], 
      allHistory: [],
      ukuran: '', 
      kode: '', 
      currentStock: 0,
      selectedMonth: '',
      availableMonths: []
    });
    setMonthlyStats({ startStock: 0, endStock: 0, totalChanges: 0 });
  };

  const formatDate = (isoString) => {
    const date = new Date(isoString);
    return date.toLocaleString('id-ID', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatMonthName = (monthStr) => {
    const [year, month] = monthStr.split('-');
    const date = new Date(year, month - 1);
    return date.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
  };

  const saveJenis = async () => {
    try {
      if (modal.item) {
        await updateDoc(doc(db, 'kaca', modal.item.id), {
          namaJenis: form.namaJenis
        });
      } else {
        await addDoc(collection(db, 'kaca'), {
          namaJenis: form.namaJenis,
          ukuran: [],
          createdAt: Date.now()
        });
      }
      closeModal();
    } catch (error) {
      console.error('Error saving jenis:', error);
      alert('Gagal menyimpan data');
    }
  };

  const deleteJenis = async (id) => {
    if (window.confirm('Hapus jenis ini?')) {
      try {
        await deleteDoc(doc(db, 'kaca', id));
      } catch (error) {
        console.error('Error deleting jenis:', error);
        alert('Gagal menghapus data');
      }
    }
  };

  const saveUkuran = async () => {
    try {
      const jenisDoc = kaca.find(k => k.id === modal.parent);
      const ukuranFormatted = `${form.panjang}x${form.lebar}`;
      
      const ukuranData = {
        id: modal.item?.id || Date.now().toString(),
        ukuran: ukuranFormatted,
        kode: form.kode || '',
        harga: Number(form.harga) || 0,
        stock: modal.item ? modal.item.stock : 0,
        history: modal.item ? modal.item.history || [] : []
      };

      let updatedUkuran;
      if (modal.item) {
        updatedUkuran = jenisDoc.ukuran.map(u => 
          u.id === modal.item.id ? ukuranData : u
        );
      } else {
        updatedUkuran = [...(jenisDoc.ukuran || []), ukuranData];
      }

      await updateDoc(doc(db, 'kaca', modal.parent), {
        ukuran: updatedUkuran
      });
      closeModal();
    } catch (error) {
      console.error('Error saving ukuran:', error);
      alert('Gagal menyimpan ukuran');
    }
  };

  const deleteUkuran = async (jenisId, ukuranId) => {
    if (window.confirm('Hapus ukuran ini?')) {
      try {
        const jenisDoc = kaca.find(k => k.id === jenisId);
        const updatedUkuran = jenisDoc.ukuran.filter(u => u.id !== ukuranId);
        await updateDoc(doc(db, 'kaca', jenisId), {
          ukuran: updatedUkuran
        });
      } catch (error) {
        console.error('Error deleting ukuran:', error);
        alert('Gagal menghapus ukuran');
      }
    }
  };

  const saveFrame = async () => {
    try {
      if (modal.item) {
        await updateDoc(doc(db, 'frame', modal.item.id), {
          namaFrame: form.namaFrame
        });
      } else {
        await addDoc(collection(db, 'frame'), {
          namaFrame: form.namaFrame,
          daun: []
        });
      }
      closeModal();
    } catch (error) {
      console.error('Error saving frame:', error);
      alert('Gagal menyimpan frame');
    }
  };

  const deleteFrame = async (id) => {
    if (window.confirm('Hapus frame ini?')) {
      try {
        await deleteDoc(doc(db, 'frame', id));
      } catch (error) {
        console.error('Error deleting frame:', error);
        alert('Gagal menghapus frame');
      }
    }
  };

  const saveDaun = async () => {
    try {
      const frameDoc = frame.find(f => f.id === modal.parent);
      const daunData = {
        id: modal.item?.id || Date.now().toString(),
        namaDaun: form.namaDaun || '',
        jumlahSet: Number(form.jumlahSet) || 0,
        p: Number(form.p) || 0,
        h: Number(form.h) || 0
      };

      let updatedDaun;
      if (modal.item) {
        updatedDaun = frameDoc.daun.map(d => 
          d.id === modal.item.id ? daunData : d
        );
      } else {
        updatedDaun = [...(frameDoc.daun || []), daunData];
      }

      await updateDoc(doc(db, 'frame', modal.parent), {
        daun: updatedDaun
      });
      closeModal();
    } catch (error) {
      console.error('Error saving daun:', error);
      alert('Gagal menyimpan daun');
    }
  };

  const deleteDaun = async (frameId, daunId) => {
    if (window.confirm('Hapus daun ini?')) {
      try {
        const frameDoc = frame.find(f => f.id === frameId);
        const updatedDaun = frameDoc.daun.filter(d => d.id !== daunId);
        await updateDoc(doc(db, 'frame', frameId), {
          daun: updatedDaun
        });
      } catch (error) {
        console.error('Error deleting daun:', error);
        alert('Gagal menghapus daun');
      }
    }
  };

  const handleSave = () => {
    if (modal.type === 'jenis') saveJenis();
    else if (modal.type === 'ukuran') saveUkuran();
    else if (modal.type === 'frame') saveFrame();
    else if (modal.type === 'daun') saveDaun();
  };

  const filteredKaca = kaca.filter(k => 
    k.namaJenis.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalPages = Math.ceil(filteredKaca.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentKaca = filteredKaca.slice(startIndex, endIndex);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  if (loading) {
    return (
      <div className="vh-100 d-flex align-items-center justify-content-center">
        <div className="spinner-border text-dark" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-light min-vh-100">
      <nav className="navbar navbar-dark bg-dark">
        <div className="container-fluid">
          <span className="navbar-brand fw-semibold fs-5">Stock Kaca CV Tri Jaya</span>
          <button className="btn btn-outline-light btn-sm" onClick={handleLogout}>
            <LogOut size={16} /> Logout
          </button>
        </div>
      </nav>

      <div className="container-fluid p-4">
        <ul className="nav nav-pills mb-3">
          <li className="nav-item">
            <button className={`nav-link ${tab === 'kaca' ? 'active' : ''}`} onClick={() => setTab('kaca')}>Kaca</button>
          </li>
          <li className="nav-item">
            <button className={`nav-link ${tab === 'frame' ? 'active' : ''}`} onClick={() => setTab('frame')}>Frame</button>
          </li>
        </ul>

        <button className="btn btn-dark mb-3" onClick={() => openModal(tab === 'kaca' ? 'jenis' : 'frame')}>
          <Plus size={16} /> Tambah {tab === 'kaca' ? 'Jenis' : 'Frame'}
        </button>

        {tab === 'kaca' && (
          <>
            <div className="row mb-3">
              <div className="col-md-6">
                <input
                  type="text"
                  className="form-control"
                  placeholder="🔍 Cari jenis kaca..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <div className="col-md-6 text-end">
                <small className="text-muted">
                  Menampilkan {currentKaca.length} dari {filteredKaca.length} jenis kaca
                </small>
              </div>
            </div>

            <div className="row">
              {currentKaca.length === 0 ? (
                <div className="col-12 text-center py-5">
                  <p className="text-muted">
                    {searchQuery 
                      ? `Tidak ada hasil untuk "${searchQuery}"`
                      : 'Belum ada data kaca. Klik tombol "Tambah Jenis" untuk mulai.'
                    }
                  </p>
                </div>
              ) : (
                currentKaca.map(k => (
                  <div key={k.id} className="col-lg-4 mb-4">
                    <div className="card h-100 shadow-sm">
                      <div className="card-header bg-dark text-white d-flex justify-content-between align-items-center">
                        <span className="fw-bold">{k.namaJenis}</span>
                        <div>
                          <button className="btn btn-sm btn-light me-1" onClick={() => openModal('jenis', k)}>
                            <Edit2 size={14} />
                          </button>
                          <button className="btn btn-sm btn-danger" onClick={() => deleteJenis(k.id)}>
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                      <div className="card-body">
                        <button className="btn btn-sm btn-outline-dark mb-3 w-100" onClick={() => openModal('ukuran', null, k.id)}>
                          <Plus size={14} /> Tambah Ukuran
                        </button>
                        {(!k.ukuran || k.ukuran.length === 0) ? (
                          <p className="text-muted text-center py-3">Belum ada ukuran</p>
                        ) : (
                          <div className="table-responsive">
                            <table className="table table-sm table-hover mb-0">
                              <thead className="table-light">
                                <tr>
                                  <th>Ukuran</th>
                                  <th>Kode</th>
                                  <th className="text-end">Harga</th>
                                  <th className="text-center">Stock</th>
                                  <th className="text-center">Aksi</th>
                                </tr>
                              </thead>
                              <tbody>
                                {k.ukuran.map(u => (
                                  <tr key={u.id}>
                                    <td><strong className="text-dark">{u.ukuran}</strong></td>
                                    <td><span className="badge bg-secondary">{u.kode}</span></td>
                                    <td className="text-end"><small>Rp {u.harga.toLocaleString()}</small></td>
                                    <td className="text-center">
                                      <span className="fw-semibold">
                                        {u.stock}
                                      </span>
                                    </td>
                                    <td>
                                      <div className="btn-group btn-group-sm" role="group">
                                        <button 
                                          className="btn btn-success" 
                                          onClick={() => openStockModal(u, k.id)}
                                          title="Update Stock"
                                        >
                                          <Package size={12} />
                                        </button>
                                        <button 
                                          className="btn btn-warning" 
                                          onClick={() => openModal('ukuran', u, k.id)}
                                          title="Edit Data"
                                        >
                                          <Edit2 size={12} />
                                        </button>
                                        <button 
                                          className="btn btn-info text-white" 
                                          onClick={() => showHistory(u)}
                                          title="Lihat History"
                                        >
                                          <History size={12} />
                                        </button>
                                        <button 
                                          className="btn btn-danger" 
                                          onClick={() => deleteUkuran(k.id, u.id)}
                                          title="Hapus"
                                        >
                                          <Trash2 size={12} />
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {totalPages > 1 && (
              <nav className="mt-4">
                <ul className="pagination justify-content-center">
                  <li className={`page-item ${currentPage === 1 ? 'disabled' : ''}`}>
                    <button 
                      className="page-link" 
                      onClick={() => setCurrentPage(currentPage - 1)}
                      disabled={currentPage === 1}
                    >
                      ← Previous
                    </button>
                  </li>
                  
                  {[...Array(totalPages)].map((_, index) => {
                    const pageNum = index + 1;
                    if (
                      pageNum === 1 || 
                      pageNum === totalPages || 
                      (pageNum >= currentPage - 1 && pageNum <= currentPage + 1)
                    ) {
                      return (
                        <li key={pageNum} className={`page-item ${currentPage === pageNum ? 'active' : ''}`}>
                          <button 
                            className="page-link" 
                            onClick={() => setCurrentPage(pageNum)}
                          >
                            {pageNum}
                          </button>
                        </li>
                      );
                    } else if (pageNum === currentPage - 2 || pageNum === currentPage + 2) {
                      return <li key={pageNum} className="page-item disabled"><span className="page-link">...</span></li>;
                    }
                    return null;
                  })}
                  
                  <li className={`page-item ${currentPage === totalPages ? 'disabled' : ''}`}>
                    <button 
                      className="page-link" 
                      onClick={() => setCurrentPage(currentPage + 1)}
                      disabled={currentPage === totalPages}
                    >
                      Next →
                    </button>
                  </li>
                </ul>
              </nav>
            )}
          </>
        )}

        {tab === 'frame' && (
          <div className="row">
            {frame.length === 0 ? (
              <div className="col-12 text-center py-5">
                <p className="text-muted">Belum ada data frame. Klik tombol "Tambah Frame" untuk mulai.</p>
              </div>
            ) : (
              frame.map(f => (
                <div key={f.id} className="col-md-6 mb-3">
                  <div className="card">
                    <div className="card-header bg-success text-white d-flex justify-content-between">
                      <span>{f.namaFrame}</span>
                      <div>
                        <button className="btn btn-sm btn-light me-1" onClick={() => openModal('frame', f)}>
                          <Edit2 size={14} />
                        </button>
                        <button className="btn btn-sm btn-danger" onClick={() => deleteFrame(f.id)}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                    <div className="card-body">
                      <button className="btn btn-sm btn-outline-success mb-2 w-100" onClick={() => openModal('daun', null, f.id)}>
                        + Tambah Daun
                      </button>
                      {(!f.daun || f.daun.length === 0) ? (
                        <p className="text-muted text-center">Belum ada daun</p>
                      ) : (
                        <table className="table table-sm">
                          <thead>
                            <tr>
                              <th>Daun</th>
                              <th>Set</th>
                              <th>P</th>
                              <th>H</th>
                              <th>Aksi</th>
                            </tr>
                          </thead>
                          <tbody>
                            {f.daun.map(d => (
                              <tr key={d.id}>
                                <td>{d.namaDaun}</td>
                                <td>{d.jumlahSet}</td>
                                <td>{d.p}</td>
                                <td>{d.h}</td>
                                <td>
                                  <button className="btn btn-sm btn-warning me-1" onClick={() => openModal('daun', d, f.id)}>
                                    <Edit2 size={12} />
                                  </button>
                                  <button className="btn btn-sm btn-danger" onClick={() => deleteDaun(f.id, d.id)}>
                                    <Trash2 size={12} />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {modal.show && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5>{modal.item ? 'Edit' : 'Tambah'} {modal.type === 'jenis' ? 'Jenis' : modal.type === 'ukuran' ? 'Ukuran' : modal.type === 'frame' ? 'Frame' : 'Daun'}</h5>
                <button className="btn-close" onClick={closeModal}></button>
              </div>
              <div className="modal-body">
                {modal.type === 'jenis' && (
                  <input 
                    className="form-control" 
                    placeholder="Nama Jenis *" 
                    value={form.namaJenis || ''} 
                    onChange={(e) => setForm({ ...form, namaJenis: e.target.value })}
                  />
                )}
                {modal.type === 'ukuran' && (
                  <>
                    <label className="form-label">Ukuran (cm)</label>
                    <div className="input-group mb-2">
                      <input 
                        type="number" 
                        className="form-control" 
                        placeholder="Panjang" 
                        value={form.panjang || ''} 
                        onChange={(e) => setForm({ ...form, panjang: e.target.value })}
                      />
                      <span className="input-group-text">x</span>
                      <input 
                        type="number" 
                        className="form-control" 
                        placeholder="Lebar" 
                        value={form.lebar || ''} 
                        onChange={(e) => setForm({ ...form, lebar: e.target.value })}
                      />
                    </div>
                    <input 
                      className="form-control mb-2" 
                      placeholder="Kode" 
                      value={form.kode || ''} 
                      onChange={(e) => setForm({ ...form, kode: e.target.value })}
                    />
                    <input 
                      type="number" 
                      className="form-control mb-2" 
                      placeholder="Harga" 
                      value={form.harga || ''} 
                      onChange={(e) => setForm({ ...form, harga: e.target.value })}
                    />
                    {modal.item && (
                      <div className="alert alert-info">
                        <small><strong>Stock saat ini:</strong> {modal.item.stock}</small><br/>
                        <small>Gunakan tombol "Update Stock" untuk mengubah stock</small>
                      </div>
                    )}
                  </>
                )}
                {modal.type === 'frame' && (
                  <input 
                    className="form-control" 
                    placeholder="Nama Frame *" 
                    value={form.namaFrame || ''} 
                    onChange={(e) => setForm({ ...form, namaFrame: e.target.value })}
                  />
                )}
                {modal.type === 'daun' && (
                  <>
                    <input 
                      className="form-control mb-2" 
                      placeholder="Nama Daun (1 Daun)" 
                      value={form.namaDaun || ''} 
                      onChange={(e) => setForm({ ...form, namaDaun: e.target.value })}
                    />
                    <input 
                      type="number" 
                      className="form-control mb-2" 
                      placeholder="Jumlah Set" 
                      value={form.jumlahSet || ''} 
                      onChange={(e) => setForm({ ...form, jumlahSet: e.target.value })}
                    />
                    <div className="row">
                      <div className="col-6">
                        <input 
                          type="number" 
                          className="form-control" 
                          placeholder="H (Tinggi)" 
                          value={form.h || ''} 
                          onChange={(e) => setForm({ ...form, h: e.target.value })}
                        />
                      </div>
                    </div>
                  </>
                )}
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={closeModal}>Batal</button>
                <button className="btn btn-dark" onClick={handleSave}>Simpan</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {stockModal.show && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header bg-success text-white">
                <h5>Update Stock - {stockModal.item?.ukuran}</h5>
                <button className="btn-close btn-close-white" onClick={closeStockModal}></button>
              </div>
              <div className="modal-body">
                <div className="alert alert-info">
                  <strong>Stock Saat Ini:</strong> {stockModal.item?.stock || 0}
                </div>

                <label className="form-label">Mode Update</label>
                <div className="btn-group w-100 mb-3" role="group">
                  <button 
                    type="button" 
                    className={`btn ${stockForm.mode === 'set' ? 'btn-dark' : 'btn-outline-dark'}`}
                    onClick={() => setStockForm({ ...stockForm, mode: 'set' })}
                  >
                    Set Langsung
                  </button>
                  <button 
                    type="button" 
                    className={`btn ${stockForm.mode === 'add' ? 'btn-success' : 'btn-outline-success'}`}
                    onClick={() => setStockForm({ ...stockForm, mode: 'add' })}
                  >
                    + Tambah
                  </button>
                  <button 
                    type="button" 
                    className={`btn ${stockForm.mode === 'subtract' ? 'btn-danger' : 'btn-outline-danger'}`}
                    onClick={() => setStockForm({ ...stockForm, mode: 'subtract' })}
                  >
                    - Kurangi
                  </button>
                </div>

                <label className="form-label">
                  {stockForm.mode === 'set' ? 'Stock Baru' : stockForm.mode === 'add' ? 'Jumlah Penambahan' : 'Jumlah Pengurangan'}
                </label>
                <input 
                  type="number" 
                  className="form-control form-control-lg mb-3" 
                  placeholder="Masukkan jumlah"
                  value={stockForm.value}
                  onChange={(e) => setStockForm({ ...stockForm, value: e.target.value })}
                  min="1"
                />

                <label className="form-label">
                  {stockForm.mode === 'subtract' ? 'Dikirim Untuk' : stockForm.mode === 'add' ? 'Dapat Dari' : 'Keterangan'}
                </label>
                <input 
                  type="text" 
                  className="form-control mb-3" 
                  placeholder={
                    stockForm.mode === 'subtract' 
                      ? 'Nama customer/project pengiriman' 
                      : stockForm.mode === 'add'
                      ? 'Nama supplier/sumber'
                      : 'Keterangan perubahan stock'
                  }
                  value={stockForm.keterangan}
                  onChange={(e) => setStockForm({ ...stockForm, keterangan: e.target.value })}
                />

                {stockForm.value && (
                  <div className="alert alert-warning mt-3">
                    <strong>Preview:</strong> Stock akan menjadi{' '}
                    {stockForm.mode === 'set' 
                      ? Number(stockForm.value)
                      : stockForm.mode === 'add'
                      ? (stockModal.item?.stock || 0) + Number(stockForm.value)
                      : (stockModal.item?.stock || 0) - Number(stockForm.value)
                    }
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={closeStockModal}>Batal</button>
                <button className="btn btn-success" onClick={handleUpdateStock}>Update Stock</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {historyModal.show && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-lg">
            <div className="modal-content">
              <div className="modal-header bg-info text-white">
                <h5>
                  <History size={20} className="me-2" />
                  History Stock - {historyModal.ukuran} ({historyModal.kode})
                </h5>
                <button className="btn-close btn-close-white" onClick={closeHistoryModal}></button>
              </div>
              <div className="modal-body">
                {historyModal.availableMonths && historyModal.availableMonths.length > 0 && (
                  <div className="mb-3">
                    <label className="form-label fw-bold">Filter Bulan</label>
                    <select 
                      className="form-select"
                      value={historyModal.selectedMonth}
                      onChange={(e) => handleMonthFilter(e.target.value)}
                    >
                      {historyModal.availableMonths.map(month => (
                        <option key={month} value={month}>
                          {formatMonthName(month)}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {historyModal.selectedMonth && historyModal.history.length > 0 && (
                  <div className="row mb-3">
                    <div className="col-md-4">
                      <div className="card bg-dark text-white">
                        <div className="card-body text-center">
                          <small>Stock Awal Bulan</small>
                          <h4 className="mb-0">{monthlyStats.startStock}</h4>
                        </div>
                      </div>
                    </div>
                    <div className="col-md-4">
                      <div className="card bg-success text-white">
                        <div className="card-body text-center">
                          <small>Stock Akhir Bulan</small>
                          <h4 className="mb-0">{monthlyStats.endStock}</h4>
                        </div>
                      </div>
                    </div>
                    <div className="col-md-4">
                      <div className="card bg-info text-white">
                        <div className="card-body text-center">
                          <small>Perubahan</small>
                          <h4 className="mb-0">
                            {monthlyStats.endStock - monthlyStats.startStock > 0 ? '+' : ''}
                            {monthlyStats.endStock - monthlyStats.startStock}
                          </h4>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="alert alert-secondary">
                  <strong>Stock Saat Ini:</strong> <span className="badge bg-dark fs-6">{historyModal.currentStock}</span>
                </div>

                {historyModal.history.length === 0 ? (
                  <p className="text-muted text-center py-4">
                    {historyModal.selectedMonth 
                      ? `Tidak ada history untuk ${formatMonthName(historyModal.selectedMonth)}`
                      : 'Belum ada history update stock'
                    }
                  </p>
                ) : (
                  <div className="table-responsive">
                    <table className="table table-hover table-sm">
                      <thead>
                        <tr>
                          <th>Waktu</th>
                          <th>Stock Lama</th>
                          <th>Perubahan</th>
                          <th>Stock Baru</th>
                          <th>Mode</th>
                          <th>Keterangan</th>
                        </tr>
                      </thead>
                      <tbody>
                        {historyModal.history.map((h, idx) => (
                          <tr key={idx}>
                            <td><small>{formatDate(h.timestamp)}</small></td>
                            <td><span className="badge bg-secondary">{h.oldStock}</span></td>
                            <td>
                              {h.change > 0 ? (
                                <span className="text-success fw-bold">
                                  <TrendingUp size={16} className="me-1" />
                                  +{h.change}
                                </span>
                              ) : (
                                <span className="text-danger fw-bold">
                                  <TrendingDown size={16} className="me-1" />
                                  {h.change}
                                </span>
                              )}
                            </td>
                            <td><span className="badge bg-dark">{h.newStock}</span></td>
                            <td>
                              <span className={`badge ${
                                h.mode === 'set' ? 'bg-info' : 
                                h.mode === 'add' ? 'bg-success' : 'bg-danger'
                              }`}>
                                {h.mode === 'set' ? 'Set' : h.mode === 'add' ? 'Tambah' : 'Kurangi'}
                              </span>
                            </td>
                            <td>
                              {h.keterangan ? (
                                <div>
                                  <small className="text-muted d-block">
                                    {h.keteranganLabel || (h.change < 0 ? 'Dikirim Untuk' : 'Dapat Dari')}:
                                  </small>
                                  <span className="badge bg-warning text-dark">{h.keterangan}</span>
                                </div>
                              ) : h.dikirimUntuk ? (
                                <div>
                                  <small className="text-muted d-block">Dikirim Untuk:</small>
                                  <span className="badge bg-warning text-dark">{h.dikirimUntuk}</span>
                                </div>
                              ) : (
                                <small className="text-muted">-</small>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={closeHistoryModal}>Tutup</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}