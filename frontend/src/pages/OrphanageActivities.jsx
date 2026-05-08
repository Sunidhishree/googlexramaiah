import React from 'react';
import '../styles.css';

export default function OrphanageActivities() {
    return (
        <div className="oa-page">
            <div className="oa-wrap">
                <div className="oa-hero">
                    <span className="section-tag">Orphanage Activities</span>
                    <h1>Turn compassion into action</h1>
                    <p>Orphanages are not invisible when you are on the front lines. Choose your quest, track your impact, and stay connected to children who need you most.</p>
                </div>

                <div className="oa-stats">
                    <div className="oa-stat">
                        <div className="val">2,481</div>
                        <div className="lbl">Wishes granted</div>
                    </div>
                    <div className="oa-stat">
                        <div className="val">1,340</div>
                        <div className="lbl">Hours volunteered this month</div>
                    </div>
                    <div className="oa-stat">
                        <div className="val">318</div>
                        <div className="lbl">Active heroes</div>
                    </div>
                </div>

                <div className="oa-cards">
                    <div className="oa-card">
                        <div className="oa-card-header">
                            <div className="oa-icon wish">🎁</div>
                            <div className="oa-card-title">
                                <h3>Wish Board</h3>
                                <div className="tagline wish">Grant a wish, change a life.</div>
                            </div>
                        </div>
                        <p>Real-time needs, directly from the source. Whether it is a textbook for a dreamer or new shoes for a runner, the Wish Board turns donating into fulfilling.</p>
                        <div className="oa-progress-wrap">
                            <div className="oa-progress-label">
                                <span>Community goal - weekly wishes</span>
                                <span>68%</span>
                            </div>
                            <div className="oa-progress-track">
                                <div className="oa-progress-fill" style={{ width: '68%' }}></div>
                            </div>
                        </div>
                        <div className="oa-quest-badge quest-badge wish">Grantor Quest - earn badge on completion</div>
                        <button className="oa-cta" onClick={() => alert('Tell me more about the Wish Board feature and how the Grantor Quest badge works.')}>
                            Browse the board
                        </button>
                    </div>

                    <div className="oa-card">
                        <div className="oa-card-header">
                            <div className="oa-icon sched">📅</div>
                            <div className="oa-card-title">
                                <h3>Volunteer Scheduler</h3>
                                <div className="tagline sched">Show up when it matters.</div>
                            </div>
                        </div>
                        <p>No more ghosting. Use our interactive calendar to book visit slots that fit your schedule. WhatsApp reminders handle logistics so you can focus on building relationships.</p>
                        <div className="oa-quest-badge quest-badge sched">Consistency Streak - become a Lead Mentor</div>
                        <button className="oa-cta" onClick={() => alert('How does the Volunteer Scheduler work and what is the Consistency Streak mechanic?')}>
                            Book a slot
                        </button>
                    </div>

                    <div className="oa-card">
                        <div className="oa-card-header">
                            <div className="oa-icon alert">⚡</div>
                            <div className="oa-card-title">
                                <h3>Urgent Alerts</h3>
                                <div className="tagline alert">Be the first responder.</div>
                            </div>
                        </div>
                        <p>Some needs are immediate. From sudden cold snaps to supply shortages, Urgent Alerts reach your device so you can help exactly when it is critical.</p>
                        <div className="oa-quest-badge quest-badge alert">Hero Points - respond within 24 hours</div>
                        <button className="oa-cta" onClick={() => alert('How do Urgent Alerts work and how are Hero Points calculated?')}>
                            Enable notifications
                        </button>
                    </div>
                </div>

                <hr className="oa-divider" />
                <p className="oa-why">"Invisibility ends where involvement begins. These activities are not just tasks - they are the bridge between a child's need and your ability to solve it."</p>
            </div>
        </div>
    );
}
