// --- 1. Firebase 設定區 ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, onSnapshot, setDoc, updateDoc, enableIndexedDbPersistence } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// 🔴 🔴 🔴 重要提醒：請去 Firebase Console 申請後，回來替換這裡的內容 🔴 🔴 🔴
const firebaseConfig = {
  apiKey: "AIzaSyDPQZVgJlVgXBKtcIzQ1Islwpjb49kzqPM",
  authDomain: "slct-40c62.firebaseapp.com",
  projectId: "slct-40c62",
  storageBucket: "slct-40c62.firebasestorage.app",
  messagingSenderId: "543185237078",
  appId: "1:543185237078:web:1f80b0b42ee3e694bd37f7"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();
const db = getFirestore(app);

try { enableIndexedDbPersistence(db).catch(err => console.log(err.code)); } catch(e){}

// --- 2. React 邏輯區 ---
const { useState, useEffect, useRef } = React;
const icons = window.lucide.icons;

const Icon = ({ name, className }) => {
  // 1. 取得圖示的數據
  const iconData = icons[name];
  
  if (!iconData) return null;

  // 2. 設定 SVG 的預設外觀
  const defaultAttrs = {
    xmlns: "http://www.w3.org/2000/svg",
    width: 24,
    height: 24,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round",
    strokeLinejoin: "round",
  };

  // 3. 手動建立 SVG 標籤，把資料填進去
  return React.createElement(
    'svg',
    { ...defaultAttrs, className: className },
    iconData.map((child, index) => {
      const [tag, attrs] = child;
      return React.createElement(tag, { ...attrs, key: index });
    })
  );
};

const UniversalSelector = () => {
  // 定義三層結構的預設值
  const DEFAULT_DATA = {
    '大分類(未分類)': {
      '小分類(未分類)': {
        '中餐': ['麥當勞', '巷口麵店', '排骨飯', '便利商店'],
        '晚餐': ['火鍋', '牛排', '自己煮', '鹹水雞']
      }
    }
  };

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState('idle');
  
  // allData 結構: { Category: { Subcategory: { Tab: [Items] } } }
  const [allData, setAllData] = useState(DEFAULT_DATA);
  
  // 三層選擇狀態
  const [activeCategory, setActiveCategory] = useState('');
  const [activeSubcategory, setActiveSubcategory] = useState('');
  const [activeTab, setActiveTab] = useState('');
  
  const [appState, setAppState] = useState('input');
  const [inputValue, setInputValue] = useState('');
  
  // 新增模式: null, 'category', 'subcategory', 'tab'
  const [addingType, setAddingType] = useState(null);
  const [newName, setNewName] = useState('');
  
  // 新增 Tab 時的目標分類狀態
  const [targetCatForAdd, setTargetCatForAdd] = useState('');
  const [targetSubForAdd, setTargetSubForAdd] = useState('');

  // 使用 Ref 追蹤當前選擇，確保 onSnapshot 更新時不會重置選擇
  const activeSelectionRef = useRef({ cat: '', sub: '', tab: '' });
  useEffect(() => {
    activeSelectionRef.current = { cat: activeCategory, sub: activeSubcategory, tab: activeTab };
  }, [activeCategory, activeSubcategory, activeTab]);

  const [currentKing, setCurrentKing] = useState(null);
  const [challenger, setChallenger] = useState(null);
  const [queue, setQueue] = useState([]);

  // --- 移動功能相關狀態 ---
  const [moveConfig, setMoveConfig] = useState(null); // { type: 'subcategory'|'tab', name: string, currentCat: string, currentSub: string }
  const [moveToCat, setMoveToCat] = useState('');
  const [moveToSub, setMoveToSub] = useState('');
  
  const longPressTimer = useRef(null);
  const ignoreClick = useRef(false); // 用來防止長按後觸發 onClick

  // 長按事件綁定器
  const bindLongPress = (type, name, currentCat, currentSub = null) => {
    const start = () => {
        ignoreClick.current = false;
        longPressTimer.current = setTimeout(() => {
            ignoreClick.current = true; // 標記為長按，讓 onClick 忽略
            if (navigator.vibrate) navigator.vibrate(50);
            setMoveConfig({ type, name, currentCat, currentSub });
            setMoveToCat('');
            setMoveToSub('');
        }, 800); // 0.8秒視為長按
    };
    const end = () => {
        if (longPressTimer.current) clearTimeout(longPressTimer.current);
    };
    return {
        onMouseDown: start, onTouchStart: start,
        onMouseUp: end, onMouseLeave: end, onTouchEnd: end,
        onContextMenu: e => e.preventDefault() // 禁止右鍵選單
    };
  };

  const executeMove = () => {
    if (!moveConfig) return;
    const newData = JSON.parse(JSON.stringify(allData));
    const { type, name, currentCat, currentSub } = moveConfig;

    if (type === 'subcategory') {
        if (!moveToCat) return;
        // 1. 取出資料
        const dataToMove = newData[currentCat][name];
        // 2. 刪除舊的
        delete newData[currentCat][name];
        // 3. 移入新的 (若目標不存在則建立)
        if (!newData[moveToCat]) newData[moveToCat] = {};
        // 若名稱衝突，直接覆蓋 (或是您可以改成自動改名，這裡採覆蓋策略)
        newData[moveToCat][name] = dataToMove;
        
        // UI 重置
        if (activeSubcategory === name) setActiveSubcategory('');
    } 
    else if (type === 'tab') {
        if (!moveToCat || !moveToSub) return;
        // 1. 取出資料
        const dataToMove = newData[currentCat][currentSub][name];
        // 2. 刪除舊的
        delete newData[currentCat][currentSub][name];
        // 3. 移入新的
        if (!newData[moveToCat][moveToSub]) newData[moveToCat][moveToSub] = {};
        newData[moveToCat][moveToSub][name] = dataToMove;

        // UI 重置
        if (activeTab === name) setActiveTab('');
    }

    updateData(newData);
    setMoveConfig(null);
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        setLoading(true);
        const unsubDoc = onSnapshot(doc(db, 'users', currentUser.uid), (docSnap) => {
          setLoading(false);
          if (docSnap.exists()) {
            const data = docSnap.data();
            const raw = data.categories;
            let loadedData = DEFAULT_DATA;
            
            // --- 結構遷移與檢查邏輯 ---
            if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
                // 檢查是否為舊的單層結構 (Key -> Array)
                const firstKey = Object.keys(raw)[0];
                const firstVal = raw[firstKey];
                
                if (Array.isArray(firstVal)) {
                    // 偵測到舊結構，執行遷移：全部塞入預設分類
                    loadedData = {
                        '大分類(未分類)': {
                            '小分類(未分類)': raw
                        }
                    };
                } else if (typeof firstVal === 'object') {
                    // 可能是三層結構，再檢查一層
                    const subKey = Object.keys(firstVal)[0];
                    if (subKey && Array.isArray(firstVal[subKey])) {
                         // 這是兩層結構 (Category -> Tab)，需升級為三層
                         let upgradedData = {};
                         Object.keys(raw).forEach(cat => {
                             upgradedData[cat] = { '小分類(未分類)': raw[cat] };
                         });
                         loadedData = upgradedData;
                    } else {
                        // 認定為正確的三層結構
                        loadedData = raw;
                    }
                }
            }
            
            setAllData(loadedData);
            
            // 初始化或更新選擇 (使用 Ref 取得最新狀態，防止跳轉)
            const currentSel = activeSelectionRef.current;
            const cats = Object.keys(loadedData);
            
            // 1. 決定 Category
            let newCat = currentSel.cat;
            if (!loadedData[newCat]) {
                newCat = cats[0] || '';
            }
            setActiveCategory(newCat);

            // 2. 決定 Subcategory
            const subs = newCat ? Object.keys(loadedData[newCat] || {}) : [];
            let newSub = currentSel.sub;
            if (!loadedData[newCat] || !loadedData[newCat][newSub]) {
                newSub = subs[0] || '';
            }
            setActiveSubcategory(newSub);

            // 3. 決定 Tab
            const tabs = (newCat && newSub) ? Object.keys(loadedData[newCat][newSub] || {}) : [];
            let newTab = currentSel.tab;
            if (!loadedData[newCat] || !loadedData[newCat][newSub] || !loadedData[newCat][newSub][newTab]) {
                newTab = tabs[0] || '';
            }
            setActiveTab(newTab);

          } else {
            saveDataToCloud(DEFAULT_DATA, currentUser.uid);
          }
        }, () => setLoading(false));
        return () => unsubDoc();
      } else {
        setAllData(DEFAULT_DATA);
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  const saveTimeoutRef = useRef(null);
  const saveDataToCloud = async (newData, uid = user?.uid) => {
    if (!uid) return;
    setSyncStatus('syncing');
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        const userRef = doc(db, 'users', uid);
        try {
          await updateDoc(userRef, { categories: newData, lastUpdated: new Date() });
        } catch (err) {
          await setDoc(userRef, { categories: newData, lastUpdated: new Date() });
        }
        setSyncStatus('saved');
        setTimeout(() => setSyncStatus('idle'), 2000);
      } catch (err) { 
        console.error("Save failed:", err);
        setSyncStatus('error'); 
      }
    }, 1000);
  };

  const updateData = (newData) => {
    setAllData(newData);
    saveDataToCloud(newData);
  };

  const handleLogin = async () => {
    try { await signInWithPopup(auth, googleProvider); } catch (error) { alert("登入失敗: " + error.message); }
  };
  
  const handleLogout = async () => {
    if (confirm("確定要登出嗎？")) { await signOut(auth); setAppState('input'); }
  };

  // 取得目前顯示的項目列表
  const currentList = (
      allData[activeCategory] && 
      allData[activeCategory][activeSubcategory] && 
      Array.isArray(allData[activeCategory][activeSubcategory][activeTab])
  ) ? allData[activeCategory][activeSubcategory][activeTab] : [];

  // --- CRUD 操作 ---
  const handleAddSubmit = () => {
    const name = newName.trim();
    if (!name) return;

    const newData = JSON.parse(JSON.stringify(allData)); // Deep copy

    if (addingType === 'category') {
        if (!newData[name]) {
            newData[name] = { '新小分類': { '新清單': [] } };
            setActiveCategory(name);
            setActiveSubcategory('新小分類');
            setActiveTab('新清單');
        }
    } else if (addingType === 'subcategory') {
        if (activeCategory && !newData[activeCategory][name]) {
            newData[activeCategory][name] = { '新清單': [] };
            setActiveSubcategory(name);
            setActiveTab('新清單');
        }
    } else if (addingType === 'tab') {
        // 使用選定的分類，而非預設 active
        if (targetCatForAdd && targetSubForAdd && !newData[targetCatForAdd][targetSubForAdd][name]) {
            newData[targetCatForAdd][targetSubForAdd][name] = [];
            // 自動切換到新建立的 tab 位置
            setActiveCategory(targetCatForAdd);
            setActiveSubcategory(targetSubForAdd);
            setActiveTab(name);
        }
    }
    
    updateData(newData);
    setAddingType(null);
    setNewName('');
  };

  const deleteItem = (type, name) => {
      if (!confirm(`確定刪除 ${type}「${name}」嗎？`)) return;
      const newData = JSON.parse(JSON.stringify(allData));
      
      if (type === 'category') {
          delete newData[name];
          // 如果刪光了，補一個預設
          if (Object.keys(newData).length === 0) newData['新大分類'] = {};
          setActiveCategory(Object.keys(newData)[0]);
      } else if (type === 'subcategory') {
          delete newData[activeCategory][name];
          setActiveSubcategory(Object.keys(newData[activeCategory])[0] || '');
      } else if (type === 'tab') {
          delete newData[activeCategory][activeSubcategory][name];
          setActiveTab(Object.keys(newData[activeCategory][activeSubcategory])[0] || '');
      }
      updateData(newData);
  };

  const addItem = () => {
    if (!inputValue.trim()) return;
    const newData = JSON.parse(JSON.stringify(allData));
    newData[activeCategory][activeSubcategory][activeTab].push(inputValue.trim());
    updateData(newData);
    setInputValue('');
  };

  const removeItem = (idx) => {
    const newData = JSON.parse(JSON.stringify(allData));
    newData[activeCategory][activeSubcategory][activeTab] = currentList.filter((_, i) => i !== idx);
    updateData(newData);
  };

  const startBattle = () => {
    if (currentList.length < 2) return;
    const shuffled = [...currentList].sort(() => Math.random() - 0.5);
    setCurrentKing(shuffled[0]);
    setChallenger(shuffled[1]);
    setQueue(shuffled.slice(2));
    setAppState('battle');
  };
  const chooseWinner = (winner) => {
    if (queue.length > 0) {
      setCurrentKing(winner);
      setChallenger(queue[0]);
      setQueue(queue.slice(1));
    } else {
      setCurrentKing(winner);
      setAppState('winner');
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center text-slate-400">載入中...</div>;
  
  if (!user) return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-2xl shadow-xl text-center max-w-md w-full">
        <h1 className="text-2xl font-bold mb-4">雲端選擇器</h1>
        <button onClick={handleLogin} className="w-full bg-blue-500 text-white py-3 rounded-xl">Google 登入</button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen p-4 flex flex-col items-center justify-center">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl overflow-hidden h-[85vh] flex flex-col relative">
        <div className="bg-slate-800 p-4 text-white flex justify-between items-center">
           <h1 className="font-bold flex gap-2 items-center"><img src="./icon.png" className="w-8 h-8 object-contain" alt="Logo"/> 雲端選擇器</h1>
           <div className="flex gap-2">
             <button onClick={handleLogout}><Icon name="LogOut" className="w-5 h-5 text-red-300"/></button>
           </div>
        </div>
        
        {/* 通用新增輸入框 (僅限新增 大分類/小分類 時顯示條狀) */}
        {addingType && addingType !== 'tab' && (
            <div className="bg-slate-900 p-3 flex gap-2 items-center animate-fade-in">
                <span className="text-white text-sm">新增{addingType === 'category' ? '大分類' : '小分類'}:</span>
                <input value={newName} onChange={e=>setNewName(e.target.value)} className="flex-1 px-2 py-1 rounded text-black text-sm" autoFocus/>
                <button onClick={handleAddSubmit} className="bg-teal-500 text-white px-3 py-1 rounded text-sm">確定</button>
                <button onClick={()=>setAddingType(null)} className="text-slate-400"><Icon name="X" className="w-4 h-4"/></button>
            </div>
        )}

        {/* 新增清單(Tab) 的專用彈出視窗 */}
        {addingType === 'tab' && (
             <div className="absolute inset-0 bg-black/90 z-50 flex flex-col items-center justify-center p-4 animate-fade-in">
                <div className="bg-white rounded-xl w-full max-w-sm overflow-hidden flex flex-col shadow-2xl max-h-[80vh]">
                    <div className="bg-slate-800 p-4 text-white font-bold flex justify-between items-center">
                        <span>新增清單</span>
                        <button onClick={()=>setAddingType(null)}><Icon name="X" className="w-5 h-5"/></button>
                    </div>
                    
                    <div className="p-4 overflow-y-auto flex-1 flex flex-col gap-3">
                        {/* 輸入名稱 */}
                        <div>
                            <div className="text-sm font-bold text-slate-500 mb-1">清單名稱</div>
                            <input value={newName} onChange={e=>setNewName(e.target.value)} className="w-full border p-2 rounded-lg text-black" placeholder="例如：早餐選擇" autoFocus/>
                        </div>

                        {/* 步驟 1: 選擇大分類 */}
                        <div>
                            <div className="text-sm font-bold text-slate-500 mb-1">歸屬大分類</div>
                            <div className="flex flex-wrap gap-2">
                                {Object.keys(allData).map(cat => (
                                    <button key={cat} 
                                        onClick={()=>{ setTargetCatForAdd(cat); setTargetSubForAdd(''); }}
                                        className={`px-3 py-2 rounded-lg text-sm border ${targetCatForAdd===cat ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-700 border-slate-300'}`}>
                                        {cat}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* 步驟 2: 選擇小分類 */}
                        {targetCatForAdd && (
                            <div className="animate-fade-in">
                                <div className="text-sm font-bold text-slate-500 mb-1 mt-2">歸屬小分類</div>
                                <div className="flex flex-wrap gap-2">
                                    {Object.keys(allData[targetCatForAdd] || {}).map(sub => (
                                        <button key={sub}
                                            onClick={()=>setTargetSubForAdd(sub)}
                                            className={`px-3 py-2 rounded-lg text-sm border ${targetSubForAdd===sub ? 'bg-sky-600 text-white border-sky-600' : 'bg-white text-slate-700 border-slate-300'}`}>
                                            {sub}
                                        </button>
                                    ))}
                                    {Object.keys(allData[targetCatForAdd] || {}).length === 0 && <span className="text-xs text-red-400">無小分類，請先新增小分類</span>}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="p-4 border-t bg-slate-50 flex gap-2">
                        <button onClick={()=>setAddingType(null)} className="flex-1 py-2 text-slate-500 bg-white border rounded-lg">取消</button>
                        <button onClick={handleAddSubmit} 
                            disabled={!newName || !targetCatForAdd || !targetSubForAdd}
                            className="flex-1 py-2 bg-teal-500 text-white rounded-lg font-bold disabled:bg-slate-300 disabled:cursor-not-allowed">
                            確認新增
                        </button>
                    </div>
                </div>
             </div>
        )}

        {/* 第一層：Category (大分類) */}
        <div className="bg-slate-800 p-2 flex overflow-x-auto gap-2 no-scrollbar border-b border-slate-700">
           {Object.keys(allData).map(cat => (
             <button key={cat} 
                onClick={()=>{
                    setActiveCategory(cat); 
                    const subs = Object.keys(allData[cat]||{}); 
                    setActiveSubcategory(subs[0]||'');
                    const tabs = subs[0] ? Object.keys(allData[cat][subs[0]]||{}) : [];
                    setActiveTab(tabs[0]||'');
                    setAppState('input');
                }} 
                onDoubleClick={()=>deleteItem('category', cat)}
                className={`px-3 py-1 rounded-lg text-sm whitespace-nowrap transition-colors border ${activeCategory===cat?'bg-indigo-600 border-indigo-400 text-white font-bold':'bg-slate-700 border-transparent text-slate-400 hover:bg-slate-600'}`}>
                {cat}
             </button>
           ))}
           <button onClick={()=>setAddingType('category')} className="px-2 py-1 bg-slate-700 text-slate-400 rounded-lg hover:bg-slate-600 border border-slate-600"><Icon name="Plus" className="w-4 h-4"/></button>
        </div>

        {/* 第二層：Subcategory (小分類) */}
        <div className="bg-slate-700 p-2 flex overflow-x-auto gap-2 no-scrollbar border-b border-slate-600 shadow-inner">
           {activeCategory && allData[activeCategory] && Object.keys(allData[activeCategory]).map(sub => (
             <button key={sub} 
                {...bindLongPress('subcategory', sub, activeCategory)}
                onClick={()=>{
                    if (ignoreClick.current) return; // 如果是長按，就不執行切換
                    setActiveSubcategory(sub);
                    const tabs = Object.keys(allData[activeCategory][sub]||{});
                    setActiveTab(tabs[0]||'');
                    setAppState('input');
                }} 
                onDoubleClick={()=>deleteItem('subcategory', sub)}
                className={`px-3 py-1 rounded-lg text-sm whitespace-nowrap transition-colors ${activeSubcategory===sub?'bg-sky-600 text-white font-bold':'bg-slate-600 text-slate-300 hover:bg-slate-500'}`}>
                {sub}
             </button>
           ))}
           {activeCategory && <button onClick={()=>setAddingType('subcategory')} className="px-2 py-1 bg-slate-600 text-slate-400 rounded-lg hover:bg-slate-500"><Icon name="Plus" className="w-4 h-4"/></button>}
        </div>

        {/* 第三層：Tab (清單/項目) */}
        <div className="bg-slate-600 p-2 flex overflow-x-auto gap-2 no-scrollbar">
           {activeCategory && activeSubcategory && allData[activeCategory][activeSubcategory] && Object.keys(allData[activeCategory][activeSubcategory]).map(tab => (
             <button key={tab} 
                {...bindLongPress('tab', tab, activeCategory, activeSubcategory)}
                onClick={()=>{
                    if (ignoreClick.current) return;
                    setActiveTab(tab); 
                    setAppState('input');
                }} 
                onDoubleClick={()=>deleteItem('tab', tab)}
                className={`px-3 py-1 rounded-full text-sm whitespace-nowrap transition-colors ${activeTab===tab?'bg-teal-500 text-white font-bold':'bg-slate-500 text-slate-200 hover:bg-slate-400'}`}>
                {tab}
             </button>
           ))}
           {activeSubcategory && <button onClick={()=>{ setAddingType('tab'); setTargetCatForAdd(activeCategory); setTargetSubForAdd(activeSubcategory); }} className="px-2 py-1 bg-slate-500 text-slate-300 rounded-full hover:bg-slate-400"><Icon name="Plus" className="w-4 h-4"/></button>}
        </div>
        
        <div className="flex-1 p-4 overflow-y-auto">
           {appState === 'input' && (
             <div className="flex flex-col h-full gap-4">
               <div className="flex gap-2"><input value={inputValue} onChange={e=>setInputValue(e.target.value)} className="flex-1 border p-3 rounded-xl" placeholder={`新增至 ${activeTab || '清單'}...`}/><button onClick={addItem} className="bg-slate-800 text-white px-4 rounded-xl"><Icon name="Plus"/></button></div>
               <div className="flex-1 overflow-y-auto space-y-2">
                 {currentList.map((item,i) => (
                   <div key={i} className="flex justify-between bg-slate-50 p-3 rounded border">
                        <span className="text-black">{item}</span>
                        <button onClick={()=>removeItem(i)} className="text-red-400"><Icon name="Trash2" className="w-4 h-4"/></button>
                   </div>
                 ))}
                 {currentList.length === 0 && <div className="text-center text-gray-400 mt-10">此清單沒有項目</div>}
               </div>
               <button onClick={startBattle} disabled={currentList.length<2} className="w-full bg-teal-500 text-white py-4 rounded-xl font-bold disabled:bg-gray-200">開始 PK</button>
             </div>
           )}
           {appState === 'battle' && (
             <div className="h-full flex flex-col justify-center gap-4">
                <button onClick={()=>chooseWinner(currentKing)} className="p-6 border-2 border-teal-500 rounded-xl text-left bg-teal-50"><span className="text-xs text-teal-600 font-bold">KING</span><div className="text-2xl font-bold text-black">{currentKing}</div></button>
                <div className="text-center text-slate-300 font-black italic">VS</div>
                <button onClick={()=>chooseWinner(challenger)} className="p-6 border-2 border-indigo-500 rounded-xl text-left bg-indigo-50"><span className="text-xs text-indigo-600 font-bold">CHALLENGER</span><div className="text-2xl font-bold text-black">{challenger}</div></button>
             </div>
           )}
           {appState === 'winner' && (
             <div className="h-full flex flex-col justify-center items-center text-center">
                <Icon name="Trophy" className="w-20 h-20 text-yellow-500 mb-4"/>
                <div className="text-4xl font-black mb-8 text-black">{currentKing}</div>
                <button onClick={()=>setAppState('input')} className="bg-slate-800 text-white px-6 py-3 rounded-xl flex gap-2"><Icon name="RotateCcw"/> 重來</button>
             </div>
           )}

           {/* --- 移動功能的選單 (Modal) --- */}
           {moveConfig && (
             <div className="absolute inset-0 bg-black/90 z-50 flex flex-col items-center justify-center p-4 animate-fade-in">
                <div className="bg-white rounded-xl w-full max-w-sm overflow-hidden flex flex-col shadow-2xl max-h-[80vh]">
                    <div className="bg-slate-800 p-4 text-white font-bold flex justify-between items-center">
                        <span>移動: {moveConfig.name}</span>
                        <button onClick={()=>setMoveConfig(null)}><Icon name="X" className="w-5 h-5"/></button>
                    </div>
                    
                    <div className="p-4 overflow-y-auto flex-1 flex flex-col gap-3">
                        {/* 步驟 1: 選擇大分類 */}
                        <div>
                            <div className="text-sm font-bold text-slate-500 mb-1">移動到哪個大分類？</div>
                            <div className="flex flex-wrap gap-2">
                                {Object.keys(allData).map(cat => (
                                    <button key={cat} 
                                        onClick={()=>{ setMoveToCat(cat); setMoveToSub(''); }}
                                        className={`px-3 py-2 rounded-lg text-sm border ${moveToCat===cat ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-700 border-slate-300'}`}>
                                        {cat}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* 步驟 2: 選擇小分類 (只有在移動 Tab 且已選大分類時出現) */}
                        {moveConfig.type === 'tab' && moveToCat && (
                            <div className="animate-fade-in">
                                <div className="text-sm font-bold text-slate-500 mb-1 mt-2">選擇「{moveToCat}」下的小分類：</div>
                                <div className="flex flex-wrap gap-2">
                                    {Object.keys(allData[moveToCat] || {}).map(sub => (
                                        <button key={sub}
                                            onClick={()=>setMoveToSub(sub)}
                                            className={`px-3 py-2 rounded-lg text-sm border ${moveToSub===sub ? 'bg-sky-600 text-white border-sky-600' : 'bg-white text-slate-700 border-slate-300'}`}>
                                            {sub}
                                        </button>
                                    ))}
                                    {Object.keys(allData[moveToCat] || {}).length === 0 && <span className="text-xs text-red-400">此大分類下無小分類，無法移動</span>}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="p-4 border-t bg-slate-50 flex gap-2">
                        <button onClick={()=>setMoveConfig(null)} className="flex-1 py-2 text-slate-500 bg-white border rounded-lg">取消</button>
                        <button onClick={executeMove} 
                            disabled={!moveToCat || (moveConfig.type==='tab' && !moveToSub)}
                            className="flex-1 py-2 bg-teal-500 text-white rounded-lg font-bold disabled:bg-slate-300 disabled:cursor-not-allowed">
                            確認移動
                        </button>
                    </div>
                </div>
             </div>
           )}
        </div>
      </div>
    </div>
  );
};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<UniversalSelector />);

// PWA 註冊
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(err => console.log('SW Failed', err));
}
