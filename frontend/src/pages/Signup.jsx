import React, { useState } from 'react'
import { signInWithGoogle } from '../firebase'

const getNextPath = () => {
    const params = new URLSearchParams(window.location.search)
    const next = params.get('next')

    if (!next || !next.startsWith('/') || next.startsWith('//')) {
        return '/home'
    }

    if (next.startsWith('/login') || next.startsWith('/signup')) {
        return '/home'
    }

    return next
}

export default function Signup() {
    const [error, setError] = useState('')

    const handleGoogleSignup = async () => {
        try {
            setError('')
            await signInWithGoogle()
            window.location.replace(getNextPath())
        } catch (err) {
            setError(err?.message || 'Google sign-up failed')
        }
    }

    return (
        <div className="auth-page">
            <form className="auth-form auth-form--signup" onSubmit={(event) => event.preventDefault()}>
                <p className="auth-kicker">Ummeed</p>
                <h2>Create your account</h2>
                <p className="auth-subcopy">Join volunteers, donors, and welfare centers working together for NGOs, orphanages, animal welfare, and elder care.</p>
                <button type="button" className="button google-button" onClick={handleGoogleSignup}>
                    Sign up with Google
                </button>
                {error ? <p className="auth-error">{error}</p> : null}
                <p className="auth-switch">Already have an account? <a href={`/login${window.location.search || ''}`}>Login</a></p>
            </form>
        </div>
    )
}
