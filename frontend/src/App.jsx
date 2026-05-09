import React from 'react'
import Landing from './pages/Landing'
import Login from './pages/Login'
import Signup from './pages/Signup'
import Home from './pages/Home'
<<<<<<< HEAD
import HowItWorks from './pages/HowItWorks'
import Programs from './pages/Programs'
import Stories from './pages/Stories'
import Donate from './pages/Donate'
import VolunteerForm from './pages/VolunteerForm'
import OrphanageRegister from './pages/OrphanageRegister'
import OrphanageDashboard from './pages/OrphanageDashboard'
=======
import OrphanageActivities from './pages/OrphanageActivities'
import Elara from './pages/Elara'
>>>>>>> f887bb503596bd52b243f60b04f7af620415fc2d

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

    if (path === '/programs/orphanage-activities') {
        return <OrphanageActivities />
    }

    if (path === '/programs/elara') {
        return <Elara />
    }

    return <Landing />
}
