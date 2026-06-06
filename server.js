const express = require('express');
const axios = require('axios');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const BASE_API_URL = "https://blanchedalmond-dugong-106131.hostingersite.com/channels.php";

// 1. نظام البروكسي وتشغيل القنوات بنفس اللوجيك القديم
app.get('/stream', async (req, res) => {
    const rawUrl = req.query.url;
    if (!rawUrl) return res.status(400).send('Missing URL');

    const url = decodeURIComponent(rawUrl);

    try {
        const response = await axios({
            method: 'get',
            url: url,
            responseType: 'text',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            },
            timeout: 15000
        });

        const contentType = response.headers['content-type'] || '';
        const body = response.data;
        
        // جلب الرابط الفعلي بعد التوجيه إن وجد
        const finalUrl = response.request.res.responseUrl || url;

        if (contentType.includes('mpegurl') || body.startsWith('#EXTM3U')) {
            res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
            
            const baseUrl = finalUrl.substring(0, finalUrl.lastIndexOf('/')) + '/';
            const lines = body.split('\n');
            let output = '';

            lines.forEach(line => {
                const trimmed = line.trim();
                if (trimmed.length === 0 || trimmed.startsWith('#')) {
                    output += trimmed + '\n';
                } else {
                    const segUrl = trimmed.startsWith('http') ? trimmed : baseUrl + trimmed;
                    output += `/stream?url=${encodeURIComponent(segUrl)}\n`;
                }
            });

            res.send(output);
        } else {
            res.setHeader("Content-Type", contentType || "video/mp4");
            res.send(body);
        }

    } catch (error) {
        res.status(500).send('Error fetching stream');
    }
});

// 2. عرض الصفحات والأقسام وجلب البيانات من الـ API الأصلي
app.get('/', async (req, res) => {
    const currentCat = req.query.cat || null;
    const currentSub = req.query.sub || null;
    
    let targetUrl = BASE_API_URL;
    let viewType = "main_categories";

    if (currentSub !== null) {
        targetUrl = `${BASE_API_URL}?cat=${encodeURIComponent(currentSub)}`;
        viewType = "channels";
    } else if (currentCat !== null) {
        targetUrl = `${BASE_API_URL}?cat=${encodeURIComponent(currentCat)}`;
    }

    let apiData = { title: "الباقات الرئيسية", items: [] };
    
    try {
        const apiRes = await axios.get(targetUrl, {
            headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
            timeout: 15000
        });
        apiData = apiRes.data;

        if (currentCat !== null && currentSub === null) {
            if (apiData.items && apiData.items[0] && apiData.items[0].is_stream == true) {
                viewType = "channels";
            } else {
                viewType = "sub_categories";
            }
        }
    } catch (e) {
        apiData.title = "خطأ في الاتصال بالسيرفر";
    }

    const pageTitle = apiData.title || "القنوات المتاحة";
    const items = apiData.items || [];

    // إنشاء كود الـ HTML ديناميكياً بناءً على البيانات اللي رجعت
    let itemsHtml = '';
    if (viewType === 'main_categories') {
        itemsHtml = '<div class="list-vertical">';
        items.forEach(item => {
            itemsHtml += `
                <a href="?cat=${encodeURIComponent(item.id)}" class="item-card">
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <img src="${item.image}" onerror="this.src='https://img.icons8.com/ios-filled/50/ffffff/video-playlist.png'">
                        <span class="title">${item.name}</span>
                    </div>
                    <i class="fas fa-chevron-left" style="color: var(--text-gray); font-size: 14px;"></i>
                </a>`;
        });
        itemsHtml += '</div>';
    } else if (viewType === 'sub_categories') {
        itemsHtml = '<div class="grid-three-columns">';
        items.forEach(item => {
            itemsHtml += `
                <a href="?cat=${encodeURIComponent(currentCat)}&sub=${encodeURIComponent(item.id)}" class="item-card">
                    <img src="${item.image}" onerror="this.src='https://img.icons8.com/ios-filled/100/ffffff/folder-invoices.png'">
                    <span class="title">${item.name}</span>
                </a>`;
        });
        itemsHtml += '</div>';
    } else if (viewType === 'channels') {
        itemsHtml = '<div class="grid-three-columns">';
        items.forEach(item => {
            const streamUrl = item.stream_url || '';
            const cleanName = item.name.replace(/'/g, "\\'");
            const cleanUrl = streamUrl.replace(/'/g, "\\'");
            itemsHtml += `
                <div class="item-card" style="cursor: pointer;" onclick="openFloatingPlayer('${cleanName}', '${cleanUrl}')">
                    <img src="${item.image}" onerror="this.src='https://img.icons8.com/ios-filled/100/ffffff/tv.png'">
                    <span class="title">${item.name}</span>
                </div>`;
        });
        itemsHtml += '</div>';
    }

    // الـ HTML النهائي اللي هيظهر للمستخدم
    res.send(`
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>𝕒𝕓𝕕𝕠 𝕞𝕠𝕦𝕤𝕒</title>
    <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700&family=Cairo:wght@400;700;900&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
    <script src="https://cdn.jsdelivr.net/npm/hls.js@latest"></script>
    <style>
        :root { --bg-dark: #000000; --bg-panel: #0d0d0d; --text-light: #ffffff; --text-gray: #888888; --accent-white: #ffffff; --border-color: #1a1a1a; }
        body { background-color: var(--bg-dark); color: var(--text-light); font-family: 'Cairo', sans-serif; margin: 0; padding: 0; overflow-x: hidden; -webkit-tap-highlight-color: transparent; }
        .main-header { display: flex; flex-direction: column; align-items: center; padding: 20px 15px; background-color: #000; border-bottom: 2px solid #111; position: sticky; top: 0; z-index: 100; gap: 15px; }
        .header-top { display: flex; justify-content: space-between; align-items: center; width: 100%; }
        .main-header .back-btn { color: var(--text-light); text-decoration: none; font-size: 16px; display: flex; align-items: center; gap: 8px; font-weight: bold; }
        .main-header .logo { font-family: 'Cairo'; font-size: 24px; font-weight: 900; color: #dc2626; }
        .nav-buttons { display: flex; gap: 12px; margin-top: 5px; justify-content: center; width: 100%; }
        .nav-btn { background: rgba(255,255,255,0.08); color: #fff; padding: 8px 18px; border-radius: 20px; text-decoration: none; font-size: 14px; font-weight: bold; transition: 0.3s; border: 1px solid rgba(255,255,255,0.1); display: flex; align-items: center; gap: 6px; }
        .nav-btn:hover { background: #dc2626; border-color: transparent; }
        .section-title { text-align: center; margin: 15px 0; font-size: 16px; font-weight: bold; color: var(--text-gray); }
        .container { padding: 0 15px 40px 15px; max-width: 600px; margin: 0 auto; }
        .list-vertical { display: flex; flex-direction: column; gap: 12px; }
        .list-vertical .item-card { background-color: var(--bg-panel); border: 1px solid var(--border-color); border-radius: 12px; display: flex; align-items: center; justify-content: space-between; padding: 12px 20px; text-decoration: none; color: var(--text-light); transition: 0.2s; }
        .list-vertical .item-card:hover { border-color: var(--accent-white); }
        .list-vertical .item-card .title { font-size: 15px; font-weight: 700; }
        .list-vertical .item-card img { width: 40px; height: 40px; border-radius: 50%; object-fit: cover; border: 1px solid #222; }
        .grid-three-columns { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
        .grid-three-columns .item-card { background-color: var(--bg-panel); border: 1px solid var(--border-color); border-radius: 8px; overflow: hidden; text-decoration: none; color: var(--text-light); display: flex; flex-direction: column; align-items: center; text-align: center; padding: 15px 5px; transition: 0.2s; }
        .grid-three-columns .item-card:hover { border-color: var(--accent-white); transform: translateY(-2px); }
        .grid-three-columns .item-card img { width: 100%; aspect-ratio: 1/1; max-width: 65px; object-fit: contain; border-radius: 6px; margin-bottom: 8px; }
        .grid-three-columns .item-card .title { font-size: 12px; font-weight: 600; line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        .player-modal { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.98); z-index: 9999; align-items: center; justify-content: center; padding: 12px; box-sizing: border-box; }
        .player-content { background: var(--bg-panel); border: 1px solid #222; width: 100%; max-width: 600px; border-radius: 14px; overflow: hidden; }
        .player-header { display: flex; justify-content: space-between; align-items: center; padding: 12px 15px; border-bottom: 1px solid #1a1a1a; }
        .player-header h3 { margin: 0; font-size: 14px; font-family: 'Cairo'; }
        .player-header .close-btn { color: #fff; cursor: pointer; font-size: 20px; transition: 0.2s; }
        .player-header .close-btn:hover { color: #ff4444; }
        .video-container { width: 100%; background: #000; aspect-ratio: 16/9; }
        video { width: 100%; height: 100%; object-fit: contain; }
        .server-box { padding: 15px; }
        .server-title { font-size: 13px; margin-bottom: 10px; color: var(--text-gray); text-align: right; }
        .btn-play-now { background: #fff; color: #000; border: none; padding: 12px; width: 100%; border-radius: 6px; font-weight: bold; cursor: pointer; margin-bottom: 10px; font-family: 'Orbitron'; font-size: 14px; }
        .split-btns { display: flex; gap: 10px; }
        .split-btns button { flex: 1; border: 1px solid #333; background: #111; color: #fff; padding: 10px; border-radius: 6px; font-size: 12px; cursor: pointer; font-family: 'Orbitron'; }
    </style>
</head>
<body>

<div class="main-header">
    <div class="header-top">
        ${viewType !== 'main_categories' ? `<a href="javascript:history.back()" class="back-btn"><i class="fas fa-arrow-right"></i> رجوع</a>` : `<div style="width: 50px;"></div>`}
        <div class="logo">𝕒𝕓𝕕ο 𝕞𝕠𝕦𝕤𝕒</div>
        <div style="width: 50px;"></div>
    </div>
    <div class="nav-buttons">
        <a href="http://ab.gt.tc" target="_blank" class="nav-btn"><i class="fas fa-film"></i> الأفلام</a>
        <a href="http://eng.gt.tc" target="_blank" class="nav-btn"><i class="fas fa-video"></i> المسلسلات</a>
    </div>
</div>

<div class="section-title">${pageTitle}</div>

<div class="container">
    ${itemsHtml}
</div>

<div class="player-modal" id="playerModal">
    <div class="player-content">
        <div class="player-header">
            <h3 id="modalChannelName">اسم القناة</h3>
            <i class="fas fa-xmark close-btn" onclick="closeFloatingPlayer()"></i>
        </div>
        <div class="video-container">
            <video id="floatingVideo" controls autoplay playsinline></video>
        </div>
        <div class="server-box">
            <div class="server-title">سيرفر البث المباشر (نظام البروكسي المدمج)</div>
            <button class="btn-play-now" id="btnPlayNow">PLAY NOW</button>
            <div class="split-btns">
                <button id="btnCopyProxy">PROXY LINK</button>
                <button id="btnCopyDirect">DIRECT LINK</button>
            </div>
        </div>
    </div>
</div>

<script>
    const currentDomain = window.location.origin;
    const playerModal = document.getElementById('playerModal');
    const modalChannelName = document.getElementById('modalChannelName');
    const videoTag = document.getElementById('floatingVideo');
    const btnPlayNow = document.getElementById('btnPlayNow');
    const btnCopyProxy = document.getElementById('btnCopyProxy');
    const btnCopyDirect = document.getElementById('btnCopyDirect');
    let hlsPlayer = null;

    function openFloatingPlayer(name, rawStreamUrl) {
        const proxyUrl = currentDomain + '/stream?url=' + encodeURIComponent(rawStreamUrl);
        modalChannelName.innerText = name;
        playerModal.style.display = 'flex';
        
        btnPlayNow.onclick = () => { loadStream(proxyUrl); makeFullscreenAndLandscape(); };
        btnCopyProxy.onclick = function() { copyToClipboard(proxyUrl, this, 'PROXY'); };
        btnCopyDirect.onclick = function() { copyToClipboard(rawStreamUrl, this, 'DIRECT'); };
        
        loadStream(proxyUrl);
        makeFullscreenAndLandscape(); 
    }

    function makeFullscreenAndLandscape() {
        if (videoTag.requestFullscreen) { videoTag.requestFullscreen(); }
        else if (videoTag.webkitRequestFullscreen) { videoTag.webkitRequestFullscreen(); }
        if (screen.orientation && screen.orientation.lock) {
            screen.orientation.lock('landscape').catch(() => {});
        }
    }

    function closeFloatingPlayer() {
        if (document.exitFullscreen) { document.exitFullscreen(); }
        if (hlsPlayer) { hlsPlayer.destroy(); }
        videoTag.pause();
        videoTag.src = "";
        playerModal.style.display = 'none';
    }

    function loadStream(streamUrl) {
        if (!streamUrl || streamUrl.trim() === "" || streamUrl.endsWith('url=')) {
            alert('عذراً، لا يوجد رابط بث مباشر متاح لهذه القناة حالياً.');
            return;
        }
        if (Hls.isSupported()) {
            if (hlsPlayer) { hlsPlayer.destroy(); }
            hlsPlayer = new Hls();
            hlsPlayer.loadSource(streamUrl);
            hlsPlayer.attachMedia(videoTag);
            hlsPlayer.on(Hls.Events.MANIFEST_PARSED, () => videoTag.play());
        } else if (videoTag.canPlayType('application/vnd.apple.mpegurl')) {
            videoTag.src = streamUrl;
            videoTag.play();
        }
    }

    function copyToClipboard(text, element, defaultText) {
        navigator.clipboard.writeText(text);
        element.innerText = 'COPIED!';
        setTimeout(() => { element.innerText = defaultText + ' LINK'; }, 1500);
    }

    window.onclick = function(event) { if (event.target == playerModal) { closeFloatingPlayer(); } }
</script>
</body>
</html>
    `);
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
