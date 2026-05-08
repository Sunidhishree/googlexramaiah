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

export default function Login() {
    const [error, setError] = useState('')

    const handleGoogleLogin = async () => {
        try {
            setError('')
            await signInWithGoogle()
            window.location.replace(getNextPath())
        } catch (err) {
            setError(err?.message || 'Google sign-in failed')
        }
    }

    return (
        <div className="auth-page">
            <form className="auth-form" onSubmit={(event) => event.preventDefault()}>
                <h2>Login</h2>
                <p className="auth-subcopy">Use Google to continue. Protected pages only open after Firebase confirms your session.</p>
                <button type="button" className="button google-button" onClick={handleGoogleLogin}>
                    Continue with Google
                </button>
                {error ? <p className="auth-error">{error}</p> : null}
                <p className="auth-switch">New here? <a href={`/signup${window.location.search || ''}`}>Create an account</a></p>
            </form>
        </div>
    )
}
