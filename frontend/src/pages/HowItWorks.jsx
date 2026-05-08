import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

const defaultLocation = { label: 'MS Ramaiah, Bengaluru', lat: 13.0308, lng: 77.5651 }
const CATEGORIES = [
    { key: 'all', label: 'All', icon: '' },
    { key: 'orphanage', label: 'Orphanages', icon: '' },
    { key: 'elderly', label: 'Elderly Homes', icon: '' },
    { key: 'animal', label: 'Animal Shelters', icon: '' },
    { key: 'welfare', label: 'Welfare Centres', icon: '' },
]
const SEARCH_RADIUS = 50000
const MAX_KM = 50
const needLabels = ['Call to confirm current care gap','Open seva task pending verification','Volunteer visit can be requested','Donation needs require staff confirmation','Supplies needed — contact centre','Weekend volunteer slots open']

const haversineKm = (a, b) => {
    const R = 6371, toR = v => (v * Math.PI) / 180
    const dLat = toR(b.lat - a.lat), dLng = toR(b.lng - a.lng)
    const x = Math.sin(dLat / 2) ** 2 + Math.cos(toR(a.lat)) * Math.cos(toR(b.lat)) * Math.sin(dLng / 2) ** 2
    return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x))
}

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

const buildOQ = ({ lat, lng }) => `[out:json][timeout:30];(nwr["amenity"="social_facility"](around:${SEARCH_RADIUS},${lat},${lng});nwr["social_facility"](around:${SEARCH_RADIUS},${lat},${lng});nwr["social_facility:for"~"child|children|orphan|elderly|senior|aged",i](around:${SEARCH_RADIUS},${lat},${lng});nwr["name"~"orphan|child care|children.?s home|bal mandir|balgram|ashram|shelter home|old age|senior citizen|elder|vriddhashram",i](around:${SEARCH_RADIUS},${lat},${lng});nwr["amenity"="animal_shelter"](around:${SEARCH_RADIUS},${lat},${lng});nwr["amenity"="veterinary"](around:${SEARCH_RADIUS},${lat},${lng});nwr["name"~"animal shelter|gaushala|spca|pet shelter|animal rescue|dog shelter|cow shelter",i](around:${SEARCH_RADIUS},${lat},${lng});nwr["amenity"="nursing_home"](around:${SEARCH_RADIUS},${lat},${lng}););out center 60;`

const fmtOsm = (el, i) => {
    const lat = el.lat ?? el.center?.lat, lng = el.lon ?? el.center?.lon
    if (typeof lat !== 'number' || typeof lng !== 'number') return null
    const t = el.tags || {}, name = t.name || t.official_name || `Care facility ${i + 1}`
    return { name, lat, lng, area: t['addr:suburb'] || t['addr:neighbourhood'] || t['addr:city'] || t['addr:street'] || 'Nearby', need: needLabels[i % needLabels.length], priority: i < 3 ? 'High' : i < 7 ? 'Medium' : 'Low', category: classifyName(name), source: 'OpenStreetMap', id: `${el.type}-${el.id}`, phone: t.phone || t['contact:phone'] || null, website: t.website || t['contact:website'] || null, address: [t['addr:street'], t['addr:suburb'], t['addr:city']].filter(Boolean).join(', ') || null }
}

const fmtSerper = (p, i, query) => {
    if (!p.latitude || !p.longitude) return null
    const name = p.title || `Centre ${i + 1}`
    let cat = classifyName(name)
    if (query) { if (/orphan|child/i.test(query)) cat = 'orphanage'; else if (/elder|old age|senior/i.test(query)) cat = 'elderly'; else if (/animal|pet|dog|cat|cow/i.test(query)) cat = 'animal'; else if (/welfare|ngo|social/i.test(query)) cat = 'welfare' }
    return { name, lat: parseFloat(p.latitude), lng: parseFloat(p.longitude), area: p.address || 'Local area', need: needLabels[i % needLabels.length], priority: i < 3 ? 'High' : i < 7 ? 'Medium' : 'Low', category: cat, source: 'Google', id: p.cid || `serper-${i}`, phone: p.phoneNumber || null, website: p.website || null, rating: p.rating || null, address: p.address || null }
}

const makeIcon = (color, label) => L.divIcon({
    html: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="42" viewBox="0 0 32 42"><path d="M16 0C7.16 0 0 7.16 0 16c0 12 16 26 16 26s16-14 16-26C32 7.16 24.84 0 16 0z" fill="${color}" stroke="#fff" stroke-width="2"/><text x="16" y="20" text-anchor="middle" fill="#fff" font-size="13" font-weight="bold" font-family="Inter,sans-serif">${label}</text></svg>`,
    className: 'leaflet-marker-custom', iconSize: [32, 42], iconAnchor: [16, 42], popupAnchor: [0, -36],
})

const userIcon = L.divIcon({
    html: `<div style="width:22px;height:22px;border-radius:50%;background:#204155;border:3px solid #fff;box-shadow:0 2px 10px rgba(0,0,0,0.35)"></div>`,
    className: 'leaflet-marker-custom', iconSize: [22, 22], iconAnchor: [11, 11],
})

const HowItWorks = () => {
    const [location, setLocation] = useState(defaultLocation)
    const [status, setStatus] = useState('Click "Use My Location" to find centres within 50 km.')
    const [centers, setCenters] = useState([])
    const [activeId, setActiveId] = useState(null)
    const [expandedId, setExpandedId] = useState(null)
    const [loading, setLoading] = useState(false)
    const [isLive, setIsLive] = useState(false)
    const [filter, setFilter] = useState('all')

    const mapEl = useRef(null), leafletMap = useRef(null), markersLayer = useRef(null), markersMap = useRef({})

    const visible = useMemo(() => {
        const list = centers.map(c => ({ ...c, distance: haversineKm(location, c) })).filter(c => c.distance <= MAX_KM).sort((a, b) => a.distance - b.distance)
        return filter === 'all' ? list : list.filter(c => c.category === filter)
    }, [centers, location, filter])

    const counts = useMemo(() => {
        const all = centers.filter(c => haversineKm(location, c) <= MAX_KM)
        const m = { all: all.length, orphanage: 0, elderly: 0, animal: 0, welfare: 0 }
        all.forEach(c => { if (m[c.category] !== undefined) m[c.category]++ })
        return m
    }, [centers, location])

    useEffect(() => {
        if (!mapEl.current || leafletMap.current) return
        leafletMap.current = L.map(mapEl.current, { center: [location.lat, location.lng], zoom: 11, zoomControl: true })
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap', maxZoom: 19 }).addTo(leafletMap.current)
        markersLayer.current = L.layerGroup().addTo(leafletMap.current)
    }, [])

    useEffect(() => {
        if (!leafletMap.current || !markersLayer.current) return
        markersLayer.current.clearLayers(); markersMap.current = {}
        L.marker([location.lat, location.lng], { icon: userIcon }).bindPopup(`<strong>${location.label}</strong>`).addTo(markersLayer.current)
        visible.forEach((c, i) => {
            const meta = catMeta[c.category] || catMeta.welfare
            const mk = L.marker([c.lat, c.lng], { icon: makeIcon(activeId === c.id ? '#204155' : meta.color, String(i + 1)) })
                .bindPopup(`<div style="font-family:Inter,sans-serif;min-width:200px"><strong style="font-size:14px">${c.name}</strong><br/><small style="color:#8a7a66">${c.area}</small><br/><span style="color:#c4714a;font-size:12px">${c.need}</span>${c.phone ? `<br/><span style="font-size:12px">Phone: ${c.phone}</span>` : ''}${c.rating ? `<br/><span style="font-size:12px">Rating: ${c.rating}/5</span>` : ''}</div>`)
            mk.on('click', () => { setActiveId(c.id); setExpandedId(c.id) })
            mk.addTo(markersLayer.current); markersMap.current[c.id] = mk
        })
        const pts = [[location.lat, location.lng], ...visible.map(c => [c.lat, c.lng])]
        if (pts.length > 1) leafletMap.current.fitBounds(L.latLngBounds(pts), { padding: [40, 40] })
        else leafletMap.current.setView([location.lat, location.lng], 11)
    }, [location, visible, activeId])

    const handleCardClick = useCallback((c) => {
        setActiveId(c.id); setExpandedId(prev => prev === c.id ? null : c.id)
        if (leafletMap.current) { leafletMap.current.flyTo([c.lat, c.lng], 16, { duration: 0.8 }); const mk = markersMap.current[c.id]; if (mk) setTimeout(() => mk.openPopup(), 850) }
    }, [])

    const fetchSerper = useCallback(async (loc) => {
        const key = import.meta.env.VITE_SERPER_API_KEY; if (!key) return null
        const queries = ['orphanages near me', 'old age homes near me', 'animal shelters near me', 'welfare centres NGO near me']
        try {
            const all = await Promise.all(queries.map(async (q) => {
                const r = await fetch('https://google.serper.dev/places', { method: 'POST', headers: { 'X-API-KEY': key, 'Content-Type': 'application/json' }, body: JSON.stringify({ q, location: `${loc.lat},${loc.lng}`, gl: 'in', num: 10 }) })
                if (!r.ok) return []; const d = await r.json(); return (d.places || []).map((p, i) => fmtSerper(p, i, q)).filter(Boolean)
            }))
            const seen = new Set(); return all.flat().filter(c => { const k = c.name.toLowerCase().replace(/\s+/g, ''); if (seen.has(k)) return false; seen.add(k); return true })
        } catch { return null }
    }, [])

    const fetchOsm = useCallback(async (loc) => {
        try { const r = await fetch('https://overpass-api.de/api/interpreter', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' }, body: new URLSearchParams({ data: buildOQ(loc) }) }); if (!r.ok) throw 0; const d = await r.json(); return (d.elements || []).map(fmtOsm).filter(Boolean).slice(0, 30) } catch { return null }
    }, [])

    const loadCenters = useCallback(async (loc) => {
        setLoading(true); setIsLive(false); setStatus('Searching within 50 km...')
        const serper = await fetchSerper(loc)
        if (serper?.length > 0) { const n = serper.filter(c => haversineKm(loc, c) <= MAX_KM); setCenters(serper); setActiveId(n[0]?.id || null); setIsLive(true); setStatus(`Found ${n.length} centres within 50 km.`); setLoading(false); return }
        const osm = await fetchOsm(loc)
        if (osm?.length > 0) { const n = osm.filter(c => haversineKm(loc, c) <= MAX_KM); setCenters(osm); setActiveId(n[0]?.id || null); setIsLive(true); setStatus(`Found ${n.length} results from OpenStreetMap within 50 km.`) }
        else { setCenters([]); setActiveId(null); setStatus('No centres found within 50 km.') }
        setLoading(false)
    }, [fetchSerper, fetchOsm])

    const handleUseLocation = useCallback(() => {
        if (!navigator.geolocation) { setStatus('Geolocation not supported.'); return }
        setStatus('Requesting your location...')
        navigator.geolocation.getCurrentPosition(
            (pos) => { const loc = { label: 'Your current location', lat: pos.coords.latitude, lng: pos.coords.longitude }; setLocation(loc); loadCenters(loc) },
            () => setStatus('Location permission denied. Showing default area.'),
            { enableHighAccuracy: true, timeout: 10000 },
        )
    }, [loadCenters])

    useEffect(() => { loadCenters(defaultLocation) }, [])
    useEffect(() => { if (!activeId) return; const el = document.getElementById(`card-${activeId}`); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' }) }, [activeId])

    return (
        <div className="seva-page">
            <nav>
                <a href="/home" className="logo">Ummeed<span>.</span></a>
                <ul>
                    <li><a href="/home" className="nav-cta">Go Back to Home</a></li>
                </ul>
            </nav>

            <section className="seva-hero">
                <div className="hero-bg"></div>
                <div className="hero-content seva-hero-content">
                    <div className="hero-tag">VAAYA Seva Track</div>
                    <h1>Find <em>care centres</em> near you</h1>
                    <p>Discover orphanages, elderly homes, animal shelters, and welfare centres within 50 km. Enable location for live results.</p>
                    <div className="hero-btns">
                        <button className="btn-primary seva-location-btn" onClick={handleUseLocation} disabled={loading} style={{ border: 'none', cursor: loading ? 'wait' : 'pointer' }}>
                            {loading ? 'Searching...' : 'Use My Location'}
                        </button>
                        <a href="#nearby-map" className="btn-secondary">See Map</a>
                    </div>
                </div>
            </section>

            <div className="hero-stats seva-stats">
                {CATEGORIES.slice(1).map(c => (
                    <div className="stat" key={c.key}><div className="stat-num">{counts[c.key]}</div><div className="stat-label">{c.label}</div></div>
                ))}
                <div className="stat"><div className="stat-num">{counts.all}</div><div className="stat-label">TotalFound</div></div>
            </div>

            <section className="seva-map-section" id="nearby-map">
                <div className="seva-map-header">
                    <div>
                        <div className="section-tag">Nearby Centres &middot; 50 km radius</div>
                        <h2 className="section-title">Care centres around you</h2>
                        <p className="seva-location-status">{status}</p>
                    </div>
                    <button className="btn-primary seva-location-btn-sm" onClick={handleUseLocation} disabled={loading} style={{ border: 'none', cursor: loading ? 'wait' : 'pointer' }}>
                        {loading ? 'Searching...' : 'Locate Me'}
                    </button>
                </div>

                <div className="seva-filters">
                    {CATEGORIES.map(c => (
                        <button key={c.key} className={`seva-pill ${filter === c.key ? 'active' : ''}`} onClick={() => setFilter(c.key)}>
                            {c.label} <span className="pill-count">{counts[c.key]}</span>
                        </button>
                    ))}
                </div>

                <div className="seva-map-layout">
                    <div className="seva-map" ref={mapEl}></div>
                    <div className="seva-map-list">
                        <div className="map-list-heading">
                            <span className={isLive ? 'live-dot' : 'default-dot'}>{isLive ? 'Live results' : 'Default area'} &middot; within 50 km</span>
                            <strong>{location.label}</strong>
                        </div>
                        {visible.length === 0 && !loading && <div className="empty-state">No centres found for this filter.</div>}
                        {visible.map((c, i) => {
                            const meta = catMeta[c.category] || catMeta.welfare
                            const isExp = expandedId === c.id
                            return (
                                <div key={c.id} id={`card-${c.id}`} className={`card-wrapper ${activeId === c.id ? 'card-active' : ''}`}>
                                    <button className={`orphanage-row ${activeId === c.id ? 'active' : ''}`} onClick={() => handleCardClick(c)}>
                                        <span className="orphanage-rank" style={{ background: meta.color }}>{i + 1}</span>
                                        <span className="orphanage-info">
                                            <strong>{c.name}</strong>
                                            <small>{c.area} — {c.distance?.toFixed(1)} km</small>
                                            <em>{c.need}</em>
                                            <span className="row-meta">
                                                <b className="cat-badge" style={{ background: meta.color + '18', color: meta.color }}>{meta.label}</b>
                                                {c.source && <b className="map-source">{c.source}</b>}
                                                {c.rating && <b className="map-source">Rating {c.rating}</b>}
                                            </span>
                                        </span>
                                        <span className="card-right">
                                            <i className={`priority priority-${c.priority.toLowerCase()}`}>{c.priority}</i>
                                            <span className={`expand-arrow ${isExp ? 'open' : ''}`}>&#9662;</span>
                                        </span>
                                    </button>
                                    {isExp && (
                                        <div className="card-details">
                                            <div className="detail-grid">
                                                {c.address && <div className="detail-item"><div className="detail-icon-box">A</div><div className="detail-body"><span className="detail-label">Address</span><span className="detail-value">{c.address}</span></div></div>}
                                                {c.phone && <div className="detail-item"><div className="detail-icon-box">P</div><div className="detail-body"><span className="detail-label">Phone</span><a href={`tel:${c.phone}`} className="detail-value detail-link">{c.phone}</a></div></div>}
                                                {c.website && <div className="detail-item"><div className="detail-icon-box">W</div><div className="detail-body"><span className="detail-label">Website</span><a href={c.website} target="_blank" rel="noreferrer" className="detail-value detail-link">{c.website.replace(/^https?:\/\//, '').slice(0, 40)}</a></div></div>}
                                                {c.rating && <div className="detail-item"><div className="detail-icon-box">R</div><div className="detail-body"><span className="detail-label">Rating</span><span className="detail-value">{c.rating} / 5</span></div></div>}
                                                <div className="detail-item"><div className="detail-icon-box">D</div><div className="detail-body"><span className="detail-label">Distance</span><span className="detail-value">{c.distance?.toFixed(1)} km away</span></div></div>
                                                <div className="detail-item"><div className="detail-icon-box" style={{ background: meta.color + '20', color: meta.color }}>C</div><div className="detail-body"><span className="detail-label">Category</span><span className="detail-value" style={{ textTransform: 'capitalize' }}>{c.category}</span></div></div>
                                            </div>
                                            <div className="detail-actions">
                                                <a href={`https://www.google.com/maps/dir/?api=1&destination=${c.lat},${c.lng}`} target="_blank" rel="noreferrer" className="detail-btn detail-btn-primary">Get Directions</a>
                                                {c.phone && <a href={`tel:${c.phone}`} className="detail-btn detail-btn-secondary">Call Now</a>}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                </div>
            </section>

            <section className="section-how" id="journey">
                <div className="section-tag">The Journey</div>
                <h2 className="section-title">How Ummeed connects you to care</h2>
                <p className="section-sub">Four simple steps to make verified, meaningful impact in your neighbourhood.</p>
                <div className="steps-grid">
                    <div className="step-card"><div className="step-num">01</div><div className="step-icon" style={{ background: '#fef0e7', color: '#c4714a', fontSize: '1.4rem', fontWeight: 700 }}>I</div><h3>Enable Location</h3><p>Allow location access so we can find care centres near you.</p></div>
                    <div className="step-card"><div className="step-num">02</div><div className="step-icon" style={{ background: '#eef5ee', color: '#5d8a5e', fontSize: '1.4rem', fontWeight: 700 }}>II</div><h3>Discover Needs</h3><p>Browse real-time results. See what each centre needs most.</p></div>
                    <div className="step-card"><div className="step-num">03</div><div className="step-icon" style={{ background: '#fff5e6', color: '#d4a24a', fontSize: '1.4rem', fontWeight: 700 }}>III</div><h3>Take Action</h3><p>Volunteer, donate, or visit. Every act counts.</p></div>
                    <div className="step-card"><div className="step-num">04</div><div className="step-icon" style={{ background: '#fce8e8', color: '#b84a25', fontSize: '1.4rem', fontWeight: 700 }}>IV</div><h3>Verified Impact</h3><p>AI verification ensures every contribution is tracked.</p></div>
                </div>
            </section>

            <footer>
                <div className="footer-grid">
                    <div className="footer-brand"><div className="logo">Ummeed<span>.</span></div><p>Connecting communities with care centres across India.</p></div>
                    <div className="footer-col"><h4>Programs</h4><ul><li><a href="/programs">Hunger Relief</a></li><li><a href="/programs">Education</a></li><li><a href="/programs">Healthcare</a></li></ul></div>
                    <div className="footer-col"><h4>Get Involved</h4><ul><li><a href="/home#volunteer">Volunteer</a></li><li><a href="/home#donate">Donate</a></li><li><a href="/home#partner">Partner</a></li></ul></div>
                    <div className="footer-col"><h4>About</h4><ul><li><a href="/home#team">Our Team</a></li><li><a href="/stories">Impact Stories</a></li><li><a href="/home#contact">Contact</a></li></ul></div>
                </div>
                <div className="footer-bottom"><p>&copy; 2025 Ummeed Welfare Initiative</p><div className="made-by">Made with care at <a href="#">Google</a> <span className="divider-dot">&times;</span> <a href="#">Ramaiah</a></div></div>
            </footer>
        </div>
    )
}

export default HowItWorks
