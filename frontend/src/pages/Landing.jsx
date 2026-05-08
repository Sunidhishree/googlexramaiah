import React from 'react'

const heroHtml = `
<nav>
    <div class="logo">Ummeed<span>.</span></div>
    <ul>
        <li><a href="#how">How It Works</a></li>
        <li><a href="#programs">Programs</a></li>
        <li><a href="#stories">Stories</a></li>
        <li><a href="#volunteer">Volunteer</a></li>
        <li><a href="/orphanage/register" style="font-size: 0.85rem; padding: 0.4rem 0.8rem; border: 1px solid currentColor; border-radius: 100px; opacity: 0.8;">Organization? Register here</a></li>
        <li><a href="/login" class="nav-cta">Login</a></li>
    </ul>
</nav>
<section class="hero">
    <div class="hero-bg"></div>
    <div class="hero-content">
        <div class="hero-tag">🌿 Welfare &amp; Community Care</div>
        <h1>Spreading <em>hope</em> to those who need it most</h1>
        <p>Ummeed connects welfare centers, volunteers, and communities — bringing food, shelter, education, and healing to vulnerable hearts across India.</p>
        <div class="hero-btns">
            <a href="/signup" class="btn-primary">Get Started</a>
            <a href="#programs" class="btn-secondary">Explore Programs</a>
        </div>
    </div>
</section>
`

export default function Landing() {
    return <div dangerouslySetInnerHTML={{ __html: heroHtml }} />
}
