import React, { useState } from 'react'
import { signInWithGoogle } from '../firebase'

export default function Signup() {
    const [error, setError] = useState('')

    const handleGoogleSignup = async () => {
        try {
            setError('')
            const result = await signInWithGoogle()
            const user = result.user
            const token = await user.getIdToken()

            // Sync with backend
            const response = await fetch('http://localhost:5000/api/auth/sync', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            })

            if (!response.ok) {
                throw new Error('Failed to sync with backend')
            }

            window.location.href = '/home'
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
                <label>Name</label>
                <input placeholder="Your name" />
                <label>Email</label>
                <input type="email" placeholder="you@example.com" />
                <label>Password</label>
                <input type="password" placeholder="Create a password" />
                <button type="submit" className="button" onClick={() => (window.location.href = '/home')}>
                    Create account
                </button>
            </form>
        </div>
    )
}
