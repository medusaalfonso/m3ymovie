🎬 Private Streaming Library (Movies & Series)

A private Arabic streaming website for movies and series, protected by one-time access codes delivered via a Telegram bot.
Users must request a code from the bot, then log in to access the full library.

✨ Features

🔐 Secure login with one-time codes

🤖 Telegram bot integration (/code)

👥 Channel membership check (only members can get codes)

🎞️ Movies & Series support

📺 Series episodes grouped automatically

🖼️ Posters for movies & series

🧭 Genres for series with filters

🌙 Modern Arabic dark UI

⚡ Fast playback (HLS / m3u8)

☁️ Serverless backend (Netlify Functions)

🏗️ Tech Stack

Frontend:
HTML, CSS, Vanilla JavaScript (Arabic RTL)

Backend:
Netlify Functions (Node.js)

Auth & Codes:
Upstash Redis

Bot:
Telegram Bot API

Hosting:
Netlify

Streaming:
External HLS (m3u8)

📁 Project Structure

/
public/
index.html - Login page
browse.html - Movies & series library
watch.html - Video player

functions/
telegram-webhook.js - Telegram bot webhook
redeem.js - Redeem login code
me.js - Session check
catalog.js - Movies & series catalog
stream.js - Get HLS stream by ID
_lib.js - Shared helpers

functions/data/
catalog.txt - Movies list
series.txt - Series & episodes

netlify.toml
README.md

🗂️ Data Files Format
Movies (functions/data/catalog.txt)

Movie Title | HLS_URL | IMAGE_URL

Example:
غضب الوالدين | https://example.com/movie.m3u8
 | https://example.com/poster.webp

Series (functions/data/series.txt)

Series Name | Episode 01 | HLS_URL | SERIES_IMAGE_URL | Genre

Example:
القضية 460 | Episode 17 | https://example.com/ep17.m3u8
 | https://example.com/poster.jpg
 | دراما

Note:
The image and genre can repeat per episode line.
The system automatically keeps them at the series level only.

🤖 Telegram Bot Flow

User opens the bot

User sends /code

Bot checks that the user is a member of the required channel

Bot generates a one-time access code

User copies the code and pastes it on the website

The code is valid for a limited time and can be used only once

🔐 Channel Membership Protection

The bot verifies that the user is a member of a specific Telegram channel before giving a code.

Requirements:

The bot must be added to the channel

The bot should be Admin

The channel can be public (@channel) or private (-100xxxxxxxxxx)

⚙️ Environment Variables (Netlify)

Add these in Netlify → Site settings → Environment variables

TELEGRAM_BOT_TOKEN=xxxxxxxx
TELEGRAM_WEBHOOK_SECRET=xxxxxxxx
REQUIRED_CHANNEL=@YourChannel
CHANNEL_JOIN_URL=https://t.me/YourChannel

SESSION_JWT_SECRET=very_long_random_secret

UPSTASH_REDIS_REST_URL=https://xxxx.upstash.io

UPSTASH_REDIS_REST_TOKEN=xxxx

SITE_URL=https://your-site.netlify.app

🔁 Telegram Webhook Setup

PowerShell example:

Invoke-RestMethod -Method Post
-Uri https://api.telegram.org/botBOT_TOKEN/setWebhook

-ContentType application/json
-Body {
"url": "https://your-site.netlify.app/.netlify/functions/telegram-webhook
",
"secret_token": "WEBHOOK_SECRET"
}

🖥️ Pages Overview

Login Page (/):

Enter one-time code

Button to open Telegram bot

Arabic instructions

Library (/browse.html):

Movies / Series tabs

Posters grid

Search

Series genre filters

Episode modal

Player (/watch.html):

Plays movie or episode

Uses HLS stream

Clean minimal UI

🚀 Deployment Steps

Push the repository to GitHub

Create a Netlify site from the repo

Set publish directory to: public

Set functions directory to: functions

Add environment variables

Deploy

Set Telegram webhook

Done

🔒 Security Notes

Codes are temporary and single-use

Redis automatically expires codes

Sessions are stored in signed cookies

Telegram webhook is protected by a secret token

📌 Future Improvements

Favorites and watchlist

Automatic metadata (TMDb)

Movie genres

Admin dashboard

Watch history

Cloudflare migration

🧠 Disclaimer

This project is intended for private or authorized content only.
You are responsible for ensuring you have the rights to stream any media.

❤️ Credits

MEDUSA  

https://t.me/island_of_epstein
