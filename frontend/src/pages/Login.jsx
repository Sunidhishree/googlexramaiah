import React, { useState } from 'react'
import { signInWithGoogle } from '../firebase'

export default function Login() {
    const [error, setError] = useState('')

    const handleGoogleLogin = async () => {
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
            setError(err?.message || 'Google sign-in failed')
        }
    }

    return (
        <div className="auth-page">
            <form className="auth-form" onSubmit={(event) => event.preventDefault()}>
                <h2>Login</h2>
                <button type="button" className="button google-button" onClick={handleGoogleLogin}>
                    Continue with Google
                </button>
                {error ? <p className="auth-error">{error}</p> : null}
                <label>Email</label>
                <input type="email" />
                <label>Password</label>
                <input type="password" />
                <button type="submit" className="button" onClick={() => (window.location.href = '/home')}>
                    Login
                </button>
            </form>
        </div>
    )
}
