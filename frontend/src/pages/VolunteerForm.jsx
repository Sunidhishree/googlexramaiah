import React, { useState } from 'react'
import { auth } from '../firebase'

const STATES = [
    "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat", "Haryana", 
    "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", 
    "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", 
    "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal", "Andaman and Nicobar Islands", "Chandigarh", 
    "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Jammu and Kashmir", "Ladakh", "Lakshadweep", "Puducherry"
]

const ID_TYPES = [
    { value: 'aadhaar', label: 'Aadhaar Card' },
    { value: 'pan', label: 'PAN Card' },
    { value: 'voter', label: 'Voter ID' },
    { value: 'dl', label: 'Driving License' }
]

export default function VolunteerForm() {
    const [formData, setFormData] = useState({
        name: '',
        dob: '',
        phone: '',
        address1: '',
        address2: '',
        pin: '',
        city: '',
        state: 'Karnataka',
        idType: 'aadhaar'
    })
    const [file, setFile] = useState(null)
    const [loading, setLoading] = useState(false)
    const [result, setResult] = useState(null)
    const [error, setError] = useState('')

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value })
    }

    const handleFileChange = (e) => {
        setFile(e.target.files[0])
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (!file) {
            setError('Please upload your Government ID.')
            return
        }
        setLoading(true)
        setError('')
        setResult(null)

        try {
            const user = auth.currentUser
            if (!user) throw new Error('You must be logged in to volunteer.')
            const token = await user.getIdToken()

            const data = new FormData()
            data.append('file', file)
            data.append('name', formData.name)
            data.append('dob', formData.dob)
            data.append('idType', formData.idType)
            data.append('details', JSON.stringify(formData))

            const response = await fetch('http://localhost:5000/api/verify-id', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: data
            })

            const resData = await response.json()
            if (!response.ok) throw new Error(resData.error || 'Verification failed.')

            setResult(resData)
        } catch (err) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="seva-page">
            <nav>
                <a href="/home" className="logo">Ummeed<span>.</span></a>
                <ul>
                    <li><a href="/home" className="nav-cta">Go Back to Home</a></li>
                </ul>
            </nav>

            <section className="volunteer-section">
                <div className="volunteer-container">
                    <div className="volunteer-header">
                        <div className="section-tag">Join the Movement</div>
                        <h1>Become a <em>Volunteer</em></h1>
                        <p>Fill in your details and upload a valid government ID for AI verification. This helps us maintain a safe community.</p>
                    </div>

                    <div className="volunteer-form-card">
                        <form onSubmit={handleSubmit}>
                            <div className="form-grid">
                                <div className="form-group">
                                    <label>Full Name (as on ID)</label>
                                    <input type="text" name="name" required value={formData.name} onChange={handleChange} placeholder="John Doe" />
                                </div>
                                <div className="form-group">
                                    <label>Date of Birth (as on ID)</label>
                                    <input type="date" name="dob" required value={formData.dob} onChange={handleChange} />
                                </div>
                                <div className="form-group">
                                    <label>Phone Number</label>
                                    <input type="tel" name="phone" required value={formData.phone} onChange={handleChange} placeholder="+91 98765 43210" />
                                </div>
                                <div className="form-group full-width">
                                    <label>Address Line 1</label>
                                    <input type="text" name="address1" required value={formData.address1} onChange={handleChange} placeholder="House No, Building Name" />
                                </div>
                                <div className="form-group full-width">
                                    <label>Address Line 2</label>
                                    <input type="text" name="address2" value={formData.address2} onChange={handleChange} placeholder="Street, Area" />
                                </div>
                                <div className="form-group">
                                    <label>PIN Code</label>
                                    <input type="text" name="pin" required value={formData.pin} onChange={handleChange} placeholder="560001" />
                                </div>
                                <div className="form-group">
                                    <label>City</label>
                                    <input type="text" name="city" required value={formData.city} onChange={handleChange} placeholder="Bengaluru" />
                                </div>
                                <div className="form-group">
                                    <label>State</label>
                                    <select name="state" value={formData.state} onChange={handleChange}>
                                        {STATES.map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>ID Type</label>
                                    <select name="idType" value={formData.idType} onChange={handleChange}>
                                        {ID_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                                    </select>
                                </div>
                                <div className="form-group full-width">
                                    <label>Upload Government ID (Image)</label>
                                    <div className="file-upload-area">
                                        <input type="file" accept="image/*" onChange={handleFileChange} id="id-upload" hidden />
                                        <label htmlFor="id-upload" className="file-label">
                                            {file ? file.name : 'Click to upload ID Card (Aadhaar, PAN, etc.)'}
                                        </label>
                                    </div>
                                </div>
                            </div>

                            {error && <div className="form-error">{error}</div>}

                            <button type="submit" className="volunteer-submit-btn" disabled={loading}>
                                {loading ? 'Verifying with AI...' : 'Submit & Verify Identity'}
                            </button>
                        </form>

                        {result && (
                            <div className={`verification-result ${result.verified ? 'success' : 'failure'}`}>
                                <h3>{result.verified ? '✓ Verification Successful' : '⚠ Verification Failed'}</h3>
                                <p>{result.reason}</p>
                                {result.verified && <p className="success-sub">Thank you for registering with us {formData.name}. The organisations registered with us would love your help.</p>}
                                {!result.verified && <p className="failure-sub">Please ensure the image is clear and details match your input.</p>}
                            </div>
                        )}
                    </div>
                </div>
            </section>
        </div>
    )
}
