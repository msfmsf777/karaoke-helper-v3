const https = require('https');
const options = {
    hostname: 'music.youtube.com',
    path: '/search?q=taylor+swift+blank+space',
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
};
https.get(options, res => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        const match = data.match(/ytInitialData = (.*?);<\/script>/);
        if (match) {
            require('fs').writeFileSync('ytm_data.json', match[1]);
            console.log('Found standard ytInitialData');
        } else {
            console.log('Not found in YT Music');
        }
    });
});
