import React, { useState, useEffect, useCallback, useMemo } from 'react'

const defaultLocation = { label: 'MS Ramaiah, Bengaluru', lat: 13.0308, lng: 77.5651 }
const AMOUNTS = [100, 250, 500, 1000, 2500, 5000]

const classifyName = (name = '') => {
    const n = name.toLowerCase()
    if (/orphan|child|bal\s?mandir|balgram|children/.test(n)) return 'orphanage'
    if (/elder|old\s?age|senior|aged|vriddhashram/.test(n)) return 'elderly'
    if (/animal|pet|dog|cat|cow|gaushala|spca|shelter\s?animal/.test(n)) return 'animal'
    return 'welfare'
}

const catMeta = {
    orphanage: { color: '#c4714a', label: 'Orphanage' },
    elderly:   { color: '#d4a24a', label: 'Elderly Home' },
    animal:    { color: '#5d8a5e', label: 'Animal Shelter' },
    welfare:   { color: '#7a6eb0', label: 'Welfare Centre' },
}

const haversineKm = (a, b) => {
    const R = 6371, toR = v => (v * Math.PI) / 180
    const dLat = toR(b.lat - a.lat), dLng = toR(b.lng - a.lng)
    const x = Math.sin(dLat / 2) ** 2 + Math.cos(toR(a.lat)) * Math.cos(toR(b.lat)) * Math.sin(dLng / 2) ** 2
    return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x))
}

const loadRazorpayScript = () => new Promise((resolve) => {
    if (document.getElementById('razorpay-sdk')) { resolve(true); return }
    const s = document.createElement('script')
    s.id = 'razorpay-sdk'
    s.src = 'https://checkout.razorpay.com/v1/checkout.js'
    s.onload = () => resolve(true)
    s.onerror = () => resolve(false)
    document.body.appendChild(s)
})

export default function Donate() {
    const [location, setLocation] = useState(defaultLocation)
    const [centres, setCentres] = useState([])
    const [loading, setLoading] = useState(false)
    const [status, setStatus] = useState('Finding nearby centres you can support...')
    const [selected, setSelected] = useState(null)
    const [amount, setAmount] = useState(500)
    const [customAmt, setCustomAmt] = useState('')
    const [donorName, setDonorName] = useState('')
    const [donorEmail, setDonorEmail] = useState('')
    const [paymentDone, setPaymentDone] = useState(null)

    const sorted = useMemo(() =>
        centres.map(c => ({ ...c, distance: haversineKm(location, c) }))
            .filter(c => c.distance <= 50)
            .sort((a, b) => a.distance - b.distance),
    [centres, location])

    const fetchCentres = useCallback(async (loc) => {
        setLoading(true)
        const key = import.meta.env.VITE_SERPER_API_KEY
        if (!key) { setStatus('Search API key missing.'); setLoading(false); return }
        const queries = ['orphanages near me', 'old age homes near me', 'animal shelters near me', 'welfare centres NGO near me']
        try {
            const all = await Promise.all(queries.map(async (q) => {
                const r = await fetch('https://google.serper.dev/places', {
                    method: 'POST',
                    headers: { 'X-API-KEY': key, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ q, location: `${loc.lat},${loc.lng}`, gl: 'in', num: 10 }),
                })
                if (!r.ok) return []
                const d = await r.json()
                return (d.places || []).filter(p => p.latitude && p.longitude).map((p, i) => {
                    let cat = classifyName(p.title || '')
                    if (/orphan|child/i.test(q)) cat = 'orphanage'
                    else if (/elder|old age/i.test(q)) cat = 'elderly'
                    else if (/animal|pet/i.test(q)) cat = 'animal'
                    return {
                        id: p.cid || `s-${i}-${q.slice(0,4)}`,
                        name: p.title || `Centre ${i+1}`,
                        address: p.address || 'Local area',
                        lat: parseFloat(p.latitude),
                        lng: parseFloat(p.longitude),
                        category: cat,
                        rating: p.rating || null,
                        phone: p.phoneNumber || null,
                    }
                })
            }))
            const seen = new Set()
            const unique = all.flat().filter(c => { const k = c.name.toLowerCase().replace(/\s+/g,''); if (seen.has(k)) return false; seen.add(k); return true })
            setCentres(unique)
            const inRange = unique.filter(c => haversineKm(loc, c) <= 50)
            setStatus(inRange.length > 0 ? `${inRange.length} centres found nearby. Select one to donate.` : 'No centres found within 50 km.')
        } catch { setStatus('Failed to fetch centres. Please try again.') }
        setLoading(false)
    }, [])

    const handleLocate = useCallback(() => {
        if (!navigator.geolocation) { setStatus('Geolocation not supported.'); return }
        setStatus('Requesting your location...')
        navigator.geolocation.getCurrentPosition(
            (pos) => { const loc = { label: 'Your location', lat: pos.coords.latitude, lng: pos.coords.longitude }; setLocation(loc); fetchCentres(loc) },
            () => setStatus('Permission denied. Showing default area.'),
            { enableHighAccuracy: true, timeout: 10000 },
        )
    }, [fetchCentres])

    useEffect(() => { fetchCentres(defaultLocation) }, [])

    const handleDonate = useCallback(async () => {
        const finalAmt = customAmt ? parseInt(customAmt, 10) : amount
        if (!finalAmt || finalAmt < 1) { alert('Please enter a valid amount.'); return }
        if (!selected) { alert('Please select a centre first.'); return }

        const ok = await loadRazorpayScript()
        if (!ok) { alert('Payment gateway failed to load. Check your connection.'); return }

        const options = {
            key: import.meta.env.VITE_RAZORPAY_KEY_ID,
            amount: finalAmt * 100,
            currency: 'INR',
            name: 'Ummeed Welfare',
            description: `Donation to ${selected.name}`,
            image: '',
            handler: (response) => {
                setPaymentDone({
                    id: response.razorpay_payment_id,
                    centre: selected.name,
                    amount: finalAmt,
                })
                setSelected(null)
            },
            prefill: { name: donorName, email: donorEmail },
            notes: { centre_name: selected.name, centre_address: selected.address, category: selected.category },
            theme: { color: '#c4714a' },
            modal: { ondismiss: () => {} },
        }
        const rzp = new window.Razorpay(options)
        rzp.open()
    }, [selected, amount, customAmt, donorName, donorEmail])

    return (
        <div className="seva-page">
            <nav>
                <a href="/home" className="logo">Ummeed<span>.</span></a>
                <ul>
                    <li><a href="/home" className="nav-cta">Go Back to Home</a></li>
                </ul>
            </nav>

            <section className="seva-hero" style={{ minHeight: '45vh' }}>
                <div className="hero-bg"></div>
                <div className="hero-content seva-hero-content">
                    <div className="hero-tag">Support a Centre Near You</div>
                    <h1>Make a <em>donation</em> that matters</h1>
                    <p>Choose a nearby orphanage, elderly home, or shelter and donate directly. Every rupee reaches where it's needed.</p>
                    <div className="hero-btns">
                        <button className="btn-primary seva-location-btn" onClick={handleLocate} disabled={loading} style={{ border:'none', cursor: loading ? 'wait' : 'pointer' }}>
                            {loading ? 'Searching...' : 'Use My Location'}
                        </button>
                    </div>
                </div>
            </section>

            {/* SUCCESS BANNER */}
            {paymentDone && (
                <div className="donate-success">
                    <div className="donate-success-inner">
                        <div className="success-check">&#10003;</div>
                        <h3>Thank you for your generosity!</h3>
                        <p>Your donation of <strong>Rs. {paymentDone.amount}</strong> to <strong>{paymentDone.centre}</strong> was successful.</p>
                        <p className="payment-id">Payment ID: {paymentDone.id}</p>
                        <button className="btn-primary" onClick={() => setPaymentDone(null)} style={{ border:'none', cursor:'pointer', marginTop:'1rem' }}>Make Another Donation</button>
                    </div>
                </div>
            )}

            {/* MAIN CONTENT */}
            <section className="donate-section">
                <div className="donate-header">
                    <div className="section-tag">Nearby Centres &middot; 50 km</div>
                    <h2 className="section-title">Select a centre to support</h2>
                    <p className="seva-location-status">{status}</p>
                </div>

                <div className="donate-layout">
                    {/* LEFT: Centre list */}
                    <div className="donate-list">
                        {sorted.length === 0 && !loading && <div className="empty-state">No centres found. Try using your location.</div>}
                        {sorted.map((c, i) => {
                            const meta = catMeta[c.category] || catMeta.welfare
                            const isActive = selected?.id === c.id
                            return (
                                <button key={c.id}
                                    className={`donate-card ${isActive ? 'donate-card-active' : ''}`}
                                    onClick={() => setSelected(c)}>
                                    <div className="donate-card-rank" style={{ background: meta.color }}>{i + 1}</div>
                                    <div className="donate-card-info">
                                        <strong>{c.name}</strong>
                                        <small>{c.address}</small>
                                        <span className="donate-card-meta">
                                            <b className="cat-badge" style={{ background: meta.color + '18', color: meta.color }}>{meta.label}</b>
                                            <b className="map-source">{c.distance?.toFixed(1)} km</b>
                                            {c.rating && <b className="map-source">Rating {c.rating}</b>}
                                        </span>
                                    </div>
                                    {isActive && <span className="donate-card-check">&#10003;</span>}
                                </button>
                            )
                        })}
                    </div>

                    {/* RIGHT: Donation form */}
                    <div className="donate-form-panel">
                        <div className="donate-form-card">
                            <h3>Donation Details</h3>

                            {selected ? (
                                <div className="donate-selected-centre">
                                    <div className="donate-selected-dot" style={{ background: (catMeta[selected.category] || catMeta.welfare).color }}></div>
                                    <div>
                                        <strong>{selected.name}</strong>
                                        <small>{selected.address}</small>
                                    </div>
                                </div>
                            ) : (
                                <p className="donate-prompt">Select a centre from the list to begin.</p>
                            )}

                            <label className="donate-label">Your Name</label>
                            <input className="donate-input" type="text" placeholder="Enter your name" value={donorName} onChange={e => setDonorName(e.target.value)} />

                            <label className="donate-label">Email</label>
                            <input className="donate-input" type="email" placeholder="your@email.com" value={donorEmail} onChange={e => setDonorEmail(e.target.value)} />

                            <label className="donate-label">Select Amount</label>
                            <div className="donate-amounts">
                                {AMOUNTS.map(a => (
                                    <button key={a}
                                        className={`donate-amt-btn ${amount === a && !customAmt ? 'active' : ''}`}
                                        onClick={() => { setAmount(a); setCustomAmt('') }}>
                                        Rs. {a}
                                    </button>
                                ))}
                            </div>

                            <label className="donate-label">Or enter custom amount</label>
                            <input className="donate-input" type="number" min="1" placeholder="Custom amount in Rs." value={customAmt}
                                onChange={e => { setCustomAmt(e.target.value); setAmount(0) }} />

                            <button className="donate-pay-btn" onClick={handleDonate} disabled={!selected}>
                                {selected ? `Donate Rs. ${customAmt || amount} to ${selected.name.slice(0,25)}` : 'Select a centre first'}
                            </button>

                            <p className="donate-secure">Secured by Razorpay. Your payment info is never stored.</p>
                        </div>
                    </div>
                </div>
            </section>

            <footer>
                <div className="footer-grid">
                    <div className="footer-brand"><div className="logo">Ummeed<span>.</span></div><p>Connecting communities with care centres across India.</p></div>
                    <div className="footer-col"><h4>Programs</h4><ul><li><a href="/programs">Hunger Relief</a></li><li><a href="/programs">Education</a></li><li><a href="/programs">Healthcare</a></li></ul></div>
                    <div className="footer-col"><h4>Get Involved</h4><ul><li><a href="/home#volunteer">Volunteer</a></li><li><a href="/donate">Donate</a></li><li><a href="/home">Partner</a></li></ul></div>
                    <div className="footer-col"><h4>About</h4><ul><li><a href="/home">Our Team</a></li><li><a href="/stories">Impact Stories</a></li><li><a href="/home">Contact</a></li></ul></div>
                </div>
                <div className="footer-bottom"><p>&copy; 2025 Ummeed Welfare Initiative</p><div className="made-by">Made with care at <a href="#">Google</a> <span className="divider-dot">&times;</span> <a href="#">Ramaiah</a></div></div>
            </footer>
        </div>
    )
}
