import React from 'react'
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

    if (path === '/donate') {
        return <Donate />
    }

    if (path === '/volunteer') {
        return <VolunteerForm />
    }

    if (path === '/orphanage/register') {
        return <OrphanageRegister />
    }

    if (path === '/orphanage/dashboard') {
        return <OrphanageDashboard />
    }

    if (path === '/login') {
        return <Login />
    }

    if (path === '/signup') {
        return <Signup />
    }

    return <Landing />
}
