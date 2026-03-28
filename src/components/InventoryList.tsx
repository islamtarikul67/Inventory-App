import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { Loader2, AlertCircle, RefreshCw, Database, PackageOpen, Pencil, Trash2, Check, X, AlertTriangle, Download, ChevronLeft, ChevronRight, Search, FileSpreadsheet } from 'lucide-react';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'motion/react';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import JsBarcode from 'jsbarcode';

interface InventoryItem {
  id: number;
  codice: string;
  descrizione: string;
  lotto: string;
  quantita: number;
  created_at: string;
  sessione_id: string | null;
}

interface InventoryListProps {
  sessionId: string | null;
}

export default function InventoryList({ sessionId }: InventoryListProps) {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editFormData, setEditFormData] = useState<Partial<InventoryItem>>({});
  
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 20;
  const [totalCount, setTotalCount] = useState(0);

  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [placeholderIndex, setPlaceholderIndex] = useState(0);

  const searchPlaceholders = [
    "Cerca per codice...",
    "Cerca per descrizione...",
    "Cerca per lotto...",
    "Cerca per codice, descrizione o lotto..."
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setPlaceholderIndex((prev) => (prev + 1) % searchPlaceholders.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
      setCurrentPage(1);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const fetchInventory = async () => {
    setLoading(true);
    setError('');
    try {
      const from = (currentPage - 1) * ITEMS_PER_PAGE;
      const to = from + ITEMS_PER_PAGE - 1;

      let query = supabase
        .from('inventario')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(from, to);
      
      if (sessionId) {
        query = query.eq('sessione_id', sessionId);
      } else {
        query = query.is('sessione_id', null);
      }

      if (debouncedSearchTerm.trim()) {
        const search = `%${debouncedSearchTerm.trim()}%`;
        query = query.or(`codice.ilike.${search},descrizione.ilike.${search},lotto.ilike.${search}`);
      }
      
      const { data, error, count } = await query;
      
      if (error) throw error;
      setItems(data || []);
      setTotalCount(count || 0);
    } catch (err: any) {
      console.error('Errore nel recupero dati:', err);
      setError(err.message || 'Impossibile caricare l\'inventario.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInventory();
  }, [sessionId, currentPage, debouncedSearchTerm]);

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
          quantita: editFormData.quantita,
          note: editFormData.note
        })
        .eq('id', id);

      if (error) throw error;

      setItems(items.map(item => item.id === id ? { ...item, ...editFormData } as InventoryItem : item));
      setEditingId(null);
      toast.success('Articolo modificato!');
    } catch (err: any) {
      console.error('Errore durante la modifica:', err);
      toast.error(err.message || 'Impossibile modificare l\'articolo.');
    } finally {
      setActionLoading(false);
    }
  };

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

      setItems(items.filter(item => item.id !== deleteConfirmId));
      setDeleteConfirmId(null);
      toast.success('Articolo eliminato!');
    } catch (err: any) {
      console.error('Errore durante l\'eliminazione:', err);
      toast.error(err.message || 'Impossibile eliminare l\'articolo.');
    } finally {
      setActionLoading(false);
    }
  };

  const exportToPDF = async () => {
    setActionLoading(true);
    try {
      const match = debouncedSearchTerm.match(/^(\d{3})-/);
      const clientId = match ? match[1] : null;

      let query = supabase
        .from('inventario')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (sessionId) {
        query = query.eq('sessione_id', sessionId);
      } else {
        query = query.is('sessione_id', null);
      }

      if (debouncedSearchTerm.trim()) {
        const search = `%${debouncedSearchTerm.trim()}%`;
        query = query.or(`codice.ilike.${search},descrizione.ilike.${search},lotto.ilike.${search}`);
      }

      const { data: exportItems, error } = await query;
      if (error) throw error;

      if (!exportItems || exportItems.length === 0) {
        toast.error('Nessun dato da esportare');
        return;
      }

      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4',
        compress: true
      });

      // --- VECTOR BARCODE DRAWING HELPER ---
      const drawVectorBarcode = (text: string, x: number, y: number, w: number, h: number) => {
        if (!text) return;
        
        // Use a dummy SVG to get the barcode structure from JsBarcode
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        try {
          JsBarcode(svg, text, { 
            format: "CODE128", 
            displayValue: false, // CRITICAL: No text in the generated structure
            margin: 0,
            background: "none"
          });
          
          const rects = svg.querySelectorAll('rect');
          if (rects.length === 0) return;

          // Calculate total width in barcode units
          let maxRight = 0;
          rects.forEach(r => {
            const rx = parseFloat(r.getAttribute('x') || '0');
            const rw = parseFloat(r.getAttribute('width') || '0');
            maxRight = Math.max(maxRight, rx + rw);
          });

          // Calculate module width (0.32mm is standard for industrial scanners)
          // We use a fixed module width but scale down proportionally if the barcode is too long for the cell
          let moduleWidth = 0.32; 
          let barcodeWidth = maxRight * moduleWidth;
          
          // Ensure barcode fits within cell width minus a 4mm quiet zone (2mm each side)
          const maxUsableWidth = w - 4;
          if (barcodeWidth > maxUsableWidth) {
            moduleWidth = maxUsableWidth / maxRight;
            barcodeWidth = maxRight * moduleWidth;
          }
          
          // Center horizontally within the cell
          const startX = x + (w - barcodeWidth) / 2;
          
          // Vertical Layout:
          // h is cell height (min 22mm)
          // Top quiet zone: 3mm
          // Barcode height: 12mm
          // Text space: 4mm
          const topQuietZone = 3;
          const barcodeHeight = 12;
          const startY = y + topQuietZone;

          doc.setDrawColor(0, 0, 0);
          doc.setFillColor(0, 0, 0);
          
          rects.forEach(r => {
            const rx = parseFloat(r.getAttribute('x') || '0');
            const rw = parseFloat(r.getAttribute('width') || '0');
            const fill = r.getAttribute('fill');
            
            if (fill !== 'none' && fill !== 'white' && fill !== '#ffffff') {
              // Draw rectangle directly on PDF (Vector)
              // Proportional scaling ensures no horizontal distortion
              doc.rect(startX + (rx * moduleWidth), startY, rw * moduleWidth, barcodeHeight, 'F');
            }
          });

          // Draw human-readable text BELOW the barcode
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(7.5);
          doc.setTextColor(0, 0, 0);
          const textY = startY + barcodeHeight + 4; // 4mm gap below bars
          doc.text(text, x + w / 2, textY, { align: 'center' });
          
        } catch (e) {
          console.error('Barcode vector error:', e);
          doc.setFontSize(8);
          doc.text(text, x + w / 2, y + h / 2, { align: 'center' });
        }
      };

      // --- DOCUMENT HEADER ---
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.text(`REPORT INVENTARIO INDUSTRIALE ${clientId ? `- CLIENTE: ${clientId}` : ''}`, 14, 12);
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(100);
      doc.text(`Generato il: ${new Date().toLocaleString('it-IT')} | Totale Righe: ${exportItems.length}`, 14, 18);
      if (debouncedSearchTerm) {
        doc.text(`Filtro applicato: ${debouncedSearchTerm}`, 14, 22);
      }

      const tableData = exportItems.map((item, index) => [
        exportItems.length - index,
        item.codice, 
        item.descrizione,
        item.lotto, 
        item.note || '',
        item.quantita.toLocaleString('it-IT')
      ]);

      autoTable(doc, {
        startY: 26,
        head: [['N.', 'Codice', 'Descrizione', 'Lotto Barcode', 'Note', 'Q.tà']],
        body: tableData,
        theme: 'grid',
        headStyles: { 
          fillColor: [40, 40, 40], 
          textColor: 255, 
          fontStyle: 'bold', 
          halign: 'center',
          valign: 'middle',
          fontSize: 8,
          lineWidth: 0.1,
          lineColor: [0, 0, 0]
        },
        styles: { 
          fontSize: 8, 
          cellPadding: 1.5, 
          valign: 'middle',
          font: 'helvetica',
          lineWidth: 0.1,
          lineColor: [180, 180, 180],
          textColor: [0, 0, 0],
          minCellHeight: 22 // Increased to 22mm to ensure barcodes are never cut and have safe zones
        },
        columnStyles: {
          0: { cellWidth: 8, halign: 'center' },
          1: { cellWidth: 85, halign: 'center' }, // Codice Barcode
          2: { cellWidth: 75, halign: 'left', fontSize: 7, cellPadding: 2 }, // Descrizione
          3: { cellWidth: 64, halign: 'center' }, // Lotto Barcode (increased from 60 to use saved space)
          4: { cellWidth: 15, halign: 'center', fontSize: 7 }, // Note (reduced from 25)
          5: { cellWidth: 20, halign: 'right', fontStyle: 'bold', fontSize: 9 } // Q.tà (increased from 14)
        },
        rowPageBreak: 'avoid', // CRITICAL: Forces entire row to next page if it doesn't fit
        showHead: 'everyPage',
        margin: { left: 15, right: 15, top: 25, bottom: 15 },
        
        didParseCell: (data) => {
          // Prevent autoTable from drawing text in barcode columns
          if (data.section === 'body' && (data.column.index === 1 || data.column.index === 3)) {
            data.cell.text = []; 
          }
        },

        didDrawCell: (data) => {
          // Draw Vector Barcodes for Codice (1) and Lotto (3)
          if (data.section === 'body' && (data.column.index === 1 || data.column.index === 3)) {
            const rawValue = data.cell.raw;
            if (rawValue !== null && rawValue !== undefined) {
              const text = String(rawValue);
              drawVectorBarcode(
                text, 
                data.cell.x, 
                data.cell.y, 
                data.cell.width, 
                data.cell.height
              );
            }
          }
        },
        
        didDrawPage: (data) => {
          // Footer
          const pageCount = doc.internal.pages.length - 1;
          doc.setFontSize(7);
          doc.setTextColor(150);
          const pageSize = doc.internal.pageSize;
          const pageHeight = pageSize.height ? pageSize.height : pageSize.getHeight();
          const pageWidth = pageSize.width ? pageSize.width : pageSize.getWidth();
          
          doc.text(`Pagina ${pageCount}`, pageWidth - 25, pageHeight - 8);
          doc.text("Documento ad uso interno - Scansione industriale garantita", 10, pageHeight - 8);
        }
      });

      doc.save(`inventario_pro_${new Date().toISOString().split('T')[0]}.pdf`);
      toast.success('PDF Professionale generato!');
    } catch (err: any) {
      console.error('Errore esportazione PDF:', err);
      toast.error('Errore durante l\'esportazione PDF');
    } finally {
      setActionLoading(false);
    }
  };

  const exportToHTML = async () => {
    setActionLoading(true);
    try {
      // 1. Identificazione Cliente
      const match = debouncedSearchTerm.match(/^(\d{3})-/);
      const clientId = match ? match[1] : null;

      let query = supabase
        .from('inventario')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (sessionId) {
        query = query.eq('sessione_id', sessionId);
      } else {
        query = query.is('sessione_id', null);
      }

      // 2. Applicazione filtro di ricerca corrente
      if (debouncedSearchTerm.trim()) {
        const search = `%${debouncedSearchTerm.trim()}%`;
        query = query.or(`codice.ilike.${search},descrizione.ilike.${search},lotto.ilike.${search}`);
      }

      const { data: exportItems, error } = await query;
      if (error) throw error;

      if (!exportItems || exportItems.length === 0) {
        toast.error('Nessun dato da esportare');
        return;
      }

      // 3. Calcolo Sommario
      const totalRows = exportItems.length;
      const totalQty = exportItems.reduce((sum, item) => sum + item.quantita, 0);

      const htmlContent = `
<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <title>Report Inventario ${clientId ? `- Cliente ${clientId}` : ''}</title>
  <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>
  <style>
    body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; margin: 0; padding: 20px; color: #000; background: #fff; }
    @page { size: A4 landscape; margin: 10mm; }
    h1 { text-align: center; font-size: 18px; text-transform: uppercase; margin-bottom: 5px; }
    h2 { text-align: center; font-size: 14px; margin-bottom: 20px; color: #555; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; table-layout: fixed; }
    th, td { border: 1px solid #000; padding: 6px 4px; vertical-align: middle; line-height: 1.2; }
    th { background-color: #f0f0f0; font-weight: bold; text-transform: uppercase; font-size: 9px; text-align: center; }
    
    /* Column Widths for Landscape */
    th:nth-child(1) { width: 3%; }  /* N. */
    th:nth-child(2) { width: 45%; } /* CODICE - Aumentato per barcode lunghi */
    th:nth-child(3) { width: 20%; } /* DESCRIZIONE - Ridotto per far spazio */
    th:nth-child(4) { width: 18%; } /* LOTTO BARCODE */
    th:nth-child(5) { width: 7%; }  /* NOTE */
    th:nth-child(6) { width: 7%; }  /* QUANTITÀ */
    
    .barcode-cell { text-align: center; padding: 4px 2px; overflow: hidden; }
    .barcode-svg { height: auto; display: block; margin: 0 auto; max-width: 100%; }
    .desc-cell { font-size: 9px; word-wrap: break-word; overflow-wrap: break-word; }
    .note-cell { font-size: 8px; text-align: center; }
    .qty-cell { text-align: right; font-weight: bold; font-size: 11px; }
    
    .summary { font-size: 12px; font-weight: bold; margin-top: 10px; border-top: 2px solid #000; padding-top: 10px; }
    
    @media print {
      .no-print { display: none !important; }
      table { page-break-inside: auto; }
      tr { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <h1>Report Inventario ${clientId ? `Cliente: ${clientId}` : ''}</h1>
  ${clientId ? `<h2>Filtro attivo: ${debouncedSearchTerm}</h2>` : ''}
  <table>
    <thead>
      <tr>
        <th>N.</th>
        <th>Codice</th>
        <th>Descrizione</th>
        <th>Lotto Barcode</th>
        <th>Note</th>
        <th>Quantità</th>
      </tr>
    </thead>
    <tbody>
      ${exportItems.map((item, index) => `
        <tr>
          <td class="note-cell">${exportItems.length - index}</td>
          <td class="barcode-cell">
            <svg class="barcode-svg codice-barcode" data-value="${item.codice}"></svg>
          </td>
          <td class="desc-cell">${item.descrizione}</td>
          <td class="barcode-cell">
            <svg class="barcode-svg lotto-barcode" data-value="${item.lotto}"></svg>
          </td>
          <td class="note-cell">${item.note || ''}</td>
          <td class="qty-cell">${item.quantita}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>
  <script>
    // Generate Barcodes
    document.querySelectorAll('.barcode-svg').forEach(svg => {
      const value = svg.getAttribute('data-value');
      if (value) {
        try {
          JsBarcode(svg, value, { 
            format: "CODE128", 
            width: 1.0, 
            height: 25, 
            displayValue: true, 
            fontSize: 8, 
            margin: 0, 
            textMargin: 1 
          });
        } catch (e) { svg.outerHTML = "<span style='font-size: 8px;'>" + value + "</span>"; }
      }
    });
    setTimeout(() => { window.print(); }, 800);
  </script>
</body>
</html>
    `;

    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `inventario_stampa_${new Date().toISOString().split('T')[0]}.html`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    } catch (err: any) {
      console.error('Errore esportazione:', err);
      toast.error('Errore durante l\'esportazione');
    } finally {
      setActionLoading(false);
    }
  };

  const exportToExcel = async () => {
    setActionLoading(true);
    try {
      let query = supabase
        .from('inventario')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (sessionId) {
        query = query.eq('sessione_id', sessionId);
      } else {
        query = query.is('sessione_id', null);
      }

      // Applicazione filtro di ricerca corrente
      if (debouncedSearchTerm.trim()) {
        const search = `%${debouncedSearchTerm.trim()}%`;
        query = query.or(`codice.ilike.${search},descrizione.ilike.${search},lotto.ilike.${search}`);
      }

      const { data: exportItems, error } = await query;
      if (error) throw error;

      if (!exportItems || exportItems.length === 0) {
        toast.error('Nessun dato da esportare');
        return;
      }

      // Prepara i dati per Excel (senza barcode, solo testo)
      const data = exportItems.map((item, index) => ({
        'N.': exportItems.length - index,
        'Codice': item.codice,
        'Descrizione': item.descrizione,
        'Lotto': item.lotto,
        'Note': item.note || '',
        'Quantità': item.quantita,
        'Data Creazione': new Date(item.created_at).toLocaleString('it-IT')
      }));

      const worksheet = XLSX.utils.json_to_sheet(data);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Inventario");

      // Imposta larghezza colonne
      const wscols = [
        { wch: 5 },  // N.
        { wch: 20 }, // Codice
        { wch: 40 }, // Descrizione
        { wch: 15 }, // Lotto
        { wch: 20 }, // Note
        { wch: 10 }, // Quantità
        { wch: 20 }  // Data
      ];
      worksheet['!cols'] = wscols;

      XLSX.writeFile(workbook, `inventario_${new Date().toISOString().split('T')[0]}.xlsx`);
      toast.success('File Excel generato con successo!');
    } catch (err: any) {
      console.error('Errore esportazione Excel:', err);
      toast.error('Errore durante l\'esportazione Excel');
    } finally {
      setActionLoading(false);
    }
  };

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);
  const currentItems = items;

  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages);
    } else if (totalPages > 0 && currentPage === 0) {
      setCurrentPage(1);
    }
  }, [totalCount, currentPage, totalPages]);

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
    <div className="bg-[#f3f4f6] p-5 min-h-full">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-5xl mx-auto space-y-6"
      >
        <div className="bg-white rounded-[18px] p-[20px_24px] shadow-[0_6px_24px_rgba(0,0,0,0.06)] flex flex-col lg:flex-row items-start lg:items-center gap-4 lg:gap-6 relative z-10">
          <div className="flex items-center gap-4 flex-shrink-0">
            <div className="bg-[#eef2ff] text-[#4f46e5] p-3 rounded-[12px] flex items-center justify-center flex-shrink-0">
              <Database className="w-7 h-7 sm:w-8 sm:h-8" />
            </div>
            <div className="min-w-fit">
              <h2 className="text-[24px] font-bold tracking-[-0.02em] text-[#111827] leading-none">
                Inventario
              </h2>
              <p className="text-[11px] tracking-[0.12em] text-[#9ca3af] mt-1 uppercase">Gestione articoli</p>
            </div>
          </div>
          
          <div className="flex flex-1 flex-col sm:flex-row items-stretch sm:items-center gap-3 lg:gap-4 w-full">
            <div className="flex items-center gap-3 px-3 py-1.5 bg-[#eef2ff] border border-[#e0e7ff] text-[#4f46e5] rounded-full font-semibold flex-shrink-0">
              <span className="text-[10px] uppercase tracking-[0.15em]">Righe</span>
              <div className="w-px h-4 bg-[#e0e7ff]"></div>
              <span className="text-lg leading-none">{totalCount}</span>
            </div>
            
            <div className="relative flex-1 max-w-full sm:max-w-[300px] lg:max-w-[400px]">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-slate-400" />
              </div>
              <input
                type="text"
                placeholder={searchPlaceholders[placeholderIndex]}
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="block w-full pl-11 pr-4 py-2.5 bg-[#f9fafb] border border-[#e5e7eb] rounded-full font-semibold text-slate-700 placeholder:text-slate-300 focus:border-[#6366f1] focus:bg-white transition-all text-sm outline-none"
              />
            </div>

            <div className="flex items-center gap-2 sm:gap-2.5 flex-shrink-0 ml-auto">
              <button 
                onClick={exportToPDF}
                disabled={loading || items.length === 0}
                className="flex items-center justify-center gap-2 rounded-[10px] px-4 py-2.5 font-semibold border-none cursor-pointer bg-[#111827] text-white hover:brightness-90 transition-all disabled:opacity-50 whitespace-nowrap"
                title="Esporta in PDF"
              >
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">PDF</span>
              </button>
              <button 
                onClick={exportToHTML}
                disabled={loading || items.length === 0}
                className="flex items-center justify-center gap-2 rounded-[10px] px-4 py-2.5 font-semibold border-none cursor-pointer bg-[#2563eb] text-white hover:brightness-90 transition-all disabled:opacity-50 whitespace-nowrap"
                title="Stampa"
              >
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">Stampa</span>
              </button>
              <button 
                onClick={exportToExcel}
                disabled={loading || items.length === 0}
                className="flex items-center justify-center gap-2 rounded-[10px] px-4 py-2.5 font-semibold border-none cursor-pointer bg-[#217346] text-white hover:brightness-90 transition-all disabled:opacity-50 whitespace-nowrap"
                title="Excel"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span className="hidden sm:inline">Excel</span>
              </button>
              <button 
                onClick={fetchInventory}
                disabled={loading || actionLoading}
                className="p-2.5 rounded-[10px] font-semibold border-none cursor-pointer bg-[#e5e7eb] text-[#374151] hover:brightness-90 transition-all shadow-sm flex-shrink-0"
                title="Aggiorna"
              >
                <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
        </div>

        <AnimatePresence>
          {error && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="p-4 bg-rose-50 text-rose-600 rounded-2xl flex items-start text-xs font-bold border border-rose-100"
            >
              <AlertCircle className="w-4 h-4 mr-2 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="bg-white rounded-[16px] shadow-[0_6px_24px_rgba(0,0,0,0.06)] overflow-hidden">
          <AnimatePresence mode="wait">
            {loading && items.length === 0 ? (
              <motion.div 
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center p-20 text-slate-400"
              >
                <Loader2 className="w-12 h-12 animate-spin text-indigo-600 mb-6" />
                <p className="font-bold uppercase tracking-widest text-xs">Caricamento dati...</p>
              </motion.div>
            ) : items.length === 0 ? (
              <motion.div 
                key="empty"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center p-20 text-slate-400"
              >
                <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mb-8">
                  <PackageOpen className="w-12 h-12 text-slate-200" />
                </div>
                <p className="text-xl font-black text-slate-900 tracking-tight">Inventario Vuoto</p>
                <p className="text-sm font-medium mt-2">Inizia a scansionare per vedere qui i tuoi articoli.</p>
              </motion.div>
            ) : (
              <motion.div 
                key="content"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <div className="hidden md:block">
                  <table className="w-full border-collapse bg-white">
                    <thead>
                      <tr className="bg-[#f8fafc]">
                        <th className="text-[12px] tracking-[0.1em] uppercase text-[#6b7280] p-[14px_12px] border-b-2 border-[#e5e7eb] w-[5%] text-center">#</th>
                        <th className="text-[12px] tracking-[0.1em] uppercase text-[#6b7280] p-[14px_12px] border-b-2 border-[#e5e7eb] w-[20%]">Codice</th>
                        <th className="text-[12px] tracking-[0.1em] uppercase text-[#6b7280] p-[14px_12px] border-b-2 border-[#e5e7eb] w-[30%]">Descrizione</th>
                        <th className="text-[12px] tracking-[0.1em] uppercase text-[#6b7280] p-[14px_12px] border-b-2 border-[#e5e7eb] w-[15%] text-center">Lotto</th>
                        <th className="text-[12px] tracking-[0.1em] uppercase text-[#6b7280] p-[14px_12px] border-b-2 border-[#e5e7eb] w-[10%] text-center">Note</th>
                        <th className="text-[12px] tracking-[0.1em] uppercase text-[#6b7280] p-[14px_12px] border-b-2 border-[#e5e7eb] text-right w-[10%]">Quantità</th>
                        <th className="text-[12px] tracking-[0.1em] uppercase text-[#6b7280] p-[14px_12px] border-b-2 border-[#e5e7eb] text-right w-[10%]">Azioni</th>
                      </tr>
                    </thead>
                  <tbody className="divide-y divide-slate-100">
                    <AnimatePresence initial={false}>
                      {currentItems.map((item, index) => (
                        <motion.tr 
                          key={item.id} 
                          layout
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, x: -20 }}
                          className={`group transition-all duration-200 hover:bg-[#f9fafb] ${editingId === item.id ? 'bg-indigo-50/80 ring-1 ring-indigo-200' : index % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}
                        >
                          {editingId === item.id ? (
                            <>
                              <td className="p-[14px_12px] border-b border-[#f1f5f9] text-center overflow-hidden">
                                <span className="text-xs font-bold text-slate-400">{totalCount - ((currentPage - 1) * ITEMS_PER_PAGE + index)}</span>
                              </td>
                              <td className="p-[14px_12px] border-b border-[#f1f5f9] overflow-hidden">
                                <input 
                                  type="text" 
                                  name="codice" 
                                  value={editFormData.codice || ''} 
                                  onChange={handleEditChange} 
                                  className="w-full px-3 py-2.5 text-sm font-semibold border border-indigo-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none bg-white shadow-sm transition-all"
                                />
                              </td>
                              <td className="p-[14px_12px] border-b border-[#f1f5f9] overflow-hidden">
                                <input 
                                  type="text" 
                                  name="descrizione" 
                                  value={editFormData.descrizione || ''} 
                                  onChange={handleEditChange} 
                                  className="w-full px-3 py-2.5 text-sm font-semibold border border-indigo-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none bg-white shadow-sm transition-all"
                                />
                              </td>
                              <td className="p-[14px_12px] border-b border-[#f1f5f9] text-center overflow-hidden">
                                <input 
                                  type="text" 
                                  name="lotto" 
                                  value={editFormData.lotto || ''} 
                                  onChange={handleEditChange} 
                                  className="w-full px-3 py-2.5 text-sm font-semibold border border-indigo-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none bg-white shadow-sm transition-all text-center"
                                />
                              </td>
                              <td className="p-[14px_12px] border-b border-[#f1f5f9] text-center overflow-hidden">
                                <input 
                                  type="text" 
                                  name="note" 
                                  value={editFormData.note || ''} 
                                  onChange={handleEditChange} 
                                  className="w-full px-3 py-2.5 text-sm font-semibold border border-indigo-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none bg-white shadow-sm transition-all text-center"
                                  placeholder="Note..."
                                />
                              </td>
                              <td className="p-[14px_12px] border-b border-[#f1f5f9] text-right overflow-hidden">
                                <input 
                                  type="number" 
                                  name="quantita" 
                                  value={editFormData.quantita || 0} 
                                  onChange={handleEditChange} 
                                  className="w-full px-3 py-2.5 text-sm font-semibold border border-indigo-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none bg-white shadow-sm text-right transition-all"
                                />
                              </td>
                              <td className="p-[14px_12px] border-b border-[#f1f5f9] text-right overflow-hidden">
                                <div className="flex justify-end gap-2">
                                  <button 
                                    onClick={() => handleSaveEdit(item.id)} 
                                    disabled={actionLoading}
                                    className="p-2.5 text-white bg-emerald-500 hover:bg-emerald-600 rounded-lg transition-colors shadow-sm"
                                  >
                                    {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                                  </button>
                                  <button 
                                    onClick={handleCancelEdit} 
                                    disabled={actionLoading}
                                    className="p-2.5 text-slate-500 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors shadow-sm"
                                  >
                                    <X className="w-4 h-4" />
                                  </button>
                                </div>
                              </td>
                            </>
                          ) : (
                            <>
                              <td className="p-[14px_12px] border-b border-[#f1f5f9] text-center overflow-hidden">
                                <span className="text-xs font-bold text-slate-400">{totalCount - ((currentPage - 1) * ITEMS_PER_PAGE + index)}</span>
                              </td>
                              <td className="p-[14px_12px] border-b border-[#f1f5f9] overflow-hidden">
                                <span className="text-sm font-bold text-slate-900">{item.codice}</span>
                              </td>
                              <td className="p-[14px_12px] border-b border-[#f1f5f9] overflow-hidden">
                                <span className="text-sm font-medium text-slate-600">{item.descrizione}</span>
                              </td>
                              <td className="p-[14px_12px] border-b border-[#f1f5f9] text-center overflow-hidden">
                                <span className="inline-flex items-center px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest bg-slate-100 text-slate-600 border border-slate-200/50">
                                  {item.lotto}
                                </span>
                              </td>
                              <td className="p-[14px_12px] border-b border-[#f1f5f9] text-center overflow-hidden">
                                <span className="text-xs font-medium text-slate-500">{item.note || '-'}</span>
                              </td>
                              <td className="p-[14px_12px] border-b border-[#f1f5f9] text-right overflow-hidden">
                                <span className="bg-[#eef2ff] text-[#4338ca] font-bold px-2.5 py-1.5 rounded-[8px]">
                                  {item.quantita}
                                </span>
                              </td>
                              <td className="p-[14px_12px] border-b border-[#f1f5f9] text-right overflow-hidden">
                                <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                                  <button 
                                    onClick={() => handleEditClick(item)} 
                                    className="p-2.5 text-indigo-600 hover:bg-indigo-100 rounded-xl transition-colors" 
                                  >
                                    <Pencil className="w-4 h-4" />
                                  </button>
                                  <button 
                                    onClick={() => handleDeleteClick(item.id)} 
                                    className="p-2.5 text-rose-500 hover:bg-rose-100 rounded-xl transition-colors" 
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </td>
                            </>
                          )}
                        </motion.tr>
                      ))}
                    </AnimatePresence>
                  </tbody>
                </table>
              </div>

              <div className="md:hidden flex flex-col gap-4">
                <AnimatePresence initial={false}>
                  {currentItems.map((item, index) => (
                    <motion.div 
                      key={item.id} 
                      layout
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      className={`p-[20px] rounded-[18px] border transition-all duration-300 shadow-[0_6px_24px_rgba(0,0,0,0.06)] ${editingId === item.id ? 'bg-indigo-50/50 border-indigo-200' : 'bg-white border-slate-100 hover:border-indigo-100'}`}
                    >
                      {editingId === item.id ? (
                        <div className="space-y-4">
                          <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Codice</label>
                            <input 
                              type="text" 
                              name="codice" 
                              value={editFormData.codice || ''} 
                              onChange={handleEditChange} 
                              className="w-full px-4 py-3 text-sm font-bold border border-indigo-200 rounded-xl focus:ring-0 outline-none bg-white"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Descrizione</label>
                            <input 
                              type="text" 
                              name="descrizione" 
                              value={editFormData.descrizione || ''} 
                              onChange={handleEditChange} 
                              className="w-full px-4 py-3 text-sm font-bold border border-indigo-200 rounded-xl focus:ring-0 outline-none bg-white"
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Lotto</label>
                              <input 
                                type="text" 
                                name="lotto" 
                                value={editFormData.lotto || ''} 
                                onChange={handleEditChange} 
                                className="w-full px-4 py-3 text-sm font-bold border border-indigo-200 rounded-xl focus:ring-0 outline-none bg-white"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Quantità</label>
                              <input 
                                type="number" 
                                name="quantita" 
                                value={editFormData.quantita || 0} 
                                onChange={handleEditChange} 
                                className="w-full px-4 py-3 text-sm font-bold border border-indigo-200 rounded-xl focus:ring-0 outline-none bg-white text-right"
                              />
                            </div>
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Note</label>
                            <input 
                              type="text" 
                              name="note" 
                              value={editFormData.note || ''} 
                              onChange={handleEditChange} 
                              className="w-full px-4 py-3 text-sm font-bold border border-indigo-200 rounded-xl focus:ring-0 outline-none bg-white"
                            />
                          </div>
                          <div className="flex justify-end gap-2 pt-4 border-t border-indigo-100/50 mt-4">
                            <button 
                              onClick={handleCancelEdit} 
                              disabled={actionLoading}
                              className="px-6 py-3 text-xs font-black uppercase tracking-widest text-slate-500 bg-white border border-slate-100 rounded-xl transition-all"
                            >
                              Annulla
                            </button>
                            <button 
                              onClick={() => handleSaveEdit(item.id)} 
                              disabled={actionLoading}
                              className="px-6 py-3 text-xs font-black uppercase tracking-widest text-white bg-emerald-500 rounded-xl transition-all shadow-lg shadow-emerald-100"
                            >
                              {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salva'}
                            </button>
                          </div>
                        </div>
                      ) : (
                      <div className="space-y-3">
                        <div className="flex justify-between items-start gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="font-bold text-[#111827] text-lg tracking-tight break-words leading-tight">
                              {item.codice}
                            </div>
                            <div className="text-xs font-medium text-slate-400 mt-2 leading-relaxed">
                              {item.descrizione}
                            </div>
                          </div>
                          <div className="flex-shrink-0 bg-[#eef2ff] text-[#4338ca] font-bold px-2.5 py-1.5 rounded-[8px] shadow-sm">
                            x{item.quantita}
                          </div>
                        </div>
                        
                        <div className="flex items-end justify-between pt-4 border-t border-slate-100 gap-4">
                          <div className="flex flex-col gap-2.5 flex-1 min-w-0">
                            <span className="inline-flex items-center px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest bg-[#f8fafc] text-[#6b7280] border border-[#e5e7eb] w-fit">
                              Lotto: {item.lotto}
                            </span>
                            <div className="flex items-center gap-2 flex-wrap">
                              {item.note && (
                                <span className="text-xs font-medium text-slate-500 truncate max-w-[120px] sm:max-w-[200px] bg-slate-50 px-2 py-1 rounded-md border border-slate-100">
                                  {item.note}
                                </span>
                              )}
                              <span className="flex items-center justify-center px-2 py-0.5 bg-slate-100 rounded-md text-[10px] font-bold text-slate-400 w-fit flex-shrink-0">
                                #{totalCount - ((currentPage - 1) * ITEMS_PER_PAGE + index)}
                              </span>
                            </div>
                          </div>
                          <div className="flex gap-1.5 flex-shrink-0">
                            <button 
                              onClick={() => handleEditClick(item)} 
                              className="p-3 text-indigo-600 hover:bg-indigo-50 rounded-2xl transition-all border border-transparent hover:border-indigo-100" 
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => handleDeleteClick(item.id)} 
                              className="p-3 text-rose-500 hover:bg-rose-50 rounded-2xl transition-all border border-transparent hover:border-rose-100" 
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                      )}
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between px-8 py-6 border-t border-slate-50 bg-white rounded-[16px] mt-6 shadow-[0_6px_24px_rgba(0,0,0,0.06)]">
          <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 hidden sm:block">
            Pagina <span className="text-slate-900">{currentPage}</span> di <span className="text-slate-900">{totalPages}</span>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto justify-center sm:justify-end">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-2.5 rounded-xl text-slate-400 hover:bg-slate-200 disabled:opacity-30 transition-all"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            
            <div className="flex items-center gap-1">
              {getPageNumbers().map(page => (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`min-w-[36px] h-9 flex items-center justify-center rounded-xl text-xs font-black transition-all ${
                    currentPage === page 
                      ? 'bg-slate-900 text-white shadow-lg' 
                      : 'text-slate-500 hover:bg-slate-200'
                  }`}
                >
                  {page}
                </button>
              ))}
            </div>

            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-2.5 rounded-xl text-slate-400 hover:bg-slate-200 disabled:opacity-30 transition-all"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      </motion.div>

      <AnimatePresence>
        {deleteConfirmId !== null && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-50 p-6"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white rounded-[2.5rem] p-10 max-w-sm w-full shadow-2xl border border-slate-100"
            >
              <div className="flex flex-col items-center text-center">
                <div className="w-20 h-20 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center mb-6">
                  <AlertTriangle className="w-10 h-10" />
                </div>
                <h3 className="text-2xl font-black text-slate-900 tracking-tight mb-4">Sei sicuro?</h3>
                <p className="text-slate-500 mb-10 leading-relaxed font-medium">
                  Questa azione eliminerà definitivamente l'articolo dall'inventario. Non potrai tornare indietro.
                </p>
                <div className="flex flex-col gap-3 w-full">
                  <button
                    onClick={handleConfirmDelete}
                    disabled={actionLoading}
                    className="w-full py-5 bg-rose-500 text-white rounded-2xl font-black uppercase tracking-widest text-sm hover:bg-rose-600 transition-all shadow-xl shadow-rose-100 flex items-center justify-center"
                  >
                    {actionLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Sì, Elimina'}
                  </button>
                  <button
                    onClick={handleCancelDelete}
                    disabled={actionLoading}
                    className="w-full py-5 bg-slate-100 text-slate-700 rounded-2xl font-black uppercase tracking-widest text-sm hover:bg-slate-200 transition-all"
                  >
                    Annulla
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
