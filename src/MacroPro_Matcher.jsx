import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { Download, Upload, Filter, Search, UserCheck, Building2, AlertCircle, CheckCircle2, X } from 'lucide-react';
import { generateReport } from './reportGenerator';

const MacroProMatcher = () => {
  // Estados principales
  const [inventory, setInventory] = useState([]);
  const [clients, setClients] = useState([]);
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Estados de filtros
  const [selectedAsesor, setSelectedAsesor] = useState('todos');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMatches, setSelectedMatches] = useState(new Set());
  
  // Estados de archivos
  const [inventoryLoaded, setInventoryLoaded] = useState(false);
  const [clientsLoaded, setClientsLoaded] = useState(false);

  // Función mejorada de normalización de headers
  const normalizeHeader = (header) => {
    if (!header) return '';
    
    let normalized = String(header)
      .replace(/\*/g, '')  // Quitar asteriscos
      .replace(/▼/g, '')   // Quitar flechas dropdown
      .trim()
      .toLowerCase();
    
    // Normalizar acentos
    const accentMap = {
      'á': 'a', 'é': 'e', 'í': 'i', 'ó': 'o', 'ú': 'u',
      'Á': 'a', 'É': 'e', 'Í': 'i', 'Ó': 'o', 'Ú': 'u',
      'ñ': 'n', 'Ñ': 'n'
    };
    
    Object.keys(accentMap).forEach(char => {
      normalized = normalized.replace(new RegExp(char, 'g'), accentMap[char]);
    });
    
    // FIX CRÍTICO: Normalizar símbolos especiales
    normalized = normalized
      .replace(/²/g, '2')           // m² -> m2
      .replace(/³/g, '3')           // m³ -> m3
      .replace(/\./g, '')           // Quitar puntos
      .replace(/\s+/g, ' ')         // Normalizar espacios múltiples
      .trim();
    
    return normalized;
  };

  // Función para encontrar columna por múltiples búsquedas
  const findColumn = (colIdx, searches) => {
    for (const [key, idx] of Object.entries(colIdx)) {
      for (const search of searches) {
        if (key.includes(search) || search.includes(key)) {
          return idx;
        }
      }
    }
    return null;
  };

  // Función mejorada para parsear números
  const toNum = (val) => {
    if (val === null || val === undefined || val === '') return null;
    if (typeof val === 'number') return val;
    
    let str = String(val)
      .replace(/\$/g, '')
      .replace(/,/g, '')
      .replace(/\./g, '')  // Quitar puntos que son separadores de miles
      .trim();
    
    const num = parseFloat(str);
    return isNaN(num) ? null : num;
  };

  // Cargar Inventario
  const handleInventoryUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setLoading(true);
    setError('');

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null });

        // Headers en fila 5 (índice 4)
        const headerRow = rawData[4];
        if (!headerRow) {
          throw new Error('No se encontraron headers en fila 5');
        }

        // Crear mapa de columnas normalizado
        const colIdx = {};
        headerRow.forEach((h, idx) => {
          if (h) {
            const normalized = normalizeHeader(h);
            if (normalized) {
              colIdx[normalized] = idx;
            }
          }
        });

        console.log('📦 Inventario colIdx:', Object.keys(colIdx).sort());

        // Buscar columnas críticas
        const cols = {
          id: findColumn(colIdx, ['id macrolote', 'id']),
          nombre: findColumn(colIdx, ['nombre / clave', 'nombre', 'clave']),
          asesor: findColumn(colIdx, ['asesor opcionador', 'asesor']),
          estado: findColumn(colIdx, ['estado']),
          ciudad: findColumn(colIdx, ['ciudad / municipio', 'ciudad']),
          superficie: findColumn(colIdx, ['superficie (m2)', 'superficie']),
          precio_m2: findColumn(colIdx, ['precio por m2', 'precio m2']),
          precio_total: findColumn(colIdx, ['precio total']),
          uso_1: findColumn(colIdx, ['uso_1', 'uso 1']),
          uso_2: findColumn(colIdx, ['uso_2', 'uso 2']),
          uso_3: findColumn(colIdx, ['uso_3', 'uso 3']),
          status: findColumn(colIdx, ['status'])
        };

        console.log('📦 Inventario columnas mapeadas:', cols);

        // Verificar columnas críticas
        const missing = Object.entries(cols).filter(([k, v]) => v === null).map(([k]) => k);
        if (missing.length > 0) {
          console.warn('⚠️ Columnas no encontradas:', missing);
        }

        // Procesar datos (desde fila 6, índice 5)
        const processed = [];
        for (let i = 5; i < rawData.length; i++) {
          const row = rawData[i];
          if (!row || !row[cols.id]) continue;

          const macrolote = {
            id: row[cols.id] || '',
            nombre: row[cols.nombre] || '',
            asesor: row[cols.asesor] || '',
            estado: row[cols.estado] || '',
            ciudad: row[cols.ciudad] || '',
            superficie: toNum(row[cols.superficie]),
            precio_m2: toNum(row[cols.precio_m2]),
            precio_total: toNum(row[cols.precio_total]),
            uso_1: row[cols.uso_1] || '',
            uso_2: row[cols.uso_2] || '',
            uso_3: row[cols.uso_3] || '',
            status: row[cols.status] || ''
          };

          // Solo incluir si tiene status "Disponible"
          if (macrolote.status && macrolote.status.toLowerCase().includes('disponible')) {
            processed.push(macrolote);
          }
        }

        console.log(`✅ Inventario cargado: ${processed.length} macrolotes disponibles`);
        setInventory(processed);
        setInventoryLoaded(true);

      } catch (err) {
        console.error('Error procesando inventario:', err);
        setError(`Error al procesar inventario: ${err.message}`);
      } finally {
        setLoading(false);
      }
    };

    reader.readAsArrayBuffer(file);
  };

  // Cargar Clientes
  const handleClientsUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setLoading(true);
    setError('');

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null });

        // Headers en fila 5 (índice 4)
        const headerRow = rawData[4];
        if (!headerRow) {
          throw new Error('No se encontraron headers en fila 5');
        }

        // Crear mapa de columnas normalizado
        const colIdx = {};
        headerRow.forEach((h, idx) => {
          if (h) {
            const normalized = normalizeHeader(h);
            if (normalized) {
              colIdx[normalized] = idx;
            }
          }
        });

        console.log('👥 Clientes colIdx:', Object.keys(colIdx).sort());

        // Buscar columnas críticas
        const cols = {
          id: findColumn(colIdx, ['id cliente', 'id']),
          nombre: findColumn(colIdx, ['nombre completo', 'nombre']),
          asesor: findColumn(colIdx, ['asesor']),
          estado_1: findColumn(colIdx, ['estado 1', 'estado1']),
          ciudad_1: findColumn(colIdx, ['ciudad 1', 'ciudad1']),
          uso_1: findColumn(colIdx, ['uso_buscado_1', 'uso buscado 1']),
          uso_2: findColumn(colIdx, ['uso_buscado_2', 'uso buscado 2']),
          uso_3: findColumn(colIdx, ['uso_buscado_3', 'uso buscado 3']),
          sup_min: findColumn(colIdx, ['sup min (m2)', 'sup min', 'superficie minima']),
          sup_max: findColumn(colIdx, ['sup max (m2)', 'sup max', 'superficie maxima']),
          ppto_min: findColumn(colIdx, ['ppto min ($mxn)', 'ppto min', 'presupuesto minimo']),
          ppto_max: findColumn(colIdx, ['ppto max ($mxn)', 'ppto max', 'presupuesto maximo']),
          temperatura: findColumn(colIdx, ['temperatura']),
          status_crm: findColumn(colIdx, ['status crm', 'statuscrm'])
        };

        console.log('👥 Clientes columnas mapeadas:', cols);

        // Verificar columnas críticas
        const missing = Object.entries(cols).filter(([k, v]) => v === null).map(([k]) => k);
        if (missing.length > 0) {
          console.warn('⚠️ Columnas no encontradas:', missing);
        }

        // Procesar datos (desde fila 6, índice 5)
        const processed = [];
        for (let i = 5; i < rawData.length; i++) {
          const row = rawData[i];
          if (!row || !row[cols.id]) continue;

          const cliente = {
            id: row[cols.id] || '',
            nombre: row[cols.nombre] || '',
            asesor: row[cols.asesor] || '',
            estado: row[cols.estado_1] || '',
            ciudad: row[cols.ciudad_1] || '',
            uso_1: row[cols.uso_1] || '',
            uso_2: row[cols.uso_2] || '',
            uso_3: row[cols.uso_3] || '',
            sup_min: toNum(row[cols.sup_min]),
            sup_max: toNum(row[cols.sup_max]),
            ppto_min: toNum(row[cols.ppto_min]),
            ppto_max: toNum(row[cols.ppto_max]),
            temperatura: row[cols.temperatura] || '',
            status_crm: row[cols.status_crm] || ''
          };

          processed.push(cliente);
        }

        console.log(`✅ Clientes cargados: ${processed.length} registros`);
        setClients(processed);
        setClientsLoaded(true);

      } catch (err) {
        console.error('Error procesando clientes:', err);
        setError(`Error al procesar clientes: ${err.message}`);
      } finally {
        setLoading(false);
      }
    };

    reader.readAsArrayBuffer(file);
  };

  // Motor de matching mejorado
  const calculateMatches = () => {
    if (inventory.length === 0 || clients.length === 0) {
      setError('Carga ambos archivos primero');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const allMatches = [];

      clients.forEach(cliente => {
        inventory.forEach(macrolote => {
          let score = 0;
          const reasons = [];

          // 1. Match de ubicación (30 puntos)
          if (cliente.estado && macrolote.estado) {
            const estadoMatch = cliente.estado.toLowerCase() === macrolote.estado.toLowerCase();
            if (estadoMatch) {
              score += 30;
              reasons.push('✓ Estado coincide');
            }
          }

          // 2. Match de uso de suelo (40 puntos)
          const clienteUsos = [cliente.uso_1, cliente.uso_2, cliente.uso_3]
            .filter(u => u && u !== 'N/A')
            .map(u => u.toLowerCase().trim());
          
          const macroloteUsos = [macrolote.uso_1, macrolote.uso_2, macrolote.uso_3]
            .filter(u => u && u !== 'N/A')
            .map(u => u.toLowerCase().trim());

          let usoMatches = 0;
          clienteUsos.forEach(cUso => {
            if (macroloteUsos.some(mUso => mUso.includes(cUso) || cUso.includes(mUso))) {
              usoMatches++;
            }
          });

          if (usoMatches > 0) {
            score += usoMatches * 15;
            reasons.push(`✓ ${usoMatches} uso(s) compatible(s)`);
          }

          // 3. Match de superficie (15 puntos)
          if (macrolote.superficie && cliente.sup_min && cliente.sup_max) {
            if (macrolote.superficie >= cliente.sup_min && macrolote.superficie <= cliente.sup_max) {
              score += 15;
              reasons.push('✓ Superficie en rango');
            }
          }

          // 4. Match de presupuesto (15 puntos)
          if (macrolote.precio_total && cliente.ppto_max) {
            if (macrolote.precio_total <= cliente.ppto_max) {
              score += 15;
              reasons.push('✓ Precio dentro del presupuesto');
            }
          }

          // Solo guardar matches con score > 30
          if (score >= 30) {
            allMatches.push({
              cliente,
              macrolote,
              score,
              reasons
            });
          }
        });
      });

      // Ordenar por score descendente
      allMatches.sort((a, b) => b.score - a.score);
      
      console.log(`✅ Matching completado: ${allMatches.length} matches encontrados`);
      setMatches(allMatches);

    } catch (err) {
      console.error('Error en matching:', err);
      setError(`Error en matching: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Ejecutar matching automáticamente cuando ambos archivos estén cargados
  useEffect(() => {
    if (inventoryLoaded && clientsLoaded && inventory.length > 0 && clients.length > 0) {
      calculateMatches();
    }
  }, [inventoryLoaded, clientsLoaded]);

  // Obtener lista de asesores únicos
  const asesores = ['todos', ...new Set(inventory.map(m => m.asesor).filter(Boolean))];

  // Filtrar matches
  const filteredMatches = matches.filter(match => {
    // Filtro por asesor
    if (selectedAsesor !== 'todos' && match.macrolote.asesor !== selectedAsesor) {
      return false;
    }

    // Filtro por búsqueda
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const searchIn = `${match.cliente.nombre} ${match.macrolote.nombre} ${match.macrolote.id} ${match.cliente.id}`.toLowerCase();
      if (!searchIn.includes(term)) {
        return false;
      }
    }

    return true;
  });

  // Manejo de selección
  const toggleSelection = (index) => {
    const newSelected = new Set(selectedMatches);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedMatches(newSelected);
  };

  const selectAll = () => {
    setSelectedMatches(new Set(filteredMatches.map((_, idx) => idx)));
  };

  const deselectAll = () => {
    setSelectedMatches(new Set());
  };

  // Generar reporte
  const handleGenerateReport = async () => {
    if (selectedMatches.size === 0) {
      setError('Selecciona al menos un match');
      return;
    }

    setLoading(true);
    try {
      const selectedData = Array.from(selectedMatches).map(idx => filteredMatches[idx]);
      await generateReport(selectedData);
    } catch (err) {
      console.error('Error generando reporte:', err);
      setError(`Error generando reporte: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Formatear números
  const formatNumber = (num) => {
    if (!num && num !== 0) return 'N/D';
    return new Intl.NumberFormat('es-MX').format(num);
  };

  const formatCurrency = (num) => {
    if (!num && num !== 0) return 'N/D';
    return new Intl.NumberFormat('es-MX', { 
      style: 'currency', 
      currency: 'MXN',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(num);
  };

  // Renderizado
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-blue-600">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
                <Building2 className="text-blue-600" size={36} />
                MacroPro Matcher v2.1
              </h1>
              <p className="text-slate-600 mt-2">Sistema inteligente de matching cliente-macrolote</p>
            </div>
            <div className="text-right text-sm text-slate-600">
              <div>📦 {inventory.length} macrolotes</div>
              <div>👥 {clients.length} clientes</div>
              <div>🎯 {matches.length} matches</div>
            </div>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-lg flex items-start gap-3">
            <AlertCircle className="text-red-500 flex-shrink-0" size={20} />
            <div>
              <p className="font-semibold text-red-800">Error</p>
              <p className="text-red-700 text-sm">{error}</p>
            </div>
            <button onClick={() => setError('')} className="ml-auto">
              <X size={20} className="text-red-500" />
            </button>
          </div>
        )}

        {/* Upload Section */}
        <div className="grid md:grid-cols-2 gap-6">
          
          {/* Inventario Upload */}
          <div className="bg-white rounded-xl shadow-md p-6 border border-slate-200">
            <div className="flex items-center gap-3 mb-4">
              <Building2 className="text-blue-600" size={24} />
              <h2 className="text-xl font-bold text-slate-800">Inventario</h2>
            </div>
            
            <label className="block">
              <div className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all ${
                inventoryLoaded 
                  ? 'border-green-400 bg-green-50' 
                  : 'border-slate-300 bg-slate-50 hover:border-blue-400 hover:bg-blue-50'
              }`}>
                <Upload className={`mx-auto mb-3 ${inventoryLoaded ? 'text-green-600' : 'text-slate-400'}`} size={32} />
                <p className="font-semibold text-slate-700">
                  {inventoryLoaded ? '✓ Inventario cargado' : 'Cargar Inventario'}
                </p>
                <p className="text-sm text-slate-500 mt-1">
                  {inventoryLoaded ? `${inventory.length} macrolotes disponibles` : 'Click para seleccionar archivo .xlsx'}
                </p>
              </div>
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleInventoryUpload}
                className="hidden"
              />
            </label>
          </div>

          {/* Clientes Upload */}
          <div className="bg-white rounded-xl shadow-md p-6 border border-slate-200">
            <div className="flex items-center gap-3 mb-4">
              <UserCheck className="text-blue-600" size={24} />
              <h2 className="text-xl font-bold text-slate-800">Clientes</h2>
            </div>
            
            <label className="block">
              <div className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all ${
                clientsLoaded 
                  ? 'border-green-400 bg-green-50' 
                  : 'border-slate-300 bg-slate-50 hover:border-blue-400 hover:bg-blue-50'
              }`}>
                <Upload className={`mx-auto mb-3 ${clientsLoaded ? 'text-green-600' : 'text-slate-400'}`} size={32} />
                <p className="font-semibold text-slate-700">
                  {clientsLoaded ? '✓ Clientes cargados' : 'Cargar Base de Clientes'}
                </p>
                <p className="text-sm text-slate-500 mt-1">
                  {clientsLoaded ? `${clients.length} clientes registrados` : 'Click para seleccionar archivo .xlsx'}
                </p>
              </div>
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleClientsUpload}
                className="hidden"
              />
            </label>
          </div>

        </div>

        {/* Filters & Actions */}
        {matches.length > 0 && (
          <div className="bg-white rounded-xl shadow-md p-6 border border-slate-200">
            <div className="flex flex-wrap items-center gap-4">
              
              {/* Filtro Asesor */}
              <div className="flex items-center gap-2">
                <Filter size={20} className="text-slate-500" />
                <select
                  value={selectedAsesor}
                  onChange={(e) => setSelectedAsesor(e.target.value)}
                  className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {asesores.map(a => (
                    <option key={a} value={a}>{a === 'todos' ? 'Todos los asesores' : a}</option>
                  ))}
                </select>
              </div>

              {/* Búsqueda */}
              <div className="flex-1 min-w-64">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={20} />
                  <input
                    type="text"
                    placeholder="Buscar cliente o macrolote..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Acciones */}
              <div className="flex items-center gap-2">
                <button
                  onClick={selectAll}
                  className="px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition"
                >
                  Seleccionar todos
                </button>
                <button
                  onClick={deselectAll}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition"
                >
                  Deseleccionar
                </button>
                <button
                  onClick={handleGenerateReport}
                  disabled={selectedMatches.size === 0 || loading}
                  className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Download size={20} />
                  Generar Reporte ({selectedMatches.size})
                </button>
              </div>
            </div>

            <div className="mt-3 text-sm text-slate-600">
              Mostrando {filteredMatches.length} de {matches.length} matches
            </div>
          </div>
        )}

        {/* Matches Table */}
        {filteredMatches.length > 0 && (
          <div className="bg-white rounded-xl shadow-md overflow-hidden border border-slate-200">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-100 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase">Sel</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase">Score</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase">Cliente</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase">Macrolote</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase">Ubicación</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase">Superficie</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase">Precio</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase">Razones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredMatches.map((match, idx) => (
                    <tr key={idx} className={`hover:bg-slate-50 transition ${selectedMatches.has(idx) ? 'bg-blue-50' : ''}`}>
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selectedMatches.has(idx)}
                          onChange={() => toggleSelection(idx)}
                          className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold ${
                          match.score >= 70 ? 'bg-green-100 text-green-800' :
                          match.score >= 50 ? 'bg-yellow-100 text-yellow-800' :
                          'bg-orange-100 text-orange-800'
                        }`}>
                          {match.score}%
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-800">{match.cliente.nombre}</div>
                        <div className="text-sm text-slate-500">{match.cliente.id}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-800">{match.macrolote.nombre}</div>
                        <div className="text-sm text-slate-500">{match.macrolote.id}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm text-slate-700">{match.macrolote.ciudad}</div>
                        <div className="text-xs text-slate-500">{match.macrolote.estado}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm text-slate-700">{formatNumber(match.macrolote.superficie)} m²</div>
                        <div className="text-xs text-slate-500">
                          Cliente: {formatNumber(match.cliente.sup_min)} - {formatNumber(match.cliente.sup_max)} m²
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm font-medium text-slate-700">{formatCurrency(match.macrolote.precio_total)}</div>
                        <div className="text-xs text-slate-500">
                          Max: {formatCurrency(match.cliente.ppto_max)}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-xs space-y-1">
                          {match.reasons.map((r, ridx) => (
                            <div key={ridx} className="text-slate-600">{r}</div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Empty State */}
        {matches.length === 0 && inventoryLoaded && clientsLoaded && (
          <div className="bg-white rounded-xl shadow-md p-12 text-center border border-slate-200">
            <AlertCircle className="mx-auto text-slate-400 mb-4" size={48} />
            <p className="text-xl font-semibold text-slate-700">No se encontraron matches</p>
            <p className="text-slate-500 mt-2">Verifica que los archivos contengan datos válidos</p>
          </div>
        )}

        {/* Loading Indicator */}
        {loading && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-8 shadow-2xl text-center">
              <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-600 border-t-transparent mx-auto mb-4"></div>
              <p className="text-lg font-semibold text-slate-700">Procesando...</p>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default MacroProMatcher;
