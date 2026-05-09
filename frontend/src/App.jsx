import React, { useState, useCallback } from 'react'
import SplashScreen from './components/SplashScreen'
import PixelBlast from './components/PixelBlast'
import Landing from './pages/Landing'
import Login from './pages/Login'
import Signup from './pages/Signup'
import Home from './pages/Home'
import HowItWorks from './pages/HowItWorks'
import Programs from './pages/Programs'
import Stories from './pages/Stories'
import Donate from './pages/Donate'
import VolunteerForm from './pages/VolunteerForm'
import OrphanageRegister from './pages/OrphanageRegister'
import OrphanageDashboard from './pages/OrphanageDashboard'

function PageRouter() {
    const path = window.location.pathname
    switch (path) {
        case '/home': return <Home />
        case '/how-it-works': return <HowItWorks />
        case '/programs': return <Programs />
        case '/stories': return <Stories />
        case '/donate': return <Donate />
        case '/volunteer': return <VolunteerForm />
        case '/orphanage/register': return <OrphanageRegister />
        case '/orphanage/dashboard': return <OrphanageDashboard />
        case '/login': return <Login />
        case '/signup': return <Signup />
        default: return <Landing />
    }
}

export default function App() {
    const [showSplash, setShowSplash] = useState(true)
    const handleSplashDone = useCallback(() => setShowSplash(false), [])

    if (showSplash) {
        return <SplashScreen onFinish={handleSplashDone} />
    }

    return (
        <>
            {/* PixelBlast background on ALL pages — Ummeed warm color scheme */}
            <div style={{
                position: 'fixed', inset: 0, zIndex: 0,
                pointerEvents: 'auto',
                background: 'linear-gradient(180deg, #fdf8f3 0%, #f5ede4 100%)'
            }}>
                <PixelBlast
                    variant="circle"
                    pixelSize={6}
                    color="#C4714A"
                    patternScale={3}
                    patternDensity={1.2}
                    pixelSizeJitter={0.5}
                    enableRipples
                    rippleSpeed={0.4}
                    rippleThickness={0.12}
                    rippleIntensityScale={1.5}
                    liquid
                    liquidStrength={0.12}
                    liquidRadius={1.2}
                    liquidWobbleSpeed={5}
                    speed={0.6}
                    edgeFade={0.25}
                    transparent
                />
            </div>

            {/* Page content sits above the background */}
            <div style={{ position: 'relative', zIndex: 1 }}>
                <PageRouter />
            </div>
        </>
    )
}
