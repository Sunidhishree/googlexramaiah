import React, { useEffect, useMemo, useState } from "react"
import './OrphanageDashboard.css'

const API_BASE = "http://localhost:5000"
const tabs = [
    { id: "overview", label: "Overview" },
    { id: "quests", label: "Quests" },
    { id: "stories", label: "Stories" },
    { id: "volunteers", label: "Volunteers" }
]
const questTypes = [
    { id: "donate", label: "Donate" },
    { id: "volunteer", label: "Volunteer" },
    { id: "fund", label: "Fund" }
]
const CHILD_ALIASES = Array.from({length:26}, (_,i) => `Child ${String.fromCharCode(65+i)}`)

export default function OrphanageDashboard() {
    const [activeTab, setActiveTab] = useState("overview")
    const [orphanage, setOrphanage] = useState(null)
    const [loadingProfile, setLoadingProfile] = useState(true)
    const [quests, setQuests] = useState([])
    const [showQuestForm, setShowQuestForm] = useState(false)
    const [stories, setStories] = useState([])
    const [showStoryForm, setShowStoryForm] = useState(false)
    const [newQuest, setNewQuest] = useState({ title: "", description: "", quest_type: "donate", deadline: "", items_needed: "", spots: "" })
    const [newStory, setNewStory] = useState({ caption: "", photo: "", tags: "Child A" })
    const [storyUploading, setStoryUploading] = useState(false)
    const [volunteers, setVolunteers] = useState([])
    const [volunteerLoading, setVolunteerLoading] = useState(true)
    const orphanageId = localStorage.getItem("orphanage_id")

    useEffect(() => {
        if (!orphanageId) { setLoadingProfile(false); return }
        ;(async () => {
            try {
                const r = await fetch(`${API_BASE}/api/orphanage/${orphanageId}`)
                const p = await r.json()
                if (r.ok) setOrphanage(p)
            } catch (e) { console.error("Profile error:", e) }
            finally { setLoadingProfile(false) }
        })()
    }, [orphanageId])

    useEffect(() => {
        if (!orphanageId) return
        ;(async () => {
            try {
                const rq = await fetch(`${API_BASE}/api/orphanage/${orphanageId}/quests`)
                if (rq.ok) setQuests(await rq.json())
                
                const rs = await fetch(`${API_BASE}/api/orphanage/${orphanageId}/stories`)
                if (rs.ok) setStories(await rs.json())
                
                setVolunteerLoading(true)
                const rv = await fetch(`${API_BASE}/api/orphanage/${orphanageId}/volunteers`)
                if (rv.ok) setVolunteers(await rv.json())
            } catch (e) { console.error("Dashboard data error:", e) }
            finally { setVolunteerLoading(false) }
        })()
    }, [orphanageId])

    const approveVolunteer = async (id) => {
        try {
            const r = await fetch(`${API_BASE}/api/volunteers/${id}/approve`, { method: 'POST' })
            if (r.ok) {
                setVolunteers(prev => prev.map(v => v._id === id ? {...v, status:"approved"} : v))
            }
        } catch (e) { console.error("Approval error", e) }
    }

    const handleQuestSubmit = async (e) => {
        e.preventDefault()
        if (!newQuest.title || !newQuest.description) return
        
        try {
            const r = await fetch(`${API_BASE}/api/orphanage/${orphanageId}/quests`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ...newQuest, accepted: 0, status: "active" })
            })
            if (r.ok) {
                const q = await r.json()
                setQuests(prev => [q, ...prev])
                setNewQuest({ title: "", description: "", quest_type: "donate", deadline: "", items_needed: "", spots: "" })
                setShowQuestForm(false)
            }
        } catch (err) { console.error("Error publishing quest", err) }
    }

    const [newStoryFile, setNewStoryFile] = useState(null)
    const [newStoryPreview, setNewStoryPreview] = useState("")

    const handleStoryPhoto = (e) => {
        const file = e.target.files?.[0]
        if (!file) return
        setNewStoryFile(file)
        
        const reader = new FileReader()
        reader.onload = () => setNewStoryPreview(reader.result)
        reader.readAsDataURL(file)
    }

    const handleStorySubmit = async (e) => {
        e.preventDefault()
        if (!newStory.caption || !newStoryFile) return
        setStoryUploading(true)
        
        try {
            const formData = new FormData()
            formData.append("caption", newStory.caption)
            formData.append("tags", newStory.tags)
            formData.append("photo", newStoryFile)
            
            const r = await fetch(`${API_BASE}/api/orphanage/${orphanageId}/stories`, {
                method: "POST",
                body: formData
            })
            if (r.ok) {
                const s = await r.json()
                setStories(prev => [s, ...prev])
                setNewStory({ caption: "", tags: "Child A" })
                setNewStoryFile(null)
                setNewStoryPreview("")
                setShowStoryForm(false)
            }
        } catch (err) { console.error("Error sharing story", err) }
        finally { setStoryUploading(false) }
    }

    const toggleLike = async (id) => {
        // Optimistic UI update
        const storyIndex = stories.findIndex(s => s._id === id)
        if (storyIndex === -1) return
        if (stories[storyIndex].liked) return // Already liked in this session
        
        setStories(prev => prev.map(s => s._id === id ? { ...s, liked: true, likes: s.likes + 1 } : s))
        
        try {
            const r = await fetch(`${API_BASE}/api/stories/${id}/like`, { method: "POST" })
            if (!r.ok) {
                // Revert on fail
                setStories(prev => prev.map(s => s._id === id ? { ...s, liked: false, likes: s.likes - 1 } : s))
            }
        } catch (err) {
             setStories(prev => prev.map(s => s._id === id ? { ...s, liked: false, likes: s.likes - 1 } : s))
        }
    }

    if (loadingProfile) {
        return <div className="dashboard-page"><div className="dashboard-main">Loading...</div></div>
    }

    if (!orphanageId) {
        return (
            <div className="dashboard-page">
                <div className="dashboard-main">
                    <h2>No session found</h2>
                    <a href="/orphanage/login" className="btn-primary">Login</a>
                </div>
            </div>
        )
    }

    return (
        <div className="dashboard-page">
            <nav className="dashboard-nav">
                <a href="/home" className="dashboard-logo">Ummeed<span>.</span></a>
                <div className="dashboard-nav-links">
                    {tabs.map(tab => (
                        <button key={tab.id} onClick={() => {
                            setActiveTab(tab.id)
                            setShowQuestForm(false)
                            setShowStoryForm(false)
                        }} className={`dashboard-nav-btn ${activeTab === tab.id ? 'active' : ''}`}>
                            {tab.label}
                        </button>
                    ))}
                    <button onClick={() => { localStorage.removeItem("orphanage_id"); window.location.href="/orphanage/login" }} className="logout-btn">Logout</button>
                </div>
            </nav>

            <main className="dashboard-main">
                <header className="dashboard-header">
                    <h1>{orphanage?.name || "Your Caring Space"}</h1>
                    <p>Manage quests, stories, and volunteers.</p>
                </header>

                <div className="tab-content">
                    {activeTab === "overview" && (
                        <div className="overview-tab">
                            <div className="welcome-banner">
                                <h2>Welcome back, {orphanage?.name || "Caretaker"}! 🏠</h2>
                                <p>Here's a quick summary of your impact and community engagement.</p>
                            </div>
                            
                            <div className="cards-grid overview-stats">
                                <div className="card stat-card">
                                    <div className="stat-icon">🧒</div>
                                    <div className="stat-info">
                                        <h3>{orphanage?.current_strength || 0}</h3>
                                        <p>Total Children</p>
                                    </div>
                                </div>
                                <div className="card stat-card">
                                    <div className="stat-icon">🏠</div>
                                    <div className="stat-info">
                                        <h3>{orphanage?.capacity || 0}</h3>
                                        <p>Capacity</p>
                                    </div>
                                </div>
                                <div className="card stat-card">
                                    <div className="stat-icon">🎯</div>
                                    <div className="stat-info">
                                        <h3>{quests.filter(q=>q.status==="active").length}</h3>
                                        <p>Active Quests</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === "quests" && (
                        <div>
                            <div className="section-header">
                                <h2>{showQuestForm ? "Create a Quest" : `Active Quests (${quests.length})`}</h2>
                                {!showQuestForm && <button onClick={() => setShowQuestForm(true)} className="btn-primary">Create Quest</button>}
                                {showQuestForm && <button onClick={() => setShowQuestForm(false)} className="btn-primary" style={{background: '#888'}}>Cancel</button>}
                            </div>

                            {showQuestForm ? (
                                <form onSubmit={handleQuestSubmit} className="dashboard-form">
                                    <div className="form-group">
                                        <label>Quest Title</label>
                                        <input required value={newQuest.title} onChange={e => setNewQuest(p => ({...p, title: e.target.value}))} />
                                    </div>
                                    <div className="form-group">
                                        <label>Description</label>
                                        <textarea required rows="3" value={newQuest.description} onChange={e => setNewQuest(p => ({...p, description: e.target.value}))} />
                                    </div>
                                    <div className="form-group">
                                        <label>Quest Type</label>
                                        <select value={newQuest.quest_type} onChange={e => setNewQuest(p => ({...p, quest_type: e.target.value}))}>
                                            {questTypes.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label>Deadline (Optional)</label>
                                        <input type="date" value={newQuest.deadline} onChange={e => setNewQuest(p => ({...p, deadline: e.target.value}))} />
                                    </div>
                                    {newQuest.quest_type === "donate" && (
                                        <div className="form-group">
                                            <label>Items Needed (e.g., Books, Clothes)</label>
                                            <input value={newQuest.items_needed} onChange={e => setNewQuest(p => ({...p, items_needed: e.target.value}))} />
                                        </div>
                                    )}
                                    {newQuest.quest_type === "volunteer" && (
                                        <div className="form-group">
                                            <label>Spots Available</label>
                                            <input type="number" value={newQuest.spots} onChange={e => setNewQuest(p => ({...p, spots: e.target.value}))} />
                                        </div>
                                    )}
                                    <button type="submit" className="btn-primary">Publish Quest</button>
                                </form>
                            ) : (
                                <div className="cards-grid">
                                    {quests.map(q => {
                                        const expired = q.deadline && new Date(q.deadline) < new Date()
                                        return (
                                            <div key={q._id} className="card">
                                                <div className="card-meta">
                                                    <span className={`badge ${expired ? 'expired' : 'active'}`}>{expired ? 'Expired' : 'Active'}</span>
                                                    <span>Type: {q.quest_type}</span>
                                                </div>
                                                <h3>{q.title}</h3>
                                                <p>{q.description}</p>
                                                {q.items_needed && <p><strong>Items:</strong> {q.items_needed}</p>}
                                                {q.spots && <p><strong>Spots:</strong> {q.spots}</p>}
                                                <div className="card-meta">
                                                    <span>Deadline: {q.deadline || 'Flexible'}</span>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === "stories" && (
                        <div>
                            <div className="section-header">
                                <h2>{showStoryForm ? "Post a Story" : "Social Wall"}</h2>
                                {!showStoryForm && <button onClick={() => setShowStoryForm(true)} className="btn-primary">Post Story</button>}
                                {showStoryForm && <button onClick={() => setShowStoryForm(false)} className="btn-primary" style={{background: '#888'}}>Cancel</button>}
                            </div>

                            {showStoryForm ? (
                                <form onSubmit={handleStorySubmit} className="dashboard-form">
                                    <div className="form-group">
                                        <label>Caption</label>
                                        <textarea required rows="3" value={newStory.caption} onChange={e => setNewStory(p => ({...p, caption: e.target.value}))} />
                                    </div>
                                    <div className="form-group">
                                        <label>Photo</label>
                                        {newStoryPreview && <img src={newStoryPreview} alt="Preview" className="story-img-preview" />}
                                        <input type="file" accept="image/*" onChange={handleStoryPhoto} />
                                        {storyUploading && <span>Uploading...</span>}
                                    </div>
                                    <div className="form-group">
                                        <label>Child Alias</label>
                                        <select value={newStory.tags} onChange={e => setNewStory(p => ({...p, tags: e.target.value}))}>
                                            {CHILD_ALIASES.map(c => <option key={c} value={c}>{c}</option>)}
                                        </select>
                                    </div>
                                    <button type="submit" className="btn-primary" disabled={storyUploading}>Share Story</button>
                                </form>
                            ) : (
                                <div className="cards-grid">
                                    {stories.map(s => (
                                        <div key={s._id} className="card" style={{padding: 0, overflow: 'hidden'}}>
                                            <img src={s.photo} alt={s.caption} style={{width: '100%', height: '200px', objectFit: 'cover'}} />
                                            <div style={{padding: '1.5rem'}}>
                                                <p>{s.caption}</p>
                                                <div className="card-meta" style={{marginTop: '1rem'}}>
                                                    <button onClick={() => toggleLike(s._id)} style={{background: 'none', border: 'none', cursor: 'pointer', color: s.liked ? 'red' : 'inherit'}}>
                                                        {s.liked ? '♥' : '♡'} {s.likes} Likes
                                                    </button>
                                                    {s.tags && <span className="badge active">{s.tags}</span>}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === "volunteers" && (
                        <div>
                            <div className="section-header">
                                <h2>Registered Volunteers</h2>
                            </div>
                            
                            {volunteerLoading ? <p>Loading volunteers...</p> : (
                                <div className="cards-grid">
                                    {volunteers.map(v => {
                                        const phone = v.phone || "+919000000000"
                                        const msg = `Hi! I saw your profile on Ummeed and would love to connect.`
                                        const waLink = `https://wa.me/${phone.replace(/\D/g, "")}?text=${encodeURIComponent(msg)}`
                                        return (
                                            <div key={v._id} className="card">
                                                <div className="card-meta">
                                                    <span className={`badge ${v.status === 'approved' ? 'approved' : 'pending'}`}>{v.status.toUpperCase()}</span>
                                                </div>
                                                <h3>{v.name}</h3>
                                                <p><strong>Phone:</strong> {v.phone || 'N/A'}</p>
                                                
                                                <div className="volunteer-actions">
                                                    <a href={waLink} target="_blank" rel="noreferrer" className="btn-contact">WhatsApp</a>
                                                    {v.status === 'pending' && (
                                                        <button onClick={() => approveVolunteer(v._id)} className="btn-approve">Approve</button>
                                                    )}
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </main>
        </div>
    )
}
