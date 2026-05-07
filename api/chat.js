import { callModel, jsonResponse, readJsonBody, textResponse } from "../scripts/api-shared.mjs";

export default {
  async fetch(request) {
    if (request.method !== "POST") {
      return textResponse("Method not allowed", 405, { allow: "POST" });
    }

    try {
      const body = await readJsonBody(request);
      const message = String(body.message || "").trim();
      const sitePassword = process.env.SITE_PASSWORD?.trim();

      if (!message) {
        return jsonResponse({ error: "message is required" }, 400);
      }

      if (sitePassword && body.password !== sitePassword) {
        return jsonResponse({ error: "password required" }, 401);
      }

      const history = Array.isArray(body.history) ? body.history : [];
      return jsonResponse(await callModel(message, history));
    } catch (error) {
      console.error(error);
      return jsonResponse({ error: "internal server error" }, 500);
    }
  }
};
