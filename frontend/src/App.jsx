import React from 'react'
import Landing from './pages/Landing'
import Login from './pages/Login'
import Signup from './pages/Signup'
import Home from './pages/Home'
import OrphanageActivities from './pages/OrphanageActivities'
import Elara from './pages/Elara'

export default function App() {
    const path = window.location.pathname

    if (path === '/home') {
        return <Home />
    }

    if (path === '/login') {
        return <Login />
    }

    if (path === '/signup') {
        return <Signup />
    }

    if (path === '/programs/orphanage-activities') {
        return <OrphanageActivities />
    }

    if (path === '/programs/elara') {
        return <Elara />
    }

    return <Landing />
}
