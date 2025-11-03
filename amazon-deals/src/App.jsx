
import React, { useEffect, useState } from 'react';
import { initializeApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth';
import {
  getFirestore,
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
  doc,
  getDoc,
  deleteDoc   // added
} from 'firebase/firestore';

import { motion, AnimatePresence } from 'framer-motion';

// ----------------- FIREBASE CONFIG (YOUR VALUES) -----------------
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyC_1piYhcAoc5Hp5BWcgV5A8rGNSEMTVwU",
  authDomain: "my-web-c4403.firebaseapp.com",
  projectId: "my-web-c4403",
  storageBucket: "my-web-c4403.firebasestorage.app",
  messagingSenderId: "894187562757",
  appId: "1:894187562757:web:c8570dbdf1730c74e7796c",
  measurementId: "G-T36BG204VH"
};

// Admin UID you provided
const ADMIN_UID = "6ivFNjW6laUuAxR4ladH92pu5Ks2";
// -----------------------------------------------------------------

// Initialize Firebase
const app = initializeApp(FIREBASE_CONFIG);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

export default function App() {
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [deals, setDeals] = useState([]);

  // form state
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [image, setImage] = useState('');
  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [autoFetchLoading, setAutoFetchLoading] = useState(false);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (!u) {
        setIsAdmin(false);
        return;
      }
      // admin check by UID
      if (ADMIN_UID && u.uid === ADMIN_UID) {
        setIsAdmin(true);
        return;
      }
      // fallback: check admins collection
      try {
        const adminDoc = await getDoc(doc(db, 'admins', u.uid));
        setIsAdmin(adminDoc.exists());
      } catch (e) {
        console.error('admin check failed', e);
        setIsAdmin(false);
      }
    });
    return () => unsubAuth();
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'deals'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      const arr = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setDeals(arr);
    });
    return () => unsub();
  }, []);

  async function login() {
    try {
      await signInWithPopup(auth, provider);
    } catch (e) {
      console.error('login failed', e);
      alert('Login failed: ' + e.message);
    }
  }

  async function logout() {
    await signOut(auth);
  }

  function resetForm() {
    setUrl('');
    setTitle('');
    setImage('');
    setPrice('');
    setDescription('');
  }

  async function addDeal(e) {
    e.preventDefault();
    if (!isAdmin) return alert('Only admins can add deals');
    if (!url || !title) return alert('Please provide at least a URL and title');
    setLoading(true);
    try {
      await addDoc(collection(db, 'deals'), {
        url,
        title,
        image: image || '',
        price: price || '',
        description: description || '',
        createdAt: serverTimestamp(),
        addedBy: user ? user.uid : null,
      });
      resetForm();
    } catch (err) {
      console.error(err);
      alert('Failed to add deal: ' + err.message);
    } finally {
      setLoading(false);
    }
  }
async function deleteDeal(id) {
  if (!isAdmin) return alert("Only admin can delete deals");
  if (!confirm("Are you sure you want to remove this deal?")) return;

  try {
    await deleteDoc(doc(db, "deals", id));
  } catch (err) {
    console.error(err);
    alert("Failed to delete deal: " + err.message);
  }
}

  // Simple auto-fetch using a public CORS proxy
  async function autoFetchPreview() {
    if (!url) return alert('Enter the affiliate URL first');
    setAutoFetchLoading(true);
    try {
      const proxy = 'https://api.allorigins.win/raw?url=' + encodeURIComponent(url);
      const res = await fetch(proxy);
      const html = await res.text();
      const ogTitle = html.match(/<meta property=\"og:title\" content=\"([^\"]+)\"/i) || html.match(/<title>([^<]+)<\/title>/i);
      const ogImage = html.match(/<meta property=\"og:image\" content=\"([^\"]+)\"/i) || html.match(/<meta name=\"twitter:image\" content=\"([^\"]+)\"/i);
      const ogDesc = html.match(/<meta property=\"og:description\" content=\"([^\"]+)\"/i) || html.match(/<meta name=\"description\" content=\"([^\"]+)\"/i);
      if (ogTitle) setTitle(ogTitle[1]);
      if (ogImage) setImage(ogImage[1]);
      if (ogDesc) setDescription(ogDesc[1]);
    } catch (err) {
      console.warn('preview fetch failed', err);
      alert('Auto-fetch failed. Paste image URL and title manually.');
    } finally {
      setAutoFetchLoading(false);
    }
  }

  function isToday(timestamp) {
    if (!timestamp) return false;
    const d = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const today = new Date();
    return (
      d.getFullYear() === today.getFullYear() &&
      d.getMonth() === today.getMonth() &&
      d.getDate() === today.getDate()
    );
  }

  const todaysDeals = deals.filter((d) => d.createdAt && isToday(d.createdAt));
  const recentDeals = deals.filter((d) => !d.createdAt || !isToday(d.createdAt));

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-gray-100 p-6">
      <div className="max-w-6xl mx-auto">
        <header className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight">Today&apos;s Amazon Deals</h1>
            <p className="text-gray-400 text-sm">Admin-managed affiliate deals — glassmorphism UI</p>
          </div>

          <div className="flex items-center gap-3">
            {user ? (
              <>
                <div className="text-sm text-gray-300">{user.displayName}</div>
                <button onClick={logout} className="px-3 py-1 bg-white/10 rounded-lg hover:bg-white/20">
                  Sign out
                </button>
              </>
            ) : (
              <button onClick={login} className="px-4 py-2 bg-emerald-500 rounded-lg shadow hover:brightness-105">
                Sign in with Google
              </button>
            )}
          </div>
        </header>

        <main className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {isAdmin && (
            <section className="md:col-span-1">
              <div className="p-5 rounded-2xl bg-white/5 backdrop-blur-md border border-white/6 shadow-lg">
                <h2 className="text-xl font-semibold mb-2">Admin Panel</h2>
                <p className="text-sm text-gray-400 mb-4">Sign in and add affiliate links. Links open in a new tab with your affiliate params.</p>
                <form onSubmit={addDeal} className="space-y-3">
                  <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Affiliate URL" className="w-full rounded-md p-2 bg-white/5 border border-white/6" />
                  <div className="flex gap-2">
                    <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" className="flex-1 rounded-md p-2 bg-white/5 border border-white/6" />
                    <button type="button" onClick={autoFetchPreview} disabled={autoFetchLoading} className="px-3 rounded-md bg-white/6">
                      {autoFetchLoading ? 'Fetching...' : 'Auto'}
                    </button>
                  </div>
                  <input value={image} onChange={(e) => setImage(e.target.value)} placeholder="Image URL (recommended)" className="w-full rounded-md p-2 bg-white/5 border border-white/6" />
                  <input value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Price (optional)" className="w-full rounded-md p-2 bg-white/5 border border-white/6" />
                  <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Short description" rows={3} className="w-full rounded-md p-2 bg-white/5 border border-white/6" />

                  <div className="flex gap-2">
                    <button type="submit" disabled={loading} className="flex-1 px-4 py-2 rounded-lg bg-emerald-500 shadow hover:brightness-105">
                      {loading ? 'Adding...' : 'Add Deal'}
                    </button>
                    <button type="button" onClick={resetForm} className="px-3 py-2 rounded-lg bg-white/6">
                      Reset
                    </button>
                  </div>
                </form>
              </div>
            </section>
          )}

          <section className="md:col-span-2 space-y-6">
            <div>
              <h2 className="text-xl font-semibold mb-3">Today's Deals</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <AnimatePresence>
                  {todaysDeals.length === 0 && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-sm text-gray-400">No deals added today yet.</motion.div>
                  )}
                  {todaysDeals.map((deal) => (
                    <motion.a
                      key={deal.id}
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      href={deal.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group block rounded-2xl overflow-hidden border border-white/6 shadow-lg bg-white/5 backdrop-blur-sm transform hover:scale-[1.01] transition-all"
                    >
                      <div className="flex">
                        <div className="w-36 h-36 flex-shrink-0 bg-gray-700 flex items-center justify-center overflow-hidden">
                          {deal.image ? (
                            <img src={deal.image} alt={deal.title} className="object-cover w-full h-full" />
                          ) : (
                            <div className="text-xs text-gray-300 p-2">No image provided</div>
                          )}
                        </div>
                        <div className="p-4 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <h3 className="text-lg font-semibold">{deal.title}</h3>
                            {deal.price && <div className="text-sm font-bold">{deal.price}</div>}
                          </div>
                          <p className="text-sm text-gray-300 mt-2 line-clamp-3">{deal.description}</p>
                          <div className="flex items-center gap-2">
  <button className="px-3 py-1 rounded-md bg-amber-500 text-black font-semibold">Buy on Amazon</button>

  {isAdmin && (
    <button
      onClick={(e) => {
        e.preventDefault();
        deleteDeal(deal.id);
      }}
      className="px-2 py-1 bg-red-500 text-xs rounded-md hover:bg-red-600"
    >
      Delete
    </button>
  )}
</div>

                        </div>
                      </div>
                    </motion.a>
                  ))}
                </AnimatePresence>
              </div>
            </div>

            <div>
              <h2 className="text-lg font-semibold mb-3">Recent Deals</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <AnimatePresence>
                  {recentDeals.map((deal) => (
                    <motion.a
                      key={deal.id}
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      href={deal.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group block rounded-2xl overflow-hidden border border-white/6 shadow-lg bg-white/5 backdrop-blur-sm transform hover:scale-[1.01] transition-all"
                    >
                      <div className="flex">
                        <div className="w-36 h-36 flex-shrink-0 bg-gray-700 flex items-center justify-center overflow-hidden">
                          {deal.image ? (
                            <img src={deal.image} alt={deal.title} className="object-cover w-full h-full" />
                          ) : (
                            <div className="text-xs text-gray-300 p-2">No image</div>
                          )}
                        </div>
                        <div className="p-4 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <h3 className="text-lg font-semibold">{deal.title}</h3>
                            {deal.price && <div className="text-sm font-bold">{deal.price}</div>}
                          </div>
                          <p className="text-sm text-gray-300 mt-2 line-clamp-3">{deal.description}</p>
                          <div className="mt-4 flex items-center gap-2">
                            <button className="px-3 py-1 rounded-md bg-amber-500 text-black font-semibold">Buy on Amazon</button>
                            <div className="text-xs text-gray-400">Added {deal.addedBy ? 'by admin' : 'by unknown'}</div>
                          </div>
                        </div>
                      </div>
                    </motion.a>
                  ))}
                </AnimatePresence>
              </div>
            </div>
          </section>
        </main>

        <footer className="mt-8 text-center text-xs text-gray-500">Built with React, Firebase, Tailwind, and Framer Motion</footer>
      </div>
    </div>
  );
}
