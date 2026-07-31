// ============================================================
// aibak.site AI Chat Cloud Function
// Compliant source: cloud function calling @cloudbase/node-sdk
// Supports both HTTP trigger and direct invocation
// ============================================================

const tcb = require("@cloudbase/node-sdk");

const app = tcb.init({
  env: "jymkjtools-study-d6eipek12446b18",
  timeout: 60000,
});

// CORS headers for browser access
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

exports.main = async (event, context) => {
  // Handle CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: CORS_HEADERS, body: "" };
  }

  // Parse input: HTTP trigger puts data in event.body as string
  let inputData = event;
  if (event.httpMethod === "POST" && event.body) {
    try {
      inputData = JSON.parse(event.body);
    } catch (e) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json", ...CORS_HEADERS },
        body: JSON.stringify({ success: false, error: "Invalid JSON body" }),
      };
    }
  }

  const { messages, model = "hy3", stream = false } = inputData;

  // Allowed free text models (Mini Program Growth Plan)
  const ALLOWED_MODELS = ["hy3", "hy3-preview"];
  if (!ALLOWED_MODELS.includes(model)) {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      body: JSON.stringify({
        success: false,
        error: `unsupported model "${model}". allowed: ${ALLOWED_MODELS.join(", ")}`,
      }),
    };
  }

  // Validate input
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      body: JSON.stringify({
        success: false,
        error: "messages is required and must be a non-empty array",
      }),
    };
  }

  const ai = app.ai();
  const aiModel = ai.createModel("cloudbase");

  try {
    if (stream) {
      const res = await aiModel.streamText({
        model: model,
        messages: messages,
      });

      let fullText = "";
      for await (const text of res.textStream) {
        fullText += text;
      }

      const usage = await res.usage;

      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json", ...CORS_HEADERS },
        body: JSON.stringify({
          success: true,
          text: fullText,
          usage: usage,
        }),
      };
    } else {
      const result = await aiModel.generateText({
        model: model,
        messages: messages,
      });

      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json", ...CORS_HEADERS },
        body: JSON.stringify({
          success: true,
          text: result.text,
          usage: result.usage,
        }),
      };
    }
  } catch (error) {
    console.error("AI call failed:", error);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      body: JSON.stringify({
        success: false,
        error: error.message,
        code: error.code || "UNKNOWN",
      }),
    };
  }
};
