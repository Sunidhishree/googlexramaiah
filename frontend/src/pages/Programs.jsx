import React, { useState, useEffect } from 'react';
import './Programs.css';
import { auth } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';

const API_BASE = "http://localhost:5000";

export default function Programs() {
    const [isProfileMinimized, setIsProfileMinimized] = useState(false);
    const [user, setUser] = useState(null);
    const [profile, setProfile] = useState(null);
    const [quests, setQuests] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            setUser(currentUser);
            if (currentUser) {
                await fetchProfile(currentUser);
                await fetchQuests();
            } else {
                setLoading(false);
            }
        });
        return () => unsubscribe();
    }, []);

    const fetchProfile = async (currentUser) => {
        try {
            const token = await currentUser.getIdToken();
            const res = await fetch(`${API_BASE}/api/user/profile`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setProfile(data);
            }
        } catch (error) {
            console.error("Error fetching profile", error);
        }
    };

    const fetchQuests = async () => {
        try {
            const res = await fetch(`${API_BASE}/api/quests/feed`);
            if (res.ok) {
                const data = await res.json();
                setQuests(data);
            }
        } catch (error) {
            console.error("Error fetching quests feed", error);
        } finally {
            setLoading(false);
        }
    };

    const handleAcceptQuest = async (questId) => {
        if (!user) return;
        try {
            const token = await user.getIdToken();
            const res = await fetch(`${API_BASE}/api/quests/${questId}/accept`, {
                method: "POST",
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (res.ok) {
                const data = await res.json();
                
                // Update local quest state
                setQuests(prev => prev.map(q => 
                    q._id === questId ? { ...q, accepted_by_me: true, accepted: (q.accepted || 0) + 1 } : q
                ));
                
                // Update local profile XP
                if (data.xp_earned) {
                    setProfile(prev => ({ ...prev, xp: (prev.xp || 0) + data.xp_earned }));
                }
            }
        } catch (error) {
            console.error("Error accepting quest", error);
        }
    };

    if (loading) {
        return <div className="loading">Loading Volunteer Dashboard...</div>;
    }

    if (!user) {
        return (
            <div className="programs-page">
                <div className="unauth-message">
                    <h2>Please Login</h2>
                    <p>You need to be logged in as a volunteer to view your dashboard and accept quests.</p>
                    <a href="/login" className="btn-primary">Go to Login</a>
                </div>
            </div>
        );
    }


    const currentXp = profile?.xp || 0;
    
    const calculateProgress = (targetXp) => {
        return Math.min(100, Math.max(0, (currentXp / targetXp) * 100));
    };

    return (
        <div className="programs-page">
            <nav className="programs-nav">
                <a href="/home" className="nav-logo">Ummeed<span>.</span></a>
                <div className={`nav-profile ${isProfileMinimized ? 'minimized' : ''}`}>
                    <div className="profile-header">
                        <div className="avatar">{(profile?.name || user?.email || "V")[0].toUpperCase()}</div>
                        {!isProfileMinimized && (
                            <div>
                                <h3>{profile?.name || "Volunteer"}</h3>
                                <p>Total XP: <strong>{currentXp}</strong></p>
                            </div>
                        )}
                        <button 
                            className="btn-minimize" 
                            onClick={() => setIsProfileMinimized(!isProfileMinimized)}
                            title={isProfileMinimized ? "Expand Profile" : "Minimize Profile"}
                        >
                            {isProfileMinimized ? '➕' : '➖'}
                        </button>
                    </div>
                    
                    {!isProfileMinimized && (
                        <div className="xp-bars-container">
                            <div className="xp-bar-group">
                                <div className="xp-label">
                                    <span>🥉 Bronze</span>
                                    <span>{currentXp} / 3000 XP</span>
                                </div>
                                <div className="xp-track"><div className="xp-fill bronze" style={{ width: `${calculateProgress(3000)}%` }}></div></div>
                            </div>

                            <div className="xp-bar-group">
                                <div className="xp-label">
                                    <span>🥈 Silver</span>
                                    <span>{currentXp} / 5000 XP</span>
                                </div>
                                <div className="xp-track"><div className="xp-fill silver" style={{ width: `${calculateProgress(5000)}%` }}></div></div>
                            </div>

                            <div className="xp-bar-group">
                                <div className="xp-label">
                                    <span>🥇 Gold</span>
                                    <span>{currentXp} / 10000 XP</span>
                                </div>
                                <div className="xp-track"><div className="xp-fill gold" style={{ width: `${calculateProgress(10000)}%` }}></div></div>
                            </div>
                        </div>
                    )}
                </div>
            </nav>

            <main className="programs-main">
                <div className="feed-header">
                    <h2>Active Quests Feed</h2>
                    <p>Help local organizations and earn XP towards your next badge.</p>
                </div>

                <div className="quests-feed">
                    {quests.length === 0 ? (
                        <div className="empty-state">No active quests found. Check back later!</div>
                    ) : (
                        quests.map(quest => (
                            <div key={quest._id} className="quest-card">
                                <div className="quest-card-header">
                                    <div className="quest-badges">
                                        <span className={`type-badge ${quest.quest_type}`}>{quest.quest_type?.toUpperCase()}</span>
                                        <span className="xp-badge">✨ {quest.xp || 100} XP</span>
                                    </div>
                                    <h3>{quest.title}</h3>
                                </div>
                                
                                <p className="quest-desc">{quest.description}</p>
                                
                                <div className="quest-meta">
                                    <div className="meta-item">
                                        <strong>Organisation</strong>
                                        <span>{quest.org_name || "Community Partner"}</span>
                                    </div>
                                    <div className="meta-item">
                                        <strong>Deadline</strong>
                                        <span>{quest.deadline ? new Date(quest.deadline).toLocaleDateString() : 'Flexible'}</span>
                                    </div>
                                    {quest.items_needed && (
                                        <div className="meta-item">
                                            <strong>Requirements</strong>
                                            <span>{quest.items_needed}</span>
                                        </div>
                                    )}
                                </div>

                                <div className="quest-actions">
                                    <button 
                                        className={`btn-accept ${quest.accepted_by_me ? 'accepted' : ''}`}
                                        onClick={() => handleAcceptQuest(quest._id)}
                                        disabled={quest.accepted_by_me}
                                    >
                                        {quest.accepted_by_me ? '✓ Accepted' : 'Accept Quest'}
                                    </button>
                                    
                                    {quest.org_phone && (
                                        <a 
                                            href={`https://wa.me/${quest.org_phone.replace(/\D/g,'')}`}
                                            target="_blank" 
                                            rel="noreferrer"
                                            className="btn-whatsapp"
                                        >
                                            <i className="whatsapp-icon">💬</i> Contact via WhatsApp
                                        </a>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </main>
        </div>
    );
}
