import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Trash2, 
  Save, 
  ChefHat,
  Package,
  Database,
  Calculator,
  Edit,
  ChevronDown,
  ChevronUp,
  AlertCircle
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

  // --- Estados para Edición de Insumo ---
  const [editingId, setEditingId] = useState(null); // ID del insumo que se está editando
  const [newIngredient, setNewIngredient] = useState({
    name: '',
    price: '',
    quantity: 1,
    unit: 'kg'
  });

  // --- Constantes de Unidades ---
  const UNITS = {
    mass: { g: 1, kg: 1000 },
    volume: { ml: 1, l: 1000 },
    unit: { u: 1 }
  };

  // --- Carga Inicial ---
  useEffect(() => {
    const loadedInventory = localStorage.getItem('costoExactoInventory');
    const loadedProducts = localStorage.getItem('costoExactoProducts');
    
    if (loadedInventory) setInventory(JSON.parse(loadedInventory));
    if (loadedProducts) setSavedProducts(JSON.parse(loadedProducts));

    if (!recipeIngredients.length) addRecipeLine();
  }, []);

  // --- Persistencia ---
  useEffect(() => {
    localStorage.setItem('costoExactoInventory', JSON.stringify(inventory));
  }, [inventory]);

  useEffect(() => {
    localStorage.setItem('costoExactoProducts', JSON.stringify(savedProducts));
  }, [savedProducts]);

  // ==========================================
  // LÓGICA DE CÁLCULO CENTRALIZADA
  // ==========================================

  const getUnitType = (unit) => {
    if (['g', 'kg'].includes(unit)) return 'mass';
    if (['ml', 'l'].includes(unit)) return 'volume';
    return 'unit';
  };

  // Calcula el costo de una línea de receta basándose en un inventario específico
  const calculateSingleLineCost = (line, currentInventory) => {
    if (!line.inventoryId) return 0;
    
    const item = currentInventory.find(i => i.id.toString() === line.inventoryId.toString());
    if (!item) return 0;

    const pPrice = parseFloat(item.price) || 0;
    const pQty = parseFloat(item.quantity) || 1;
    const uQty = parseFloat(line.usageQty) || 0;

    const pType = getUnitType(item.unit);
    const uType = getUnitType(line.usageUnit);

    if (pType !== uType) return 0;

    const pFactor = UNITS[pType][item.unit]; 
    const uFactor = UNITS[uType][line.usageUnit];

    if (pQty === 0 || pFactor === 0) return 0;
    
    return (pPrice / (pQty * pFactor)) * (uQty * uFactor);
  };

  // Recalcula un producto completo (útil para actualizaciones masivas)
  const recalculateProduct = (product, currentInventory) => {
    const ingredientsCost = product.recipe.reduce((acc, line) => 
      acc + calculateSingleLineCost(line, currentInventory), 0
    );
    
    const fixedTotal = (parseFloat(product.fixedCosts.packaging) || 0) + 
                       (parseFloat(product.fixedCosts.cutlery) || 0) + 
                       (parseFloat(product.fixedCosts.extras) || 0);

    const totalCost = ingredientsCost + fixedTotal;
    const price = parseFloat(product.salePrice) || 0;
    const margin = price - totalCost;
    const marginPercent = price > 0 ? ((margin / price) * 100).toFixed(1) : 0;

    return {
      ...product,
      totalCost,
      margin,
      marginPercent
    };
  };

  // ==========================================
  // GESTIÓN DE INVENTARIO
  // ==========================================

  const handleSaveInventoryItem = () => {
    if (!newIngredient.name || !newIngredient.price) {
      setShowNotification({ show: true, message: 'Falta nombre o precio.' });
      setTimeout(() => setShowNotification({ show: false, message: '' }), 3000);
      return;
    }

    let updatedInventory;

    if (editingId) {
      // --- MODO EDICIÓN ---
      updatedInventory = inventory.map(item => 
        item.id === editingId ? { ...newIngredient, id: editingId } : item
      );
      
      // ALERTA: Actualizar todas las recetas guardadas automáticamente
      const updatedProducts = savedProducts.map(prod => recalculateProduct(prod, updatedInventory));
      setSavedProducts(updatedProducts);
      
      setShowNotification({ show: true, message: 'Insumo y recetas actualizados' });
    } else {
      // --- MODO CREACIÓN ---
      const item = { ...newIngredient, id: Date.now() };
      updatedInventory = [...inventory, item];
      setShowNotification({ show: true, message: 'Insumo agregado' });
    }

    setInventory(updatedInventory);
    
    // Resetear formulario
    setNewIngredient({ name: '', price: '', quantity: 1, unit: 'kg' });
    setEditingId(null);
    setTimeout(() => setShowNotification({ show: false, message: '' }), 2000);
  };

  const startEditing = (item) => {
    setNewIngredient({
      name: item.name,
      price: item.price,
      quantity: item.quantity,
      unit: item.unit
    });
    setEditingId(item.id);
    window.scrollTo({ top: 0, behavior: 'smooth' }); // Subir al formulario
  };

  const cancelEditing = () => {
    setNewIngredient({ name: '', price: '', quantity: 1, unit: 'kg' });
    setEditingId(null);
  };

  const deleteInventoryItem = (id) => {
    if (window.confirm('¿Borrar este insumo? Si lo usas en una receta, el costo bajará a 0.')) {
      const updatedInventory = inventory.filter(i => i.id !== id);
      setInventory(updatedInventory);
      // Recalcular productos (costo bajará porque falta ingrediente)
      const updatedProducts = savedProducts.map(prod => recalculateProduct(prod, updatedInventory));
      setSavedProducts(updatedProducts);
    }
  };


  // ==========================================
  // GESTIÓN DE CALCULADORA
  // ==========================================

  const addRecipeLine = () => {
    setRecipeIngredients([...recipeIngredients, { 
      id: Date.now(), 
      inventoryId: '', 
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
      
      if (field === 'inventoryId') {
        const selectedItem = inventory.find(i => i.id.toString() === value.toString());
        if (selectedItem) {
          if (selectedItem.unit === 'kg') updatedLine.usageUnit = 'g';
          else if (selectedItem.unit === 'l') updatedLine.usageUnit = 'ml';
          else updatedLine.usageUnit = selectedItem.unit;
        }
      }
      return updatedLine;
    }));
  };

  // Cálculos en tiempo real para el formulario actual
  const currentTotalIngredients = recipeIngredients.reduce((acc, line) => acc + calculateSingleLineCost(line, inventory), 0);
  
  const currentTotalCost = currentTotalIngredients + 
                    (parseFloat(fixedCosts.packaging) || 0) + 
                    (parseFloat(fixedCosts.cutlery) || 0) + 
                    (parseFloat(fixedCosts.extras) || 0);
  
  const currentPrice = parseFloat(salePrice) || 0;
  const currentMargin = currentPrice - currentTotalCost;
  const currentMarginPercent = currentPrice > 0 ? ((currentMargin / currentPrice) * 100).toFixed(1) : 0;

  const handleSaveProduct = () => {
    if (!productName.trim()) {
      setShowNotification({ show: true, message: 'Falta nombre del producto.' });
      setTimeout(() => setShowNotification({ show: false, message: '' }), 3000);
      return;
    }
    const newProduct = {
      id: Date.now(),
      name: productName,
      totalCost: currentTotalCost,
      salePrice: currentPrice,
      margin: currentMargin,
      marginPercent: currentMarginPercent,
      recipe: recipeIngredients, 
      fixedCosts,
      date: new Date().toLocaleDateString()
    };
    setSavedProducts([newProduct, ...savedProducts]);
    setShowNotification({ show: true, message: 'Receta guardada' });
    setTimeout(() => setShowNotification({ show: false, message: '' }), 3000);
    
    // Resetear form
    setProductName('');
    setRecipeIngredients([{ id: Date.now(), inventoryId: '', usageQty: '', usageUnit: 'g' }]);
    setSalePrice('');
    setFixedCosts({ packaging: 0, cutlery: 0, extras: 0 });
  };

  const deleteProduct = (id) => {
    if (window.confirm('¿Eliminar receta?')) {
      setSavedProducts(savedProducts.filter(p => p.id !== id));
    }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(value);
  };

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-800 pb-20">
      <div className="hidden"><meta name="theme-color" content="#4f46e5" /></div>

      {showNotification.show && (
        <div className="fixed top-4 right-4 bg-gray-900 text-white px-6 py-3 rounded-lg shadow-xl z-50 animate-bounce flex items-center gap-2">
          <Save size={18} className="text-green-400" />
          <span>{showNotification.message}</span>
        </div>
      )}

      {/* HEADER */}
      <header className="bg-indigo-700 text-white p-4 shadow-lg sticky top-0 z-40">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ChefHat size={32} className="text-indigo-200" />
            <div>
              <h1 className="text-xl font-bold leading-none">CostoExacto</h1>
              <p className="text-xs text-indigo-300">Gestor v2.0</p>
            </div>
          </div>
          <div className="flex bg-indigo-800/50 p-1 rounded-lg">
            <button 
              onClick={() => setActiveTab('inventory')}
              className={`px-3 py-2 rounded-md text-sm font-medium flex items-center gap-2 ${activeTab === 'inventory' ? 'bg-white text-indigo-700 shadow' : 'text-indigo-200'}`}
            >
              <Database size={16} /> <span className="hidden sm:inline">Insumos</span>
            </button>
            <button 
              onClick={() => setActiveTab('calculator')}
              className={`px-3 py-2 rounded-md text-sm font-medium flex items-center gap-2 ${activeTab === 'calculator' ? 'bg-white text-indigo-700 shadow' : 'text-indigo-200'}`}
            >
              <Calculator size={16} /> <span className="hidden sm:inline">Recetas</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4 mt-4">

        {/* --- INVENTARIO --- */}
        {activeTab === 'inventory' && (
          <div className="animate-fade-in">
            <div className={`bg-white rounded-xl shadow-sm border p-6 mb-6 ${editingId ? 'border-orange-300 ring-2 ring-orange-100' : 'border-gray-200'}`}>
              <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                {editingId ? <Edit className="text-orange-500" size={20}/> : <Plus className="text-indigo-600" size={20}/>} 
                {editingId ? 'Editar Insumo' : 'Agregar Nuevo Insumo'}
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nombre</label>
                  <input 
                    type="text" 
                    placeholder="Ej. Harina"
                    value={newIngredient.name}
                    onChange={e => setNewIngredient({...newIngredient, name: e.target.value})}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
                
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Costo Compra</label>
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

                <div className="md:col-span-4 mt-2 flex gap-2">
                   {editingId && (
                     <button 
                       onClick={cancelEditing}
                       className="flex-1 bg-gray-200 text-gray-700 font-bold py-2 rounded-lg hover:bg-gray-300 transition-colors"
                     >
                       Cancelar
                     </button>
                   )}
                   <button 
                    onClick={handleSaveInventoryItem}
                    className={`flex-1 font-bold py-2 rounded-lg text-white transition-colors ${editingId ? 'bg-orange-500 hover:bg-orange-600' : 'bg-indigo-600 hover:bg-indigo-700'}`}
                   >
                     {editingId ? 'Actualizar Insumo' : 'Guardar Insumo'}
                   </button>
                </div>
              </div>
              {editingId && <p className="text-xs text-orange-600 mt-2 flex items-center gap-1"><AlertCircle size={12}/> Al actualizar, se recalcularán todas las recetas guardadas.</p>}
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="p-4 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
                <h3 className="font-bold text-gray-700">Inventario Actual</h3>
                <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded-full font-bold">{inventory.length} items</span>
              </div>
              
              <div className="divide-y divide-gray-100">
                {inventory.map(item => (
                  <div key={item.id} className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors group">
                    <div>
                      <p className="font-bold text-gray-800">{item.name}</p>
                      <p className="text-sm text-gray-500">
                        {formatCurrency(item.price)} x {item.quantity} {item.unit}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right hidden sm:block mr-4">
                          <p className="text-xs text-gray-400 uppercase">Costo Unitario</p>
                          <p className="text-sm font-mono text-indigo-600 font-bold">
                            {formatCurrency(item.price / (item.quantity * (item.unit === 'kg' || item.unit === 'l' ? 1000 : 1)))} 
                            <span className="text-xs text-gray-400 font-normal"> / {item.unit === 'kg' || item.unit === 'g' ? 'gr' : (item.unit === 'l' || item.unit === 'ml' ? 'ml' : 'u')}</span>
                          </p>
                      </div>
                      <button 
                        onClick={() => startEditing(item)}
                        className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                        title="Editar"
                      >
                        <Edit size={18} />
                      </button>
                      <button 
                        onClick={() => deleteInventoryItem(item.id)}
                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        title="Eliminar"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* --- CALCULADORA --- */}
        {activeTab === 'calculator' && (
          <div className="animate-fade-in space-y-6">
            
            {/* Formulario Calculadora */}
            <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
              <div className="p-6">
                <div className="mb-6">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wide">Nuevo Producto</label>
                  <input
                    type="text"
                    value={productName}
                    onChange={(e) => setProductName(e.target.value)}
                    placeholder="Nombre del plato..."
                    className="w-full text-xl font-bold border-b-2 border-indigo-100 focus:border-indigo-600 outline-none py-2 transition-colors placeholder-gray-300"
                  />
                </div>

                <div className="space-y-3 mb-6">
                  {recipeIngredients.map((line) => {
                    const lineCost = calculateSingleLineCost(line, inventory);
                    const selectedInventoryItem = inventory.find(i => i.id.toString() === line.inventoryId.toString());
                    const unitError = selectedInventoryItem && getUnitType(selectedInventoryItem.unit) !== getUnitType(line.usageUnit);

                    return (
                      <div key={line.id} className="flex flex-col sm:flex-row gap-2 items-start sm:items-center bg-gray-50 p-3 rounded-lg border border-gray-200">
                        <div className="w-full sm:w-1/2">
                          <select
                            value={line.inventoryId}
                            onChange={(e) => updateRecipeLine(line.id, 'inventoryId', e.target.value)}
                            className={`w-full bg-white border ${!line.inventoryId ? 'border-indigo-300' : 'border-gray-200'} rounded px-3 py-2 text-sm focus:outline-none focus:border-indigo-500`}
                          >
                            <option value="">-- Insumo --</option>
                            {inventory.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                          </select>
                        </div>
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
                        <div className="flex-grow text-right w-full sm:w-auto flex justify-between sm:justify-end items-center gap-3">
                           {unitError ? <span className="text-xs text-red-500 font-bold">Error Unidad</span> : <span className="font-bold text-gray-700">{formatCurrency(lineCost)}</span>}
                           <button onClick={() => removeRecipeLine(line.id)} className="text-gray-300 hover:text-red-500"><Trash2 size={16} /></button>
                        </div>
                      </div>
                    );
                  })}
                  <button onClick={addRecipeLine} className="w-full py-2 border border-dashed border-indigo-200 text-indigo-600 rounded-lg text-sm font-medium hover:bg-indigo-50 flex justify-center gap-2"><Plus size={16} /> Agregar Ingrediente</button>
                </div>

                <div className="grid grid-cols-3 gap-3 mb-6 bg-indigo-50/50 p-4 rounded-xl">
                   {['packaging', 'cutlery', 'extras'].map(key => (
                     <div key={key}>
                       <label className="block text-[10px] font-bold text-indigo-400 uppercase mb-1">{key === 'packaging' ? 'Envase' : key === 'cutlery' ? 'Cubiertos' : 'Extras'}</label>
                       <div className="relative">
                         <span className="absolute left-2 top-1.5 text-indigo-300 text-xs">$</span>
                         <input type="number" value={fixedCosts[key]} onChange={(e) => setFixedCosts({...fixedCosts, [key]: e.target.value})} className="w-full pl-5 py-1 text-sm bg-white border border-indigo-100 rounded focus:ring-1 focus:ring-indigo-500 outline-none" placeholder="0"/>
                       </div>
                     </div>
                   ))}
                </div>

                <div className="bg-gray-900 text-white rounded-xl p-5 shadow-inner flex flex-col md:flex-row justify-between items-center gap-6">
                    <div>
                      <p className="text-gray-400 text-xs uppercase mb-1">Costo Total</p>
                      <p className="text-3xl font-bold text-white">{formatCurrency(currentTotalCost)}</p>
                    </div>
                    <div className="flex-grow w-full md:w-auto relative">
                         <label className="absolute -top-2 left-3 bg-gray-900 px-1 text-xs text-indigo-400">Precio Venta</label>
                         <input type="number" value={salePrice} onChange={(e) => setSalePrice(e.target.value)} className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-3 text-lg font-bold focus:border-indigo-500 outline-none" placeholder="0.00"/>
                    </div>
                    <div className="text-right w-full md:w-auto">
                       <div className={`text-xl font-bold ${currentMargin >= 0 ? 'text-green-400' : 'text-red-400'}`}>{currentMarginPercent}%</div>
                       <p className="text-xs text-gray-500">Margen</p>
                    </div>
                </div>

                <button onClick={handleSaveProduct} className="mt-6 w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold py-3 rounded-xl shadow-lg flex justify-center items-center gap-2"><Save size={20} /> Guardar Receta</button>
              </div>
            </div>

            {/* LISTA DE RECETAS GUARDADAS */}
            <div className="mt-8">
              <h3 className="text-lg font-bold text-gray-700 mb-4 flex items-center gap-2"><Package size={20} className="text-indigo-600"/> Recetas Guardadas</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {savedProducts.map(prod => (
                  <SavedProductCard 
                    key={prod.id} 
                    product={prod} 
                    onDelete={deleteProduct} 
                    formatCurrency={formatCurrency}
                    inventory={inventory}
                    calculateSingleLineCost={calculateSingleLineCost}
                  />
                ))}
              </div>
            </div>

          </div>
        )}
      </main>
      
      <footer className="bg-gray-100 border-t border-gray-200 py-4 mt-12 text-center text-sm text-gray-600">
          <p>Desarrollado por <a href="https://guruweb.com.ar" target="_blank" rel="noopener noreferrer" className="text-indigo-600 font-bold">guruweb.com.ar</a></p>
      </footer>
    </div>
  );
}

// Sub-componente para manejar el estado de "ver detalles" de cada tarjeta individualmente
function SavedProductCard({ product, onDelete, formatCurrency, inventory, calculateSingleLineCost }) {
  const [showDetails, setShowDetails] = useState(false);

  return (
    <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-all relative">
      <button onClick={() => onDelete(product.id)} className="absolute top-4 right-4 text-gray-300 hover:text-red-500"><Trash2 size={16} /></button>
      
      <h4 className="font-bold text-gray-800 text-lg pr-8">{product.name}</h4>
      <p className="text-xs text-gray-400 mb-3">{product.date}</p>
      
      <div className="flex justify-between items-center text-sm mb-2">
         <span className="text-gray-500">Costo Total:</span>
         <span className="font-semibold">{formatCurrency(product.totalCost)}</span>
      </div>
      <div className="flex justify-between items-center text-sm mb-2">
         <span className="text-gray-500">Venta:</span>
         <span className="font-bold text-indigo-700">{formatCurrency(product.salePrice)}</span>
      </div>
      
      {/* Botón para ver ingredientes */}
      <button 
        onClick={() => setShowDetails(!showDetails)}
        className="w-full mt-3 text-xs flex items-center justify-center gap-1 text-indigo-500 hover:bg-indigo-50 py-1 rounded transition-colors"
      >
        {showDetails ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
        {showDetails ? 'Ocultar Ingredientes' : 'Ver Ingredientes'}
      </button>

      {/* Lista Desplegable de Ingredientes */}
      {showDetails && (
        <div className="mt-2 pt-2 border-t border-dashed border-gray-200 bg-gray-50 rounded p-2 text-xs">
          <p className="font-bold text-gray-500 mb-2">Detalle de Costos:</p>
          <ul className="space-y-1">
            {product.recipe.map((line, idx) => {
               const item = inventory.find(i => i.id.toString() === line.inventoryId.toString());
               const cost = calculateSingleLineCost(line, inventory);
               return (
                 <li key={idx} className="flex justify-between">
                   <span>{item ? item.name : 'Ingrediente eliminado'} <span className="text-gray-400">({line.usageQty} {line.usageUnit})</span></span>
                   <span className="font-mono text-gray-600">{formatCurrency(cost)}</span>
                 </li>
               )
            })}
            <li className="flex justify-between text-indigo-400 mt-1 pt-1 border-t border-gray-200">
              <span>Costos Fijos (Envase/Extras)</span>
              <span>{formatCurrency(
                (parseFloat(product.fixedCosts.packaging)||0) + 
                (parseFloat(product.fixedCosts.cutlery)||0) + 
                (parseFloat(product.fixedCosts.extras)||0)
              )}</span>
            </li>
          </ul>
        </div>
      )}

      <div className="mt-2 pt-2 border-t border-gray-100 flex justify-between items-center">
         <span className={`text-xs font-bold px-2 py-1 rounded ${parseFloat(product.marginPercent) > 30 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
           {product.marginPercent}% Margen
         </span>
         <span className="text-xs font-bold text-gray-600">Ganancia: {formatCurrency(product.margin)}</span>
      </div>
    </div>
  );
}
