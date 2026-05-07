import { jsonResponse, textResponse, searchKnowledge } from "../scripts/api-shared.mjs";

export default {
  fetch(request) {
    if (request.method !== "GET") {
      return textResponse("Method not allowed", 405, { allow: "GET" });
    }

    const url = new URL(request.url || "/", "http://localhost");
    const query = url.searchParams.get("q") || "";
    const limit = url.searchParams.get("limit") || "12";

    return jsonResponse(searchKnowledge(query, limit));
  }
};
