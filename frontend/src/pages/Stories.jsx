import React, { useState, useEffect } from 'react';
import './Stories.css';
import { auth } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';

const API_BASE = "http://localhost:5000";

export default function Stories() {
    const [user, setUser] = useState(null);
    const [stories, setStories] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
            fetchStories();
        });
        return () => unsubscribe();
    }, []);

    const fetchStories = async () => {
        try {
            const res = await fetch(`${API_BASE}/api/stories/feed`);
            if (res.ok) {
                const data = await res.json();
                setStories(data);
            }
        } catch (error) {
            console.error("Error fetching stories", error);
        } finally {
            setLoading(false);
        }
    };

    const handleLike = async (storyId) => {
        if (!user) {
            alert("Please login to like stories!");
            return;
        }

        // Optimistic update
        setStories(prev => prev.map(s => {
            if (s._id === storyId && !s.liked_by_me) {
                return { ...s, liked_by_me: true, likes: (s.likes || 0) + 1 };
            }
            return s;
        }));

        try {
            const res = await fetch(`${API_BASE}/api/stories/${storyId}/like`, {
                method: "POST"
            });
            if (!res.ok) {
                // Revert if failed
                setStories(prev => prev.map(s => {
                    if (s._id === storyId && s.liked_by_me) {
                        return { ...s, liked_by_me: false, likes: s.likes - 1 };
                    }
                    return s;
                }));
            }
        } catch (error) {
            console.error("Error liking story", error);
        }
    };

    if (loading) {
        return <div className="stories-page"><div className="loading">Loading Stories...</div></div>;
    }

    return (
        <div className="stories-page">
            <nav className="stories-nav">
                <a href="/home" className="nav-logo">Ummeed<span>.</span></a>
                <div className="nav-actions">
                    {user ? (
                        <span className="user-badge">Logged in as {user.email}</span>
                    ) : (
                        <a href="/login" className="btn-login-small">Login to interact</a>
                    )}
                </div>
            </nav>

            <main className="stories-main">
                <div className="stories-header">
                    <h2>Stories of Hope</h2>
                    <p>Real impact and moments shared by our partnered orphanages.</p>
                </div>

                <div className="stories-feed">
                    {stories.length === 0 ? (
                        <div className="empty-state">No stories found. Check back later!</div>
                    ) : (
                        stories.map(story => (
                            <div key={story._id} className="story-card">
                                <div className="story-org-header">
                                    <div className="org-avatar">{(story.org_name || "O")[0]}</div>
                                    <div className="org-info">
                                        <h3>{story.org_name || "Orphanage"}</h3>
                                        <span>{new Date(story.created_at).toLocaleDateString()}</span>
                                    </div>
                                </div>
                                
                                {story.photo && (
                                    <div className="story-image-container">
                                        <img src={story.photo} alt="Story visual" className="story-image" />
                                    </div>
                                )}
                                
                                <div className="story-content">
                                    <p>{story.caption}</p>
                                    {story.tags && <div className="story-tags">#{story.tags}</div>}
                                </div>

                                <div className="story-interactions">
                                    <button 
                                        className={`btn-like ${story.liked_by_me ? 'liked' : ''}`} 
                                        onClick={() => handleLike(story._id)}
                                        disabled={story.liked_by_me}
                                    >
                                        <span className="heart-icon">{story.liked_by_me ? '❤️' : '🤍'}</span>
                                        <span className="like-count">{story.likes || 0}</span>
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </main>
        </div>
    );
}
