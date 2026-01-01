// --- 1. Firebase 設定區 ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, onSnapshot, setDoc, enableIndexedDbPersistence } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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
  // 1. 改為階層式預設資料
  const DEFAULT_CATEGORIES = {
    '餐飲選擇': {
      '中餐': ['麥當勞', '巷口麵店', '排骨飯', '便利商店'],
      '晚餐': ['火鍋', '牛排', '自己煮', '鹹水雞']
    },
    '創作靈感': {
      '寫作題材': ['回憶錄', '科幻短篇', '生活觀察'],
      '繪畫風格': ['水彩', '素描', '油畫']
    }
  };

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState('idle');
  const [allData, setAllData] = useState(DEFAULT_CATEGORIES);
  
  // 2. 新增 activeGroup 狀態
  const [activeGroup, setActiveGroup] = useState('餐飲選擇');
  const [activeTab, setActiveTab] = useState('中餐');
  
  const [appState, setAppState] = useState('input');
  const [inputValue, setInputValue] = useState('');
  
  // 3. 新增控制群組/分類新增模式的狀態
  const [addingMode, setAddingMode] = useState(null); // null, 'group', 'category'
  const [newCategoryName, setNewCategoryName] = useState('');
  
  const [currentKing, setCurrentKing] = useState(null);
  const [challenger, setChallenger] = useState(null);
  const [queue, setQueue] = useState([]);

  // --- 拖曳核心邏輯開始 ---
  const [dragState, setDragState] = useState(null); // { type: 'item'|'category', data: any, startGroup: string, startCat: string }
  const [dragPos, setDragPos] = useState({ x: 0, y: 0 });
  const longPressTimer = useRef(null);
  const isDraggingRef = useRef(false);

  // 通用拖曳事件綁定器
  const bindDrag = (type, data) => {
    const handleStart = (e) => {
      // 忽略右鍵或多指觸控
      if (e.type === 'mousedown' && e.button !== 0) return;
      if (e.type === 'touchstart' && e.touches.length > 1) return;

      const clientX = e.type.includes('mouse') ? e.clientX : e.touches[0].clientX;
      const clientY = e.type.includes('mouse') ? e.clientY : e.touches[0].clientY;
      
      isDraggingRef.current = false;
      longPressTimer.current = setTimeout(() => {
        isDraggingRef.current = true;
        setDragState({ 
          type, 
          data, 
          startGroup: activeGroup, 
          startCat: activeTab 
        });
        setDragPos({ x: clientX, y: clientY });
        if (navigator.vibrate) navigator.vibrate(50); // 手機震動回饋
      }, 500); // 長按 0.5 秒觸發
    };

    const handleMove = (e) => {
      if (longPressTimer.current && !isDraggingRef.current) {
        // 如果還沒觸發長按就移動了，表示使用者是想滑動畫面，取消長按
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
      }
      if (isDraggingRef.current) {
        e.preventDefault(); // 防止畫面捲動
        const clientX = e.type.includes('mouse') ? e.clientX : e.touches[0].clientX;
        const clientY = e.type.includes('mouse') ? e.clientY : e.touches[0].clientY;
        setDragPos({ x: clientX, y: clientY });
      }
    };

    const handleEnd = (e) => {
      if (longPressTimer.current) clearTimeout(longPressTimer.current);
      
      if (isDraggingRef.current) {
        // 執行放置邏輯
        const clientX = e.type.includes('mouse') ? e.clientX : e.changedTouches[0].clientX;
        const clientY = e.type.includes('mouse') ? e.clientY : e.changedTouches[0].clientY;
        
        // 尋找手指下的目標元素 (Group 或 Category 按鈕)
        // 暫時隱藏 ghost 元素以免擋住檢測
        const ghost = document.getElementById('drag-ghost');
        if (ghost) ghost.style.display = 'none';
        const elemBelow = document.elementFromPoint(clientX, clientY);
        if (ghost) ghost.style.display = 'flex';

        const targetGroupBtn = elemBelow?.closest('[data-group-target]');
        const targetCatBtn = elemBelow?.closest('[data-cat-target]');

        // 邏輯 A: 項目 (Item) -> 拖到 -> 小分類 (Category)
        if (dragState.type === 'item' && targetCatBtn) {
          const targetCat = targetCatBtn.dataset.catTarget;
          if (targetCat !== activeTab) { // 避免拖到自己所在的分類
             const newData = { ...allData };
             // 1. 從舊處移除
             newData[activeGroup][activeTab] = newData[activeGroup][activeTab].filter(i => i !== dragState.data);
             // 2. 加入新處
             if (!newData[activeGroup][targetCat]) newData[activeGroup][targetCat] = [];
             newData[activeGroup][targetCat].push(dragState.data);
             updateData(newData);
          }
        }
        
        // 邏輯 B: 小分類 (Category) -> 拖到 -> 大分類 (Group)
        if (dragState.type === 'category' && targetGroupBtn) {
           const targetGroup = targetGroupBtn.dataset.groupTarget;
           const catName = dragState.data;
           if (targetGroup !== activeGroup) { // 避免拖到自己所在的大群組
              const newData = { ...allData };
              const catData = newData[activeGroup][catName];
              // 1. 從舊群組移除
              delete newData[activeGroup][catName];
              // 2. 加入新群組
              if (!newData[targetGroup]) newData[targetGroup] = {};
              newData[targetGroup][catName] = catData;
              // 3. 介面跳轉修正
              if (activeTab === catName) setActiveTab(Object.keys(newData[activeGroup])[0] || '');
              updateData(newData);
           }
        }
      }
      
      setDragState(null);
      isDraggingRef.current = false;
    };

    return {
      onMouseDown: handleStart,
      onTouchStart: handleStart,
      onMouseMove: handleMove,
      onTouchMove: handleMove,
      onMouseUp: handleEnd,
      onTouchEnd: handleEnd,
      onContextMenu: (e) => e.preventDefault() // 防止長按跳出選單
    };
  };
  // --- 拖曳核心邏輯結束 ---

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        setLoading(true);
        const unsubDoc = onSnapshot(doc(db, 'users', currentUser.uid), (docSnap) => {
          setLoading(false);
          if (docSnap.exists()) {
            let data = docSnap.data().categories;
            // 資料遷移邏輯：如果讀取到舊的扁平資料（值是陣列），則包裹進「未分類」群組
            const firstKey = Object.keys(data || {})[0];
            if (firstKey && Array.isArray(data[firstKey])) {
              data = { '未分類': data };
            }
            if (data) {
              setAllData(data);
              // 確保選中有效的群組與分類
              const groups = Object.keys(data);
              if (groups.length > 0) {
                 const firstGroup = groups[0];
                 setActiveGroup(prev => data[prev] ? prev : firstGroup);
                 const cats = Object.keys(data[firstGroup] || {});
                 if (cats.length > 0) setActiveTab(prev => (data[prev] && data[prev][prev]) ? prev : cats[0]);
              }
            }
          } else {
            saveDataToCloud(DEFAULT_CATEGORIES, currentUser.uid);
          }
        }, () => setLoading(false));
        return () => unsubDoc();
      } else {
        setAllData(DEFAULT_CATEGORIES);
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
        await setDoc(doc(db, 'users', uid), { categories: newData, lastUpdated: new Date() }, { merge: true });
        setSyncStatus('saved');
        setTimeout(() => setSyncStatus('idle'), 2000);
      } catch (err) { setSyncStatus('error'); }
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

  const currentGroupData = allData[activeGroup] || {};
  const currentList = currentGroupData[activeTab] || [];

  const addItem = () => {
    if (!inputValue.trim()) return;
    const newGroupData = { ...currentGroupData, [activeTab]: [...currentList, inputValue.trim()] };
    updateData({ ...allData, [activeGroup]: newGroupData });
    setInputValue('');
  };

  const removeItem = (idx) => {
    const newGroupData = { ...currentGroupData, [activeTab]: currentList.filter((_, i) => i !== idx) };
    updateData({ ...allData, [activeGroup]: newGroupData });
  };

  const handleAddSubmit = () => {
    const name = newCategoryName.trim();
    if (!name) return;
    
    if (addingMode === 'group') {
       if (allData[name]) return;
       updateData({ ...allData, [name]: {} });
       setActiveGroup(name);
    } else if (addingMode === 'category') {
       if (currentGroupData[name]) return;
       const newGroupData = { ...currentGroupData, [name]: [] };
       updateData({ ...allData, [activeGroup]: newGroupData });
       setActiveTab(name);
    }
    setNewCategoryName('');
    setAddingMode(null);
  };

  const deleteGroup = (groupName) => {
    if (!confirm(`刪除大分類「${groupName}」及其下所有內容？`)) return;
    const newData = { ...allData };
    delete newData[groupName];
    updateData(newData);
    if (activeGroup === groupName) setActiveGroup(Object.keys(newData)[0] || '');
  };

  const deleteCategory = (catName) => {
    if (!confirm(`刪除小分類「${catName}」？`)) return;
    const newGroupData = { ...currentGroupData };
    delete newGroupData[catName];
    updateData({ ...allData, [activeGroup]: newGroupData });
    if (activeTab === catName) setActiveTab(Object.keys(newGroupData)[0] || '');
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
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl overflow-hidden h-[85vh] flex flex-col">
        <div className="bg-slate-800 p-4 text-white flex justify-between items-center">
           <h1 className="font-bold flex gap-2 items-center"><img src="./icon.png" className="w-8 h-8 object-contain" alt="Logo"/> 雲端選擇器</h1>
           <div className="flex gap-2">
             <button onClick={handleLogout}><Icon name="LogOut" className="w-5 h-5 text-red-300"/></button>
           </div>
        </div>
        
        {/* 新增模式輸入框 */}
        {addingMode && (
          <div className="bg-slate-900 p-3 flex gap-2 items-center animate-fade-in">
            <span className="text-white text-sm whitespace-nowrap">{addingMode==='group'?'新增大群組':'新增小分類'}:</span>
            <input value={newCategoryName} onChange={e=>setNewCategoryName(e.target.value)} className="flex-1 px-2 py-1 rounded text-black text-sm" autoFocus/>
            <button onClick={handleAddSubmit} className="bg-teal-500 text-white px-3 py-1 rounded text-sm">確定</button>
            <button onClick={()=>setAddingMode(null)} className="text-slate-400"><Icon name="X" className="w-4 h-4"/></button>
          </div>
        )}

        {/* 第一層：大分類 (Groups) */}
        <div className="bg-slate-800 px-2 py-2 flex overflow-x-auto gap-2 border-b border-slate-700 no-scrollbar">
           {Object.keys(allData).map(group => (
             <button key={group} 
               data-group-target={group} // 標記為拖曳目標
               onClick={()=>{setActiveGroup(group); setActiveTab(Object.keys(allData[group]||{})[0]||''); setAppState('input')}} 
               onDoubleClick={()=>deleteGroup(group)}
               className={`px-3 py-1 rounded-lg text-sm whitespace-nowrap transition-colors ${activeGroup===group?'bg-indigo-500 text-white font-bold':'bg-slate-700 text-slate-400 hover:bg-slate-600'}`}>
               {group}
             </button>
           ))}
           <button onClick={()=>setAddingMode('group')} className="px-2 py-1 bg-slate-700 text-slate-400 rounded-lg hover:bg-slate-600"><Icon name="Plus" className="w-4 h-4"/></button>
        </div>

        {/* 第二層：小分類 (Categories) */}
        <div className="bg-slate-700 p-2 flex flex-wrap gap-2 shadow-inner min-h-[50px] items-center">
           {activeGroup && Object.keys(allData[activeGroup] || {}).map(cat => (
             <button key={cat} 
               data-cat-target={cat} // 標記為拖曳目標
               {...bindDrag('category', cat)} // 讓自己可以被拖曳
               onClick={()=>{if(!isDraggingRef.current){setActiveTab(cat);setAppState('input')}}} 
               onDoubleClick={()=>deleteCategory(cat)}
               className={`px-3 py-1 rounded-full text-sm transition-colors select-none ${activeTab===cat?'bg-teal-500 text-white shadow-lg':'bg-slate-600 text-slate-300 hover:bg-slate-500'}`}>
               {cat}
             </button>
           ))}
           {activeGroup && <button onClick={()=>setAddingMode('category')} className="px-2 py-1 bg-slate-600 text-slate-400 rounded-full hover:bg-slate-500"><Icon name="Plus" className="w-4 h-4"/></button>}
        </div>

        <div className="flex-1 p-4 overflow-y-auto">
           {appState === 'input' && (
             <div className="flex flex-col h-full gap-4">
               <div className="flex gap-2"><input value={inputValue} onChange={e=>setInputValue(e.target.value)} className="flex-1 border p-3 rounded-xl" placeholder="新增..."/><button onClick={addItem} className="bg-slate-800 text-white px-4 rounded-xl"><Icon name="Plus"/></button></div>
               <div className="flex-1 overflow-y-auto space-y-2">
                 {currentList.map((item,i) => (
                   <div key={i} 
                        {...bindDrag('item', item)} // 綁定拖曳功能
                        className="flex justify-between bg-slate-50 p-3 rounded border select-none active:bg-slate-200 transition-colors touch-none">
                        <span className="text-black">{item}</span>
                        <button onClick={(e)=>{e.stopPropagation(); removeItem(i);}} className="text-red-400"><Icon name="Trash2" className="w-4 h-4"/></button>
                   </div>
                 ))}
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
        </div>

        {/* --- 5. 拖曳時的分身 (Ghost Element) --- */}
        {dragState && (
          <div id="drag-ghost" 
               className="fixed pointer-events-none bg-teal-500 text-white px-4 py-2 rounded-lg shadow-2xl z-50 transform -translate-x-1/2 -translate-y-1/2 opacity-90 font-bold border-2 border-white"
               style={{ left: dragPos.x, top: dragPos.y }}>
             {dragState.data}
             <div className="text-xs font-normal opacity-80 mt-1">
               {dragState.type === 'item' ? '移動至上方小分類' : '移動至上方大分類'}
             </div>
          </div>
        )}

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
