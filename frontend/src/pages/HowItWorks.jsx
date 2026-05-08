import React, { useMemo, useState, useEffect, useRef } from 'react'

const defaultLocation = {
    label: 'MS Ramaiah, Bengaluru',
    lat: 13.0308,
    lng: 77.5651,
}

const sampleOrphanages = [
    {
        name: 'Snehadaan Children Home',
        area: 'Hebbal',
        lat: 13.0358,
        lng: 77.5899,
        need: 'Math mentor, 2 hours',
        priority: 'High',
        children: 42,
    },
    {
        name: 'Asha Kiran Shelter',
        area: 'Yeshwanthpur',
        lat: 13.0285,
        lng: 77.5402,
        need: 'Rice and dal kits',
        priority: 'Medium',
        children: 31,
    },
    {
        name: 'Balya Seva Nilaya',
        area: 'Malleswaram',
        lat: 13.0031,
        lng: 77.5643,
        need: 'School notebooks',
        priority: 'Medium',
        children: 56,
    },
    {
        name: 'Hope Nest Home',
        area: 'RT Nagar',
        lat: 13.0247,
        lng: 77.5944,
        need: 'Weekend science tutor',
        priority: 'High',
        children: 27,
    },
    {
        name: 'Udaya Child Care Trust',
        area: 'Rajajinagar',
        lat: 12.9915,
        lng: 77.5542,
        need: 'Hygiene kits',
        priority: 'Low',
        children: 38,
    },
]

const OVERPASS_ENDPOINT = 'https://overpass-api.de/api/interpreter'
const SEARCH_RADIUS_METERS = 15000
const liveNeedLabels = [
    'Call to confirm current care gap',
    'Open seva task pending verification',
    'Volunteer visit can be requested',
    'Donation needs require staff confirmation',
]

const buildOverpassQuery = ({ lat, lng }) => `
[out:json][timeout:25];
(
  nwr["amenity"="social_facility"](around:${SEARCH_RADIUS_METERS},${lat},${lng});
  nwr["social_facility"](around:${SEARCH_RADIUS_METERS},${lat},${lng});
  nwr["social_facility:for"~"child|children|orphan",i](around:${SEARCH_RADIUS_METERS},${lat},${lng});
  nwr["name"~"orphan|child care|children.?s home|bal mandir|balgram|ashram|shelter home",i](around:${SEARCH_RADIUS_METERS},${lat},${lng});
);
out center 40;
`

const getDistanceKm = (from, to) => {
    const toRad = (value) => (value * Math.PI) / 180
    const radiusKm = 6371
    const dLat = toRad(to.lat - from.lat)
    const dLng = toRad(to.lng - from.lng)
    const lat1 = toRad(from.lat)
    const lat2 = toRad(to.lat)
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
    return radiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

const getElementCoords = (element) => {
    const lat = element.lat ?? element.center?.lat
    const lng = element.lon ?? element.center?.lon

    if (typeof lat !== 'number' || typeof lng !== 'number') {
        return null
    }

    return { lat, lng }
}

const formatOsmCenter = (element, index) => {
    const coords = getElementCoords(element)

    if (!coords) {
        return null
    }

    const tags = element.tags || {}
    const area = tags['addr:suburb'] || tags['addr:neighbourhood'] || tags['addr:city'] || tags['addr:street'] || 'Nearby'

    return {
        name: tags.name || tags.official_name || `Mapped care facility ${index + 1}`,
        area,
        lat: coords.lat,
        lng: coords.lng,
        need: liveNeedLabels[index % liveNeedLabels.length],
        priority: index < 2 ? 'High' : index < 5 ? 'Medium' : 'Low',
        children: null,
        source: 'OpenStreetMap',
        osmId: `${element.type}-${element.id}`,
    }
}

const formatSerperCenter = (place, index) => {
    return {
        name: place.title || `Orphanage ${index + 1}`,
        area: place.address || 'Local area',
        lat: parseFloat(place.latitude),
        lng: parseFloat(place.longitude),
        need: liveNeedLabels[index % liveNeedLabels.length],
        priority: index < 2 ? 'High' : index < 5 ? 'Medium' : 'Low',
        children: null,
        source: 'Serper/Google',
        osmId: place.cid || `serper-${index}`,
    }
}

const HowItWorks = () => {
    const [location, setLocation] = useState(defaultLocation)
    const [locationStatus, setLocationStatus] = useState('Showing sample results near MS Ramaiah, Bengaluru.')
    const [centers, setCenters] = useState(sampleOrphanages)
    const [activeCenter, setActiveCenter] = useState(sampleOrphanages[0].name)
    const [isMapLoading, setIsMapLoading] = useState(false)
    const [isLiveMap, setIsLiveMap] = useState(false)
    const [googleMapsLoaded, setGoogleMapsLoaded] = useState(false)

    const mapRef = useRef(null)
    const googleMapRef = useRef(null)
    const markersRef = useRef([])

    const nearbyCenters = useMemo(() => {
        return centers
            .map((center) => ({
                ...center,
                distance: getDistanceKm(location, center),
            }))
            .sort((a, b) => a.distance - b.distance)
    }, [centers, location])

    // Load Google Maps API
    useEffect(() => {
        const loadGoogleMaps = () => {
            if (window.google && window.google.maps) {
                setGoogleMapsLoaded(true)
                return
            }

            const script = document.createElement('script')
            const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || 'YOUR_API_KEY_HERE'
            script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&callback=initMap`
            script.async = true
            script.defer = true
            window.initMap = () => setGoogleMapsLoaded(true)
            document.head.appendChild(script)
        }

        loadGoogleMaps()
    }, [])

    // Initialize/Update Google Map
    useEffect(() => {
        if (!googleMapsLoaded || !mapRef.current) return

        if (!googleMapRef.current) {
            googleMapRef.current = new window.google.maps.Map(mapRef.current, {
                center: { lat: location.lat, lng: location.lng },
                zoom: 13,
                disableDefaultUI: false,
                styles: [
                    {
                        "featureType": "all",
                        "elementType": "labels.text.fill",
                        "stylers": [{"color": "#5a4a38"}]
                    },
                    {
                        "featureType": "landscape",
                        "elementType": "all",
                        "stylers": [{"color": "#fdf6ec"}]
                    },
                    {
                        "featureType": "water",
                        "elementType": "all",
                        "stylers": [{"color": "#e1f4ff"}]
                    }
                ]
            })
        } else {
            googleMapRef.current.setCenter({ lat: location.lat, lng: location.lng })
        }

        // Clear existing markers
        markersRef.current.forEach(marker => marker.setMap(null))
        markersRef.current = []

        // User Marker
        const userMarker = new window.google.maps.Marker({
            position: { lat: location.lat, lng: location.lng },
            map: googleMapRef.current,
            title: 'You are here',
            icon: {
                path: window.google.maps.SymbolPath.CIRCLE,
                fillColor: '#204155',
                fillOpacity: 1,
                strokeWeight: 2,
                strokeColor: '#ffffff',
                scale: 10,
            }
        })
        markersRef.current.push(userMarker)

        // Center Markers
        nearbyCenters.forEach((center, index) => {
            const marker = new window.google.maps.Marker({
                position: { lat: center.lat, lng: center.lng },
                map: googleMapRef.current,
                label: {
                    text: (index + 1).toString(),
                    color: 'white',
                    fontWeight: 'bold'
                },
                title: center.name,
                icon: {
                    path: 'M 0,0 C -2,-20 -10,-22 -10,-30 A 10,10 0 1,1 10,-30 C 10,-22 2,-20 0,0 z',
                    fillColor: activeCenter === center.name ? '#4a7150' : '#c4714a',
                    fillOpacity: 1,
                    strokeWeight: 1,
                    strokeColor: '#ffffff',
                    scale: 1.2,
                    labelOrigin: new window.google.maps.Point(0, -30)
                }
            })

            marker.addListener('click', () => {
                setActiveCenter(center.name)
            })

            markersRef.current.push(marker)
        })

        // Auto-fit bounds
        if (nearbyCenters.length > 0) {
            const bounds = new window.google.maps.LatLngBounds()
            bounds.extend({ lat: location.lat, lng: location.lng })
            nearbyCenters.forEach(c => bounds.extend({ lat: c.lat, lng: c.lng }))
            googleMapRef.current.fitBounds(bounds)
        }

    }, [googleMapsLoaded, location, nearbyCenters, activeCenter])

    const fetchSerperNearbyCenters = async (nextLocation) => {
        const serperKey = import.meta.env.VITE_SERPER_API_KEY
        if (!serperKey) return null

        try {
            const response = await fetch('https://google.serper.dev/places', {
                method: 'POST',
                headers: {
                    'X-API-KEY': serperKey,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    q: 'orphanages',
                    location: `${nextLocation.lat}, ${nextLocation.lng}`,
                    radius: 15, // km
                }),
            })

            if (!response.ok) return null

            const data = await response.json()
            return (data.places || []).map(formatSerperCenter)
        } catch (error) {
            console.error('Serper search failed:', error)
            return null
        }
    }

    const loadRealNearbyCenters = async (nextLocation) => {
        setIsMapLoading(true)
        setIsLiveMap(false)
        setLocationStatus('Searching for nearby orphanages...')

        // Try Serper First
        const serperCenters = await fetchSerperNearbyCenters(nextLocation)
        if (serperCenters && serperCenters.length > 0) {
            setCenters(serperCenters)
            setActiveCenter(serperCenters[0].name)
            setIsLiveMap(true)
            setLocationStatus(`Showing ${serperCenters.length} live results from Google Search within 15 km.`)
            setIsMapLoading(false)
            return
        }

        // Fallback to OpenStreetMap
        try {
            const response = await fetch(OVERPASS_ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
                },
                body: new URLSearchParams({
                    data: buildOverpassQuery(nextLocation),
                }),
            })

            if (!response.ok) throw new Error('OSM failed')

            const payload = await response.json()
            const liveCenters = (payload.elements || [])
                .map(formatOsmCenter)
                .filter(Boolean)
                .slice(0, 8)

            if (!liveCenters.length) {
                setCenters(sampleOrphanages)
                setActiveCenter(sampleOrphanages[0].name)
                setLocationStatus('No mapped orphanages found within 15 km. Showing sample partner data.')
                return
            }

            setCenters(liveCenters)
            setActiveCenter(liveCenters[0].name)
            setIsLiveMap(true)
            setLocationStatus(`Showing ${liveCenters.length} results from OpenStreetMap within 15 km.`)
        } catch (error) {
            setCenters(sampleOrphanages)
            setActiveCenter(sampleOrphanages[0].name)
            setLocationStatus('Could not reach location services. Showing sample partner data.')
        } finally {
            setIsMapLoading(false)
        }
    }

    const handleUseLocation = () => {
        if (!navigator.geolocation) {
            setLocationStatus('Location not available. Showing Bengaluru sample results.')
            return
        }

        setLocationStatus('Requesting your location...')
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const nextLocation = {
                    label: 'Your current location',
                    lat: position.coords.latitude,
                    lng: position.coords.longitude,
                }
                setLocation(nextLocation)
                loadRealNearbyCenters(nextLocation)
            },
            () => {
                setLocationStatus('Location permission denied. Showing Bengaluru sample results.')
            },
            { enableHighAccuracy: true, timeout: 8000 }
        )
    }

    return (
        <div className="seva-page">
            <nav>
                <a href="/" className="logo">Ummeed<span>.</span></a>
                <ul>
                    <li><a href="/how-it-works">How It Works</a></li>
                    <li><a href="#nearby-map">Nearby Map</a></li>
                    <li><a href="/home#programs">Programs</a></li>
                    <li><a href="/home#stories">Stories</a></li>
                    <li><a href="/home#volunteer">Volunteer</a></li>
                    <li><a href="#journey" className="nav-cta">Seva Track</a></li>
                </ul>
            </nav>

            <section className="seva-hero">
                <div className="hero-bg"></div>
                <svg className="seva-hero-art" viewBox="0 0 620 760" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                    <ellipse cx="380" cy="710" rx="250" ry="56" fill="#c8ddc8" opacity="0.56" />
                    <rect x="256" y="280" width="170" height="160" rx="12" fill="#c4714a" />
                    <path d="M232 292 342 205 452 292Z" fill="#8b4c2d" />
                    <rect x="316" y="354" width="50" height="86" rx="8" fill="#5a2a10" opacity="0.82" />
                    <rect x="282" y="322" width="38" height="34" rx="6" fill="#fce8a0" />
                    <rect x="370" y="322" width="38" height="34" rx="6" fill="#fce8a0" />
                    <path d="M120 520c62-46 127-68 196-66 90 2 152 40 198 86" stroke="#7a9e7e" strokeWidth="18" fill="none" strokeLinecap="round" />
                    <circle cx="140" cy="526" r="44" fill="#fdf6ec" stroke="#7a9e7e" strokeWidth="8" />
                    <circle cx="320" cy="456" r="44" fill="#fdf6ec" stroke="#c4714a" strokeWidth="8" />
                    <circle cx="514" cy="540" r="44" fill="#fdf6ec" stroke="#d4a24a" strokeWidth="8" />
                    <path d="M120 526h40M140 506v40" stroke="#7a9e7e" strokeWidth="9" strokeLinecap="round" />
                    <path d="m302 456 14 14 28-34" stroke="#c4714a" strokeWidth="9" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M494 525h40M494 542h30M494 559h26" stroke="#d4a24a" strokeWidth="8" strokeLinecap="round" />
                    <g opacity="0.92">
                        <rect x="86" y="102" width="152" height="92" rx="22" fill="white" />
                        <path d="M118 135h78M118 160h52" stroke="#5a4a38" strokeWidth="9" strokeLinecap="round" opacity="0.32" />
                        <circle cx="202" cy="145" r="18" fill="#e8b4a0" />
                    </g>
                    <g opacity="0.92">
                        <rect x="398" y="132" width="142" height="92" rx="22" fill="white" />
                        <path d="M428 164h74M428 188h42" stroke="#5a4a38" strokeWidth="9" strokeLinecap="round" opacity="0.32" />
                        <circle cx="502" cy="174" r="18" fill="#7a9e7e" />
                    </g>
                    <path d="M242 148c28 14 46 36 55 66M386 174c-25 14-42 33-50 59" stroke="#d4a24a" strokeWidth="6" fill="none" strokeLinecap="round" strokeDasharray="10 16" />
                    <circle cx="95" cy="640" r="8" fill="#e8b4a0" />
                    <circle cx="176" cy="650" r="7" fill="#d4a24a" />
                    <circle cx="458" cy="650" r="8" fill="#e8b4a0" />
                    <circle cx="538" cy="630" r="7" fill="#c4714a" />
                </svg>

                <div className="hero-content seva-hero-content">
                    <div className="hero-tag">VAAYA Seva Track</div>
                    <h1>How care becomes <em>verified impact</em></h1>
                    <p>
                        Seva Track helps orphanages publish urgent needs, act on them, and close loops with AI-assisted proof.
                    </p>
                    <div className="hero-btns">
                        <a href="#journey" className="btn-primary">See The Journey</a>
                        <a href="#agents" className="btn-secondary">Explore AI Workflows</a>
                    </div>
                </div>
            </section>

            <div className="hero-stats seva-stats">
                <div className="stat">
                    <div className="stat-num">4</div>
                    <div className="stat-label">Step Trust Loop</div>
                </div>
                <div className="stat">
                    <div className="stat-num">3</div>
                    <div className="stat-label">Agent Workflows</div>
                </div>
                <div className="stat">
                    <div className="stat-num">24/7</div>
                    <div className="stat-label">Care Gap Board</div>
                </div>
                <div className="stat">
                    <div className="stat-num">100%</div>
                    <div className="stat-label">Proof Tracked</div>
                </div>
            </div>

            <section className="seva-map-section" id="nearby-map">
                <div className="seva-map-copy">
                    <div className="section-tag">Nearby Orphanages</div>
                    <h2 className="section-title">Find care gaps around you</h2>
                    <p>
                        This map uses live data to find child-care facilities and shows the most urgent open tasks.
                    </p>
                    <button type="button" className="btn-primary seva-location-btn" onClick={handleUseLocation} disabled={isMapLoading}>
                        {isMapLoading ? 'Searching...' : 'Use My Location'}
                    </button>
                    <p className="seva-location-status">{locationStatus}</p>
                </div>

                <div className="seva-map-layout">
                    <div className="seva-map" ref={mapRef}>
                        {!googleMapsLoaded && (
                            <div className="map-loading-overlay">
                                <span>Loading Google Maps...</span>
                            </div>
                        )}
                    </div>

                    <div className="seva-map-list">
                        <div className="map-list-heading">
                            <span>{isLiveMap ? 'Live results detected' : 'Sample partner data'}</span>
                            <strong>{location.label}</strong>
                        </div>
                        {nearbyCenters.map((center, index) => (
                            <button
                                type="button"
                                className={`orphanage-row ${activeCenter === center.name ? 'active' : ''}`}
                                key={center.osmId || center.name}
                                onClick={() => setActiveCenter(center.name)}
                            >
                                <span className="orphanage-rank">{index + 1}</span>
                                <span>
                                    <strong>{center.name}</strong>
                                    <small>{center.area} - {center.distance.toFixed(1)} km away</small>
                                    <em>{center.need}</em>
                                    {center.source ? <b className="map-source">{center.source}</b> : null}
                                </span>
                                <i className={`priority priority-${center.priority.toLowerCase()}`}>{center.priority}</i>
                            </button>
                        ))}
                    </div>
                </div>
            </section>

            <section className="section-story seva-story" id="verification">
                <div className="story-img-area">
                    <div className="story-illustration seva-phone">
                        <div className="phone-shell">
                            <div className="phone-top">
                                <span>Quest #442</span>
                                <i></i>
                            </div>
                            <div className="phone-camera">
                                <div className="scan-line"></div>
                                <div className="kit-box">
                                    <span></span>
                                    <strong>20kg rice</strong>
                                    <small>matched to donor pledge</small>
                                </div>
                            </div>
                            <div className="phone-bottom">
                                <div className="capture-button"></div>
                            </div>
                        </div>
                        <div className="story-bubble top-right">
                            <div className="dot" style={{ background: '#5d8a5e' }}></div>
                            Gemini vision verified
                        </div>
                        <div className="story-bubble bottom-left">
                            <div className="dot" style={{ background: '#c4714a' }}></div>
                            Gemini validated
                        </div>
                    </div>
                </div>

                <div className="story-content">
                    <div className="section-tag">Trust Layer</div>
                    <h2>Verification without making care teams do more work</h2>
                    <p>
                        The staff member only captures a delivery photo. Seva Track compares the proof with the original pledge.
                    </p>
                    <ul className="feature-list">
                        <li>Photo-based confirmation for physical donations</li>
                        <li>Delivery and visit status shared with the supporter</li>
                        <li>Receipts and thank-you updates generated</li>
                        <li>Resource heatmaps show where help is still missing</li>
                    </ul>
                    <a href="#agents" className="btn-primary">Start A Seva Quest</a>
                </div>
            </section>

            <footer className="py-24 px-10 border-t border-impact-dark/5 bg-white">
                <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-10">
                    <div className="flex items-center gap-3">
                        <div className="text-lg font-black font-serif tracking-tighter text-impact-dark/30 uppercase">Impact Odyssey</div>
                    </div>
                    <div className="flex gap-10 text-[10px] font-black uppercase tracking-[0.2em] text-impact-dark/40">
                        <a href="#">Privacy</a>
                        <a href="#">Laws</a>
                        <a href="#">API</a>
                    </div>
                    <div className="text-[10px] font-black text-impact-dark/20 uppercase tracking-[0.3em]">
                        VAAYA ENGINE v4.2 // GEMINI CORE 2.5
                    </div>
                </div>
            </footer>

            <style dangerouslySetInnerHTML={{ __html: `
                @keyframes scan {
                    0%, 100% { top: 5%; opacity: 0.3; }
                    50% { top: 75%; opacity: 1; }
                }
            `}} />
        </div>
    )
}

export default HowItWorks
