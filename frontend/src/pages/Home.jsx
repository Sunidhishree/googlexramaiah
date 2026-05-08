import React, { useEffect, useRef } from 'react'
import { auth } from '../firebase'
import { signOut } from 'firebase/auth'

const homeHtml = `
<!-- Floating bg leaves -->
<div class="falling-leaf" style="left:8%;font-size:28px;animation-duration:12s;animation-delay:0s">🍂</div>
<div class="falling-leaf" style="left:25%;font-size:18px;animation-duration:16s;animation-delay:3s">🍃</div>
<div class="falling-leaf" style="left:60%;font-size:22px;animation-duration:14s;animation-delay:6s">🍂</div>
<div class="falling-leaf" style="left:80%;font-size:16px;animation-duration:18s;animation-delay:9s">🍃</div>
<div class="falling-leaf" style="left:44%;font-size:20px;animation-duration:20s;animation-delay:2s">🍂</div>

<!-- NAV -->
<nav>
    <div class="logo">Ummeed<span>.</span></div>
    <ul>
        <li><a href="/how-it-works">How It Works</a></li>
        <li><a href="/programs">Programs</a></li>
        <li><a href="/stories">Stories</a></li>
        <li><a href="#volunteer">Volunteer</a></li>
        <li><a href="/donate" class="nav-cta">Donate Now</a></li>
        <li><a href="#" id="sign-out-link" style="color: var(--text-muted); margin-left: 1rem;">Sign Out</a></li>
    </ul>
</nav>

<!-- HERO -->
<section class="hero">
    <div class="hero-bg"></div>

    <!-- Decorative illustration -->
    <svg class="hero-leaves" viewBox="0 0 600 800" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <ellipse cx="400" cy="780" rx="380" ry="80" fill="#c8ddc0" opacity="0.5"/>
        <rect x="340" y="400" width="32" height="320" rx="12" fill="#8B6340"/>
        <path d="M356 500 Q290 430 220 400" stroke="#8B6340" stroke-width="14" fill="none" stroke-linecap="round"/>
        <path d="M356 450 Q430 370 500 340" stroke="#8B6340" stroke-width="12" fill="none" stroke-linecap="round"/>
        <path d="M356 520 Q300 510 260 480" stroke="#8B6340" stroke-width="10" fill="none" stroke-linecap="round"/>
        <circle cx="340" cy="350" r="110" fill="#5d8a5e" opacity="0.9"/>
        <circle cx="270" cy="380" r="80" fill="#6e9e6e" opacity="0.85"/>
        <circle cx="420" cy="310" r="90" fill="#7aae7a" opacity="0.8"/>
        <circle cx="310" cy="300" r="70" fill="#8dc88d" opacity="0.75"/>
        <circle cx="390" cy="380" r="65" fill="#5d8a5e" opacity="0.85"/>
        <circle cx="220" cy="360" r="55" fill="#7aae7a" opacity="0.7"/>
        <circle cx="460" cy="360" r="60" fill="#6e9e6e" opacity="0.7"/>
        <circle cx="230" cy="710" r="8" fill="#e8b4a0"/>
        <circle cx="250" cy="700" r="6" fill="#c4714a"/>
        <circle cx="300" cy="715" r="7" fill="#d4a24a"/>
        <circle cx="380" cy="705" r="9" fill="#e8b4a0"/>
        <circle cx="420" cy="718" r="6" fill="#c4714a"/>
        <circle cx="460" cy="710" r="8" fill="#d4a24a"/>
        <circle cx="500" cy="703" r="7" fill="#e8b4a0"/>
        <g opacity="0.6">
            <path d="M200 750 Q195 720 205 700" stroke="#5d8a5e" stroke-width="3" fill="none"/>
            <path d="M215 755 Q220 725 210 705" stroke="#5d8a5e" stroke-width="3" fill="none"/>
            <path d="M350 745 Q345 715 355 695" stroke="#5d8a5e" stroke-width="3" fill="none"/>
            <path d="M450 748 Q455 718 445 698" stroke="#5d8a5e" stroke-width="3" fill="none"/>
            <path d="M520 750 Q515 720 525 700" stroke="#5d8a5e" stroke-width="3" fill="none"/>
        </g>
        <path d="M150 200 Q160 190 170 200 Q180 190 190 200" stroke="#5a4a38" stroke-width="2.5" fill="none" stroke-linecap="round" opacity="0.5"/>
        <path d="M490 150 Q500 140 510 150 Q520 140 530 150" stroke="#5a4a38" stroke-width="2" fill="none" stroke-linecap="round" opacity="0.4"/>
        <g class="floating-leaf" style="animation-delay:0s">
            <ellipse cx="140" cy="500" rx="18" ry="10" fill="#c4714a" opacity="0.6" transform="rotate(-30 140 500)"/>
        </g>
        <g class="floating-leaf" style="animation-delay:2s">
            <ellipse cx="520" cy="600" rx="14" ry="8" fill="#d4a24a" opacity="0.55" transform="rotate(20 520 600)"/>
        </g>
        <g class="floating-leaf" style="animation-delay:1s">
            <ellipse cx="100" cy="650" rx="16" ry="9" fill="#c4714a" opacity="0.5" transform="rotate(-15 100 650)"/>
        </g>
        <circle cx="290" cy="730" r="14" fill="#f5c4a0"/>
        <path d="M290 744 Q282 770 276 785" stroke="#c4714a" stroke-width="6" stroke-linecap="round" fill="none"/>
        <path d="M290 744 Q298 770 304 785" stroke="#c4714a" stroke-width="6" stroke-linecap="round" fill="none"/>
        <rect x="272" y="760" width="28" height="18" rx="3" fill="#7a9e7e"/>
        <line x1="286" y1="760" x2="286" y2="778" stroke="white" stroke-width="1.5"/>
    </svg>

    <div class="hero-content">
        <div class="hero-tag">🌿 Welfare &amp; Community Care</div>
        <h1>Spreading <em>hope</em> to those who need it most</h1>
        <p>Ummeed connects welfare centers, volunteers, and communities — bringing food, shelter, education, and healing to vulnerable hearts across India.</p>
        <div class="hero-btns">
            <a href="/donate" class="btn-primary">💛 Donate Today</a>
            <a href="/programs" class="btn-secondary">Explore Programs</a>
        </div>
    </div>
</section>

<!-- STATS -->
<div class="hero-stats">
    <div class="stat">
        <div class="stat-num">12,400+</div>
        <div class="stat-label">Lives Touched</div>
    </div>
    <div class="stat">
        <div class="stat-num">87</div>
        <div class="stat-label">Welfare Centers</div>
    </div>
    <div class="stat">
        <div class="stat-num">340+</div>
        <div class="stat-label">Active Volunteers</div>
    </div>
    <div class="stat">
        <div class="stat-num">18</div>
        <div class="stat-label">Cities Covered</div>
    </div>
</div>

<!-- MEADOW DIVIDER -->
<div class="meadow-divider">
    <svg viewBox="0 0 1440 90" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
        <path d="M0,40 Q180,80 360,40 Q540,0 720,40 Q900,80 1080,40 Q1260,0 1440,40 L1440,90 L0,90 Z" fill="#eef5ef"/>
        <circle cx="100" cy="55" r="5" fill="#e8b4a0"/>
        <circle cx="360" cy="40" r="4" fill="#d4a24a"/>
        <circle cx="620" cy="55" r="5" fill="#e8b4a0"/>
        <circle cx="860" cy="38" r="4" fill="#c4714a"/>
        <circle cx="1100" cy="50" r="5" fill="#d4a24a"/>
        <circle cx="1340" cy="38" r="4" fill="#e8b4a0"/>
    </svg>
</div>

<!-- HOW IT WORKS -->
<section class="section-how" id="how">
    <div class="section-tag">The Journey</div>
    <h2 class="section-title">See how Ummeed works</h2>
    <p class="section-sub">A simple four-step pathway that ensures every rupee and every hour of care reaches the people who truly need it.</p>

    <div class="steps-grid">
        <div class="step-card">
            <div class="step-num">01</div>
            <div class="step-icon" style="background:#fef0e7;">🏘️</div>
            <h3>Centers Register</h3>
            <p>Local welfare centers, shelters, and NGOs join our platform and share real-time needs — from food and medicines to volunteers.</p>
        </div>
        <div class="step-card">
            <div class="step-num">02</div>
            <div class="step-icon" style="background:#eef5ee;">🙋</div>
            <h3>Volunteers Connect</h3>
            <p>Caring individuals sign up, browse nearby centers, and commit time or skills — teaching, cooking, counseling, or simply being there.</p>
        </div>
        <div class="step-card">
            <div class="step-num">03</div>
            <div class="step-icon" style="background:#fff5e6;">💛</div>
            <h3>Donors Give</h3>
            <p>Transparent donations go directly to verified programs — food drives, school kits, medical camps, and mental health support.</p>
        </div>
        <div class="step-card">
            <div class="step-num">04</div>
            <div class="step-icon" style="background:#fce8e8;">🌱</div>
            <h3>Lives Transform</h3>
            <p>Families receive care. Children go to school. Elders find dignity. Every story of change is shared back with the community.</p>
        </div>
    </div>
</section>

<div style="overflow:hidden;line-height:0;background:#eef5ef;margin-bottom:-2px;">
    <svg viewBox="0 0 1440 70" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
        <path d="M0,30 Q360,70 720,30 Q1080,0 1440,30 L1440,0 L0,0 Z" fill="#fdf6ec"/>
    </svg>
</div>

<section style="padding: 7rem 5%;" id="volunteer">
    <div class="section-story" style="padding:0;">
        <div class="story-img-area">
            <div class="story-illustration">
                <svg viewBox="0 0 320 400" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
                    <rect width="320" height="400" fill="#e8f0e8"/>
                    <rect width="320" height="200" fill="#d4e8d4"/>
                    <circle cx="260" cy="60" r="35" fill="#fce8a0" opacity="0.8"/>
                    <circle cx="260" cy="60" r="25" fill="#fad84a" opacity="0.6"/>
                    <ellipse cx="80" cy="80" rx="50" ry="22" fill="white" opacity="0.75"/>
                    <ellipse cx="110" cy="72" rx="35" ry="20" fill="white" opacity="0.75"/>
                    <ellipse cx="50" cy="76" rx="32" ry="18" fill="white" opacity="0.7"/>
                    <ellipse cx="60" cy="250" rx="130" ry="80" fill="#8dc88d" opacity="0.8"/>
                    <ellipse cx="280" cy="270" rx="120" ry="70" fill="#7aae7a" opacity="0.75"/>
                    <rect y="300" width="320" height="100" fill="#a8c8a0"/>
                    <rect x="110" y="180" width="100" height="80" rx="4" fill="#c4714a"/>
                    <polygon points="100,185 160,140 220,185" fill="#8B3a1a"/>
                    <rect x="140" y="215" width="28" height="45" rx="4" fill="#5a2a10"/>
                    <rect x="120" y="198" width="22" height="20" rx="3" fill="#fce8a0"/>
                    <rect x="180" y="198" width="22" height="20" rx="3" fill="#fce8a0"/>
                    <rect x="138" y="213" width="32" height="47" rx="5" fill="#7B4a25" opacity="0.3"/>
                    <rect x="60" y="240" width="8" height="55" fill="#8B6340"/>
                    <circle cx="64" cy="228" r="26" fill="#5d8a5e"/>
                    <circle cx="52" cy="238" r="18" fill="#6e9e6e"/>
                    <circle cx="76" cy="235" r="16" fill="#7aae7a"/>
                    <circle cx="245" cy="300" r="12" fill="#f5c4a0"/>
                    <rect x="238" y="312" width="14" height="35" rx="6" fill="#c4714a"/>
                    <circle cx="225" cy="308" r="9" fill="#f5c4a0"/>
                    <rect x="220" y="317" width="10" height="26" rx="5" fill="#7a9e7e"/>
                    <path d="M232 325 L238 325" stroke="#f5c4a0" stroke-width="3" stroke-linecap="round"/>
                    <circle cx="30" cy="360" r="6" fill="#e8b4a0"/>
                    <circle cx="55" cy="355" r="5" fill="#d4a24a"/>
                    <circle cx="290" cy="360" r="6" fill="#e8b4a0"/>
                    <circle cx="310" cy="352" r="5" fill="#c4714a"/>
                    <path d="M160 90 C160 90 148 80 148 70 C148 62 155 56 160 60 C165 56 172 62 172 70 C172 80 160 90 160 90Z" fill="#e8a0a0" opacity="0.8"/>
                </svg>

                <div class="story-bubble top-right">
                    <div class="dot" style="background:#5d8a5e;"></div>
                    340 volunteers active
                </div>
                <div class="story-bubble bottom-left">
                    <div class="dot" style="background:#c4714a;"></div>
                    💛 127 meals served today
                </div>
            </div>
        </div>

        <div class="story-content">
            <div class="section-tag">Your Role Matters</div>
            <h2>Be a part of <em>healing stories</em></h2>
            <p>Every welfare center has a story waiting to be completed. You are the missing chapter — the volunteer, the donor, the friend who showed up.</p>
            <p>Ummeed makes it easy to find a center near you, understand real needs, and take meaningful action today.</p>

            <ul class="feature-list">
                <li>Match with welfare centers based on your city and skills</li>
                <li>Donate to specific verified programs — no middlemen</li>
                <li>Track exactly how your contribution helps</li>
                <li>Join community events: food camps, blood drives, skill workshops</li>
                <li>Receive updates and photo stories from the field</li>
            </ul>

            <a href="#volunteer" class="btn-primary">Start Volunteering →</a>
        </div>
    </div>
</section>

<div class="cta-banner" id="donate">
    <div class="cta-text">
        <h2>Every act of kindness <br>plants a seed of hope 🌱</h2>
        <p>Whether you give ₹100 or 1 hour a week — you become part of a story of change that ripples across communities.</p>
    </div>
    <div class="cta-actions">
        <a href="/donate" class="btn-white">Donate Now</a>
        <a href="#" class="btn-outline-white">Volunteer Today</a>
    </div>
</div>

<footer>
    <div class="footer-grid">
        <div class="footer-brand">
            <div class="logo">Ummeed<span>.</span></div>
            <p>Ummeed means hope. We exist to carry that hope to welfare centers, shelter homes, and vulnerable communities across India — one act of care at a time.</p>
            <div style="display:flex;gap:0.8rem;">
                <a href="#" style="color:rgba(255,255,255,0.5);font-size:1.2rem;text-decoration:none;transition:color 0.3s;" onmouseover="this.style.color='#e8b4a0'" onmouseout="this.style.color='rgba(255,255,255,0.5)'">✦</a>
                <a href="#" style="color:rgba(255,255,255,0.5);font-size:1.2rem;text-decoration:none;transition:color 0.3s;" onmouseover="this.style.color='#e8b4a0'" onmouseout="this.style.color='rgba(255,255,255,0.5)'">✦</a>
                <a href="#" style="color:rgba(255,255,255,0.5);font-size:1.2rem;text-decoration:none;transition:color 0.3s;" onmouseover="this.style.color='#e8b4a0'" onmouseout="this.style.color='rgba(255,255,255,0.5)'">✦</a>
            </div>
        </div>

        <div class="footer-col">
            <h4>Programs</h4>
            <ul>
                <li><a href="/programs">Hunger Relief</a></li>
                <li><a href="/programs">Education</a></li>
                <li><a href="/programs">Healthcare</a></li>
                <li><a href="/programs">Mental Health</a></li>
                <li><a href="/programs">Shelter</a></li>
                <li><a href="/programs">Livelihood</a></li>
            </ul>
        </div>

        <div class="footer-col">
            <h4>Get Involved</h4>
            <ul>
                <li><a href="#">Volunteer</a></li>
                <li><a href="#">Donate</a></li>
                <li><a href="#">Partner Centers</a></li>
                <li><a href="#">Corporate CSR</a></li>
                <li><a href="#">Fundraise</a></li>
            </ul>
        </div>

        <div class="footer-col">
            <h4>Organisation</h4>
            <ul>
                <li><a href="#">About Us</a></li>
                <li><a href="#">Our Team</a></li>
                <li><a href="#">Impact Reports</a></li>
                <li><a href="#">Press</a></li>
                <li><a href="#">Contact</a></li>
            </ul>
        </div>
    </div>

    <div class="footer-bottom">
        <p>© 2025 Ummeed Welfare Initiative. All rights reserved.</p>
        <div class="made-by">
            Made with 💛 at
            <a href="#">Google</a>
            <span class="divider-dot">×</span>
            <a href="#">DeepStation</a>
            <span class="divider-dot">×</span>
            <a href="#">Ramaiah</a>
        </div>
    </div>
</footer>
`

export default function Home() {
    const ref = useRef(null)

    useEffect(() => {
        const el = ref.current
        if (!el) return

        el.querySelectorAll('a[href^="#"]').forEach(a => {
            a.addEventListener('click', e => {
                if (a.id === 'sign-out-link') return; // Handled separately
                const href = a.getAttribute('href')
                const target = el.querySelector(href)
                if (target) { e.preventDefault(); target.scrollIntoView({ behavior: 'smooth' }) }
            })
        })

        const signOutLink = el.querySelector('#sign-out-link')
        if (signOutLink) {
            signOutLink.addEventListener('click', async (e) => {
                e.preventDefault()
                try {
                    await signOut(auth)
                    window.location.href = '/'
                } catch (error) {
                    console.error('Sign out error:', error)
                }
            })
        }

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.style.opacity = '1'
                    entry.target.style.transform = 'translateY(0)'
                    observer.unobserve(entry.target)
                }
            })
        }, { threshold: 0.15 })

        el.querySelectorAll('.step-card, .program-card, .testimonial-card').forEach(node => {
            node.style.opacity = '0'
            node.style.transform = 'translateY(24px)'
            node.style.transition = 'opacity 0.7s ease, transform 0.7s ease'
            observer.observe(node)
        })

        return () => observer.disconnect()
    }, [])

    return (
        <div ref={ref} dangerouslySetInnerHTML={{ __html: homeHtml }} />
    )
}