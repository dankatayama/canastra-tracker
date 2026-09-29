import React, { useState, useEffect, useMemo } from 'react';
import {
  Home, Users, BarChart2, BookOpen, Play, Edit2, Trash2, Plus, 
  ChevronLeft, Check, Trophy, AlertCircle, X, Info, AlertTriangle
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, signInWithCustomToken, signInAnonymously, onAuthStateChanged 
} from 'firebase/auth';
import { 
  getFirestore, collection, onSnapshot, doc, deleteDoc, updateDoc, addDoc, serverTimestamp 
} from 'firebase/firestore';

// Environment Variables
const appId = typeof __app_id !== 'undefined' ? __app_id : 'canastra-tracker-default';
const firebaseConfig = {
  apiKey: "AIzaSyCBhW9EmmsZw9P9-syHB00-LRs28MdsXxU",
  authDomain: "canastra-tracker.firebaseapp.com",
  projectId: "canastra-tracker",
  storageBucket: "canastra-tracker.firebasestorage.app",
  messagingSenderId: "359491544068",
  appId: "1:359491544068:web:470470559b4ac3d1f24151"
};
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

// Firebase Initialization
let app, auth, db;
try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
} catch (error) {
  console.error("Firebase initialization error:", error);
}

// Data Paths
const PLAYERS_PATH = `artifacts/${appId}/public/data/players`;
const GAMES_PATH = `artifacts/${appId}/public/data/games`;
const WIN_SCORE = 5000;

// Calculates who the dealer is for a given round index (0-based)
const calculateDealerId = (roundIndex, team1Ids, team2Ids, d1Id, d2Id) => {
  const isD1InT1 = team1Ids.includes(d1Id);
  const teamFirst = isD1InT1 ? team1Ids : team2Ids;
  const teamSecond = isD1InT1 ? team2Ids : team1Ids;

  const d1Index = teamFirst.indexOf(d1Id);
  const d2Index = teamSecond.indexOf(d2Id);

  const cycle = roundIndex % 4;
  if (cycle === 0) return d1Id;
  if (cycle === 1) return d2Id;
  if (cycle === 2) return teamFirst[1 - d1Index]; // Teammate of D1
  if (cycle === 3) return teamSecond[1 - d2Index]; // Teammate of D2
  return null;
};

// Calculates styling and handicap based on score thresholds
const getScoreStyles = (score) => {
  if (score > 3499) return { color: 'text-red-600 dark:text-red-400', bg: 'bg-red-100 dark:bg-red-900/30', handicap: 120 };
  if (score > 2999) return { color: 'text-orange-500 dark:text-orange-400', bg: 'bg-orange-100 dark:bg-orange-900/30', handicap: 90 };
  if (score > 2499) return { color: 'text-amber-500 dark:text-amber-400', bg: 'bg-amber-100 dark:bg-amber-900/30', handicap: 75 };
  return { color: 'text-gray-900 dark:text-gray-100', bg: 'bg-gray-100 dark:bg-gray-800', handicap: 0 };
};

export default function CanastraApp() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [view, setView] = useState('landing'); // landing, players, dashboard, game_register, new_game, active_game
  
  const [players, setPlayers] = useState([]);
  const [games, setGames] = useState([]);
  const [activeGameId, setActiveGameId] = useState(null);

  // Authentication Setup
  useEffect(() => {
    if (!auth) return;
    const initAuth = async () => {
      try {
        if (initialAuthToken) {
          await signInWithCustomToken(auth, initialAuthToken);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) {
        console.error("Auth error:", err);
      }
    };
    initAuth();

    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Data Fetching
  useEffect(() => {
    if (!user || !db) return;

    // Listen to Players
    const unsubPlayers = onSnapshot(collection(db, PLAYERS_PATH), (snap) => {
      const p = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setPlayers(p.sort((a, b) => a.name.localeCompare(b.name)));
    }, (err) => console.error("Players error:", err));

    // Listen to Games
    const unsubGames = onSnapshot(collection(db, GAMES_PATH), (snap) => {
      const g = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setGames(g.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0)));
    }, (err) => console.error("Games error:", err));

    return () => { unsubPlayers(); unsubGames(); };
  }, [user]);

  const renderLanding = () => (
    <div className="flex flex-col items-center justify-center space-y-4 p-4 min-h-[80vh]">
      <div className="w-24 h-24 bg-blue-600 text-white rounded-full flex items-center justify-center mb-6 shadow-lg shadow-blue-200 dark:shadow-blue-900/50">
        <Trophy size={48} />
      </div>
      <h1 className="text-3xl font-black text-gray-800 dark:text-gray-100 mb-8 text-center tracking-tight">Canastra Tracker</h1>
      
      <button onClick={() => setView('new_game')} className="w-full max-w-sm flex items-center p-4 bg-blue-600 text-white rounded-2xl shadow-md hover:bg-blue-700 transition-colors active:scale-95">
        <Play className="mr-4" /> <span className="text-lg font-bold">Start New Game</span>
      </button>
      <button onClick={() => setView('dashboard')} className="w-full max-w-sm flex items-center p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors active:scale-95">
        <BarChart2 className="mr-4 text-blue-500" /> <span className="text-lg font-semibold dark:text-gray-200">Dashboard & Metrics</span>
      </button>
      <button onClick={() => setView('game_register')} className="w-full max-w-sm flex items-center p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors active:scale-95">
        <BookOpen className="mr-4 text-blue-500" /> <span className="text-lg font-semibold dark:text-gray-200">Game Register</span>
      </button>
      <button onClick={() => setView('players')} className="w-full max-w-sm flex items-center p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors active:scale-95">
        <Users className="mr-4 text-blue-500" /> <span className="text-lg font-semibold dark:text-gray-200">Player Register</span>
      </button>
    </div>
  );

  const [newPlayerName, setNewPlayerName] = useState('');
  const [newPlayerInitials, setNewPlayerInitials] = useState('');

  const handleAddPlayer = async (e) => {
    e.preventDefault();
    if (!newPlayerName.trim() || !newPlayerInitials.trim() || !user) return;
    try {
      await addDoc(collection(db, PLAYERS_PATH), {
        name: newPlayerName.trim(),
        initials: newPlayerInitials.trim().toUpperCase(),
        createdAt: serverTimestamp()
      });
      setNewPlayerName('');
      setNewPlayerInitials('');
    } catch (err) { console.error("Error adding player:", err); }
  };

  const renderPlayers = () => (
    <div className="p-4 max-w-lg mx-auto">
      <div className="flex items-center mb-6">
        <button onClick={() => setView('landing')} className="p-2 mr-2 bg-gray-100 dark:bg-gray-800 rounded-full active:scale-95"><ChevronLeft /></button>
        <h2 className="text-2xl font-bold dark:text-white">Player Register</h2>
      </div>

      <form onSubmit={handleAddPlayer} className="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 mb-6">
        <h3 className="font-semibold mb-3 dark:text-white flex items-center"><Plus size={18} className="mr-2 text-blue-500"/> Add New Player</h3>
        <div className="space-y-3">
          <input type="text" placeholder="Full Name" value={newPlayerName} onChange={e => setNewPlayerName(e.target.value)}
            className="w-full p-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-shadow" required />
          <input type="text" placeholder="Initials (e.g. JD)" maxLength={4} value={newPlayerInitials} onChange={e => setNewPlayerInitials(e.target.value)}
            className="w-full p-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-shadow uppercase" required />
          <button type="submit" className="w-full bg-blue-600 text-white p-3 rounded-xl font-bold hover:bg-blue-700 flex items-center justify-center transition-colors active:scale-95">
            Save Player
          </button>
        </div>
      </form>

      <div className="space-y-2">
        <h3 className="font-semibold text-gray-600 dark:text-gray-300 mb-3 px-1">Registered Players ({players.length})</h3>
        {players.length === 0 ? (
          <p className="text-gray-500 text-center py-6 bg-gray-50 dark:bg-gray-800 rounded-2xl border border-dashed border-gray-300 dark:border-gray-700">No players added yet.</p>
        ) : players.map(p => (
          <div key={p.id} className="flex justify-between items-center p-4 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl shadow-sm">
            <span className="font-semibold dark:text-white">{p.name}</span>
            <span className="bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 px-3 py-1 rounded-lg text-sm font-black tracking-widest">{p.initials}</span>
          </div>
        ))}
      </div>
    </div>
  );

  const renderDashboard = () => {
    // Calculate metrics in-memory
    const stats = players.map(p => {
      let totalGames = 0;
      let totalVictories = 0;
      let totalPoints = 0;

      games.forEach(g => {
        const isT1 = g.team1.includes(p.id);
        const isT2 = g.team2.includes(p.id);
        if (!isT1 && !isT2) return;

        const t1Score = g.rounds?.reduce((sum, r) => sum + (r.t1Score || 0), 0) || 0;
        const t2Score = g.rounds?.reduce((sum, r) => sum + (r.t2Score || 0), 0) || 0;
        
        // Count finished games only
        if (t1Score >= WIN_SCORE || t2Score >= WIN_SCORE || g.isCompleted) {
           totalGames++;
           const playerTeamScore = isT1 ? t1Score : t2Score;
           const otherTeamScore = isT1 ? t2Score : t1Score;
           
           totalPoints += playerTeamScore;
           if (playerTeamScore > otherTeamScore) {
             totalVictories++;
           }
        }
      });

      const winRatio = totalGames > 0 ? Math.round((totalVictories / totalGames) * 100) : 0;
      const ptsPerGame = totalGames > 0 ? (totalPoints / totalGames).toFixed(1) : 0;
      return { ...p, totalGames, totalVictories, winRatio, totalPoints, ptsPerGame };
    });

    return (
      <div className="p-4 max-w-4xl mx-auto">
        <div className="flex items-center mb-6">
          <button onClick={() => setView('landing')} className="p-2 mr-2 bg-gray-100 dark:bg-gray-800 rounded-full active:scale-95"><ChevronLeft /></button>
          <h2 className="text-2xl font-bold dark:text-white">Dashboard</h2>
        </div>

        <div className="overflow-x-auto bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700">
          <table className="w-full text-left border-collapse min-w-[600px]">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
                <th className="p-4 font-bold text-gray-700 dark:text-gray-200">Player</th>
                <th className="p-4 font-bold text-gray-700 dark:text-gray-200 text-center">Games</th>
                <th className="p-4 font-bold text-gray-700 dark:text-gray-200 text-center">Wins</th>
                <th className="p-4 font-bold text-gray-700 dark:text-gray-200 text-center">Win %</th>
                <th className="p-4 font-bold text-gray-700 dark:text-gray-200 text-center">Total Pts</th>
                <th className="p-4 font-bold text-gray-700 dark:text-gray-200 text-center">Pts/Game</th>
              </tr>
            </thead>
            <tbody>
              {stats.sort((a, b) => b.winRatio - a.winRatio).map(s => (
                <tr key={s.id} className="border-b border-gray-100 dark:border-gray-700 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors">
                  <td className="p-4">
                    <div className="font-bold dark:text-white">{s.name}</div>
                    <div className="text-xs font-bold text-gray-400">{s.initials}</div>
                  </td>
                  <td className="p-4 text-center font-medium dark:text-gray-300">{s.totalGames}</td>
                  <td className="p-4 text-center text-green-600 font-bold">{s.totalVictories}</td>
                  <td className="p-4 text-center font-medium dark:text-gray-300">{s.winRatio}%</td>
                  <td className="p-4 text-center font-mono font-bold text-blue-600 dark:text-blue-400">{s.totalPoints}</td>
                  <td className="p-4 text-center font-mono font-medium text-gray-600 dark:text-gray-400">{s.ptsPerGame}</td>
                </tr>
              ))}
              {stats.length === 0 && (
                <tr><td colSpan="6" className="p-8 text-center text-gray-500">No gameplay data available yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  const renderGameRegister = () => {
    const executeDelete = async (gameId) => {
      if(!user) return;
      try { 
        await deleteDoc(doc(db, GAMES_PATH, gameId)); 
        setDeleteConfirmId(null);
      } 
      catch (err) { console.error("Error deleting game:", err); }
    };

    const handleResumeGame = (gameId) => {
      setActiveGameId(gameId);
      setView('active_game');
    };

    const getInitials = (ids) => ids.map(id => players.find(p => p.id === id)?.initials || '?').join(' & ');

    return (
      <div className="p-4 max-w-lg mx-auto pb-12">
        <div className="flex items-center mb-6">
          <button onClick={() => setView('landing')} className="p-2 mr-2 bg-gray-100 dark:bg-gray-800 rounded-full active:scale-95"><ChevronLeft /></button>
          <h2 className="text-2xl font-bold dark:text-white">Game Register</h2>
        </div>

        <div className="space-y-4">
          {games.map(g => {
            const t1Score = g.rounds?.reduce((sum, r) => sum + (r.t1Score || 0), 0) || 0;
            const t2Score = g.rounds?.reduce((sum, r) => sum + (r.t2Score || 0), 0) || 0;
            const isFinished = t1Score >= WIN_SCORE || t2Score >= WIN_SCORE || g.isCompleted;
            const isDeleting = deleteConfirmId === g.id;

            return (
              <div key={g.id} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-5 shadow-sm relative overflow-hidden">
                <div className="flex justify-between items-start mb-4 relative z-10">
                  <div>
                    <span className={`text-xs font-black uppercase tracking-wider px-3 py-1 rounded-lg ${isFinished ? 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300' : 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300'}`}>
                      {isFinished ? 'Completed' : 'In Progress'}
                    </span>
                    <div className="text-xs text-gray-400 mt-2 font-medium">
                      {g.createdAt?.toDate().toLocaleDateString()} {g.createdAt?.toDate().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </div>
                  </div>
                  
                  {!isDeleting && (
                    <div className="flex space-x-2">
                      <button onClick={() => handleResumeGame(g.id)} className="p-2 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl hover:bg-blue-100 transition-colors active:scale-95" title={isFinished ? "View/Edit" : "Resume"}>
                        {isFinished ? <Edit2 size={18} /> : <Play size={18} />}
                      </button>
                      <button onClick={() => setDeleteConfirmId(g.id)} className="p-2 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-xl hover:bg-red-100 transition-colors active:scale-95" title="Delete">
                        <Trash2 size={18} />
                      </button>
                    </div>
                  )}
                </div>

                {isDeleting ? (
                  <div className="absolute inset-0 bg-white/95 dark:bg-gray-800/95 z-20 flex flex-col items-center justify-center p-4">
                    <p className="font-bold text-gray-800 dark:text-gray-100 mb-4 text-center">Delete this game permanently?</p>
                    <div className="flex space-x-3 w-full max-w-[250px]">
                      <button onClick={() => setDeleteConfirmId(null)} className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-xl font-semibold active:scale-95">Cancel</button>
                      <button onClick={() => executeDelete(g.id)} className="flex-1 px-4 py-2 bg-red-600 text-white rounded-xl font-semibold active:scale-95">Delete</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex justify-between items-center text-center bg-gray-50 dark:bg-gray-900 p-4 rounded-xl relative z-10">
                    <div className="flex-1">
                      <div className="text-xs font-bold text-gray-500 dark:text-gray-400 mb-1 tracking-wide">{getInitials(g.team1)}</div>
                      <div className={`text-3xl font-black ${t1Score >= WIN_SCORE ? 'text-green-500' : 'text-gray-900 dark:text-white'}`}>{t1Score}</div>
                    </div>
                    <div className="px-4 text-gray-300 dark:text-gray-600 font-black text-xl italic">vs</div>
                    <div className="flex-1">
                      <div className="text-xs font-bold text-gray-500 dark:text-gray-400 mb-1 tracking-wide">{getInitials(g.team2)}</div>
                      <div className={`text-3xl font-black ${t2Score >= WIN_SCORE ? 'text-green-500' : 'text-gray-900 dark:text-white'}`}>{t2Score}</div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {games.length === 0 && (
            <div className="text-center py-10 bg-white dark:bg-gray-800 rounded-2xl border border-dashed border-gray-300 dark:border-gray-700">
              <BookOpen className="mx-auto text-gray-400 mb-3" size={32} />
              <p className="text-gray-500 font-medium">No games recorded yet.</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  const [setupState, setSetupState] = useState({ t1p1: '', t1p2: '', t2p1: '', t2p2: '', d1: '', d2: '' });

  const renderNewGame = () => {
    const handleSetupChange = (field, val) => setSetupState(prev => ({ ...prev, [field]: val }));
    
    const t1 = [setupState.t1p1, setupState.t1p2].filter(Boolean);
    const t2 = [setupState.t2p1, setupState.t2p2].filter(Boolean);
    const allSelectedPlayers = [...t1, ...t2];
    const uniquePlayers = new Set(allSelectedPlayers);
    const isTeamsValid = allSelectedPlayers.length === 4 && uniquePlayers.size === 4;

    const availableD1 = isTeamsValid ? allSelectedPlayers : [];
    
    let availableD2 = [];
    if (setupState.d1) {
       const d1InT1 = t1.includes(setupState.d1);
       availableD2 = d1InT1 ? t2 : t1; // D2 MUST be from opposing team
    }

    const isReady = isTeamsValid && setupState.d1 && setupState.d2 && availableD2.includes(setupState.d2);

    const handleStart = async () => {
      if (!isReady || !user) return;
      try {
        const newGameData = {
          team1: t1,
          team2: t2,
          d1: setupState.d1,
          d2: setupState.d2,
          rounds: [],
          isCompleted: false,
          createdAt: serverTimestamp()
        };
        const docRef = await addDoc(collection(db, GAMES_PATH), newGameData);
        setActiveGameId(docRef.id);
        setSetupState({ t1p1: '', t1p2: '', t2p1: '', t2p2: '', d1: '', d2: '' });
        setView('active_game');
      } catch (err) { console.error("Error starting game:", err); }
    };

    return (
      <div className="p-4 max-w-lg mx-auto pb-10">
        <div className="flex items-center mb-6">
          <button onClick={() => setView('landing')} className="p-2 mr-2 bg-gray-100 dark:bg-gray-800 rounded-full active:scale-95"><ChevronLeft /></button>
          <h2 className="text-2xl font-bold dark:text-white">Setup Canastra Game</h2>
        </div>

        {players.length < 4 ? (
          <div className="p-5 bg-amber-50 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200 rounded-2xl border border-amber-200 shadow-sm flex flex-col items-center text-center">
            <AlertCircle size={40} className="mb-3 text-amber-500" />
            <h3 className="font-bold text-lg mb-1">Not Enough Players</h3>
            <p className="text-sm">You need at least 4 registered players to start a Canastra game.</p>
            <button onClick={() => setView('players')} className="mt-4 px-4 py-2 bg-amber-200 dark:bg-amber-800 rounded-lg font-bold">Go to Player Register</button>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Team 1 Setup */}
            <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm">
              <h3 className="font-black text-lg mb-4 text-blue-600 dark:text-blue-400">Team 1</h3>
              <div className="space-y-3">
                <select value={setupState.t1p1} onChange={(e) => handleSetupChange('t1p1', e.target.value)} className="w-full p-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none font-medium">
                  <option value="">Select Player 1</option>
                  {players.map(p => <option key={p.id} value={p.id} disabled={allSelectedPlayers.includes(p.id) && p.id !== setupState.t1p1}>{p.name} ({p.initials})</option>)}
                </select>
                <select value={setupState.t1p2} onChange={(e) => handleSetupChange('t1p2', e.target.value)} className="w-full p-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none font-medium">
                  <option value="">Select Player 2</option>
                  {players.map(p => <option key={p.id} value={p.id} disabled={allSelectedPlayers.includes(p.id) && p.id !== setupState.t1p2}>{p.name} ({p.initials})</option>)}
                </select>
              </div>
            </div>

            {/* Team 2 Setup */}
            <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm">
              <h3 className="font-black text-lg mb-4 text-emerald-600 dark:text-emerald-400">Team 2</h3>
              <div className="space-y-3">
                <select value={setupState.t2p1} onChange={(e) => handleSetupChange('t2p1', e.target.value)} className="w-full p-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none font-medium">
                  <option value="">Select Player 1</option>
                  {players.map(p => <option key={p.id} value={p.id} disabled={allSelectedPlayers.includes(p.id) && p.id !== setupState.t2p1}>{p.name} ({p.initials})</option>)}
                </select>
                <select value={setupState.t2p2} onChange={(e) => handleSetupChange('t2p2', e.target.value)} className="w-full p-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none font-medium">
                  <option value="">Select Player 2</option>
                  {players.map(p => <option key={p.id} value={p.id} disabled={allSelectedPlayers.includes(p.id) && p.id !== setupState.t2p2}>{p.name} ({p.initials})</option>)}
                </select>
              </div>
            </div>

            {/* Dealer Setup */}
            {isTeamsValid && (
              <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm animate-slide-up">
                <h3 className="font-black text-lg mb-4 dark:text-white">Starting Dealers</h3>
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-2">Round 1 Dealer</label>
                    <select value={setupState.d1} onChange={(e) => handleSetupChange('d1', e.target.value)} className="w-full p-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none font-medium">
                      <option value="">Select Round 1 Dealer</option>
                      {availableD1.map(pid => {
                        const p = players.find(x => x.id === pid);
                        return <option key={pid} value={pid}>{p?.name}</option>;
                      })}
                    </select>
                  </div>
                  {setupState.d1 && (
                    <div className="animate-slide-up">
                      <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-2 flex items-center">
                        Round 2 Dealer <Info size={14} className="ml-1 text-gray-400" title="Must be from opposing team" />
                      </label>
                      <select value={setupState.d2} onChange={(e) => handleSetupChange('d2', e.target.value)} className="w-full p-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none font-medium">
                        <option value="">Select Round 2 Dealer</option>
                        {availableD2.map(pid => {
                          const p = players.find(x => x.id === pid);
                          return <option key={pid} value={pid}>{p?.name}</option>;
                        })}
                      </select>
                    </div>
                  )}
                </div>
              </div>
            )}

            <button 
              onClick={handleStart} 
              disabled={!isReady}
              className={`w-full p-4 rounded-2xl font-black text-xl flex justify-center items-center transition-all active:scale-95 ${isReady ? 'bg-blue-600 text-white shadow-xl shadow-blue-200 dark:shadow-none hover:bg-blue-700' : 'bg-gray-200 text-gray-400 dark:bg-gray-700 dark:text-gray-500'}`}
            >
              Start Canastra Game <Play className="ml-2" fill="currentColor" />
            </button>
          </div>
        )}
      </div>
    );
  };

  const [pointModal, setPointModal] = useState({ open: false, roundIndex: -1, t1Score: '', t2Score: '' });

  const renderActiveGame = () => {
    const game = games.find(g => g.id === activeGameId);
    if (!game) return <div className="p-4 text-center text-gray-500">Loading game data...</div>;

    const rounds = game.rounds || [];
    const currentRoundNum = rounds.length + 1;
    
    // Calculate Totals
    const t1Total = rounds.reduce((s, r) => s + (r.t1Score || 0), 0);
    const t2Total = rounds.reduce((s, r) => s + (r.t2Score || 0), 0);
    
    const isGameOver = t1Total >= WIN_SCORE || t2Total >= WIN_SCORE || game.isCompleted;

    // Resolve Current Dealer based on auto-rotation
    const currentDealerId = calculateDealerId(currentRoundNum - 1, game.team1, game.team2, game.d1, game.d2);
    const currentDealer = players.find(p => p.id === currentDealerId);

    const getInitials = (teamIds) => teamIds.map(id => players.find(p => p.id === id)?.initials || '?').join(', ');
    const t1Initials = getInitials(game.team1);
    const t2Initials = getInitials(game.team2);

    const handleSavePoints = async () => {
      // Parse integers
      const t1Pts = parseInt(pointModal.t1Score, 10) || 0;
      const t2Pts = parseInt(pointModal.t2Score, 10) || 0;
      
      let newRounds = [...rounds];
      if (pointModal.roundIndex === -1) {
        newRounds.push({ 
          r: currentRoundNum, 
          dealerId: currentDealerId, 
          t1Score: t1Pts, 
          t2Score: t2Pts 
        });
      } else {
        newRounds[pointModal.roundIndex] = {
          ...newRounds[pointModal.roundIndex],
          t1Score: t1Pts,
          t2Score: t2Pts
        };
      }

      const newT1Total = newRounds.reduce((s, r) => s + r.t1Score, 0);
      const newT2Total = newRounds.reduce((s, r) => s + r.t2Score, 0);
      const newlyCompleted = newT1Total >= WIN_SCORE || newT2Total >= WIN_SCORE;

      try {
        await updateDoc(doc(db, GAMES_PATH, game.id), {
          rounds: newRounds,
          isCompleted: newlyCompleted
        });
        setPointModal({ open: false, roundIndex: -1, t1Score: '', t2Score: '' });
      } catch (err) { console.error("Error saving points:", err); }
    };

    const t1Styles = getScoreStyles(t1Total);
    const t2Styles = getScoreStyles(t2Total);

    return (
      <div className="flex flex-col h-[100dvh] bg-gray-50 dark:bg-gray-900">
        {/* Top Navbar */}
        <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4 sticky top-0 z-10 flex justify-between items-center shadow-sm">
           <button onClick={() => setView('landing')} className="p-2 -ml-2 text-gray-600 dark:text-gray-300 active:scale-95 bg-gray-100 dark:bg-gray-700 rounded-full"><Home size={20} /></button>
           <div className="text-center">
             <div className="text-xs font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest">Round {currentRoundNum}</div>
             <div className="text-lg font-bold dark:text-white">Dealer: <span className="underline decoration-2 decoration-blue-500/30">{currentDealer?.name || 'Unknown'}</span></div>
           </div>
           <div className="w-10"></div>
        </div>

        {/* Scorecards */}
        <div className="flex-none flex p-4 gap-4 max-w-2xl mx-auto w-full">
          <div className={`flex-1 rounded-3xl p-5 flex flex-col items-center justify-center text-center shadow-sm border border-gray-100 dark:border-gray-700 relative overflow-hidden transition-colors ${t1Styles.bg}`}>
            <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">Team 1</h3>
            <div className="text-xs font-black text-gray-400 dark:text-gray-500 mb-2 bg-white/50 dark:bg-black/20 px-2 py-0.5 rounded">[{t1Initials}]</div>
            <span className={`text-6xl font-black mb-1 ${t1Styles.color} tracking-tighter`}>{t1Total}</span>
            {t1Styles.handicap > 0 ? (
              <span className={`text-xs font-black px-3 py-1 mt-2 rounded-full bg-white/60 dark:bg-black/30 shadow-sm ${t1Styles.color}`}>
                Handicap: {t1Styles.handicap}
              </span>
            ) : <div className="h-6 mt-2"></div>}
          </div>
          
          <div className={`flex-1 rounded-3xl p-5 flex flex-col items-center justify-center text-center shadow-sm border border-gray-100 dark:border-gray-700 relative overflow-hidden transition-colors ${t2Styles.bg}`}>
             <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">Team 2</h3>
            <div className="text-xs font-black text-gray-400 dark:text-gray-500 mb-2 bg-white/50 dark:bg-black/20 px-2 py-0.5 rounded">[{t2Initials}]</div>
            <span className={`text-6xl font-black mb-1 ${t2Styles.color} tracking-tighter`}>{t2Total}</span>
            {t2Styles.handicap > 0 ? (
              <span className={`text-xs font-black px-3 py-1 mt-2 rounded-full bg-white/60 dark:bg-black/30 shadow-sm ${t2Styles.color}`}>
                Handicap: {t2Styles.handicap}
              </span>
            ) : <div className="h-6 mt-2"></div>}
          </div>
        </div>

        {/* Win Banner Overlay */}
        {isGameOver && (
          <div className="mx-4 p-5 mb-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-2xl text-center shadow-lg flex flex-col items-center animate-slide-up max-w-2xl sm:mx-auto sm:w-full">
             <Trophy size={40} className="mb-3 text-yellow-300 drop-shadow-md" fill="currentColor" />
             <h2 className="text-3xl font-black mb-2 tracking-tight">Canastra Match Over!</h2>
             <p className="text-xl font-bold mb-4 bg-white/20 px-4 py-1 rounded-lg">
               {t1Total > t2Total ? 'Team 1 Wins!' : t1Total < t2Total ? 'Team 2 Wins!' : 'It\'s a Tie!'}
             </p>
             <button onClick={() => setView('landing')} className="bg-white text-green-700 px-6 py-3 rounded-xl font-black shadow-sm active:scale-95">Back to Home</button>
          </div>
        )}

        {/* Play History Log */}
        <div className="flex-1 overflow-y-auto px-4 pb-4 max-w-2xl mx-auto w-full">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
            <table className="w-full text-center text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600 text-xs uppercase tracking-widest text-gray-500 dark:text-gray-400 font-black">
                  <th className="py-4 px-2">Rnd</th>
                  <th className="py-4 px-2">Dlr</th>
                  <th className="py-4 px-2 text-blue-500">T1 Pts</th>
                  <th className="py-4 px-2 text-emerald-500">T2 Pts</th>
                  <th className="py-4 px-2"></th>
                </tr>
              </thead>
              <tbody>
                {rounds.map((r, idx) => {
                  const dInitials = players.find(p => p.id === r.dealerId)?.initials || '?';
                  return (
                    <tr key={idx} className="border-b border-gray-100 dark:border-gray-700 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors cursor-pointer active:bg-gray-100"
                        onClick={() => setPointModal({ open: true, roundIndex: idx, t1Score: r.t1Score, t2Score: r.t2Score })}>
                      <td className="py-4 px-2 font-bold text-gray-500 dark:text-gray-300">{r.r}</td>
                      <td className="py-4 px-2 font-bold text-gray-400 bg-gray-50/50 dark:bg-gray-800/50">{dInitials}</td>
                      <td className="py-4 px-2 font-mono font-bold text-base dark:text-white">{r.t1Score}</td>
                      <td className="py-4 px-2 font-mono font-bold text-base dark:text-white">{r.t2Score}</td>
                      <td className="py-4 px-2 text-gray-300 dark:text-gray-500"><Edit2 size={16} /></td>
                    </tr>
                  );
                })}
                {rounds.length === 0 && (
                  <tr><td colSpan="5" className="py-8 text-gray-400 font-medium bg-gray-50/50 dark:bg-gray-800/50">No rounds recorded yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Record Points Button */}
        {!isGameOver && (
          <div className="p-4 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 pb-safe max-w-2xl mx-auto w-full">
             <button 
               onClick={() => setPointModal({ open: true, roundIndex: -1, t1Score: '', t2Score: '' })}
               className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black text-xl p-5 rounded-2xl shadow-xl shadow-blue-200 dark:shadow-none flex items-center justify-center transition-all active:scale-95"
             >
               <Plus className="mr-2" size={24} /> Record Round {currentRoundNum}
             </button>
          </div>
        )}

        {/* Point Entry Modal */}
        {pointModal.open && (
          <div className="fixed inset-0 z-50 bg-gray-900/40 dark:bg-black/60 backdrop-blur-sm flex flex-col justify-end sm:justify-center items-center p-0 sm:p-4">
             <div className="bg-white dark:bg-gray-800 w-full max-w-md rounded-t-[32px] sm:rounded-[32px] p-6 pb-10 sm:pb-6 shadow-2xl animate-slide-up border border-gray-100 dark:border-gray-700">
                <div className="flex justify-between items-center mb-8">
                   <h3 className="text-2xl font-black dark:text-white tracking-tight">
                     {pointModal.roundIndex === -1 ? `Round ${currentRoundNum} Points` : `Edit Round ${pointModal.roundIndex + 1}`}
                   </h3>
                   <button onClick={() => setPointModal({...pointModal, open: false})} className="p-2 bg-gray-100 dark:bg-gray-700 rounded-full active:scale-95"><X size={24} className="dark:text-white" /></button>
                </div>
                
                <div className="space-y-6 mb-8">
                  <div className="bg-blue-50/50 dark:bg-blue-900/10 p-4 rounded-2xl border border-blue-100 dark:border-blue-900/30">
                    <label className="block text-sm font-black text-blue-600 dark:text-blue-400 mb-2 uppercase tracking-wide flex justify-between items-center">
                      <span>Team 1</span>
                      <span className="text-xs bg-blue-100 dark:bg-blue-900/50 px-2 py-1 rounded text-blue-800 dark:text-blue-300">[{t1Initials}]</span>
                    </label>
                    <input 
                      type="number" pattern="[0-9]*" inputMode="numeric"
                      value={pointModal.t1Score} onChange={e => setPointModal({...pointModal, t1Score: e.target.value})}
                      className="w-full text-4xl p-4 font-mono font-black bg-white dark:bg-gray-900 border-2 border-transparent focus:border-blue-500 rounded-xl outline-none dark:text-white transition-all text-center shadow-inner"
                      placeholder="0" autoFocus
                    />
                  </div>
                  <div className="bg-emerald-50/50 dark:bg-emerald-900/10 p-4 rounded-2xl border border-emerald-100 dark:border-emerald-900/30">
                    <label className="block text-sm font-black text-emerald-600 dark:text-emerald-400 mb-2 uppercase tracking-wide flex justify-between items-center">
                      <span>Team 2</span>
                      <span className="text-xs bg-emerald-100 dark:bg-emerald-900/50 px-2 py-1 rounded text-emerald-800 dark:text-emerald-300">[{t2Initials}]</span>
                    </label>
                    <input 
                      type="number" pattern="[0-9]*" inputMode="numeric"
                      value={pointModal.t2Score} onChange={e => setPointModal({...pointModal, t2Score: e.target.value})}
                      className="w-full text-4xl p-4 font-mono font-black bg-white dark:bg-gray-900 border-2 border-transparent focus:border-emerald-500 rounded-xl outline-none dark:text-white transition-all text-center shadow-inner"
                      placeholder="0"
                    />
                  </div>
                </div>

                <button onClick={handleSavePoints} className="w-full bg-blue-600 text-white font-black text-xl p-5 rounded-2xl shadow-lg shadow-blue-200 dark:shadow-none hover:bg-blue-700 flex justify-center items-center active:scale-95 transition-all">
                  <Check className="mr-2" size={24} /> Save Points
                </button>
             </div>
          </div>
        )}

      </div>
    );
  };

  if (authLoading) return <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 font-bold dark:text-white text-gray-500 text-xl tracking-tight animate-pulse">Loading Canastra Tracker...</div>;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-sans selection:bg-blue-200">
      {view === 'landing' && renderLanding()}
      {view === 'players' && renderPlayers()}
      {view === 'dashboard' && renderDashboard()}
      {view === 'game_register' && renderGameRegister()}
      {view === 'new_game' && renderNewGame()}
      {view === 'active_game' && renderActiveGame()}
      
      <style dangerouslySetInnerHTML={{__html:`
        .pb-safe { padding-bottom: env(safe-area-inset-bottom, 1rem); }
        .animate-slide-up { animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
      `}} />
    </div>
  );
}