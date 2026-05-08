import React, { useState } from 'react'
import { signInWithGoogle } from '../firebase'

export default function Login() {
    const [error, setError] = useState('')

    const handleGoogleLogin = async () => {
        try {
            setError('')
            await signInWithGoogle()
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
