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
  const DEFAULT_CATEGORIES = {
    '中餐': ['麥當勞', '巷口麵店', '排骨飯', '便利商店'],
    '晚餐': ['火鍋', '牛排', '自己煮', '鹹水雞'],
    '寫作題材': ['回憶錄', '科幻短篇', '生活觀察', '讀書心得']
  };

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState('idle');
  const [allData, setAllData] = useState(DEFAULT_CATEGORIES);
  const [activeTab, setActiveTab] = useState('中餐');
  const [appState, setAppState] = useState('input');
  const [inputValue, setInputValue] = useState('');
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [currentKing, setCurrentKing] = useState(null);
  const [challenger, setChallenger] = useState(null);
  const [queue, setQueue] = useState([]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        setLoading(true);
        const unsubDoc = onSnapshot(doc(db, 'users', currentUser.uid), (docSnap) => {
          setLoading(false);
          if (docSnap.exists()) {
            const data = docSnap.data().categories;
            if (data) setAllData(data);
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

  const currentList = allData[activeTab] || [];
  const addItem = () => {
    if (!inputValue.trim()) return;
    updateData({ ...allData, [activeTab]: [...(allData[activeTab] || []), inputValue.trim()] });
    setInputValue('');
  };
  const removeItem = (idx) => updateData({ ...allData, [activeTab]: allData[activeTab].filter((_, i) => i !== idx) });
  const clearCurrentList = () => confirm(`清空「${activeTab}」？`) && updateData({ ...allData, [activeTab]: [] });
  const addCategory = () => {
    const name = newCategoryName.trim();
    if (!name || allData[name]) return;
    updateData({ ...allData, [name]: [] });
    setActiveTab(name);
    setNewCategoryName('');
    setIsAddingCategory(false);
  };
  const deleteCategory = (name) => {
    if (Object.keys(allData).length <= 1 || !confirm(`刪除「${name}」？`)) return;
    const newData = { ...allData };
    delete newData[name];
    updateData(newData);
    if (activeTab === name) setActiveTab(Object.keys(newData)[0]);
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
             <button onClick={()=>setIsAddingCategory(!isAddingCategory)}>{isAddingCategory?<Icon name="X" className="w-5 h-5"/>:<Icon name="Plus" className="w-5 h-5"/>}</button>
             <button onClick={handleLogout}><Icon name="LogOut" className="w-5 h-5 text-red-300"/></button>
           </div>
        </div>
        {isAddingCategory && <div className="bg-slate-700 p-2 flex gap-2"><input value={newCategoryName} onChange={e=>setNewCategoryName(e.target.value)} className="flex-1 px-2 rounded text-black"/><button onClick={addCategory} className="text-white px-2">新增</button></div>}
        <div className="bg-slate-700 p-2 flex flex-wrap gap-2">
           {Object.keys(allData).map(cat => (
             <button key={cat} onClick={()=>{setActiveTab(cat);setAppState('input')}} className={`px-3 py-1 rounded-full text-sm ${activeTab===cat?'bg-teal-500 text-white':'bg-slate-600 text-slate-300'}`}>{cat}</button>
           ))}
        </div>
        <div className="flex-1 p-4 overflow-y-auto">
           {appState === 'input' && (
             <div className="flex flex-col h-full gap-4">
               <div className="flex gap-2"><input value={inputValue} onChange={e=>setInputValue(e.target.value)} className="flex-1 border p-3 rounded-xl" placeholder="新增..."/><button onClick={addItem} className="bg-slate-800 text-white px-4 rounded-xl"><Icon name="Plus"/></button></div>
               <div className="flex-1 overflow-y-auto space-y-2">
                 {currentList.map((item,i) => (
                   <div key={i} className="flex justify-between bg-slate-50 p-3 rounded border"><span className="text-black">{item}</span><button onClick={()=>removeItem(i)} className="text-red-400"><Icon name="Trash2" className="w-4 h-4"/></button></div>
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
