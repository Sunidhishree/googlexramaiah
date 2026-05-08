import React from 'react'

export default function Landing({ isLoggedIn = false }) {
    return (
        <div>
            <nav>
                <div className="logo">Ummeed<span>.</span></div>
                {isLoggedIn ? (
                    <ul>
                        <li><a href="/how-it-works">How It Works</a></li>
                        <li><a href="/home#programs">Programs</a></li>
                        <li><a href="/home#stories">Stories</a></li>
                        <li><a href="/home#volunteer">Volunteer</a></li>
                        <li><a href="/home#donate" className="nav-cta">Donate Now</a></li>
                    </ul>
                ) : (
                    <ul>
                        <li><a href="/signup">Get Started</a></li>
                        <li><a href="/login" className="nav-cta">Login</a></li>
                    </ul>
                )}
            </nav>
            <section className="hero">
                <div className="hero-bg"></div>
                <div className="hero-content">
                    <div className="hero-tag">Welfare &amp; Community Care</div>
                    <h1>Spreading <em>hope</em> to those who need it most</h1>
                    <p>Ummeed connects welfare centers, volunteers, and communities, bringing food, shelter, education, and healing to vulnerable hearts across India.</p>
                    <div className="hero-btns">
                        {isLoggedIn ? (
                            <>
                                <a href="/home#donate" className="btn-primary">Donate Today</a>
                                <a href="/how-it-works" className="btn-secondary">How It Works</a>
                            </>
                        ) : (
                            <>
                                <a href="/signup" className="btn-primary">Get Started</a>
                                <a href="/login" className="btn-secondary">Login</a>
                            </>
                        )}
                    </div>
                </div>
            </section>
        </div>
    )
}
