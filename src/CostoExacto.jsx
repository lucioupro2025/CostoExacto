import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Trash2, 
  Save, 
  ChefHat,
  Package,
  Database,
  Calculator
} from 'lucide-react';

export default function App() {
  // --- Estados de Navegación ---
  const [activeTab, setActiveTab] = useState('calculator'); // 'inventory' | 'calculator'

  // --- Estados de Datos ---
  const [inventory, setInventory] = useState([]);
  const [savedProducts, setSavedProducts] = useState([]);

  // --- Estados del Formulario Calculadora ---
  const [productName, setProductName] = useState('');
  const [recipeIngredients, setRecipeIngredients] = useState([]);
  const [fixedCosts, setFixedCosts] = useState({ packaging: 0, cutlery: 0, extras: 0 });
  const [salePrice, setSalePrice] = useState('');
  const [showNotification, setShowNotification] = useState({ show: false, message: '' });

  // --- Estado para Nuevo Insumo (Formulario Inventario) ---
  const [newIngredient, setNewIngredient] = useState({
    name: '',
    price: '',
    quantity: 1,
    unit: 'kg'
  });

  // --- Constantes de Unidades (Conversion Factors to Base Unit: g, ml, u) ---
  const UNITS = {
    mass: { g: 1, kg: 1000 },
    volume: { ml: 1, l: 1000 },
    unit: { u: 1 }
  };

  // --- Carga Inicial y Persistencia (localStorage) ---
  useEffect(() => {
    // Cargar inventario y productos guardados desde el almacenamiento local
    const loadedInventory = localStorage.getItem('costoExactoInventory');
    const loadedProducts = localStorage.getItem('costoExactoProducts');
    
    if (loadedInventory) setInventory(JSON.parse(loadedInventory));
    if (loadedProducts) setSavedProducts(JSON.parse(loadedProducts));

    // Inicializar una línea de ingrediente vacía si no hay
    if (!recipeIngredients.length) addRecipeLine();
  }, []);

  // Persistir el inventario cada vez que cambie
  useEffect(() => {
    localStorage.setItem('costoExactoInventory', JSON.stringify(inventory));
  }, [inventory]);

  // Persistir los productos guardados cada vez que cambien
  useEffect(() => {
    localStorage.setItem('costoExactoProducts', JSON.stringify(savedProducts));
  }, [savedProducts]);

  // --- Lógica del Inventario ---
  const handleAddInventoryItem = () => {
    if (!newIngredient.name || !newIngredient.price) {
      setShowNotification({ show: true, message: 'Falta nombre o precio del insumo.' });
      setTimeout(() => setShowNotification({ show: false, message: '' }), 3000);
      return;
    }
    const item = { ...newIngredient, id: Date.now() };
    setInventory([...inventory, item]);
    setNewIngredient({ name: '', price: '', quantity: 1, unit: 'kg' });
    setShowNotification({ show: true, message: 'Insumo agregado al inventario' });
    setTimeout(() => setShowNotification({ show: false, message: '' }), 2000);
  };

  const deleteInventoryItem = (id) => {
    // Usar un modal o un mensaje de confirmación en un entorno real
    if (window.confirm('¿Borrar este insumo? Si lo usas en una receta guardada, el costo podría cambiar.')) {
      setInventory(inventory.filter(i => i.id !== id));
    }
  };

  // --- Lógica de la Calculadora (Recetas) ---
  const addRecipeLine = () => {
    setRecipeIngredients([...recipeIngredients, { 
      id: Date.now(), 
      inventoryId: '', // ID del insumo seleccionado
      usageQty: '', 
      usageUnit: 'g' 
    }]);
  };

  const removeRecipeLine = (id) => {
    setRecipeIngredients(recipeIngredients.filter(i => i.id !== id));
  };

  const updateRecipeLine = (id, field, value) => {
    setRecipeIngredients(recipeIngredients.map(line => {
      if (line.id !== id) return line;
      
      const updatedLine = { ...line, [field]: value };
      
      // Si cambiamos el insumo, actualizamos la unidad de uso por defecto
      if (field === 'inventoryId') {
        const selectedItem = inventory.find(i => i.id.toString() === value.toString());
        if (selectedItem) {
          // Intentar predecir una unidad lógica (kg -> g, l -> ml)
          if (selectedItem.unit === 'kg') updatedLine.usageUnit = 'g';
          else if (selectedItem.unit === 'l') updatedLine.usageUnit = 'ml';
          else updatedLine.usageUnit = selectedItem.unit;
        }
      }
      return updatedLine;
    }));
  };

  // --- Lógica de Costos y Cálculos ---
  const getUnitType = (unit) => {
    if (['g', 'kg'].includes(unit)) return 'mass';
    if (['ml', 'l'].includes(unit)) return 'volume';
    return 'unit';
  };

  const calculateLineCost = (line) => {
    if (!line.inventoryId) return 0;
    
    const item = inventory.find(i => i.id.toString() === line.inventoryId.toString());
    if (!item) return 0; // El insumo fue borrado o no encontrado

    const pPrice = parseFloat(item.price) || 0;
    const pQty = parseFloat(item.quantity) || 1;
    const uQty = parseFloat(line.usageQty) || 0;

    const pType = getUnitType(item.unit); // Tipo de unidad de compra (ej. mass)
    const uType = getUnitType(line.usageUnit); // Tipo de unidad de uso (ej. mass)

    if (pType !== uType) return 0; // Error: No se puede mezclar masa con volumen

    // Factores de conversión a la unidad base (g, ml, u)
    const pFactor = UNITS[pType][item.unit]; 
    const uFactor = UNITS[uType][line.usageUnit];

    if (pQty === 0 || pFactor === 0) return 0;
    
    // Cálculo: (Precio / (CantCompra * FactorCompra)) * (CantUso * FactorUso)
    return (pPrice / (pQty * pFactor)) * (uQty * uFactor);
  };

  const calculateTotalIngredients = () => {
    // Suma el costo de todos los ingredientes de la receta
    return recipeIngredients.reduce((acc, line) => acc + calculateLineCost(line), 0);
  };

  const totalCost = calculateTotalIngredients() + 
                    (parseFloat(fixedCosts.packaging) || 0) + 
                    (parseFloat(fixedCosts.cutlery) || 0) + 
                    (parseFloat(fixedCosts.extras) || 0);
  
  const price = parseFloat(salePrice) || 0;
  const margin = price - totalCost;
  const marginPercent = price > 0 ? ((margin / price) * 100).toFixed(1) : 0;

  // --- Guardar Producto ---
  const handleSaveProduct = () => {
    if (!productName.trim()) {
      setShowNotification({ show: true, message: 'Por favor, ingrese un nombre para el producto.' });
      setTimeout(() => setShowNotification({ show: false, message: '' }), 3000);
      return;
    }
    const newProduct = {
      id: Date.now(),
      name: productName,
      totalCost,
      salePrice: price,
      margin,
      marginPercent,
      // Guardamos la receta completa también
      recipe: recipeIngredients, 
      fixedCosts,
      date: new Date().toLocaleDateString()
    };
    setSavedProducts([newProduct, ...savedProducts]);
    setShowNotification({ show: true, message: 'Producto guardado correctamente' });
    setTimeout(() => setShowNotification({ show: false, message: '' }), 3000);
    
    // Resetear formulario
    setProductName('');
    setRecipeIngredients([{ id: Date.now(), inventoryId: '', usageQty: '', usageUnit: 'g' }]);
    setSalePrice('');
    setFixedCosts({ packaging: 0, cutlery: 0, extras: 0 });
  };

  const deleteProduct = (id) => {
    if (window.confirm('¿Eliminar producto guardado?')) {
      setSavedProducts(savedProducts.filter(p => p.id !== id));
    }
  };

  // --- Utilidad de Formato de Moneda ---
  const formatCurrency = (value) => {
    // Usar el formato de Argentina (ARS) por defecto
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(value);
  };

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-800 pb-20">
      {/* PWA Meta */}
      <div className="hidden">
        <meta name="theme-color" content="#4f46e5" />
      </div>

      {/* Notification Toast */}
      {showNotification.show && (
        <div className="fixed top-4 right-4 bg-gray-900 text-white px-6 py-3 rounded-lg shadow-xl z-50 animate-bounce flex items-center gap-2">
          <Save size={18} className="text-green-400" />
          <span>{showNotification.message}</span>
        </div>
      )}

      {/* --- HEADER --- */}
      <header className="bg-indigo-700 text-white p-4 shadow-lg sticky top-0 z-40">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ChefHat size={32} className="text-indigo-200" />
            <div>
              <h1 className="text-xl font-bold leading-none">CostoExacto</h1>
              <p className="text-xs text-indigo-300">Gestor de Costos Pro</p>
            </div>
          </div>
          
          {/* Navegación Tabs */}
          <div className="flex bg-indigo-800/50 p-1 rounded-lg">
            <button 
              onClick={() => setActiveTab('inventory')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${activeTab === 'inventory' ? 'bg-white text-indigo-700 shadow' : 'text-indigo-200 hover:text-white'}`}
            >
              <Database size={16} /> <span className="hidden sm:inline">Mis Insumos</span>
            </button>
            <button 
              onClick={() => setActiveTab('calculator')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${activeTab === 'calculator' ? 'bg-white text-indigo-700 shadow' : 'text-indigo-200 hover:text-white'}`}
            >
              <Calculator size={16} /> <span className="hidden sm:inline">Calculadora</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4 mt-4">

        {/* --- VISTA: INVENTARIO --- */}
        {activeTab === 'inventory' && (
          <div className="animate-fade-in">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
              <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                <Plus className="text-indigo-600" size={20}/> Agregar Nuevo Insumo
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nombre Insumo</label>
                  <input 
                    type="text" 
                    placeholder="Ej. Harina 0000, Tomate, Caja Pizza"
                    value={newIngredient.name}
                    onChange={e => setNewIngredient({...newIngredient, name: e.target.value})}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
                
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Costo de Compra</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-gray-400">$</span>
                    <input 
                      type="number" 
                      placeholder="0.00"
                      value={newIngredient.price}
                      onChange={e => setNewIngredient({...newIngredient, price: e.target.value})}
                      className="w-full border border-gray-300 rounded-lg pl-6 pr-3 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                </div>

                <div className="flex gap-2">
                   <div className="w-1/2">
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Cant.</label>
                      <input 
                        type="number" 
                        value={newIngredient.quantity}
                        onChange={e => setNewIngredient({...newIngredient, quantity: e.target.value})}
                        className="w-full border border-gray-300 rounded-lg px-2 py-2 text-center"
                      />
                   </div>
                   <div className="w-1/2">
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Unid.</label>
                      <select 
                        value={newIngredient.unit}
                        onChange={e => setNewIngredient({...newIngredient, unit: e.target.value})}
                        className="w-full border border-gray-300 rounded-lg px-1 py-2 bg-white"
                      >
                        <option value="kg">kg</option>
                        <option value="g">gr</option>
                        <option value="l">L</option>
                        <option value="ml">ml</option>
                        <option value="u">u</option>
                      </select>
                   </div>
                </div>

                <div className="md:col-span-4 mt-2">
                   <button 
                    onClick={handleAddInventoryItem}
                    className="w-full bg-indigo-600 text-white font-bold py-2 rounded-lg hover:bg-indigo-700 transition-colors"
                   >
                     Guardar Insumo
                   </button>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="p-4 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
                <h3 className="font-bold text-gray-700">Inventario Actual</h3>
                <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded-full font-bold">{inventory.length} items</span>
              </div>
              
              {inventory.length === 0 ? (
                <div className="p-8 text-center text-gray-400">
                  <Database size={48} className="mx-auto mb-2 opacity-20" />
                  <p>No has cargado insumos todavía.</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {inventory.map(item => (
                    <div key={item.id} className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                      <div>
                        <p className="font-bold text-gray-800">{item.name}</p>
                        <p className="text-sm text-gray-500">
                          {formatCurrency(item.price)} x {item.quantity} {item.unit}
                        </p>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right hidden sm:block">
                           <p className="text-xs text-gray-400 uppercase">Costo Unitario</p>
                           {/* Muestra el costo por gramo, ml o unidad */}
                           <p className="text-sm font-mono text-indigo-600 font-bold">
                             {formatCurrency(item.price / (item.quantity * (item.unit === 'kg' || item.unit === 'l' ? 1000 : 1)))} 
                             <span className="text-xs text-gray-400 font-normal"> / {item.unit === 'kg' || item.unit === 'g' ? 'gr' : (item.unit === 'l' || item.unit === 'ml' ? 'ml' : 'u')}</span>
                           </p>
                        </div>
                        <button 
                          onClick={() => deleteInventoryItem(item.id)}
                          className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* --- VISTA: CALCULADORA --- */}
        {activeTab === 'calculator' && (
          <div className="animate-fade-in space-y-6">
            
            {/* Si no hay inventario, aviso */}
            {inventory.length === 0 && (
              <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4">
                <div className="flex">
                  <div className="ml-3">
                    <p className="text-sm text-yellow-700">
                      Primero debes cargar insumos en la pestaña <b>"Mis Insumos"</b> para poder usarlos aquí.
                    </p>
                    <button 
                      onClick={() => setActiveTab('inventory')}
                      className="mt-2 text-sm font-bold text-yellow-800 underline"
                    >
                      Ir a Cargar Insumos
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
              <div className="p-6">
                
                {/* Nombre Producto */}
                <div className="mb-6">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wide">Producto a Calcular</label>
                  <input
                    type="text"
                    value={productName}
                    onChange={(e) => setProductName(e.target.value)}
                    placeholder="Nombre del plato o producto..."
                    className="w-full text-xl font-bold border-b-2 border-indigo-100 focus:border-indigo-600 outline-none py-2 transition-colors placeholder-gray-300"
                  />
                </div>

                {/* Lista de Receta */}
                <div className="space-y-3 mb-6">
                  <div className="flex justify-between items-end mb-2 border-b border-gray-100 pb-2">
                    <span className="text-sm font-bold text-gray-700">Ingredientes</span>
                    <span className="text-xs text-gray-400">Selecciona del inventario</span>
                  </div>

                  {recipeIngredients.map((line, idx) => {
                    const lineCost = calculateLineCost(line);
                    const selectedInventoryItem = inventory.find(i => i.id.toString() === line.inventoryId.toString());
                    const unitError = selectedInventoryItem && getUnitType(selectedInventoryItem.unit) !== getUnitType(line.usageUnit);

                    return (
                      <div key={line.id} className="flex flex-col sm:flex-row gap-2 items-start sm:items-center bg-gray-50 p-3 rounded-lg border border-gray-200">
                        
                        {/* Selector de Insumo */}
                        <div className="w-full sm:w-1/2">
                          <select
                            value={line.inventoryId}
                            onChange={(e) => updateRecipeLine(line.id, 'inventoryId', e.target.value)}
                            className={`w-full bg-white border ${!line.inventoryId ? 'border-indigo-300' : 'border-gray-200'} rounded px-3 py-2 text-sm focus:outline-none focus:border-indigo-500`}
                            disabled={inventory.length === 0}
                          >
                            <option value="">-- Seleccionar Insumo --</option>
                            {inventory.map(i => (
                              <option key={i.id} value={i.id}>{i.name}</option>
                            ))}
                          </select>
                        </div>

                        {/* Cantidad y Unidad */}
                        <div className="flex gap-2 w-full sm:w-auto items-center">
                          <input
                            type="number"
                            placeholder="Cant"
                            value={line.usageQty}
                            onChange={(e) => updateRecipeLine(line.id, 'usageQty', e.target.value)}
                            className="w-20 bg-white border border-gray-200 rounded px-2 py-2 text-sm text-center"
                          />
                          <select 
                            value={line.usageUnit}
                            onChange={(e) => updateRecipeLine(line.id, 'usageUnit', e.target.value)}
                            className={`w-18 bg-white border ${unitError ? 'border-red-500 text-red-500' : 'border-gray-200'} rounded px-1 py-2 text-sm`}
                          >
                            <option value="g">g</option>
                            <option value="kg">kg</option>
                            <option value="ml">ml</option>
                            <option value="l">L</option>
                            <option value="u">u</option>
                          </select>
                        </div>

                        {/* Costo Calculado */}
                        <div className="flex-grow text-right w-full sm:w-auto flex justify-between sm:justify-end items-center gap-3">
                           {unitError ? (
                             <span className="text-xs text-red-500 font-bold bg-red-50 px-2 py-1 rounded">Error Unidad</span>
                           ) : (
                             <span className="font-bold text-gray-700">{formatCurrency(lineCost)}</span>
                           )}
                           
                           <button 
                             onClick={() => removeRecipeLine(line.id)}
                             className="text-gray-300 hover:text-red-500"
                           >
                             <Trash2 size={16} />
                           </button>
                        </div>
                      </div>
                    );
                  })}
                  
                  <button
                    onClick={addRecipeLine}
                    className="w-full py-2 border border-dashed border-indigo-200 text-indigo-600 rounded-lg text-sm font-medium hover:bg-indigo-50 transition-colors flex items-center justify-center gap-2"
                  >
                    <Plus size={16} /> Agregar Ingrediente
                  </button>
                </div>

                {/* Costos Fijos */}
                <div className="grid grid-cols-3 gap-3 mb-6 bg-indigo-50/50 p-4 rounded-xl">
                   {['packaging', 'cutlery', 'extras'].map(key => (
                     <div key={key}>
                       <label className="block text-[10px] font-bold text-indigo-400 uppercase mb-1">
                         {key === 'packaging' ? 'Envase' : key === 'cutlery' ? 'Cubiertos' : 'Extras'}
                       </label>
                       <div className="relative">
                         <span className="absolute left-2 top-1.5 text-indigo-300 text-xs">$</span>
                         <input 
                           type="number"
                           value={fixedCosts[key]}
                           onChange={(e) => setFixedCosts({...fixedCosts, [key]: e.target.value})}
                           className="w-full pl-5 py-1 text-sm bg-white border border-indigo-100 rounded focus:ring-1 focus:ring-indigo-500 outline-none" 
                           placeholder="0"
                         />
                       </div>
                     </div>
                   ))}
                </div>

                {/* Panel de Resultado */}
                <div className="bg-gray-900 text-white rounded-xl p-5 shadow-inner">
                  <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                    <div>
                      <p className="text-gray-400 text-xs uppercase mb-1">Costo Total</p>
                      <p className="text-3xl font-bold text-white">{formatCurrency(totalCost)}</p>
                    </div>

                    <div className="flex-grow w-full md:w-auto">
                       <div className="relative">
                         <label className="absolute -top-2 left-3 bg-gray-900 px-1 text-xs text-indigo-400">Precio Venta</label>
                         <input 
                           type="number" 
                           value={salePrice}
                           onChange={(e) => setSalePrice(e.target.value)}
                           className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-3 text-lg font-bold focus:border-indigo-500 outline-none"
                           placeholder="0.00"
                         />
                       </div>
                    </div>

                    <div className="text-right w-full md:w-auto">
                       <div className={`text-xl font-bold ${margin >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                         {marginPercent}%
                       </div>
                       <p className="text-xs text-gray-500">Margen</p>
                    </div>
                  </div>
                </div>

                {/* Botón Guardar */}
                <button 
                  onClick={handleSaveProduct}
                  className="mt-6 w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold py-3 rounded-xl shadow-lg transition-all transform active:scale-95 flex justify-center items-center gap-2"
                >
                  <Save size={20} /> Guardar Receta
                </button>

              </div>
            </div>

            {/* --- LISTA DE RECETAS GUARDADAS --- */}
            <div className="mt-8">
              <h3 className="text-lg font-bold text-gray-700 mb-4 flex items-center gap-2">
                <Package size={20} className="text-indigo-600"/> Recetas Guardadas
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {savedProducts.map(prod => (
                  <div key={prod.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow relative">
                    <button 
                      onClick={() => deleteProduct(prod.id)}
                      className="absolute top-4 right-4 text-gray-300 hover:text-red-500"
                    >
                      <Trash2 size={16} />
                    </button>
                    
                    <h4 className="font-bold text-gray-800 text-lg">{prod.name}</h4>
                    <p className="text-xs text-gray-400 mb-3">{prod.date}</p>
                    
                    <div className="flex justify-between items-center text-sm mb-2">
                       <span className="text-gray-500">Costo:</span>
                       <span className="font-semibold">{formatCurrency(prod.totalCost)}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm mb-2">
                       <span className="text-gray-500">Venta:</span>
                       <span className="font-bold text-indigo-700">{formatCurrency(prod.salePrice)}</span>
                    </div>
                    <div className="mt-2 pt-2 border-t border-gray-100 flex justify-between items-center">
                       <span className={`text-xs font-bold px-2 py-1 rounded ${prod.marginPercent > 30 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                         {prod.marginPercent}% Margen
                       </span>
                       <span className="text-xs font-bold text-gray-600">Ganancia: {formatCurrency(prod.margin)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        )}

      </main>
    </div>
  );
}
