import React, { useMemo, useState } from "react"
import "./OrphanageRegister.css"

const API_BASE = "http://localhost:5000"
const stepTitles = ["Basic Info", "Legal Documents", "Contact & Login"]

const INDIAN_STATES = [
    "Andhra Pradesh","Arunachal Pradesh","Assam","Bihar","Chhattisgarh","Goa","Gujarat",
    "Haryana","Himachal Pradesh","Jharkhand","Karnataka","Kerala","Madhya Pradesh",
    "Maharashtra","Manipur","Meghalaya","Mizoram","Nagaland","Odisha","Punjab",
    "Rajasthan","Sikkim","Tamil Nadu","Telangana","Tripura","Uttar Pradesh",
    "Uttarakhand","West Bengal","Delhi","Jammu & Kashmir","Ladakh","Chandigarh",
    "Puducherry","Andaman & Nicobar Islands","Dadra & Nagar Haveli","Lakshadweep"
]

const initialForm = {
    name: "", description: "", address: "", pincode: "", state: "",
    year_established: "", current_strength: "", capacity: "",
    registration_cert: null, darpan_cert: null,
    darpan_id: "", pan_number: "", registration_12a: "", registration_80g: "",
    contact_person: "", phone: "", email: "", password: "", confirmPassword: ""
}

export default function OrphanageRegister() {
    const [step, setStep] = useState(0)
    const [formData, setFormData] = useState(initialForm)
    const [status, setStatus] = useState("idle")
    const [error, setError] = useState("")
    const [verification, setVerification] = useState(null)
    const [locating, setLocating] = useState(false)

    const handleLocate = async () => {
        if (!navigator.geolocation) {
            setError("Geolocation is not supported by your browser.")
            return
        }
        setLocating(true)
        setError("")
        navigator.geolocation.getCurrentPosition(
            async (pos) => {
                try {
                    const resp = await fetch("http://localhost:5000/api/places/reverse-geocode", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
                    })
                    if (!resp.ok) throw new Error("Geocoding failed")
                    const geo = await resp.json()
                    setFormData((prev) => ({
                        ...prev,
                        address: geo.address || geo.display_name || prev.address,
                        pincode: geo.pincode || prev.pincode,
                        state: INDIAN_STATES.find(s => s.toLowerCase() === (geo.state || "").toLowerCase()) || prev.state,
                    }))
                } catch {
                    setError("Could not fetch address. Please enter manually.")
                }
                setLocating(false)
            },
            () => {
                setError("Location permission denied. Please enter address manually.")
                setLocating(false)
            },
            { enableHighAccuracy: true, timeout: 10000 }
        )
    }

    const progress = useMemo(() => ((step + 1) / stepTitles.length) * 100, [step])

    const handleChange = (e) => {
        const { name, value } = e.target
        setFormData((prev) => ({ ...prev, [name]: value }))
    }

    const handleFileChange = (e) => {
        const { name, files } = e.target
        if (files?.[0]) setFormData((prev) => ({ ...prev, [name]: files[0] }))
    }

    const validateStep = (currentStep) => {
        switch (currentStep) {
            case 0: {
                if (!formData.name.trim()) return "Orphanage Name is required."
                if (!formData.address.trim()) return "Address is required."
                if (!formData.pincode.trim()) return "Pincode is required."
                if (formData.pincode.trim().length !== 6 || !/^\d{6}$/.test(formData.pincode.trim())) return "Pincode must be exactly 6 digits."
                if (!formData.state) return "State is required."
                return null
            }
            case 2: {
                if (!formData.contact_person.trim()) return "Contact Person Name is required."
                if (!formData.phone.trim()) return "Phone number is required."
                if (!formData.email.trim()) return "Email is required."
                if (!formData.password) return "Password is required."
                if (formData.password.length < 6) return "Password must be at least 6 characters."
                if (!formData.confirmPassword) return "Please confirm your password."
                if (formData.password !== formData.confirmPassword) return "Passwords don't match."
                return null
            }
            default:
                return null
        }
    }

    const nextStep = () => {
        const err = validateStep(step)
        if (err) {
            setError(err)
            return
        }
        setError("")
        setStep((p) => Math.min(p + 1, stepTitles.length - 1))
    }
    const prevStep = () => { setError(""); setStep((p) => Math.max(p - 1, 0)) }

    const handleSubmit = async (e) => {
        e.preventDefault()
        setError("")

        for (let s = 0; s < stepTitles.length; s++) {
            const stepErr = validateStep(s)
            if (stepErr) {
                setStep(s)
                setError(stepErr)
                return
            }
        }

        setStatus("loading")
        try {
            const body = new FormData()
            body.append("name", formData.name)
            body.append("description", formData.description)
            body.append("address", formData.address)
            body.append("pincode", formData.pincode)
            body.append("state", formData.state)
            body.append("year_established", String(formData.year_established || 0))
            body.append("current_strength", String(formData.current_strength || 0))
            body.append("capacity", String(formData.capacity || 0))
            body.append("darpan_id", formData.darpan_id)
            body.append("pan_number", formData.pan_number)
            body.append("registration_12a", formData.registration_12a)
            body.append("registration_80g", formData.registration_80g)
            body.append("contact_person", formData.contact_person)
            body.append("phone", formData.phone)
            body.append("email", formData.email)
            body.append("password", formData.password)
            if (formData.registration_cert) {
                body.append("certificate", formData.registration_cert)
            } else if (formData.darpan_cert) {
                body.append("certificate", formData.darpan_cert)
            }
            const response = await fetch(`${API_BASE}/api/orphanage/register`, {
                method: "POST",
                body: body
            })
            const payload = await response.json()
            if (!response.ok) throw new Error(payload?.error || "Registration failed.")

            setVerification(payload.verification)
            localStorage.setItem("orphanage_id", payload.id)

            if (payload.verification?.status === "verified") {
                setStatus("verified")
                setTimeout(() => { window.location.href = "/orphanage/dashboard" }, 3000)
            } else if (payload.verification?.status === "rejected") {
                setStatus("rejected")
            } else {
                setStatus("review")
            }
        } catch (err) {
            setStatus("error")
            setError(err?.message || "Something went wrong. Please try again.")
        }
    }

    if (status === "loading") {
        return (
            <div className="status-screen">
                <div className="status-card">
                    <div className="status-icon animate-spin">🔍</div>
                    <h2 className="status-title">Verifying Documents...</h2>
                    <p className="status-desc">Our AI is checking your registration. This usually takes a few seconds.</p>
                </div>
            </div>
        )
    }

    if (status === "verified") {
        return (
            <div className="status-screen">
                <div className="status-card">
                    <div className="status-icon">🎉</div>
                    <h2 className="status-title" style={{ color: 'var(--deep-sage)' }}>Verified!</h2>
                    <p className="status-desc">
                        Verification score: <span style={{ fontWeight: 700, color: 'var(--deep-sage)' }}>{verification?.score ?? "--"}</span>
                    </p>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-light)' }}>Redirecting to your dashboard...</p>
                </div>
            </div>
        )
    }

    if (status === "review") {
        return (
            <div className="status-screen">
                <div className="status-card">
                    <div className="status-icon">🧭</div>
                    <h2 className="status-title">Under Review</h2>
                    <p className="status-desc">Our team will take a closer look. We'll notify you shortly.</p>
                    <a href="/" className="btn-secondary" style={{ padding: '0.6rem 1.2rem', fontSize: '0.85rem' }}>Back to Home</a>
                </div>
            </div>
        )
    }

    if (status === "rejected") {
        return (
            <div className="status-screen">
                <div className="status-card">
                    <div className="status-icon">🚨</div>
                    <h2 className="status-title" style={{ color: '#9b1c1c' }}>Rejected</h2>
                    <p className="status-desc">{verification?.reason || "Please review your details and try again."}</p>
                    <button onClick={() => setStatus("idle")} className="btn-primary">Try Again</button>
                </div>
            </div>
        )
    }

    return (
        <div className="reg-container">
            <div className="reg-card">
                <div className="reg-header">
                    <span className="reg-kicker">Orphanage Onboarding</span>
                    <h1 className="reg-title">Register your orphanage 🏠</h1>
                    <p className="reg-subtitle">Join Ummeed to connect with volunteers and donors. Our AI-driven system ensures safe and verified connections.</p>
                </div>

                <div className="progress-container">
                    <div className="progress-info">
                        <div>
                            <span className="step-label">Step {step + 1} of {stepTitles.length}</span>
                            <span className="step-title">{stepTitles[step]}</span>
                        </div>
                    </div>
                    <div className="progress-track">
                        <div className="progress-fill" style={{ width: `${progress}%` }} />
                    </div>
                </div>

                <form onSubmit={handleSubmit}>
                    {step === 0 && (
                        <div className="reg-form-grid">
                            <div className="form-group full-width">
                                <label>Orphanage Name *</label>
                                <input name="name" value={formData.name} onChange={handleChange} placeholder="Sunshine Children's Home" className="form-input" />
                            </div>
                            <div className="form-group full-width">
                                <label>Description</label>
                                <textarea name="description" value={formData.description} onChange={handleChange} rows="3" placeholder="Tell us about your mission..." className="form-input" />
                            </div>
                            <div className="form-group full-width">
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <label>Address *</label>
                                    <button type="button" onClick={handleLocate} disabled={locating} className="btn-secondary" style={{ padding: '4px 12px', fontSize: '11px', height: 'auto' }}>
                                        {locating ? "Detecting..." : "📍 Use Location"}
                                    </button>
                                </div>
                                <input name="address" value={formData.address} onChange={handleChange} placeholder="Full physical address" className="form-input" />
                            </div>
                            <div className="form-group">
                                <label>Pincode *</label>
                                <input name="pincode" value={formData.pincode} onChange={handleChange} placeholder="560001" maxLength="6" className="form-input" />
                            </div>
                            <div className="form-group">
                                <label>State *</label>
                                <select name="state" value={formData.state} onChange={handleChange} className="form-input">
                                    <option value="">Select State</option>
                                    {INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Year Established</label>
                                <input name="year_established" type="number" value={formData.year_established} onChange={handleChange} placeholder="2005" className="form-input" />
                            </div>
                            <div className="form-group">
                                <label>Capacity</label>
                                <input name="capacity" type="number" value={formData.capacity} onChange={handleChange} placeholder="60" className="form-input" />
                            </div>
                        </div>
                    )}

                    {step === 1 && (
                        <div className="step-content">
                            <div className="ai-banner">
                                <div className="ai-banner-icon">🤖</div>
                                <div>
                                    <p className="ai-banner-title">AI-Powered Verification</p>
                                    <p className="ai-banner-text">Upload your Darpan or Registration certificate. Our AI will automatically extract and verify the details.</p>
                                </div>
                            </div>

                            <div className="upload-grid">
                                <div className="form-group">
                                    <label>Registration Certificate</label>
                                    <div className="upload-box">
                                        <input type="file" name="registration_cert" accept="image/*,.pdf" onChange={handleFileChange} className="hidden" id="reg-cert" />
                                        <label htmlFor="reg-cert" style={{ cursor: 'pointer' }}>
                                            <span className="upload-icon">📄</span>
                                            <p className="upload-text">{formData.registration_cert ? formData.registration_cert.name : "Upload Document"}</p>
                                            <p className="upload-hint">JPG, PNG or PDF</p>
                                        </label>
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label>Darpan Certificate</label>
                                    <div className="upload-box">
                                        <input type="file" name="darpan_cert" accept="image/*,.pdf" onChange={handleFileChange} className="hidden" id="darpan-cert" />
                                        <label htmlFor="darpan-cert" style={{ cursor: 'pointer' }}>
                                            <span className="upload-icon">🏛️</span>
                                            <p className="upload-text">{formData.darpan_cert ? formData.darpan_cert.name : "Upload Document"}</p>
                                            <p className="upload-hint">Official NGO Darpan doc</p>
                                        </label>
                                    </div>
                                </div>
                            </div>

                            <div className="reg-form-grid" style={{ background: 'rgba(255,255,255,0.4)', padding: '1.5rem', borderRadius: '14px' }}>
                                <div className="form-group">
                                    <label>Darpan ID (Optional if uploading)</label>
                                    <input name="darpan_id" value={formData.darpan_id} onChange={handleChange} placeholder="MH/2020/0123456" className="form-input" />
                                </div>
                                <div className="form-group">
                                    <label>PAN Number</label>
                                    <input name="pan_number" value={formData.pan_number} onChange={handleChange} placeholder="AAAAA0000A" className="form-input" />
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="reg-form-grid">
                            <div className="form-group">
                                <label>Contact Person Name *</label>
                                <input name="contact_person" value={formData.contact_person} onChange={handleChange} placeholder="Primary representative" className="form-input" />
                            </div>
                            <div className="form-group">
                                <label>Phone *</label>
                                <input name="phone" type="tel" value={formData.phone} onChange={handleChange} placeholder="+91 98765 43210" className="form-input" />
                            </div>
                            <div className="form-group full-width">
                                <label>Official Email *</label>
                                <input name="email" type="email" value={formData.email} onChange={handleChange} placeholder="admin@orphanage.org" className="form-input" />
                            </div>
                            <div className="form-group">
                                <label>Password *</label>
                                <input name="password" type="password" value={formData.password} onChange={handleChange} placeholder="Min. 6 characters" className="form-input" />
                            </div>
                            <div className="form-group">
                                <label>Confirm Password *</label>
                                <input name="confirmPassword" type="password" value={formData.confirmPassword} onChange={handleChange} placeholder="Repeat password" className="form-input" />
                            </div>
                        </div>
                    )}

                    {error && <p className="error-msg">⚠️ {error}</p>}

                    <div className="nav-btns">
                        <button type="button" onClick={prevStep} disabled={step === 0} className="btn-back">
                            ← Back
                        </button>
                        {step < stepTitles.length - 1 ? (
                            <button type="button" onClick={nextStep} className="btn-primary" style={{ padding: '0.8rem 2.2rem' }}>
                                Next Step →
                            </button>
                        ) : (
                            <button type="submit" className="btn-primary" style={{ padding: '0.8rem 2.2rem' }}>
                                Submit for Verification 🚀
                            </button>
                        )}
                    </div>
                </form>
            </div>
        </div>
    )
}
