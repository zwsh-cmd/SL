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

  // --- 新增：移動項目的相關狀態 ---
  const [movingItem, setMovingItem] = useState(null); // { item: '名稱', index: 0 }
  const [moveTargetGroup, setMoveTargetGroup] = useState(null);
  const longPressTimer = useRef(null);

  // 開始長按
  const startLongPress = (item, index) => {
    longPressTimer.current = setTimeout(() => {
      setMovingItem({ item, index });
      setMoveTargetGroup(null); // 重置選擇狀態
      if (navigator.vibrate) navigator.vibrate(50); // 手機震動回饋
    }, 800); // 設定長按時間為 0.8 秒
  };

  // 結束/取消長按
  const endLongPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  // 執行移動
  const executeMove = (targetCategory) => {
     if (!movingItem || !moveTargetGroup) return;
     
     // 深拷貝一份資料以策安全
     const newData = JSON.parse(JSON.stringify(allData));
     const currentGroup = activeGroup;
     
     // 1. 從舊位置刪除
     if (newData[currentGroup] && newData[currentGroup][activeTab]) {
        newData[currentGroup][activeTab].splice(movingItem.index, 1);
     }
     
     // 2. 加入新位置
     if (!newData[moveTargetGroup][targetCategory]) {
        newData[moveTargetGroup][targetCategory] = [];
     }
     newData[moveTargetGroup][targetCategory].push(movingItem.item);
     
     // 3. 儲存並關閉
     updateData(newData);
     setMovingItem(null);
     setMoveTargetGroup(null);
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        setLoading(true);
        const unsubDoc = onSnapshot(doc(db, 'users', currentUser.uid), (docSnap) => {
          setLoading(false);
          if (docSnap.exists()) {
            let data = docSnap.data().categories || {};
            
            // --- 資料結構強力修復區 ---
            // 1. 如果最外層是陣列 (舊資料)，包進「未分類」
            if (Array.isArray(data)) { 
                data = { '未分類': { '預設清單': data } };
            } else {
                // 2. 遍歷檢查每個大分類
                Object.keys(data).forEach(groupKey => {
                    // 如果大分類的值竟然是陣列 (格式錯誤)，把它包成物件
                    if (Array.isArray(data[groupKey])) {
                        data[groupKey] = { '預設清單': data[groupKey] };
                    } 
                    // 如果大分類的值不是物件 (甚至是字串)，重置為空物件
                    else if (typeof data[groupKey] !== 'object' || data[groupKey] === null) {
                        data[groupKey] = {};
                    }

                    // 3. 遍歷檢查每個小分類
                    Object.keys(data[groupKey]).forEach(catKey => {
                        // 如果小分類的值不是陣列 (格式錯誤)，重置為空陣列
                        if (!Array.isArray(data[groupKey][catKey])) {
                            data[groupKey][catKey] = [];
                        }
                    });
                });
            }
            // --- 修復結束 ---

            setAllData(data);
            
            // 智慧設定預設選中項 (防止選中不存在的項目導致白屏)
            const groups = Object.keys(data);
            if (groups.length > 0) {
               setActiveGroup(prevGroup => {
                   const targetGroup = data[prevGroup] ? prevGroup : groups[0];
                   // 設定完 Group 後，接著設定 Tab
                   const cats = Object.keys(data[targetGroup] || {});
                   if (cats.length > 0) {
                       setActiveTab(prevTab => (data[targetGroup][prevTab]) ? prevTab : cats[0]);
                   } else {
                       setActiveTab('');
                   }
                   return targetGroup;
               });
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
  // 強制確認 currentList 必須是陣列，否則給空陣列 (防止白屏)
  const rawList = currentGroupData[activeTab];
  const currentList = Array.isArray(rawList) ? rawList : [];

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
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl overflow-hidden h-[85vh] flex flex-col relative">
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
               onClick={()=>{setActiveTab(cat);setAppState('input')}} 
               onDoubleClick={()=>deleteCategory(cat)}
               className={`px-3 py-1 rounded-full text-sm transition-colors ${activeTab===cat?'bg-teal-500 text-white shadow-lg':'bg-slate-600 text-slate-300 hover:bg-slate-500'}`}>
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
                        onMouseDown={()=>startLongPress(item, i)} 
                        onMouseUp={endLongPress} 
                        onMouseLeave={endLongPress}
                        onTouchStart={()=>startLongPress(item, i)}
                        onTouchEnd={endLongPress}
                        onContextMenu={(e)=>e.preventDefault()}
                        className="flex justify-between bg-slate-50 p-3 rounded border select-none active:bg-slate-200 transition-colors cursor-pointer">
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

        {/* --- 移動項目的彈出視窗 --- */}
        {movingItem && (
           <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-50 p-4 animate-fade-in">
             <div className="bg-white rounded-xl w-full max-w-sm overflow-hidden flex flex-col max-h-[80vh] shadow-2xl">
               <div className="bg-slate-800 p-4 text-white font-bold flex justify-between items-center">
                 <span className="truncate">移動: {movingItem.item}</span>
                 <button onClick={()=>{setMovingItem(null); setMoveTargetGroup(null);}}><Icon name="X" className="w-5 h-5"/></button>
               </div>
               
               <div className="p-4 overflow-y-auto flex-1">
                 {!moveTargetGroup ? (
                   <>
                     <div className="text-sm text-slate-500 mb-2 font-bold">請選擇大分類 (Groups)</div>
                     <div className="flex flex-col gap-2">
                       {Object.keys(allData).map(group => (
                         <button key={group} onClick={()=>setMoveTargetGroup(group)} className="p-4 bg-slate-100 rounded-lg text-left hover:bg-indigo-50 text-black font-medium border border-slate-200">
                           {group}
                         </button>
                       ))}
                     </div>
                   </>
                 ) : (
                   <>
                     <div className="flex items-center gap-2 mb-4">
                        <button onClick={()=>setMoveTargetGroup(null)} className="text-slate-500 hover:text-slate-800 flex items-center gap-1 bg-slate-100 px-3 py-1 rounded-full text-sm"><Icon name="ArrowLeft" className="w-4 h-4"/> 返回大分類</button>
                     </div>
                     <div className="text-sm text-slate-500 mb-2 font-bold">選擇「{moveTargetGroup}」的小分類</div>
                     <div className="flex flex-col gap-2">
                       {Object.keys(allData[moveTargetGroup] || {}).map(cat => (
                         <button key={cat} onClick={()=>executeMove(cat)} className="p-4 bg-white border border-slate-200 rounded-lg text-left hover:bg-teal-50 text-black hover:border-teal-500 shadow-sm">
                           {cat}
                         </button>
                       ))}
                       {Object.keys(allData[moveTargetGroup] || {}).length === 0 && <div className="text-slate-400 text-center py-8 bg-slate-50 rounded-lg">此分類下沒有小分類</div>}
                     </div>
                   </>
                 )}
               </div>
               
               <div className="p-4 border-t bg-slate-50">
                  <button onClick={()=>{setMovingItem(null); setMoveTargetGroup(null);}} className="w-full py-3 text-slate-500 font-medium hover:bg-slate-200 rounded-lg transition-colors">取消</button>
               </div>
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
