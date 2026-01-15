module.exports = {
    apps: [{
        name: "pantallas-retorcedoras",
        script: "./server.js",
        watch: false,
        autorestart: true,
        max_memory_restart: '500M',
        env: {
            NODE_ENV: "production",
            PORT: 4020
        }
    }]
}
