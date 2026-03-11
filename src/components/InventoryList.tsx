import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { Loader2, AlertCircle, RefreshCw, Database, PackageOpen, Pencil, Trash2, Check, X, AlertTriangle, Download, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import toast from 'react-hot-toast';

interface InventoryItem {
  id: number;
  codice: string;
  descrizione: string;
  lotto: string;
  quantita: number;
  created_at: string;
}

export default function InventoryList() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Stati per la modifica inline
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editFormData, setEditFormData] = useState<Partial<InventoryItem>>({});
  
  // Stati per l'eliminazione
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Stati per la paginazione
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 20;

  // Stato per la ricerca
  const [searchTerm, setSearchTerm] = useState('');

  const fetchInventory = async () => {
    setLoading(true);
    setError('');
    try {
      const { data, error } = await supabase
        .from('inventario')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setItems(data || []);
    } catch (err: any) {
      console.error('Errore nel recupero dati:', err);
      setError(err.message || 'Impossibile caricare l\'inventario.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInventory();
  }, []);

  // --- Gestione Modifica ---
  const handleEditClick = (item: InventoryItem) => {
    setEditingId(item.id);
    setEditFormData(item);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditFormData({});
  };

  const handleEditChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target;
    setEditFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? Number(value) : value
    }));
  };

  const handleSaveEdit = async (id: number) => {
    setActionLoading(true);
    try {
      const { error } = await supabase
        .from('inventario')
        .update({
          codice: editFormData.codice,
          descrizione: editFormData.descrizione,
          lotto: editFormData.lotto,
          quantita: editFormData.quantita
        })
        .eq('id', id);

      if (error) throw error;

      // Aggiorna lo stato locale
      setItems(items.map(item => item.id === id ? { ...item, ...editFormData } as InventoryItem : item));
      setEditingId(null);
      toast.success('Articolo modificato con successo!');
    } catch (err: any) {
      console.error('Errore durante la modifica:', err);
      toast.error(err.message || 'Impossibile modificare l\'articolo.');
    } finally {
      setActionLoading(false);
    }
  };

  // --- Gestione Eliminazione ---
  const handleDeleteClick = (id: number) => {
    setDeleteConfirmId(id);
  };

  const handleCancelDelete = () => {
    setDeleteConfirmId(null);
  };

  const handleConfirmDelete = async () => {
    if (deleteConfirmId === null) return;
    setActionLoading(true);
    try {
      const { error } = await supabase
        .from('inventario')
        .delete()
        .eq('id', deleteConfirmId);

      if (error) throw error;

      // Rimuovi l'elemento dallo stato locale
      setItems(items.filter(item => item.id !== deleteConfirmId));
      setDeleteConfirmId(null);
      toast.success('Articolo eliminato con successo!');
    } catch (err: any) {
      console.error('Errore durante l\'eliminazione:', err);
      toast.error(err.message || 'Impossibile eliminare l\'articolo.');
    } finally {
      setActionLoading(false);
    }
  };

  const exportToCSV = () => {
    if (items.length === 0) return;

    const headers = ['Codice', 'Descrizione', 'Lotto', 'Quantità', 'Data Creazione'];
    
    const csvRows = items.map(item => {
      return [
        `"${item.codice.replace(/"/g, '""')}"`,
        `"${item.descrizione.replace(/"/g, '""')}"`,
        `"${item.lotto.replace(/"/g, '""')}"`,
        item.quantita,
        `"${new Date(item.created_at).toLocaleString()}"`
      ].join(',');
    });

    const csvContent = [headers.join(','), ...csvRows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `inventario_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filtro ricerca
  const filteredItems = useMemo(() => {
    if (!searchTerm.trim()) return items;
    const lowerSearch = searchTerm.toLowerCase();
    return items.filter(item => 
      item.codice.toLowerCase().includes(lowerSearch) ||
      item.descrizione.toLowerCase().includes(lowerSearch) ||
      item.lotto.toLowerCase().includes(lowerSearch)
    );
  }, [items, searchTerm]);

  // Calcoli per la paginazione
  const totalPages = Math.ceil(filteredItems.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const currentItems = filteredItems.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  // Assicurati che la pagina corrente sia valida se gli elementi vengono eliminati o filtrati
  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages);
    } else if (totalPages > 0 && currentPage === 0) {
      setCurrentPage(1);
    }
  }, [filteredItems.length, currentPage, totalPages]);

  const getPageNumbers = () => {
    const pages = [];
    const maxVisible = 5;
    let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    let end = Math.min(totalPages, start + maxVisible - 1);

    if (end - start + 1 < maxVisible) {
      start = Math.max(1, end - maxVisible + 1);
    }

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  };

  return (
    <div className="w-full max-w-4xl mx-auto bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden relative">
      <div className="p-6 border-b border-gray-100 bg-gray-50/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Database className="w-5 h-5 text-indigo-600" />
            Inventario Corrente
          </h2>
          <p className="text-sm text-gray-500 mt-1">Elenco di tutti gli articoli scansionati e salvati.</p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-grow sm:flex-grow-0">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Cerca codice, lotto..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition-colors"
            />
          </div>
          <div className="flex items-center gap-2 justify-end">
            <button 
              onClick={exportToCSV}
              disabled={loading || items.length === 0}
              className="flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors shadow-sm disabled:opacity-50 flex-1 sm:flex-none"
              title="Esporta in CSV"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Esporta</span>
            </button>
            <button 
              onClick={fetchInventory}
              disabled={loading || actionLoading}
              className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors disabled:opacity-50 border border-transparent"
              title="Aggiorna"
            >
              <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="m-6 p-4 bg-red-50 text-red-700 rounded-xl flex items-start text-sm border border-red-100">
          <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <div className="overflow-x-auto">
        {loading && items.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-gray-500">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mb-4" />
            <p>Caricamento inventario in corso...</p>
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-gray-500">
            <PackageOpen className="w-12 h-12 text-gray-300 mb-4" />
            <p className="text-lg font-medium text-gray-900">Nessun articolo</p>
            <p>L'inventario è vuoto. Scansiona un'etichetta per iniziare.</p>
          </div>
        ) : (
          <table className="w-full text-left border-collapse min-w-[600px]">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100 text-sm text-gray-500">
                <th className="p-4 font-medium w-1/4">Codice</th>
                <th className="p-4 font-medium w-1/3">Descrizione</th>
                <th className="p-4 font-medium w-1/6">Lotto</th>
                <th className="p-4 font-medium text-right w-1/6">Quantità</th>
                <th className="p-4 font-medium text-right w-1/6">Azioni</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {currentItems.map((item) => (
                <tr key={item.id} className="even:bg-gray-50/30 hover:bg-indigo-50/40 transition-colors group">
                  {editingId === item.id ? (
                    // Modalità Modifica Inline
                    <>
                      <td className="p-2">
                        <input 
                          type="text" 
                          name="codice" 
                          value={editFormData.codice || ''} 
                          onChange={handleEditChange} 
                          className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                        />
                      </td>
                      <td className="p-2">
                        <input 
                          type="text" 
                          name="descrizione" 
                          value={editFormData.descrizione || ''} 
                          onChange={handleEditChange} 
                          className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                        />
                      </td>
                      <td className="p-2">
                        <input 
                          type="text" 
                          name="lotto" 
                          value={editFormData.lotto || ''} 
                          onChange={handleEditChange} 
                          className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                        />
                      </td>
                      <td className="p-2">
                        <input 
                          type="number" 
                          name="quantita" 
                          value={editFormData.quantita || 0} 
                          onChange={handleEditChange} 
                          className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-right"
                        />
                      </td>
                      <td className="p-2 text-right">
                        <div className="flex justify-end gap-1">
                          <button 
                            onClick={() => handleSaveEdit(item.id)} 
                            disabled={actionLoading}
                            className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-md transition-colors disabled:opacity-50"
                            title="Salva"
                          >
                            {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                          </button>
                          <button 
                            onClick={handleCancelEdit} 
                            disabled={actionLoading}
                            className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-md transition-colors disabled:opacity-50"
                            title="Annulla"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </>
                  ) : (
                    // Modalità Visualizzazione
                    <>
                      <td className="p-4 font-medium text-gray-900">{item.codice}</td>
                      <td className="p-4 text-gray-600">{item.descrizione}</td>
                      <td className="p-4 text-gray-600">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                          {item.lotto}
                        </span>
                      </td>
                      <td className="p-4 text-right font-semibold text-gray-900">{item.quantita}</td>
                      <td className="p-4 text-right">
                        <div className="flex justify-end gap-1">
                          <button 
                            onClick={() => handleEditClick(item)} 
                            className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors" 
                            title="Modifica"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => handleDeleteClick(item.id)} 
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded-md transition-colors" 
                            title="Elimina"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Controlli Paginazione */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-gray-50/50">
          <div className="text-sm text-gray-500 hidden sm:block">
            Mostrando da <span className="font-medium text-gray-900">{filteredItems.length === 0 ? 0 : startIndex + 1}</span> a <span className="font-medium text-gray-900">{Math.min(startIndex + ITEMS_PER_PAGE, filteredItems.length)}</span> di <span className="font-medium text-gray-900">{filteredItems.length}</span> articoli
          </div>
          <div className="flex items-center gap-1 w-full sm:w-auto justify-center sm:justify-end">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-1.5 rounded-md text-gray-500 hover:bg-gray-200 disabled:opacity-50 transition-colors"
              title="Pagina precedente"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            
            {getPageNumbers().map(page => (
              <button
                key={page}
                onClick={() => setCurrentPage(page)}
                className={`min-w-[32px] h-8 flex items-center justify-center rounded-md text-sm font-medium transition-colors ${
                  currentPage === page 
                    ? 'bg-indigo-600 text-white shadow-sm' 
                    : 'text-gray-700 hover:bg-gray-200'
                }`}
              >
                {page}
              </button>
            ))}

            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-1.5 rounded-md text-gray-500 hover:bg-gray-200 disabled:opacity-50 transition-colors"
              title="Pagina successiva"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* Modale di Conferma Eliminazione */}
      {deleteConfirmId !== null && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 text-red-600 mb-4">
              <div className="p-2 bg-red-50 rounded-full">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Conferma eliminazione</h3>
            </div>
            <p className="text-gray-600 mb-6 text-sm">
              Sei sicuro di voler eliminare questo articolo dall'inventario? Questa azione non può essere annullata.
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleCancelDelete}
                disabled={actionLoading}
                className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors text-sm"
              >
                Annulla
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={actionLoading}
                className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 transition-colors flex items-center justify-center text-sm shadow-sm"
              >
                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Elimina'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
