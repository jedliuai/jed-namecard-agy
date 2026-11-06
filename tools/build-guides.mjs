// Builds the search landing pages (cards/<slug>/index.html) from the copy below, so every page
// shares one layout, nav, footer, Google Analytics snippet and structured data.
// Run after editing: node tools/build-guides.mjs
// The GA snippet is copied from cards/privacy/index.html, so change it there.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "cards");
const SITE = "https://1name.cards";
const UPDATED = "2026-11-06";

const STYLES = [
  ["noir", "Noir", "Law · Finance"], ["holo", "Holo", "Creators · Brands"], ["terminal", "Terminal", "Developers · AI"],
  ["swiss", "Swiss", "Design · Architecture"], ["pop", "Pop", "Food · Retail"], ["ink", "Ink", "Tea · Culture"],
  ["aurora", "Aurora", "Beauty · Wellness"], ["blueprint", "Blueprint", "Engineering"], ["helix", "Helix", "Pharma · Health"],
];

const PLANS = `<div class="plans">
<div class="plan"><h3>Free</h3><p class="price">$0</p><ul><li>Design your card in all nine styles</li><li>Your photo and messenger QR code</li><li>Save your card to your account</li></ul></div>
<div class="plan"><h3>Pro</h3><p class="price">$9.90 <small>per year</small></p><ul><li>Your live card link: yourname.1name.cards</li><li>Video, GIF and image exports, up to 20 a day</li><li>Change your card any time</li></ul></div>
<div class="plan"><h3>Share pack</h3><p class="price">$2.99 <small>once</small></p><ul><li>One HD export of your card in one style</li><li>MP4 video with music, GIF and JPG images</li><li>No subscription</li></ul></div>
</div>
<p class="note">Prices in US dollars, sales tax or VAT included. Payments by Creem, our merchant of record. Full refund within 14 days: see the <a href="/refund/">refund policy</a>.</p>`;

const PAGES = [
  {
    slug: "business-card-maker",
    nav: "Card maker",
    name: "Business card maker",
    title: "Free Business Card Maker Online: Digital & 3D | Super Namecard",
    desc: "Make a business card online for free. Pick one of nine 3D styles, add your photo and contact details, and share it as a link or QR code. No app, no printing.",
    h1: "Free online business card maker",
    lead: "Design a business card in your browser in about a minute. Type your details, add your photo and pick a style. Your card is ready to share as a link, a QR code or a video, and designing it is free in all nine styles.",
    shots: [["noir", "front", "Black and gold business card for a corporate lawyer, made with Super Namecard"], ["noir", "back", "Back of the black and gold business card with a WhatsApp QR code"]],
    sections: [
      ["Make a business card in three steps", `<div class="prose"><ol>
<li><b>Pick a style.</b> Nine designs, from black metal and gold to ink-wash painting. You can switch any time without losing what you typed.</li>
<li><b>Type your details.</b> Name, job title, company, phone and email. The card updates as you type.</li>
<li><b>Add your photo and a messenger.</b> Choose WhatsApp or WeChat and the back of your card gets your QR code.</li>
</ol><p>Then share it: send your card link, show the QR code in person, or post a video of your card.</p></div>`],
      ["Why a digital business card", `<ul class="feats">
<li><h3>It never runs out</h3><p>No reprints, no boxes of old cards with last year's job title.</p></li>
<li><h3>Change it any time</h3><p>Update a phone number or title and your shared link shows it at once.</p></li>
<li><h3>One tap to save you</h3><p>Visitors save your contact to their phone, or start a chat with you.</p></li>
<li><h3>No app for anyone</h3><p>Your card opens in any phone or computer browser.</p></li>
<li><h3>It feels like a card</h3><p>It tilts with the phone, flips with a swipe and turns sideways in landscape.</p></li>
<li><h3>Ready for social</h3><p>Export an HD video, a GIF and images of your card.</p></li>
</ul>`],
      ["Pick a style", "STYLES"],
      ["What it costs", PLANS],
      ["Digital, not printed", `<div class="prose"><p>Super Namecard makes cards for screens: a live link, a QR code, and video and image files for social media. It doesn't print paper cards. Plenty of people keep a few paper cards for formal moments and use the digital one everywhere else.</p></div>`],
    ],
    faq: [
      ["Is the business card maker really free?", "Designing your card is free in all nine styles, and you can save it to your account. Your live card link and video exports come with Pro ($9.90 a year) or a one-off share pack ($2.99)."],
      ["Do I need to install an app?", "No. You make your card in the browser, and the people you share it with open it in theirs."],
      ["Can I print my card?", "Not from Super Namecard. It makes digital cards: a live link, a QR code, and video, GIF and JPG files."],
      ["Can I change my card after sharing it?", "Yes. Edit it any time and your card link shows the new version straight away."],
    ],
  },
  {
    slug: "whatsapp-business-card",
    nav: "WhatsApp",
    name: "WhatsApp business card",
    title: "WhatsApp Business Card with QR Code | Super Namecard",
    desc: "A digital business card with your WhatsApp QR code. People scan it or tap once to start a chat, save your contact, or pass your card on. Free to design.",
    h1: "WhatsApp business card with your QR code",
    lead: "Put a WhatsApp QR code on a business card that tilts and flips like the real thing. The code is made from your number, so anyone who scans it lands in a chat with you. Nobody has to install anything.",
    shots: [["swiss", "front", "Swiss-style business card for an architect, made with Super Namecard"], ["swiss", "back", "Back of the Swiss-style card with a WhatsApp QR code to start a chat"]],
    sections: [
      ["How the WhatsApp QR code works", `<div class="prose"><p>Type your WhatsApp number, with its country code, and the back of your card gets a QR code that opens a chat with you. Any phone camera can scan it. The person doesn't need your number saved first.</p>
<p>People who open your card link instead of scanning get a <b>WhatsApp</b> button that does the same thing, plus <b>Save contact</b> to add you to their phone.</p>
<p>It works the same for WhatsApp and WhatsApp Business numbers. If you'd rather use a QR code you already have, upload the image and it goes on the card instead.</p></div>`],
      ["Made for the way WhatsApp gets used", `<ul class="feats">
<li><h3>Send it in any chat</h3><p>Your card link opens with a proper preview of your card.</p></li>
<li><h3>Post it to Status</h3><p>Export a vertical HD video of your card, with music, sized for WhatsApp Status.</p></li>
<li><h3>Show it in person</h3><p>At a meeting or a trade show, flip your card and let them scan.</p></li>
</ul>`],
      ["Pick a style", "STYLES"],
      ["What it costs", PLANS],
    ],
    faq: [
      ["Does someone need my number saved to message me?", "No. Scanning the code opens a WhatsApp chat with you straight away. They can save your contact afterwards from your card."],
      ["Can I use a WhatsApp Business number?", "Yes. The QR code carries your number, so it works with WhatsApp and WhatsApp Business alike."],
      ["Can my card show both WhatsApp and WeChat?", "Each card shows one messenger. Pick the one your clients use; you can switch any time."],
      ["Is it free?", "Designing your card, QR code included, is free. Your live card link and video exports come with Pro ($9.90 a year) or a share pack ($2.99)."],
    ],
  },
  {
    slug: "wechat-business-card",
    nav: "WeChat",
    name: "WeChat business card",
    title: "WeChat Business Card with Your WeChat QR Code | Super Namecard",
    desc: "A digital business card that carries your WeChat QR code, with your name in English, Chinese or both. Share it as a link, show it in person, or post a video.",
    h1: "WeChat business card with your WeChat QR code",
    lead: "Working with clients or suppliers in China? Put your WeChat QR code on a 3D digital business card, next to your name, company, phone and email. People scan it in WeChat to add you, and anyone else can still save your contact in one tap.",
    shots: [["ink", "front", "Ink-wash business card for a tea master with a Chinese and English name"], ["blueprint", "front", "Blueprint-style business card for a structural engineer with a bilingual name"]],
    sections: [
      ["Add your WeChat QR code", `<div class="prose"><ol>
<li>In WeChat, open <b>Me</b>, tap your name, then <b>My QR Code</b>, and save the image.</li>
<li>In the card editor, choose WeChat and upload that image. It goes on the back of your card.</li>
<li>Add your WeChat ID too if you like, so people can search for you.</li>
</ol></div>`],
      ["Your name in two languages", `<div class="prose"><p>Card text can be in English, Chinese or both, and the styles carry Chinese fonts. Ink and Blueprint are designed with bilingual names in mind, like 苏清和 · Su Qinghe or 王建国 · James Wang.</p></div>`],
      ["Who it's for", `<ul class="feats">
<li><h3>Trade fairs</h3><p>Buyers and sourcing teams meeting Chinese suppliers, where WeChat is how follow-ups happen.</p></li>
<li><h3>Chinese businesses abroad</h3><p>Shops, restaurants and agencies whose customers use WeChat as well as email.</p></li>
<li><h3>Anyone between two worlds</h3><p>One card for contacts who live on WeChat and those who don't.</p></li>
</ul>`],
      ["Pick a style", "STYLES"],
      ["What it costs", PLANS],
    ],
    faq: [
      ["Why not just share my WeChat QR code?", "A bare QR code says nothing about you. Your card shows it next to your name, title, company and other contacts, and people who don't use WeChat can still reach you."],
      ["Do people need WeChat to see my card?", "No. Your card opens in any browser. They only need WeChat to scan your QR code and add you."],
      ["Can my card show both WeChat and WhatsApp?", "Each card shows one messenger. Pick the one your clients use; you can switch any time."],
      ["Can I write my card in Chinese?", "Yes. Any field can be in Chinese, English or both."],
    ],
  },
  {
    slug: "qr-code-business-card",
    nav: "QR code",
    name: "QR code business card",
    title: "QR Code Business Card, Free to Design | Super Namecard",
    desc: "A digital business card with a QR code on the back. One scan opens a WhatsApp chat or adds you on WeChat, and your card page saves your contact as a vCard.",
    h1: "QR code business card",
    lead: "Your card has a QR code on its back. Hold up your phone, flip the card, and people scan it to message you. From your card page they can also save your details straight to their contacts.",
    shots: [["terminal", "front", "Amber terminal-style business card for an AI engineer"], ["terminal", "back", "Back of the terminal-style card with a QR code and contact details as a vCard"]],
    sections: [
      ["What the QR code does", `<ul class="feats">
<li><h3>WhatsApp</h3><p>The code is made from your number and opens a chat with you.</p></li>
<li><h3>WeChat</h3><p>Upload the QR code from your WeChat profile; scanning it adds you.</p></li>
<li><h3>Your own</h3><p>Already have a QR code you like? Upload the image and it goes on your card.</p></li>
</ul>`],
      ["Save contact in one tap", `<div class="prose"><p>Every card page has a <b>Save contact</b> button. It hands the visitor's phone a contact card (a vCard) with your name, job title, company, phone and email, so nobody has to type you in by hand.</p></div>`],
      ["Three ways to share", `<div class="prose"><ul>
<li><b>In person:</b> flip your card and let them scan the QR code.</li>
<li><b>By link:</b> with Pro your card lives at yourname.1name.cards. Send it by message, email or in your social bio.</li>
<li><b>On social:</b> post an HD video or GIF of your card turning and flipping.</li>
</ul></div>`],
      ["Pick a style", "STYLES"],
      ["What it costs", PLANS],
    ],
    faq: [
      ["Do people need a QR scanner app?", "No. The camera app on iPhone and Android phones reads QR codes."],
      ["What does my QR code open?", "With WhatsApp, a chat with you. With WeChat, your WeChat profile so they can add you. If you upload your own code, wherever that code points."],
      ["Can I change the QR code later?", "Yes. Change your number or upload a new image and your card updates."],
      ["Is a QR code business card free?", "Designing your card, QR code included, is free. Your live card link and video exports come with Pro ($9.90 a year) or a share pack ($2.99)."],
    ],
  },
  {
    slug: "animated-business-card",
    nav: "3D & video",
    name: "3D animated business card",
    title: "3D Animated Business Card with Video Export | Super Namecard",
    desc: "A business card that tilts, flips and turns sideways. Nine 3D styles with music, plus HD video, GIF and image exports for Instagram, TikTok and WhatsApp.",
    h1: "3D animated business card, with video for social media",
    lead: "Most digital business cards are a web page with a photo. Yours behaves like a card: light follows the tilt of the phone, a swipe flips it over, and turning the phone shows it in landscape. Every style has its own entrance and its own music.",
    shots: [["holo", "front", "Holographic foil business card for a lifestyle creator"], ["aurora", "front", "Northern-lights business card for a licensed therapist"]],
    sections: [
      ["Nine styles, each with its own motion", "STYLES"],
      ["Video, GIF and images of your card", `<div class="prose"><p>Export a vertical HD video (1080 × 1920) of your card turning and flipping, with its style's music. You also get a GIF of the flip and JPG images of the front, the back and the landscape view.</p>
<p>Pro includes up to 20 exports a day. If you only need one, a share pack gives you a single HD export for $2.99.</p></div>`],
      ["Where to post it", `<ul class="feats">
<li><h3>Instagram and TikTok</h3><p>Vertical video for Reels, Stories and TikTok.</p></li>
<li><h3>WhatsApp Status</h3><p>A quick way to show every contact your new card.</p></li>
<li><h3>Email and chat</h3><p>Use the GIF where video won't play.</p></li>
</ul>`],
      ["What it costs", PLANS],
    ],
    faq: [
      ["How long is the video?", "About 15 seconds: your card's entrance, a flip to the back and back again, and a turn to landscape."],
      ["Can I export my own card, not a sample?", "Yes. Exports use your own card, with your name, photo and QR code."],
      ["Is there sound?", "Each style has its own music. On your card page, visitors turn it on or off with the sound button; the video export includes it."],
      ["Do I need design skills?", "No. Pick a style and type your details; the layout, motion and music come with the style."],
    ],
  },
];

// Pages by profession. Each one leads with the style made for that work; the rest of the page is
// built from the same parts as the pages above (styles grid, prices, questions).
const FREE_Q = ["Is it free?", "Designing your card is free in all nine styles. Your live card link and video exports come with Pro ($9.90 a year) or a one-off share pack ($2.99)."];
const INDUSTRIES = [
  {
    slug: "digital-business-card-for-lawyers", short: "Lawyers", style: "noir",
    title: "Digital Business Card for Lawyers | Super Namecard",
    desc: "A digital business card for lawyers: black metal and gold, your practice area up front, and one tap for clients to save your contact or message you.",
    h1: "Digital business card for lawyers",
    lead: "Noir is made for law, finance and any firm where first impressions are formal. Black brushed metal, gold foil lettering and a back like a black charge card. Clients save your contact in one tap, and you never run out of cards at a closing.",
    alts: ["Black and gold digital business card for a corporate lawyer", "Back of the black and gold lawyer's card with a signature panel and QR code"],
    whyH: "Why Noir suits a law practice",
    why: `<p>Noir looks like the cards the best firms print on heavy stock: a brushed black face, your name in gold serif type and the firm's name in spaced capitals. As the card opens, its gold lines catch the light as if freshly engraved, and as the client tilts their phone the light moves across the metal.</p>
<p>The back carries a magnetic stripe, a signature panel with your name and your QR code, so it reads like a premium charge card rather than a web page. Add your photo and it sits on the front beside your name.</p>`,
    fields: ["<b>Tagline:</b> your position, such as Managing Partner", "<b>Job title:</b> your practice area, such as Corporate Law · M&amp;A", "<b>Company:</b> the firm's name", "<b>Phone and email:</b> your direct line, not the switchboard", "<b>WhatsApp or WeChat:</b> for clients who would rather message than email"],
    uses: [["After a first meeting", "Share your card so the client leaves with your direct line and email in their phone."], ["Conferences and bar events", "No stack of paper cards to carry. Flip the card and let them scan."], ["Clients abroad", "Many international clients prefer WhatsApp or WeChat to email. Your card carries the one they use."]],
    faq: [["Does it look serious enough for a law firm?", "Noir was designed for exactly that: black metal, gold type, no bright colours. For a cleaner, modern look, choose Swiss."],
      ["Can everyone at my firm have one?", "Each person makes their own card with their own account and email. There is no team plan yet."],
      ["Where do credentials go?", "Use the tagline under your name and the job title line, for example your position and practice area."]],
  },
  {
    slug: "digital-business-card-for-real-estate-agents", short: "Real estate agents", style: "noir", shots: [["noir", "front"], ["swiss", "front"]],
    title: "Digital Business Card for Real Estate Agents | Super Namecard",
    desc: "A digital business card for real estate agents and brokers. Buyers scan to message you on WhatsApp, save your contact in one tap, and see your card on social.",
    h1: "Digital business card for real estate agents",
    lead: "Agents hand out more cards than almost anyone: at open houses, on viewings and at every follow-up. A digital card never runs out, and buyers can message you on WhatsApp straight from its QR code.",
    alts: ["Black and gold digital business card, a premium look for luxury real estate", "Swiss-style digital business card with a clean grid for a modern real estate brand"],
    whyH: "Which style for real estate",
    why: `<p><b>Noir</b> suits luxury listings and premium brokerages: black metal, gold type, a black-card back, and room for your photo so buyers remember your face. <b>Swiss</b> suits modern brands: a clean grid, a bold red disc and big type that reads well on a small screen.</p>
<p>Both carry your WhatsApp or WeChat QR code and a Save contact button, and you can switch between them any time without retyping.</p>`,
    fields: ["<b>Tagline:</b> Licensed agent, or your licence number", "<b>Job title:</b> your area or speciality, such as Downtown condos · First-time buyers", "<b>Company:</b> your brokerage", "<b>Phone and WhatsApp:</b> the number buyers can text", "<b>Photo:</b> in Noir, it sits beside your name"],
    uses: [["Open houses", "Show your card on a phone or tablet at the sign-in table so visitors save you before they leave."], ["After a viewing", "Send your card link. With Pro it opens with a proper preview of your card."], ["Social media", "Post the HD video of your card to Instagram and your WhatsApp Status."]],
    faq: [["Can buyers message me on WhatsApp from the card?", "Yes. The QR code on the back and the WhatsApp button on your card page both open a chat with your number."],
      ["Can I put my licence number on my card?", "Yes. Use the tagline or job title line for it."],
      ["What if I change brokerage?", "Edit the company line and your card link shows the change at once. Nobody is left holding an old card."]],
  },
  {
    slug: "digital-business-card-for-influencers", short: "Influencers and creators", style: "holo",
    title: "Digital Business Card for Influencers | Super Namecard",
    desc: "A holographic digital business card for influencers and creators: your follower count, your brand-deal contact, and a video of your card for your Stories.",
    h1: "Digital business card for influencers and creators",
    lead: "Holo is made for creators: iridescent foil, a follower badge, your photo and your name in big type. Hand it to brands at events, send the link in DMs and post the video of your card to your Stories.",
    alts: ["Holographic digital business card for a lifestyle creator with a follower badge", "Back of the holographic creator card with a QR code sticker"],
    whyH: "Why Holo suits creators",
    why: `<p>Holo is a card printed on holographic foil: soft rainbow colour across the face, your photo or monogram in a tile, a badge for your follower count, and small tags for what you do. The back runs your name as a marquee with your QR code on a foil-rimmed sticker.</p>`,
    fields: ["<b>Badge:</b> your follower count, such as 286K followers", "<b>Tagline:</b> your niche and city, such as Lifestyle creator · LA", "<b>Job title:</b> what you offer, shown as tags: Content · Brand deals · UGC", "<b>Company:</b> your studio or management", "<b>Email:</b> the address for brand deals"],
    uses: [["Brand events", "Brands get your contact in one scan instead of a handle to search for later."], ["Stories and Reels", "Post the HD video of your card, with its music."], ["DMs and email", "Send your card link when a brand asks how to reach you."]],
    faq: [["Can I show my follower count?", "Yes. Holo has a badge field for it, such as 120K followers."],
      ["Is it a link-in-bio page?", "No. It's a contact card: your details, a QR code and one-tap save. Your card link works anywhere a link does, bio included."],
      ["Can I change the badge as I grow?", "Yes. Edit it any time and your card link shows the new number."]],
  },
  {
    slug: "digital-business-card-for-developers", short: "Developers", style: "terminal",
    title: "Digital Business Card for Developers | Super Namecard",
    desc: "A terminal-style digital business card for developers and AI engineers: your name types itself on an amber screen and your contact prints as a vCard.",
    h1: "Digital business card for developers",
    lead: "Terminal looks like an amber CRT. Your name is typed in as the card opens, your role prints as the output of a command, and the back shows your contact as a vCard. Engineers get it at a glance.",
    alts: ["Amber terminal-style digital business card for an AI engineer", "Back of the terminal card with a QR code and contact details printed as a vCard"],
    whyH: "Why Terminal suits developers",
    why: `<p>The front reads like a shell session: <code>$ whoami</code> and your name typed key by key, then your role and company as command output, then your phone and email. The back draws your QR code as if from a <code>qrencode</code> command and prints your details as <code>contact.vcf</code>.</p>
<p>Underneath it's a real business card. Save contact gives people a proper vCard, and the QR code opens a WhatsApp chat or adds you on WeChat.</p>`,
    fields: ["<b>Tagline:</b> a word about you, such as Builder", "<b>Job title:</b> your role, such as AI Engineer · LLM Agents", "<b>Company:</b> your company, or Independent", "<b>Email:</b> the one you answer", "<b>WhatsApp or WeChat:</b> for quick messages"],
    uses: [["Meetups and hackathons", "Flip and scan instead of spelling out your handle."], ["Hiring and being hired", "Save contact puts your details in a recruiter's phone, not a pile of paper."], ["Your own link", "With Pro your card lives at yourname.1name.cards."]],
    faq: [["Can I add my GitHub?", "There's no separate field for it yet. Many people put a handle in the tagline line."],
      ["Is the terminal text real?", "It's part of the design: the commands are the style, filled in with your own details."],
      ["Does it work in light mode?", "The card has its own look in every browser: an amber screen on black."]],
  },
  {
    slug: "digital-business-card-for-architects", short: "Architects and designers", style: "swiss",
    title: "Digital Business Card for Architects | Super Namecard",
    desc: "A Swiss-style digital business card for architects and designers: a clean grid, a red disc and bold type. Share it as a link or QR code, or post it as a video.",
    h1: "Digital business card for architects and designers",
    lead: "Swiss follows the international typographic style: a strict grid, a red disc, big sans-serif type and labels set like a drawing's title block. It shows you care about detail before anyone reads a word.",
    alts: ["Swiss-style digital business card for an architect with a red disc and grid", "Back of the Swiss-style card with a QR code on the grid"],
    whyH: "Why Swiss suits architecture and design",
    why: `<p>The front sets your name large on a white field beside a red disc, with your role, studio, phone and messenger in labelled cells along the grid. The back keeps the grid: the red disc, your QR code and a label pointing to it.</p>
<p>Turn the phone and the layout reflows to landscape, each element sliding to its new place on the grid.</p>`,
    fields: ["<b>Industry label:</b> shown in the corner, such as Architecture", "<b>Job title:</b> your role, such as Principal Architect", "<b>Company:</b> your studio", "<b>Phone and email</b>", "<b>WhatsApp or WeChat:</b> for clients and contractors"],
    uses: [["Client presentations", "End the meeting with a card that matches the care in your drawings."], ["Competitions and exhibitions", "Visitors scan your card at the stand instead of taking a leaflet."], ["With your portfolio", "Send your card link next to your portfolio."]],
    faq: [["Is Swiss only for architects?", "No. Designers, studios, agencies and anyone who likes a clean look use it."],
      ["Can I change the colours?", "Each style has its own fixed design. You choose the style and fill in your details."],
      ["What does the corner label say?", "Whatever you type in the Industry field, such as Architecture or Interior design."]],
  },
  {
    slug: "digital-business-card-for-restaurants", short: "Restaurants and shops", style: "pop",
    title: "Digital Business Card for Restaurants | Super Namecard",
    desc: "A comic-book digital business card for restaurants, cafés and shops. Customers scan to message you on WhatsApp, and you post a video of your card to social.",
    h1: "Digital business card for restaurants, cafés and shops",
    lead: "Pop is loud on purpose: comic-book colour, sticker letters that tumble in and land in a pile, and a SCAN ME burst on the back. It's made for burger joints, bubble-tea shops, food trucks and any brand that's fun.",
    alts: ["Comic-book digital business card for a burger restaurant", "Back of the comic-book card with a SCAN ME burst and QR code"],
    whyH: "Why Pop suits food and retail",
    why: `<p>When the card opens, the letters of your name drop in like stickers and stack up with real physics. A greeting bubble sits beside them, and the back is a comic panel with your QR code and a CALL ME! burst. Your photo or logo goes in the round badge.</p>`,
    fields: ["<b>Name:</b> your brand, such as FATTY", "<b>Greeting:</b> a line in a speech bubble, such as Hungry? Burgers on me!", "<b>Tagline:</b> who you are, such as Burger boss", "<b>Company:</b> your shop and where, such as Fatty's Burgers · 3 stores", "<b>Phone and WhatsApp:</b> for bookings and catering"],
    uses: [["At the counter", "Show the QR code at the till so regulars can message you."], ["Catering and events", "Planners save your contact in one tap."], ["Social media", "Post the video of your card, with its music, to Instagram and TikTok."]],
    faq: [["Can customers order through the card?", "The card opens a WhatsApp chat or adds you on WeChat; orders and bookings happen there. It isn't an ordering system."],
      ["Can I use my brand name instead of my own?", "Yes. The name line can be your brand, like FATTY on the sample card."],
      ["Can I put my logo on it?", "Upload your logo as the photo and it goes in the round badge."]],
  },
  {
    slug: "chinese-business-card", short: "Bilingual Chinese card", style: "ink",
    title: "Chinese Business Card: Bilingual & Digital | Super Namecard",
    desc: "A bilingual Chinese and English digital business card in ink-wash style, with your WeChat QR code. Made for doing business in China and with Chinese clients.",
    h1: "Bilingual Chinese business card",
    lead: "Doing business in China, or with Chinese clients abroad? Ink sets your Chinese name in brush-style characters down the card, with your English name, a red seal and your WeChat QR code. Your contacts can read both.",
    alts: ["Ink-wash digital business card with a Chinese name in brush characters and a red seal", "Back of the ink-wash card with a QR code and details in vertical lines"],
    whyH: "Why a bilingual card matters",
    why: `<p>In China a business card is often handed over with both hands and read with care, and a card in Chinese shows respect to the person receiving it. A digital card adds what paper can't: the WeChat QR code most Chinese contacts will use to follow up.</p>
<p>Ink is rice paper, a brush-written name in a vertical column, a red seal and a crane in the mist. The back shows far hills under the moon with your details in vertical lines. On an English-only card, Latin names stand upright in the column, so nothing lies on its side.</p>`,
    fields: ["<b>Name:</b> your Chinese name, such as 苏清和", "<b>Tagline:</b> your English name and role, such as Su Qinghe · Tea master", "<b>Job title and company:</b> in Chinese, English or both", "<b>WeChat QR code:</b> from your WeChat profile", "<b>Phone and email</b>"],
    uses: [["Trade fairs", "Suppliers add you on WeChat from the back of your card."], ["Visiting China", "Send your card before you arrive so hosts know your name and title in Chinese."], ["Chinese businesses abroad", "Tea houses, restaurants and studios with Chinese-speaking customers."]],
    faq: [["Do I need a Chinese name?", "No, but one chosen with a native speaker helps. Ink works for English-only cards too."],
      ["Which other styles work in Chinese?", "Every style can carry Chinese text. Blueprint is also laid out for a name in two languages."],
      ["WeChat or WhatsApp?", "For contacts in mainland China, WeChat. Each card shows one messenger, and you can switch any time."]],
  },
  {
    slug: "digital-business-card-for-therapists", short: "Therapists and wellness", style: "aurora",
    title: "Digital Business Card for Therapists | Super Namecard",
    desc: "A calm digital business card for therapists, coaches, beauty and yoga professionals: soft northern lights, your photo, and one tap for clients to message you.",
    h1: "Digital business card for therapists, coaches and wellness",
    lead: "Aurora is soft light moving under frosted glass, with your photo in a glowing ring and your name in a light script. It feels calm before a client reads a word, which suits therapy, coaching, beauty and yoga.",
    alts: ["Northern-lights digital business card for a licensed therapist", "Back of the northern-lights card with a QR code in a glass orb"],
    whyH: "Why Aurora suits wellness work",
    why: `<p>The front is frosted glass over slowly moving colour, with your photo or initials in a ring and your specialities below your name. The back puts your QR code in a glass orb with a ring of text turning around it.</p>`,
    fields: ["<b>Tagline:</b> your credential and city, such as Licensed therapist · NYC", "<b>Job title:</b> your specialities, such as Emotional healing · Couples", "<b>Company:</b> your practice or studio", "<b>Photo:</b> clients like to see who they'll meet", "<b>Phone and WhatsApp:</b> for appointments"],
    uses: [["First sessions", "Clients leave with your contact saved, not a card in a coat pocket."], ["Workshops and retreats", "Everyone scans your card at once from the front of the room."], ["Referrals", "Other practitioners pass your card link on."]],
    faq: [["Is my card public?", "Only people with your link or QR code see it, and card pages are kept out of search engines."],
      ["Can clients book through the card?", "They message or call you from it. It isn't a booking system."],
      ["Is Aurora only for therapists?", "No. Coaches, beauty salons, yoga teachers and spas use it too."]],
  },
  {
    slug: "digital-business-card-for-engineers", short: "Engineers and construction", style: "blueprint",
    title: "Digital Business Card for Engineers | Super Namecard",
    desc: "A blueprint digital business card for engineers and construction firms: a 3D tower that builds itself, drawing-sheet details and your QR code on the back.",
    h1: "Digital business card for engineers and construction",
    lead: "Blueprint is an engineering drawing come to life: white lines on blue, a 3D tower that builds itself as the card opens and then slowly turns, and your details in a title block. Engineers and builders read it instantly.",
    alts: ["Blueprint digital business card for a structural engineer with a 3D tower", "Back of the blueprint card laid out as a detail sheet with a QR code"],
    whyH: "Why Blueprint suits engineering",
    why: `<p>The front has a rotating 3D tower in line work, dimension marks, and a title block with your role, drawing number, phone and company. The back is a detail sheet: your QR code with a scan callout and your contact listed as numbered notes.</p>`,
    fields: ["<b>Name:</b> in one or two languages, such as James Wang with 王建国 in the tagline", "<b>Job title:</b> your discipline, such as Structural Engineer", "<b>Company:</b> your firm", "<b>Card number:</b> shown as the drawing number", "<b>Phone, WhatsApp and email</b>"],
    uses: [["Site visits", "Contractors and clients save you on the spot, gloves and all."], ["Bids and tenders", "Send your card link with your proposal."], ["Industry fairs", "Visitors scan your card at the stand."]],
    faq: [["Is Blueprint only for engineers?", "No. Architects, contractors, surveyors and manufacturers use it too."],
      ["Can I add a second language?", "Yes. Put your name in the other language in the tagline, as on the sample card."],
      ["What is the drawing number?", "The Card number field. Use it for anything, or leave it as it is."]],
  },
  {
    slug: "digital-business-card-for-doctors", short: "Doctors, pharma and biotech", style: "helix",
    title: "Digital Business Card for Doctors & Pharma | Super Namecard",
    desc: "A clean clinical digital business card for doctors, pharma and biotech professionals: a DNA helix that unzips, your credentials, and a back like a facts label.",
    h1: "Digital business card for doctors, pharma and biotech",
    lead: "Helix is clinical white with a DNA strand that unzips as the card opens and a capsule floating beside your name. The back sets out your contact like a drug facts label. Precise, a little playful and unmistakably health science.",
    alts: ["Clinical digital business card with a DNA helix for a pharmacology PhD", "Back of the clinical card laid out like a Contact Facts label"],
    whyH: "Why Helix suits health science",
    why: `<p>The front puts your credentials and role under your name, with your organisation above and a DNA strand down the side. The back is a Contact Facts label: your name, your role, what you do, how to reach you, and your QR code.</p>`,
    fields: ["<b>Name:</b> with your title, such as Dr. Emma Zhang", "<b>Tagline:</b> your credentials, such as PhD · Clinical Pharmacology", "<b>Job title:</b> your role, such as Regulatory Affairs · APAC", "<b>Company:</b> your hospital, practice or company", "<b>Phone, WhatsApp and email</b>"],
    uses: [["Congresses and conferences", "One scan instead of a card lost in a pile."], ["Medical reps and liaisons", "Every contact gets your details in their phone after a visit."], ["Research collaborations", "Send your card link to new partners."]],
    faq: [["Is it suitable for a medical practice?", "Yes. It's a contact card: your name, role and how to reach you."],
      ["Can I list several credentials?", "Use the tagline line, for example MD · PhD · Cardiology."],
      ["Can I add my photo?", "Yes. In Helix it appears on the front beside your name."]],
  },
];
const INDUSTRY_PAGES = INDUSTRIES.map((o) => {
  const sh = o.shots || [[o.style, "front"], [o.style, "back"]];
  return {
    slug: o.slug, name: o.short === "Bilingual Chinese card" ? "Chinese business card" : `Business card for ${o.short.toLowerCase()}`,
    short: o.short, title: o.title, desc: o.desc, h1: o.h1, lead: o.lead, style: o.style,
    shots: sh.map(([id, side], i) => [id, side, o.alts[i]]),
    sections: [
      [o.whyH, `<div class="prose">${o.why}</div>`],
      ["What to put on your card", `<div class="prose"><ul>${o.fields.map((f) => `<li>${f}</li>`).join("")}</ul><p>Your card updates as you type, and you can change any of it later.</p></div>`],
      ["How people use it", `<ul class="feats">${o.uses.map(([h, t]) => `<li><h3>${h}</h3><p>${t}</p></li>`).join("")}</ul>`],
      ["All nine styles", "STYLES"],
      ["What it costs", PLANS],
    ],
    faq: [...o.faq, FREE_Q],
  };
});
const ALL = [...PAGES, ...INDUSTRY_PAGES];

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const privacy = readFileSync(path.join(ROOT, "privacy", "index.html"), "utf8");
const ga = privacy.slice(privacy.indexOf("<!-- Google Analytics"), privacy.indexOf("</script>", privacy.indexOf("<!-- Google Analytics")) + 9);
if (!ga.includes("gtag(")) throw new Error("GA snippet not found in privacy/index.html");

const stylesGrid = `<ul class="styles">${STYLES.map(([id, name, fit]) =>
  `<li><a href="/?style=${id}"><img src="/assets/styles/${id}-front.webp" width="540" height="960" loading="lazy" alt="${name} style digital business card">` +
  `<b>${name}</b>${fit}</a></li>`).join("")}</ul>`;

function page(p) {
  const url = `${SITE}/${p.slug}/`;
  const ld = {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "BreadcrumbList", itemListElement: [
        { "@type": "ListItem", position: 1, name: "Super Namecard", item: `${SITE}/` },
        { "@type": "ListItem", position: 2, name: p.name, item: url }] },
      { "@type": "WebPage", "@id": url, url, name: p.title, description: p.desc, inLanguage: "en", dateModified: UPDATED,
        isPartOf: { "@id": `${SITE}/#site` }, primaryImageOfPage: `${SITE}/assets/styles/${p.shots[0][0]}-${p.shots[0][1]}.webp` },
      { "@type": "FAQPage", mainEntity: p.faq.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) },
    ],
  };
  const nav = PAGES.map((o) => `<a href="/${o.slug}/"${o.slug === p.slug ? ' aria-current="page"' : ""}>${o.nav}</a>`).join("");
  const shots = p.shots.map(([id, side, alt], i) =>
    `<img src="/assets/styles/${id}-${side}.webp" width="540" height="960" alt="${esc(alt)}"${i ? ' loading="lazy"' : ' fetchpriority="high"'}>`).join("");
  const sections = p.sections.map(([h, body]) => `<section><h2>${h}</h2>${body === "STYLES" ? stylesGrid : body}</section>`).join("\n");
  const faq = p.faq.map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join("\n");
  const card = (o) => `<li><a href="/${o.slug}/">${o.name}<span>${esc(o.desc.split(/[.:] /)[0])}.</span></a></li>`;
  const more = `<ul class="more">${PAGES.filter((o) => o.slug !== p.slug).map(card).join("")}</ul>
<h3 class="by">By profession</h3><ul class="pros">${INDUSTRY_PAGES.filter((o) => o.slug !== p.slug).map((o) => `<li><a href="/${o.slug}/">${o.short}</a></li>`).join("")}</ul>`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
${ga}
<title>${esc(p.title)}</title>
<meta name="description" content="${esc(p.desc)}">
<link rel="canonical" href="${url}">
<meta name="robots" content="max-image-preview:large">
<meta name="theme-color" content="#0b0b0e">
<link rel="icon" href="/favicon.ico" sizes="48x48">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Super Namecard">
<meta property="og:title" content="${esc(p.title)}">
<meta property="og:description" content="${esc(p.desc)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${SITE}/assets/og.jpg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(p.title)}">
<meta name="twitter:description" content="${esc(p.desc)}">
<meta name="twitter:image" content="${SITE}/assets/og.jpg">
<script type="application/ld+json">${JSON.stringify(ld)}</script>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400;700;800&display=swap">
<link rel="stylesheet" href="/css/guide.css">
</head>
<body>
<!-- Built by tools/build-guides.mjs: edit the copy there, not here. -->
<div class="wrap">
<header class="top"><a class="brand" href="/">Super Namecard</a>${nav}<a href="/#pricing">Pricing</a></header>
<p class="crumbs"><a href="/">Home</a> › ${esc(p.name)}</p>
<main>
<div class="hero">
  <div>
    <h1>${esc(p.h1)}</h1>
    <p class="lead">${esc(p.lead)}</p>
    <div class="cta"><a class="btn main" href="/#make">Make your card free</a><a class="btn alt" href="/">See the 3D cards</a></div>
    <p class="note">Free to design · No app needed · Works on any phone</p>
  </div>
  <div class="shots">${shots}</div>
</div>
${sections}
<section><h2>Questions</h2>
${faq}
</section>
<section><h2>More about Super Namecard</h2>${more}</section>
</main>
<footer><span>© 2026 Super Namecard · 1name.cards</span><a href="/terms/">Terms</a><a href="/privacy/">Privacy</a><a href="/refund/">Refunds</a><a href="mailto:support@1name.cards">support@1name.cards</a></footer>
</div>
</body>
</html>
`;
}

for (const p of ALL) {
  mkdirSync(path.join(ROOT, p.slug), { recursive: true });
  writeFileSync(path.join(ROOT, p.slug, "index.html"), page(p));
  console.log(`cards/${p.slug}/index.html`);
}

// Keep the generated parts of the sitemap and the home page's About panel in step with the pages.
function splice(file, start, end, body) {
  const f = path.join(ROOT, file), s = readFileSync(f, "utf8");
  const a = s.indexOf(start), b = s.indexOf(end);
  if (a < 0 || b < a) throw new Error(`markers ${start} … ${end} missing in ${file}`);
  writeFileSync(f, s.slice(0, a + start.length) + body + s.slice(b));
}
splice("sitemap.xml", "<!-- guides -->\n", "  <!-- /guides -->", ALL.map((p) =>
  `  <url><loc>${SITE}/${p.slug}/</loc><lastmod>${UPDATED}</lastmod><changefreq>monthly</changefreq><priority>${p.style ? "0.7" : "0.8"}</priority></url>\n`).join(""));
splice("index.html", "<!-- guides -->\n", "  <!-- /guides -->", `  <h2>Guides</h2>
  <ul class="about-guides">
${PAGES.map((p) => `    <li><a href="/${p.slug}/">${esc(p.h1.replace(/,.*$/, ""))}</a></li>`).join("\n")}
  </ul>
  <h3>By profession</h3>
  <ul class="about-guides">
${INDUSTRY_PAGES.map((p) => `    <li><a href="/${p.slug}/">${esc(p.name)}</a></li>`).join("\n")}
  </ul>
`);
console.log("sitemap.xml and index.html guides updated");
