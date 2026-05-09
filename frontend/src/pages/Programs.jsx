import React, { useState, useEffect } from 'react';
import './Programs.css';
import { auth } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';

const API_BASE = "http://localhost:5000";

export default function Programs() {
    const [user, setUser] = useState(null);
    const [profile, setProfile] = useState(null);
    const [quests, setQuests] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            setUser(currentUser);
            if (currentUser) {
                // Fetch profile, quests, and user's existing quest statuses in parallel
                const [, questData] = await Promise.all([
                    fetchProfile(currentUser),
                    fetchQuestsRaw(),
                ]);
                // Merge MongoDB quest statuses so state persists across reloads
                const statuses = await fetchQuestStatuses(currentUser);
                if (questData && statuses) {
                    setQuests(questData.map(q => {
                        const s = statuses[q._id];
                        if (!s) return q;
                        return {
                            ...q,
                            accepted_by_me: s.accepted,
                            verification_status: s.status === 'verified' ? 'verified' : (s.status === 'failed' ? 'failed' : 'pending'),
                            xp_awarded: s.status === 'verified',
                        };
                    }));
                } else if (questData) {
                    setQuests(questData);
                }
                setLoading(false);
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

    /** Fetches raw quest list without updating state (returns data for merging). */
    const fetchQuestsRaw = async () => {
        try {
            const res = await fetch(`${API_BASE}/api/quests/feed`);
            if (res.ok) return await res.json();
        } catch (error) {
            console.error("Error fetching quests feed", error);
        }
        return null;
    };

    /** Fetches user's quest acceptance+completion statuses from MongoDB. */
    const fetchQuestStatuses = async (currentUser) => {
        try {
            const token = await currentUser.getIdToken();
            const res = await fetch(`${API_BASE}/api/user/quest-statuses`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) return await res.json();
        } catch (error) {
            console.error("Error fetching quest statuses", error);
        }
        return null;
    };

    const handleAcceptQuest = async (questId) => {
        if (!user) return;
        try {
            const token = await user.getIdToken();
            const res = await fetch(`${API_BASE}/api/quests/${questId}/accept`, {
                method: "POST",
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (res.status === 409) {
                // Already completed — lock the card immediately
                setQuests(prev => prev.map(q =>
                    q._id === questId
                        ? { ...q, accepted_by_me: true, verification_status: 'verified', xp_awarded: true }
                        : q
                ));
                return;
            }

            if (res.ok) {
                const data = await res.json();
                if (data.already_accepted) {
                    // Idempotent — still mark as accepted in UI
                    setQuests(prev => prev.map(q =>
                        q._id === questId
                            ? { ...q, accepted_by_me: true, verification_status: q.verification_status || 'pending' }
                            : q
                    ));
                } else {
                    // Fresh acceptance
                    setQuests(prev => prev.map(q =>
                        q._id === questId
                            ? { ...q, accepted_by_me: true, accepted: (q.accepted || 0) + 1, verification_status: 'pending' }
                            : q
                    ));
                }
            }
        } catch (error) {
            console.error("Error accepting quest", error);
        }
    };

    const handleVerifyCompletion = async (quest, photoFile, locationData) => {
        if (!user) return { verified: false, message: 'Not logged in' };
        try {
            const token = await user.getIdToken();
            const formData = new FormData();
            if (photoFile) formData.append('photo', photoFile);
            if (locationData) {
                formData.append('latitude', locationData.latitude);
                formData.append('longitude', locationData.longitude);
            }
            formData.append('quest_id', quest._id);
            formData.append('orphanage_id', quest.orphanage_id);

            const res = await fetch(`${API_BASE}/api/quests/${quest._id}/verify-completion`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            });

            if (res.ok) {
                const data = await res.json();
                if (data.verified) {
                    // Auto-award XP immediately on verification
                    setProfile(prev => ({ ...prev, xp: (prev?.xp || 0) + (quest.xp || 100) }));
                    setQuests(prev => prev.map(q =>
                        q._id === quest._id
                            ? { ...q, verification_status: 'verified', xp_awarded: true }
                            : q
                    ));
                }
                return data;
            }
            return { verified: false, message: 'Server error. Please try again.' };
        } catch (error) {
            console.error("Error verifying quest completion", error);
            return { verified: false, message: error.message };
        }
    };

    if (loading) {
        return (
            <div className="programs-page">
                <div className="programs-loading">
                    <div className="loading-spinner"></div>
                    <p>Loading Quest Feed...</p>
                </div>
            </div>
        );
    }

    if (!user) {
        return (
            <div className="programs-page">
                <nav className="programs-nav">
                    <div className="nav-left">
                        <a href="/home" className="nav-logo">Ummeed<span>.</span></a>
                    </div>
                    <a href="/home" className="back-home-btn">← Back to Home</a>
                </nav>
                <div className="unauth-message">
                    <div className="unauth-icon">🔐</div>
                    <h2>Login Required</h2>
                    <p>You need to be logged in as a volunteer to view your dashboard and accept quests.</p>
                    <a href="/login" className="btn-primary-ummeed">Go to Login</a>
                </div>
            </div>
        );
    }

    const currentXp = profile?.xp || 0;
    const calculateProgress = (targetXp) => Math.min(100, Math.max(0, (currentXp / targetXp) * 100));

    return (
        <div className="programs-page">
            <ProgramsNav
                profile={profile}
                user={user}
                currentXp={currentXp}
                calculateProgress={calculateProgress}
            />

            <main className="programs-main">
                <div className="feed-header">
                    <div className="section-eyebrow">🌱 Community Quests</div>
                    <h2>Active Quest Feed</h2>
                    <p>Help local organizations, earn XP, and level up your badge. Upload proof &amp; verify location to auto-collect rewards.</p>
                </div>

                <div className="quests-feed">
                    {quests.length === 0 ? (
                        <div className="quests-empty">
                            <div className="quests-empty-icon">🗺️</div>
                            <h3>No Active Quests</h3>
                            <p>Organizations are adding new quests daily. Check back soon!</p>
                        </div>
                    ) : (
                        quests.map(quest => (
                            <QuestCard
                                key={quest._id}
                                quest={quest}
                                user={user}
                                onAccept={handleAcceptQuest}
                                onVerify={handleVerifyCompletion}
                            />
                        ))
                    )}
                </div>
            </main>
        </div>
    );
}

// ── Profile Nav Panel ─────────────────────────────────────────────────────
function ProgramsNav({ profile, user, currentXp, calculateProgress }) {
    const [profileOpen, setProfileOpen] = useState(false);

    return (
        <nav className="programs-nav">
            <div className="nav-left">
                <a href="/home" className="nav-logo">Ummeed<span>.</span></a>
                <a href="/home" className="back-home-btn">← Home</a>
            </div>

            <div className="nav-profile-wrapper">
                <button
                    className={`profile-toggle-btn ${profileOpen ? 'open' : ''}`}
                    onClick={() => setProfileOpen(o => !o)}
                    aria-label="Toggle profile"
                >
                    <div className="avatar">{(profile?.name || user?.email || "V")[0].toUpperCase()}</div>
                    <div className="profile-summary">
                        <span className="profile-name">{profile?.name || "Volunteer"}</span>
                        <span className="profile-xp">✨ {currentXp} XP</span>
                    </div>
                    <span className={`profile-chevron ${profileOpen ? 'open' : ''}`}>▾</span>
                </button>

                {profileOpen && (
                    <div className="profile-dropdown">
                        <div className="profile-dropdown-header">
                            <div className="avatar avatar-lg">
                                {(profile?.name || user?.email || "V")[0].toUpperCase()}
                            </div>
                            <div>
                                <div className="profile-full-name">{profile?.name || "Volunteer"}</div>
                                <div className="profile-total-xp">Total XP: <strong>{currentXp}</strong></div>
                            </div>
                        </div>
                        <div className="xp-bars-container">
                            <XpBar label="🥉 Bronze" current={currentXp} target={3000} fillClass="bronze" progress={calculateProgress(3000)} />
                            <XpBar label="🥈 Silver" current={currentXp} target={5000} fillClass="silver" progress={calculateProgress(5000)} />
                            <XpBar label="🥇 Gold" current={currentXp} target={10000} fillClass="gold" progress={calculateProgress(10000)} />
                        </div>
                    </div>
                )}
            </div>
        </nav>
    );
}

function XpBar({ label, current, target, fillClass, progress }) {
    return (
        <div className="xp-bar-group">
            <div className="xp-label">
                <span>{label}</span>
                <span>{current} / {target} XP</span>
            </div>
            <div className="xp-track">
                <div className={`xp-fill ${fillClass}`} style={{ width: `${progress}%` }}></div>
            </div>
        </div>
    );
}

// ── Quest Card ────────────────────────────────────────────────────────────
function QuestCard({ quest, user, onAccept, onVerify }) {
    const [verifying, setVerifying] = useState(false);
    const [photoFile, setPhotoFile] = useState(null);
    const [photoPreview, setPhotoPreview] = useState(null);
    const [locationStatus, setLocationStatus] = useState('idle'); // idle | loading | ok | fail
    const [locationData, setLocationData] = useState(null);
    const [verifyResult, setVerifyResult] = useState(null);
    const [submitting, setSubmitting] = useState(false);

    const handlePhotoChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setPhotoFile(file);
        const reader = new FileReader();
        reader.onload = (ev) => setPhotoPreview(ev.target.result);
        reader.readAsDataURL(file);
    };

    const handleEnableLocation = () => {
        if (!navigator.geolocation) { setLocationStatus('fail'); return; }
        setLocationStatus('loading');
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                setLocationData({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
                setLocationStatus('ok');
            },
            () => setLocationStatus('fail'),
            { enableHighAccuracy: true, timeout: 10000 }
        );
    };

    const handleSubmitVerification = async () => {
        // OR logic: just need photo OR location (not both)
        if (!photoFile && locationStatus !== 'ok') return;
        setSubmitting(true);
        const result = await onVerify(quest, photoFile, locationData);
        setVerifyResult(result);
        setSubmitting(false);
        if (result?.verified) setVerifying(false);
    };

    const isAccepted = quest.accepted_by_me;
    const isVerified = quest.verification_status === 'verified';
    const isXpAwarded = quest.xp_awarded;
    // Can submit if user has provided at least a photo OR a location
    const canSubmit = photoFile || locationStatus === 'ok';

    return (
        <div className={`quest-card ${isVerified ? 'quest-verified' : ''}`}>
            {isXpAwarded && (
                <div className="xp-award-banner">
                    🎉 +{quest.xp || 100} XP Awarded Automatically!
                </div>
            )}

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
                    <span className="meta-icon">🏛️</span>
                    <span><strong>Organisation:</strong> {quest.org_name}</span>
                </div>
                <div className="meta-item">
                    <span className="meta-icon">📅</span>
                    <span><strong>Deadline:</strong> {new Date(quest.deadline).toLocaleDateString()}</span>
                </div>
                {quest.items_needed && (
                    <div className="meta-item">
                        <span className="meta-icon">📦</span>
                        <span><strong>Items:</strong> {quest.items_needed}</span>
                    </div>
                )}
            </div>

            <div className="quest-actions">
                {!isAccepted ? (
                    <button className="btn-accept" onClick={() => onAccept(quest._id)}>
                        Accept Quest
                    </button>
                ) : isVerified ? (
                    <div className="verified-badge">✅ Quest Completed &amp; Verified</div>
                ) : (
                    <>
                        <button
                            className="btn-verify-toggle"
                            onClick={() => setVerifying(v => !v)}
                        >
                            {verifying ? '▴ Hide Verification' : '📸 Submit Proof to Earn XP'}
                        </button>
                        {quest.org_phone && (
                            <a
                                href={`https://wa.me/${quest.org_phone.replace(/\D/g, '')}`}
                                target="_blank"
                                rel="noreferrer"
                                className="btn-whatsapp"
                            >
                                💬 WhatsApp
                            </a>
                        )}
                    </>
                )}
            </div>

            {/* Completed footer — no further actions possible */}
            {isVerified && (
                <div className="quest-done-footer">
                    🏅 Great work! This quest is complete. XP has been added to your profile.
                </div>
            )}

            {/* Verification Panel — shown after accepting, before verified */}
            {isAccepted && !isVerified && verifying && (
                <div className="verification-panel">
                    <div className="verification-panel-title">📋 Quest Completion Verification</div>
                    <p className="verification-hint">
                        Upload a proof photo <strong>or</strong> enable location — either one passing is enough to earn XP.
                        Our AI (BLIP) analyses your photo; GPS checks if you're within 500 m of the organisation.
                    </p>

                    {/* Step 1 — Photo */}
                    <div className="verify-step">
                        <div className="verify-step-label">
                            <span className={`step-dot ${photoFile ? 'done' : ''}`}>1</span>
                            Add Proof Photo
                        </div>
                        <label className="photo-upload-label" htmlFor={`photo-${quest._id}`}>
                            {photoPreview ? (
                                <img src={photoPreview} alt="Proof" className="photo-preview" />
                            ) : (
                                <div className="photo-placeholder">
                                    <span className="photo-icon">📷</span>
                                    <span>Click to upload photo</span>
                                    <span className="photo-hint">AI will match it to quest keywords</span>
                                </div>
                            )}
                        </label>
                        <input
                            id={`photo-${quest._id}`}
                            type="file"
                            accept="image/*"
                            onChange={handlePhotoChange}
                            style={{ display: 'none' }}
                        />
                    </div>

                    {/* Step 2 — Location */}
                    <div className="verify-step">
                        <div className="verify-step-label">
                            <span className={`step-dot ${locationStatus === 'ok' ? 'done' : ''}`}>2</span>
                            Verify Your Location
                        </div>
                        <button
                            className={`btn-location ${locationStatus}`}
                            onClick={handleEnableLocation}
                            disabled={locationStatus === 'loading' || locationStatus === 'ok'}
                        >
                            {locationStatus === 'idle' && '📍 Enable Location'}
                            {locationStatus === 'loading' && '⏳ Getting location...'}
                            {locationStatus === 'ok' && '✅ Location Captured'}
                            {locationStatus === 'fail' && '❌ Retry Location'}
                        </button>
                        {locationStatus === 'ok' && locationData && (
                            <small className="location-coords">
                                📌 {locationData.latitude.toFixed(5)}, {locationData.longitude.toFixed(5)}
                            </small>
                        )}
                    </div>

                    {/* Submit */}
                    <button
                        className={`btn-submit-verify ${!canSubmit ? 'disabled' : ''}`}
                        onClick={handleSubmitVerification}
                        disabled={!canSubmit || submitting}
                    >
                        {submitting ? '⏳ AI Analysing...' : '🚀 Submit & Earn XP'}
                    </button>

                    {/* Rich verification result */}
                    {verifyResult && (
                        <div className={`verify-result ${verifyResult.verified ? 'success' : 'fail'}`}>
                            {verifyResult.verified ? (
                                <>
                                    <div className="verify-result-title">
                                        🎉 Verified! +{quest.xp || 100} XP added automatically!
                                    </div>
                                    <div className="verify-result-methods">
                                        {verifyResult.verify_method?.includes('image') && (
                                            <span className="verify-tag image">🤖 AI Image Match</span>
                                        )}
                                        {verifyResult.verify_method?.includes('location') && (
                                            <span className="verify-tag location">📍 Location Match</span>
                                        )}
                                    </div>
                                    {verifyResult.blip_caption && (
                                        <div className="verify-caption">
                                            🔍 AI saw: <em>"{verifyResult.blip_caption}"</em>
                                        </div>
                                    )}
                                    {verifyResult.distance_km != null && (
                                        <div className="verify-distance">
                                            📏 Distance: {(verifyResult.distance_km * 1000).toFixed(0)} m from organisation
                                        </div>
                                    )}
                                </>
                            ) : (
                                <>
                                    <div className="verify-result-title">⚠️ Verification Failed</div>
                                    <div className="verify-fail-reason">{verifyResult.message || verifyResult.reason}</div>
                                    {verifyResult.blip_caption && (
                                        <div className="verify-caption">
                                            🤖 AI saw: <em>"{verifyResult.blip_caption}"</em> — try a clearer photo showing the quest items.
                                        </div>
                                    )}
                                    {verifyResult.distance_km != null && (
                                        <div className="verify-distance">
                                            📏 You are {verifyResult.distance_km.toFixed(2)} km away (need ≤0.5 km).
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
