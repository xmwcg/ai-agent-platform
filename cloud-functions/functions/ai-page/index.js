// ============================================================
// aibak.site AI Page - Serves the Codex-style chat UI
// Reads chat.html from the same directory
// ============================================================

const fs = require("fs");
const path = require("path");

exports.main = async (event, context) => {
  try {
    const htmlPath = path.join(__dirname, "chat.html");
    const html = fs.readFileSync(htmlPath, "utf-8");

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-cache",
      },
      body: html,
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
      body: "Failed to load page: " + error.message,
    };
  }
};
