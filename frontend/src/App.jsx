import React, { useEffect, useState } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from './firebase'
import Landing from './pages/Landing'
import Login from './pages/Login'
import Signup from './pages/Signup'
import Home from './pages/Home'
import HowItWorks from './pages/HowItWorks'

const protectedPaths = ['/home', '/how-it-works']

const getSafeNextPath = (next) => {
    if (!next || !next.startsWith('/') || next.startsWith('//')) {
        return '/home'
    }

    if (next.startsWith('/login') || next.startsWith('/signup')) {
        return '/home'
    }

    return next
}

function LoadingScreen({ title = 'Loading your space...' }) {
    return (
        <div className="home-shell">
            <div className="home-card">
                <p className="auth-kicker">Ummeed</p>
                <h1 className="home-title">{title}</h1>
            </div>
        </div>
    )
}

function RedirectToLogin() {
    useEffect(() => {
        const nextPath = `${window.location.pathname}${window.location.hash || ''}`
        window.location.replace(`/login?next=${encodeURIComponent(nextPath)}`)
    }, [])

    return <LoadingScreen title="Taking you to login..." />
}

function RedirectToHome() {
    useEffect(() => {
        const params = new URLSearchParams(window.location.search)
        window.location.replace(getSafeNextPath(params.get('next')))
    }, [])

    return <LoadingScreen title="Opening your dashboard..." />
}

export default function App() {
    const [user, setUser] = useState(null)
    const [isAuthReady, setIsAuthReady] = useState(false)
    const rawPath = window.location.pathname
    const path = rawPath !== '/' ? rawPath.replace(/\/$/, '') : rawPath

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser)
            setIsAuthReady(true)
        })

        return unsubscribe
    }, [])

    if (!isAuthReady) {
        return <LoadingScreen />
    }

    if (protectedPaths.includes(path) && !user) {
        return <RedirectToLogin />
    }

    if ((path === '/login' || path === '/signup') && user) {
        return <RedirectToHome />
    }

    if (path === '/home') {
        return <Home />
    }

    if (path === '/login') {
        return <Login />
    }

    if (path === '/signup') {
        return <Signup />
    }

    if (path === '/how-it-works') {
        return <HowItWorks />
    }

    return <Landing isLoggedIn={Boolean(user)} />
}
