const express = require("express");
const path = require("path");
const app = express();
const dist = "G:/项目成品及测试/AIBAK/reasoni-deepseek/ai-agent-platform/client/dist";
app.use(express.static(dist));
app.get("*", (req, res) => { if (!req.path.startsWith("/api")) res.sendFile(path.join(dist, "index.html")); else res.status(404).end(); });
app.listen(3000, () => console.log("Web: http://localhost:3000"));
