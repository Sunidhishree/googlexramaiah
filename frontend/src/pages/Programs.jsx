import React, { useState, useEffect, useRef } from 'react';
import './Programs.css';
import { auth } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';

const API_BASE = "http://localhost:5000";

export default function Programs() {
    const [user, setUser] = useState(null);
    const [profile, setProfile] = useState(null);
    const [quests, setQuests] = useState([]);
    const [recommended, setRecommended] = useState([]);
    const [greeting, setGreeting] = useState('');
    const [loading, setLoading] = useState(true);
    const [userRank, setUserRank] = useState('Newcomer');
    const [nextRank, setNextRank] = useState(null);
    const [xpToNext, setXpToNext] = useState(0);
    const [badges, setBadges] = useState([]);

    // Filters
    const [typeFilter, setTypeFilter] = useState('all');
    const [urgencyFilter, setUrgencyFilter] = useState('all');
    const [sortBy, setSortBy] = useState('recommended');
    const [searchQuery, setSearchQuery] = useState('');

    // Modal
    const [acceptModal, setAcceptModal] = useState(null);
    const [certificateModal, setCertificateModal] = useState(null);
    const [xpFly, setXpFly] = useState(null);
    const [completing, setCompleting] = useState({});

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            setUser(currentUser);
            if (currentUser) {
                await fetchProfile(currentUser);
                await fetchData(currentUser);
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

    const fetchData = async (currentUser) => {
        try {
            const token = await currentUser.getIdToken();

            // Try recommended endpoint first
            const recRes = await fetch(`${API_BASE}/api/quests/recommended/${currentUser.uid}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (recRes.ok) {
                const data = await recRes.json();
                setRecommended(data.recommended || []);
                setQuests(data.all_quests || []);
                setGreeting(data.greeting || '');
                setUserRank(data.user_rank || 'Newcomer');
                setNextRank(data.next_rank || null);
                setXpToNext(data.xp_to_next_rank || 0);
                setBadges(data.badges || []);
            } else {
                // Fallback to all quests with auth
                const feedRes = await fetch(`${API_BASE}/api/quests/all`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (feedRes.ok) {
                    const data = await feedRes.json();
                    setQuests(data);
                }
            }
        } catch (error) {
            console.error("Error fetching quests", error);
            // Fallback without auth
            try {
                const feedRes = await fetch(`${API_BASE}/api/quests/all`);
                if (feedRes.ok) {
                    const data = await feedRes.json();
                    setQuests(data);
                }
            } catch (e) {
                console.error("Feed fallback also failed", e);
            }
        } finally {
            setLoading(false);
        }
    };

    const handleAcceptQuest = async (questId, event) => {
        if (!user) return;
        try {
            const token = await user.getIdToken();
            const res = await fetch(`${API_BASE}/api/quests/${questId}/accept`, {
                method: "POST",
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (res.ok) {
                const data = await res.json();

                // Show XP fly animation
                if (event && data.xp_earned) {
                    const rect = event.target.getBoundingClientRect();
                    setXpFly({
                        x: rect.left + rect.width / 2,
                        y: rect.top,
                        xp: data.xp_earned
                    });
                    setTimeout(() => setXpFly(null), 1500);
                }

                // Update local quest state
                const updateQuest = q =>
                    q._id === questId ? { ...q, accepted_by_me: true, accepted: (q.accepted || 0) + 1 } : q;

                setQuests(prev => prev.map(updateQuest));
                setRecommended(prev => prev.map(updateQuest));

                // Optimistic XP update
                if (data.xp_earned) {
                    setProfile(prev => ({
                        ...prev,
                        xp: data.new_xp_total || (prev.xp || 0) + data.xp_earned
                    }));
                }

                if (data.new_rank) setUserRank(data.new_rank);
                if (data.next_rank) setNextRank(data.next_rank);
                if (data.xp_to_next_rank !== undefined) setXpToNext(data.xp_to_next_rank);

                // Show modal
                setAcceptModal({
                    xp: data.xp_earned,
                    totalXp: data.new_xp_total,
                    rank: data.new_rank,
                    nextRank: data.next_rank,
                    xpToNext: data.xp_to_next_rank,
                    spotsRemaining: data.spots_remaining,
                    questId
                });
            }
        } catch (error) {
            console.error("Error accepting quest", error);
        }
    };

    const handleCompleteQuest = async (questId, event) => {
        if (!user || completing[questId]) return;
        setCompleting(prev => ({ ...prev, [questId]: true }));
        try {
            const token = await user.getIdToken();
            const res = await fetch(`${API_BASE}/api/quests/${questId}/complete`, {
                method: "POST",
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (res.ok) {
                const data = await res.json();

                // XP fly animation
                if (event && data.xp_earned) {
                    const rect = event.target.getBoundingClientRect();
                    setXpFly({ x: rect.left + rect.width / 2, y: rect.top, xp: data.xp_earned });
                    setTimeout(() => setXpFly(null), 1500);
                }

                // Update quest state
                const updateQuest = q =>
                    q._id === questId ? { ...q, completed_by_me: true } : q;
                setQuests(prev => prev.map(updateQuest));
                setRecommended(prev => prev.map(updateQuest));

                // XP + rank update
                if (data.new_xp_total) {
                    setProfile(prev => ({ ...prev, xp: data.new_xp_total }));
                }
                if (data.new_rank) setUserRank(data.new_rank);
                if (data.next_rank) setNextRank(data.next_rank);
                if (data.xp_to_next_rank !== undefined) setXpToNext(data.xp_to_next_rank);
                if (data.new_badges?.length) {
                    setBadges(prev => [...prev, ...data.new_badges]);
                }

                // Show certificate modal
                setCertificateModal({
                    xp: data.xp_earned,
                    totalXp: data.new_xp_total,
                    rank: data.new_rank,
                    nextRank: data.next_rank,
                    xpToNext: data.xp_to_next_rank,
                    newBadges: data.new_badges || [],
                    certificateSent: data.certificate_sent,
                    certificateEmail: data.certificate_email,
                });
            } else {
                const err = await res.json().catch(() => ({}));
                if (err.already_completed) {
                    const updateQuest = q =>
                        q._id === questId ? { ...q, completed_by_me: true } : q;
                    setQuests(prev => prev.map(updateQuest));
                    setRecommended(prev => prev.map(updateQuest));
                }
                console.error("Complete quest error:", err);
            }
        } catch (error) {
            console.error("Error completing quest", error);
        } finally {
            setCompleting(prev => ({ ...prev, [questId]: false }));
        }
    };

    // ─── Filtering & Sorting ───
    const getFilteredQuests = () => {
        let filtered = [...quests];

        // Type filter
        if (typeFilter !== 'all') {
            filtered = filtered.filter(q => (q.quest_type || '').toLowerCase() === typeFilter);
        }

        // Urgency filter
        if (urgencyFilter !== 'all') {
            filtered = filtered.filter(q => {
                const urgency = computeUrgency(q);
                return urgency === urgencyFilter;
            });
        }

        // Search
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(q =>
                (q.title || '').toLowerCase().includes(query) ||
                (q.org_name || '').toLowerCase().includes(query) ||
                (q.description || '').toLowerCase().includes(query)
            );
        }

        // Sort
        if (sortBy === 'newest') {
            filtered.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
        } else if (sortBy === 'xp') {
            filtered.sort((a, b) => (b.xp || 0) - (a.xp || 0));
        } else if (sortBy === 'deadline') {
            filtered.sort((a, b) => new Date(a.deadline || '9999') - new Date(b.deadline || '9999'));
        }

        return filtered;
    };

    const computeUrgency = (quest) => {
        if (quest.urgency) return quest.urgency;
        const deadline = quest.deadline;
        if (!deadline) return 'open';
        const days = Math.ceil((new Date(deadline) - new Date()) / (1000 * 60 * 60 * 24));
        if (days < 0) return 'expired';
        if (days <= 3) return 'urgent';
        if (days <= 7) return 'soon';
        return 'open';
    };

    const getUrgencyDisplay = (urgency) => {
        switch (urgency) {
            case 'urgent': return { text: '🔴 Urgent', cls: 'urgent' };
            case 'soon': return { text: '🟡 Soon', cls: 'soon' };
            case 'open': return { text: '🟢 Open', cls: 'open' };
            default: return { text: '🟢 Open', cls: 'open' };
        }
    };

    // ─── Render ───
    if (loading) {
        return (
            <div className="programs-page">
                <div className="loading">
                    <div className="loading-spinner"></div>
                    Loading Volunteer Dashboard...
                </div>
            </div>
        );
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
    const calculateProgress = (targetXp) => Math.min(100, Math.max(0, (currentXp / targetXp) * 100));
    const filteredQuests = getFilteredQuests();

    return (
        <div className="programs-page">
            {/* ─── Thin Navbar ─── */}
            <nav className="programs-nav">
                <a href="/home" className="nav-logo">Ummeed<span>.</span></a>
                <div className="nav-profile">
                    <div className="profile-header">
                        <div className="avatar">{(profile?.name || user?.email || "V")[0].toUpperCase()}</div>
                        <div>
                            <h3>{profile?.name || "Volunteer"}</h3>
                            <p>Total XP: <strong>{currentXp}</strong></p>
                        </div>
                    </div>

                    <span className="nav-rank-badge">⭐ {userRank}</span>

                    {nextRank && (
                        <span className="quests-to-next">🎯 {xpToNext} XP to {nextRank}</span>
                    )}

                    <div className="xp-bars-container">
                        <div className="xp-bar-group">
                            <div className="xp-label">
                                <span>🥉 Bronze</span>
                                <span>{currentXp} / 3000</span>
                            </div>
                            <div className="xp-track"><div className="xp-fill bronze" style={{ width: `${calculateProgress(3000)}%` }}></div></div>
                        </div>
                        <div className="xp-bar-group">
                            <div className="xp-label">
                                <span>🥈 Silver</span>
                                <span>{currentXp} / 5000</span>
                            </div>
                            <div className="xp-track"><div className="xp-fill silver" style={{ width: `${calculateProgress(5000)}%` }}></div></div>
                        </div>
                        <div className="xp-bar-group">
                            <div className="xp-label">
                                <span>🥇 Gold</span>
                                <span>{currentXp} / 10000</span>
                            </div>
                            <div className="xp-track"><div className="xp-fill gold" style={{ width: `${calculateProgress(10000)}%` }}></div></div>
                        </div>
                    </div>
                </div>
            </nav>

            {/* ─── AI Greeting ─── */}
            {greeting && (
                <div className="greeting-section">
                    <div className="greeting-card">
                        <div className="greeting-text">{greeting}</div>
                        <div className="greeting-stats">
                            <div className="greeting-stat">
                                <div className="stat-value">{currentXp}</div>
                                <div className="stat-label">Total XP</div>
                            </div>
                            <div className="greeting-stat">
                                <div className="stat-value">{quests.filter(q => q.accepted_by_me).length}</div>
                                <div className="stat-label">Accepted</div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <main className="programs-main">
                {/* ─── Recommended Section ─── */}
                {recommended.length > 0 && (
                    <>
                        <div className="section-label">
                            <span className="section-icon">✨</span>
                            Recommended for You
                        </div>
                        <div className="recommended-grid">
                            {recommended.slice(0, 3).map(quest => (
                                <QuestCard
                                    key={quest._id}
                                    quest={quest}
                                    isRecommended
                                    computeUrgency={computeUrgency}
                                    getUrgencyDisplay={getUrgencyDisplay}
                                    onAccept={handleAcceptQuest}
                                    onComplete={handleCompleteQuest}
                                    completing={completing[quest._id]}
                                />
                            ))}
                        </div>
                    </>
                )}

                {/* ─── Filter Bar ─── */}
                <div className="filter-bar">
                    <div className="filter-group">
                        <span className="filter-group-label">Type</span>
                        {['all', 'donate', 'volunteer', 'fund'].map(type => (
                            <button
                                key={type}
                                className={`filter-btn ${typeFilter === type ? 'active' : ''}`}
                                onClick={() => setTypeFilter(type)}
                            >
                                {type === 'all' ? 'All' : type === 'donate' ? '🎁 Donate' : type === 'volunteer' ? '🤝 Volunteer' : '💰 Fund'}
                            </button>
                        ))}
                    </div>

                    <div className="filter-divider"></div>

                    <div className="filter-group">
                        <span className="filter-group-label">Urgency</span>
                        {['all', 'urgent', 'soon', 'open'].map(urg => (
                            <button
                                key={urg}
                                className={`filter-btn ${urgencyFilter === urg ? 'active' : ''}`}
                                onClick={() => setUrgencyFilter(urg)}
                            >
                                {urg === 'all' ? 'All' : urg.charAt(0).toUpperCase() + urg.slice(1)}
                            </button>
                        ))}
                    </div>

                    <div className="filter-divider"></div>

                    <select
                        className="sort-select"
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value)}
                    >
                        <option value="recommended">Sort: Recommended</option>
                        <option value="newest">Sort: Newest</option>
                        <option value="xp">Sort: XP Reward</option>
                        <option value="deadline">Sort: Deadline</option>
                    </select>

                    <input
                        type="text"
                        className="search-input"
                        placeholder="🔍 Search quests or organisations..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>

                {/* ─── All Quests Feed ─── */}
                <div className="section-label">
                    <span className="section-icon">📋</span>
                    {searchQuery ? 'Search Results' : 'All Active Quests'}
                    <span style={{ fontWeight: 400, fontSize: '0.82rem', color: '#888', marginLeft: '0.5rem' }}>
                        ({filteredQuests.length} quest{filteredQuests.length !== 1 ? 's' : ''})
                    </span>
                </div>

                <div className="quests-feed">
                    {filteredQuests.length === 0 ? (
                        <div className="empty-state">
                            {searchQuery ? 'No quests match your search.' : 'No active quests found. Check back later!'}
                        </div>
                    ) : (
                        filteredQuests.map(quest => (
                            <QuestCard
                                key={quest._id}
                                quest={quest}
                                computeUrgency={computeUrgency}
                                getUrgencyDisplay={getUrgencyDisplay}
                                onAccept={handleAcceptQuest}
                                onComplete={handleCompleteQuest}
                                completing={completing[quest._id]}
                            />
                        ))
                    )}
                </div>
            </main>

            {/* ─── XP Fly Animation ─── */}
            {xpFly && (
                <div className="xp-fly" style={{ left: xpFly.x, top: xpFly.y }}>
                    +{xpFly.xp} XP ✨
                </div>
            )}

            {/* ─── Accept Modal ─── */}
            {acceptModal && (
                <div className="modal-overlay" onClick={() => setAcceptModal(null)}>
                    <div className="accept-modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-emoji">🎉</div>
                        <h3>Quest Accepted!</h3>
                        <p>You're making a real difference.</p>
                        <div className="modal-xp">+{acceptModal.xp} XP</div>
                        <div className="modal-rank-info">
                            <p>Total XP: <strong>{acceptModal.totalXp}</strong></p>
                            <p>Rank: <strong>{acceptModal.rank}</strong></p>
                            {acceptModal.nextRank && (
                                <p>{acceptModal.xpToNext} XP to <strong>{acceptModal.nextRank}</strong></p>
                            )}
                        </div>
                        <div className="modal-actions">
                            <button className="btn-modal-close" onClick={() => setAcceptModal(null)}>
                                Continue Browsing
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ─── Certificate Modal ─── */}
            {certificateModal && (
                <div className="modal-overlay" onClick={() => setCertificateModal(null)}>
                    <div className="accept-modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-emoji">{certificateModal.certificateSent ? '📜' : '🎉'}</div>
                        <h3>Quest Completed!</h3>
                        {certificateModal.certificateSent ? (
                            <p className="cert-sent-msg">Certificate sent to <strong>{certificateModal.certificateEmail}</strong></p>
                        ) : (
                            <p>Great work! Your XP has been awarded.</p>
                        )}
                        <div className="modal-xp">+{certificateModal.xp} XP</div>
                        <div className="modal-rank-info">
                            <p>Total XP: <strong>{certificateModal.totalXp}</strong></p>
                            <p>Rank: <strong>{certificateModal.rank}</strong></p>
                            {certificateModal.nextRank && (
                                <p>{certificateModal.xpToNext} XP to <strong>{certificateModal.nextRank}</strong></p>
                            )}
                        </div>
                        {certificateModal.newBadges?.length > 0 && (
                            <div className="modal-badges">
                                <p>🏆 New badge{certificateModal.newBadges.length > 1 ? 's' : ''} earned:</p>
                                <div className="badge-list">
                                    {certificateModal.newBadges.map(b => (
                                        <span key={b} className="badge-chip">🎖️ {b}</span>
                                    ))}
                                </div>
                            </div>
                        )}
                        <div className="modal-actions">
                            <button className="btn-modal-close" onClick={() => setCertificateModal(null)}>
                                Continue Browsing
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

/* ═══════════════════════════════════════════
   QUEST CARD COMPONENT
   ═══════════════════════════════════════════ */
function QuestCard({ quest, isRecommended, computeUrgency, getUrgencyDisplay, onAccept, onComplete, completing }) {
    const urgency = computeUrgency(quest);
    const urgencyDisplay = getUrgencyDisplay(urgency);
    const acceptedCount = quest.accepted || 0;
    const isTrending = acceptedCount >= 5;
    const spotsAvailable = quest.spots_available || 10;
    const spotsFilled = quest.spots_filled || quest.accepted_by?.length || 0;
    const spotsLeft = Math.max(0, spotsAvailable - spotsFilled);
    const fillPercent = Math.min(100, (spotsFilled / spotsAvailable) * 100);

    const spotsFillClass = fillPercent >= 90 ? 'full' : fillPercent >= 70 ? 'almost-full' : '';

    return (
        <div className={`quest-card ${isRecommended ? 'recommended-card' : ''}`}>
            <div className="quest-card-header">
                <div className="quest-badges">
                    <span className={`type-badge ${quest.quest_type}`}>
                        {(quest.quest_type || 'QUEST').toUpperCase()}
                    </span>
                    <span className="xp-badge">✨ {quest.xp || 100} XP</span>
                    <span className={`urgency-badge ${urgencyDisplay.cls}`}>{urgencyDisplay.text}</span>
                    {isTrending && <span className="trending-badge">🔥 Trending</span>}
                </div>
                <h3>{quest.title}</h3>
            </div>

            {isRecommended && quest.recommendation_reason && (
                <div className="recommendation-reason">
                    💡 {quest.recommendation_reason}
                </div>
            )}

            <p className="quest-desc">{quest.description}</p>

            <div className="spots-progress">
                <span className="spots-text">👥 {spotsLeft} spot{spotsLeft !== 1 ? 's' : ''} left</span>
                <div className="spots-track">
                    <div className={`spots-fill ${spotsFillClass}`} style={{ width: `${fillPercent}%` }}></div>
                </div>
                <span style={{ fontSize: '0.75rem', color: '#888' }}>{spotsFilled}/{spotsAvailable}</span>
            </div>

            <div className="quest-meta">
                <div className="meta-item">
                    <strong>Organisation:</strong> {quest.org_name || quest.orphanage_name || 'Unknown'}
                </div>
                <div className="meta-item">
                    <strong>Deadline:</strong> {quest.deadline ? new Date(quest.deadline).toLocaleDateString() : 'Open'}
                </div>
                {quest.items_needed && (
                    <div className="meta-item">
                        <strong>Items:</strong> {quest.items_needed}
                    </div>
                )}
            </div>

            <div className="quest-actions">
                {!quest.accepted_by_me ? (
                    <button
                        className="btn-accept"
                        onClick={(e) => onAccept(quest._id, e)}
                        disabled={spotsLeft === 0}
                    >
                        {spotsLeft === 0 ? 'Full' : 'Accept Quest'}
                    </button>
                ) : quest.completed_by_me ? (
                    <button className="btn-accept accepted" disabled>✅ Completed</button>
                ) : (
                    <>
                        <button className="btn-accept accepted" disabled>✅ Accepted</button>
                        <button
                            className="btn-complete"
                            onClick={(e) => onComplete(quest._id, e)}
                            disabled={completing}
                        >
                            {completing ? 'Completing...' : '🏁 Mark Complete'}
                        </button>
                    </>
                )}

                {quest.org_phone && (
                    <a
                        href={`https://wa.me/${(quest.org_phone || '').replace(/\D/g, '')}`}
                        target="_blank"
                        rel="noreferrer"
                        className="btn-whatsapp"
                    >
                        💬 Contact via WhatsApp
                    </a>
                )}
            </div>
        </div>
    );
}
