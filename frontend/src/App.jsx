import React from 'react'
import Landing from './pages/Landing'
import Login from './pages/Login'
import Signup from './pages/Signup'
import Home from './pages/Home'
import HowItWorks from './pages/HowItWorks'
import Programs from './pages/Programs'
import Stories from './pages/Stories'

export default function App() {
    const path = window.location.pathname

    if (path === '/home') {
        return <Home />
    }

    if (path === '/how-it-works') {
        return <HowItWorks />
    }

    if (path === '/programs') {
        return <Programs />
    }

    if (path === '/stories') {
        return <Stories />
    }

    if (path === '/login') {
        return <Login />
    }

    if (path === '/signup') {
        return <Signup />
    }

    return <Landing />
}
